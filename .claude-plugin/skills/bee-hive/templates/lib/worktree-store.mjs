// worktree-store.mjs — worktree-feature-parallelism S2: the NEW decision +
// replay logic proven by .bee/spikes/worktree-feature-parallelism/seam-proof.mjs
// (5/5 passed). This module is NOT YET WIRED — nothing in production imports
// it. Git-worktree CLASSIFICATION (ordinary / linked-valid / linked-invalid)
// already lives in production `resolveRoots` and is intentionally NOT
// duplicated here; this module only picks up from a `classification` object
// that the wire-in slice will have `resolveRoots` produce.
//
// Wire-in plan (future slice, not this one): `resolveRoots` starts returning
// `{ kind, id, mainRoot, worktreeRoot }` (same shape `classify()` builds in
// the spike), and the caller does:
//
//   const grants = readGrants(path.join(mainRoot, '.bee'));
//   const decision = decideWorktreeStore(classification, { grants });
//
// Zero deps beyond node: built-ins. Node 18+.

import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// readGrants — load the MAIN store's grant registry.
// ---------------------------------------------------------------------------

/**
 * Reads <mainStoreRoot>/runtime/worktree-grants.json.
 *
 * `mainStoreRoot` is the MAIN checkout's `.bee` directory (never a
 * worktree's own `.bee`) — that asymmetry is the whole security point, see
 * decideWorktreeStore below. Returns `{}` on any missing file, unreadable
 * file, or malformed JSON — this never throws, because a throw here would
 * propagate into a fail-open hook and become a silent allow.
 */
export function readGrants(mainStoreRoot) {
  const grantsFile = path.join(mainStoreRoot, 'runtime', 'worktree-grants.json');
  try {
    const parsed = JSON.parse(fs.readFileSync(grantsFile, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// decideWorktreeStore — the NEW decision layer. PURE: no fs, no throw.
// ---------------------------------------------------------------------------

/**
 * Decides which `.bee` store a write should land in, given a checkout's git
 * CLASSIFICATION (already computed by production `resolveRoots`) and the
 * grants already read from the MAIN store's registry.
 *
 * `classification` shape (what the wire-in slice will feed):
 *   { kind: 'ordinary' | 'linked-valid' | 'linked-invalid',
 *     id?: string, mainRoot?: string, worktreeRoot?: string }
 *
 * `options.grants` is the object returned by `readGrants(mainStoreRoot)` —
 * always read from the MAIN checkout's store. This function takes grants as
 * a plain argument and never reads any filesystem itself: structurally it
 * cannot see a worktree's own `.bee/`, because nothing about `worktreeRoot`
 * is ever used to locate a registry to read. A worktree could write any
 * self-claiming marker it likes inside its own `.bee/runtime/` and this
 * function would never look there — the only trusted grant source is the
 * `grants` object the caller supplies, which the wire-in plan always sources
 * from the main store. This is the security property proven by spike case 4
 * ("self-written grant marker is ignored").
 *
 * Returns one of:
 *   { ok: true,  kind: 'ordinary',              storeRoot }
 *   { ok: false, reason: 'WORKTREE_LINK_INVALID' }
 *   { ok: true,  kind: 'linked-valid-granted',   storeRoot, id }
 *   { ok: true,  kind: 'linked-valid-default',   storeRoot, id }
 *
 * NEVER throws — an invalid/unrecognized classification also collapses to a
 * typed deny rather than an exception, for the same fail-open-hook reason
 * readGrants never throws.
 */
export function decideWorktreeStore(classification, { grants } = {}) {
  try {
    const safeGrants = grants && typeof grants === 'object' ? grants : {};
    const kind = classification && classification.kind;

    if (kind === 'ordinary') {
      // Own store: the checkout's own .bee. worktreeRoot is absent for a
      // true ordinary checkout, so fall back to mainRoot — kept simple and
      // documented per the brief, rather than requiring callers to always
      // populate both fields identically.
      const root = classification.worktreeRoot ?? classification.mainRoot;
      return { ok: true, kind: 'ordinary', storeRoot: path.join(root, '.bee') };
    }

    if (kind === 'linked-invalid') {
      // Typed deny, never a throw: this models a fail-open hook where an
      // uncaught exception would otherwise collapse to a silent allow.
      return { ok: false, reason: 'WORKTREE_LINK_INVALID' };
    }

    if (kind === 'linked-valid') {
      const { id, mainRoot, worktreeRoot } = classification;
      if (safeGrants[id] === true) {
        return {
          ok: true,
          kind: 'linked-valid-granted',
          storeRoot: path.join(worktreeRoot, '.bee'),
          id,
        };
      }
      // Not granted -> P40 default: fall back to the main store.
      return {
        ok: true,
        kind: 'linked-valid-default',
        storeRoot: path.join(mainRoot, '.bee'),
        id,
      };
    }

    // Unrecognized classification kind: fail closed, typed, no throw.
    return { ok: false, reason: 'WORKTREE_LINK_INVALID' };
  } catch {
    return { ok: false, reason: 'WORKTREE_LINK_INVALID' };
  }
}

// ---------------------------------------------------------------------------
// replayLog — pure, deterministic, idempotent projection over an event log.
// ---------------------------------------------------------------------------

/**
 * Sorts `events` by `(ts, id)`, dedups by `id` (last one after the sort
 * wins), and folds the result into a plain object keyed by id. Pure: does
 * not mutate `events`, performs no I/O, and calling it twice with the same
 * input yields byte-identical (JSON.stringify-equal) output.
 */
export function replayLog(events) {
  const sorted = [...events].sort((a, b) => {
    if (a.ts !== b.ts) return a.ts - b.ts;
    return String(a.id).localeCompare(String(b.id));
  });

  const map = new Map();
  for (const ev of sorted) {
    map.set(ev.id, ev); // dedup by id: last wins after the sort above
  }

  const ids = [...map.keys()].sort();
  const state = {};
  for (const id of ids) state[id] = map.get(id);
  return state;
}

// ---------------------------------------------------------------------------
// writeGrant / removeGrant / listGrants — MAIN store grant registry mutators
// (worktree-feature-parallelism Slice A: the wire-in above is read-only —
// nothing before this point could ever put a `true` into the registry.
// These are the write-side companion to readGrants: readGrants itself is
// left completely untouched, still the fail-open, read-only primitive
// resolveRoots depends on).
// ---------------------------------------------------------------------------

function grantsFile(mainStoreRoot) {
  return path.join(mainStoreRoot, 'runtime', 'worktree-grants.json');
}

function writeGrantsFileAtomic(mainStoreRoot, grants) {
  const file = grantsFile(mainStoreRoot);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(grants, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
}

/**
 * Merges `{ [id]: true }` into <mainStoreRoot>/runtime/worktree-grants.json,
 * preserving every other entry already on disk. Creates the runtime/ dir and
 * the grants file if either is missing. Atomic write (tmp file + rename),
 * the same pattern fsutil.mjs's writeJsonAtomic uses (not imported directly,
 * to keep this module's zero-deps-beyond-node-builtins contract intact).
 */
export function writeGrant(mainStoreRoot, id) {
  const next = { ...readGrants(mainStoreRoot), [id]: true };
  writeGrantsFileAtomic(mainStoreRoot, next);
  return next;
}

/**
 * Deletes `id` from the MAIN store's grant registry. A no-op (returns the
 * registry unchanged, no write) when `id` was never present or the file
 * does not exist yet.
 */
export function removeGrant(mainStoreRoot, id) {
  const existing = readGrants(mainStoreRoot);
  if (!(id in existing)) return existing;
  const next = { ...existing };
  delete next[id];
  writeGrantsFileAtomic(mainStoreRoot, next);
  return next;
}

/**
 * Returns the MAIN store's grant registry object. A thin named alias over
 * readGrants for the `bee worktree list` CLI surface — deliberately not a
 * second read implementation.
 */
export function listGrants(mainStoreRoot) {
  return readGrants(mainStoreRoot);
}

// ---------------------------------------------------------------------------
// bootstrapWorktreeStore — set up a newly granted worktree's OWN .bee/ so
// bee actually works there (Slice A: the resolver has honored a granted
// worktree's local store since the wire-in slice, but until this function
// existed nothing ever populated that local store, so a granted worktree
// resolved to a store that was simply empty).
// ---------------------------------------------------------------------------

// Mirrors state.mjs's defaultState() schema/gate shape exactly. NOT imported
// from state.mjs: state.mjs imports readGrants FROM this module, so an
// import the other way would be a cycle. Kept as a literal here on purpose.
const FRESH_STATE_SCHEMA_VERSION = '1.0';

/**
 * Creates <worktreeRoot>/.bee/ if missing, copies onboarding.json and
 * config.json from the MAIN store when present (copy-if-absent, never
 * overwrite — a worktree has no installer of its own to produce them), and
 * writes a FRESH state.json for the worktree: `feature` set, `phase: 'idle'`,
 * every gate false. An independent-feature worktree runs its OWN lifecycle —
 * main's live phase/gates/workers/log are deliberately NOT copied, so a
 * worktree can never inherit a gate approval it never earned locally.
 *
 * Idempotent: if <worktreeRoot>/.bee/state.json already exists, this call
 * does NOT overwrite it — re-running bootstrap must never clobber real
 * in-progress worktree state. onboarding.json/config.json follow the same
 * copy-if-absent rule independently of state.json's presence.
 */
export function bootstrapWorktreeStore(worktreeRoot, mainStoreRoot, feature) {
  const worktreeStoreRoot = path.join(worktreeRoot, '.bee');
  fs.mkdirSync(worktreeStoreRoot, { recursive: true });

  const copyIfAbsent = (name) => {
    const dest = path.join(worktreeStoreRoot, name);
    if (fs.existsSync(dest)) return { copied: false, reason: `${name} already exists` };
    const src = path.join(mainStoreRoot, name);
    if (!fs.existsSync(src)) return { copied: false, reason: `main store has no ${name}` };
    fs.copyFileSync(src, dest);
    return { copied: true };
  };

  const onboarding = copyIfAbsent('onboarding.json');
  const config = copyIfAbsent('config.json');

  const stateFile = path.join(worktreeStoreRoot, 'state.json');
  if (fs.existsSync(stateFile)) {
    return { created: false, reason: 'state.json already exists', worktreeStoreRoot, onboarding, config };
  }

  const freshState = {
    schema_version: FRESH_STATE_SCHEMA_VERSION,
    phase: 'idle',
    feature: feature ?? null,
    mode: null,
    approved_gates: { context: false, shape: false, execution: false, review: false },
    workers: [],
    summary: '',
    next_action: 'Invoke bee-hive.',
  };
  const tmp = `${stateFile}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(freshState, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, stateFile);

  return { created: true, worktreeStoreRoot, onboarding, config, state: freshState };
}
