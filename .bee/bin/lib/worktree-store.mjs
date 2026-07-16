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
