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
import { spawnSync } from 'node:child_process';

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

// ---------------------------------------------------------------------------
// createFeatureWorktree — "bee worktree new --feature <slug>" (GH #21,
// decision D7): create AND register a fresh linked git worktree for an
// independent feature in one move, instead of a human running `git worktree
// add` by hand and then `bee worktree register`. Folds the two into a
// single atomic-as-git-allows step: `git worktree add`, then the EXACT
// writeGrant + bootstrapWorktreeStore sequence `worktree register` already
// performs.
//
// `mainRoot` MUST already be a resolved ORDINARY checkout root — the CLI
// caller proves this the same way `handleWorktreeRegister` proves its own
// worktree link is valid: by calling `resolveRoots(process.cwd())` (see
// bee.mjs's `handleWorktreeNew`). This function deliberately does NOT import
// `resolveRoots` itself: state.mjs imports `readGrants` FROM this module (see
// the FRESH_STATE_SCHEMA_VERSION comment above), so importing state.mjs back
// would be a cycle, and it would break this module's "zero deps beyond node
// builtins" contract (module header). Instead it re-derives the same
// ordinary-vs-linked distinction `resolveRoots` uses directly against
// `mainRoot` (a `.git` FILE means "this checkout is itself a linked
// worktree"; a `.git` DIRECTORY means "ordinary") as its own independent
// guard — belt-and-braces, not a substitute for the CLI's check.
// ---------------------------------------------------------------------------

const FEATURE_SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

/** Typed refusal for createFeatureWorktree: `.code` is a stable string (e.g.
 * "WORKTREE_TARGET_EXISTS"), `.message` already carries the SAME code as a
 * "[CODE] ..." prefix (the convention handleConfigValidate's `[${p.code}] ...`
 * formatting already uses elsewhere in this codebase) because bee.mjs's
 * dispatcher only ever surfaces a caught error's bare `.message` to the CLI
 * caller (emitError), never a separate `.code` field. */
export class WorktreeCreateError extends Error {
  constructor(code, message) {
    super(`[${code}] ${message}`);
    this.name = 'WorktreeCreateError';
    this.code = code;
  }
}

function refuse(code, message) {
  throw new WorktreeCreateError(code, message);
}

/** Same distinction `resolveRoots` draws (a `.git` FILE = linked worktree, a
 * `.git` DIRECTORY = ordinary checkout) — re-derived here, not imported, per
 * the module-cycle note above. */
function isOrdinaryCheckout(root) {
  try {
    return fs.statSync(path.join(root, '.git')).isDirectory();
  } catch {
    return false;
  }
}

function runGit(cwd, args) {
  return spawnSync('git', args, { cwd, encoding: 'utf8' });
}

/**
 * Resolves a `--base-ref` commit-ish to a concrete commit sha via `git
 * rev-parse --verify --end-of-options "<baseRef>^{commit}"` — NOT `git
 * check-ref-format`, which only validates ref-NAME syntax and wrongly
 * rejects/mishandles perfectly valid commit-ish forms `check-ref-format`
 * was never meant to judge: `HEAD~1` (the `~` is a disallowed ref-name
 * character), a short sha (not a ref at all), or `v1.2.0^{commit}` (the `^`
 * and `{`/`}` are disallowed too) — decision D3 / advisor R8. `rev-parse
 * --verify` instead proves the commit-ish actually RESOLVES to a real
 * commit in THIS repo, which is the property `createFeatureWorktree`
 * actually needs before handing it to `git worktree add`.
 *
 * `--end-of-options` (requires git >= 2.24) tells git everything after it
 * is a positional revision argument, never an option — this is what stops a
 * `baseRef` value starting with `-` (e.g. `--upload-pack=evil`) from being
 * parsed as a git flag instead of data, even though it already arrives as
 * its own argv array element (spawnSync, no shell) rather than a
 * shell-interpolated string.
 *
 * Returns the resolved, full commit sha on success, or `null` when the
 * commit-ish doesn't resolve — bad syntax and "doesn't exist" both land
 * here as the SAME `null` (git's own `rev-parse --verify` doesn't
 * distinguish the two either: both fail with "Needed a single revision").
 * The call site collapses both into one typed refusal, `WORKTREE_BASE_NOT_FOUND`
 * — see that refusal's comment for why no separate syntax-only code remains.
 */
function resolveBaseRefCommit(cwd, ref) {
  const result = runGit(cwd, ['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`]);
  if (result.status !== 0) return null;
  const sha = (result.stdout || '').trim();
  return sha || null;
}

function branchExists(mainRoot, branch) {
  return runGit(mainRoot, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]).status === 0;
}

/**
 * Reads the git-verified worktree id from a freshly-created worktree's own
 * `.git` file — the SAME bidirectional-gitdir mechanism `resolveRoots` (and
 * scripts/test_worktree_cli.mjs's `verifiedId()`) already use. Never assumes
 * id === directory basename: git only defaults a new worktree's id to the
 * sibling directory's own basename when that id is free, and silently
 * suffixes a counter on collision (`<basename>1`, `<basename>2`, ...).
 */
function readWorktreeGitVerifiedId(worktreeRoot) {
  const gitFile = path.join(worktreeRoot, '.git');
  const raw = fs.readFileSync(gitFile, 'utf8').trim();
  const match = raw.match(/^gitdir:\s*(.+)$/);
  if (!match) {
    throw new Error(`worktree .git file at ${gitFile} is not a valid "gitdir: ..." pointer`);
  }
  const gitdir = path.resolve(worktreeRoot, match[1].trim().replace(/\\/g, path.sep));
  return path.basename(gitdir);
}

/**
 * Creates a NEW linked git worktree for `feature` — `git worktree add
 * <mainRoot's sibling>--wt--<feature> -b wt/<feature> [baseRefSha]` — then
 * grants and bootstraps it exactly as `worktree register` does. Returns
 * `{ id, worktreeRoot, branch, baseRef, baseRefSha, bootstrap }` on success.
 *
 * `options`:
 *   - `feature` (required): slug, validated against `FEATURE_SLUG_RE`.
 *   - `baseRef` (optional): a commit-ish (branch, tag, `HEAD~N`, short sha,
 *     `<tag>^{commit}`, ...), resolved to a concrete commit sha via `git
 *     rev-parse --verify --end-of-options` when given (see
 *     `resolveBaseRefCommit`'s own comment for why not `check-ref-format`;
 *     requires git >= 2.24 for `--end-of-options`).
 *   - `_writeGrant` / `_bootstrapWorktreeStore`: internal test-only injection
 *     points (default to the real `writeGrant` / `bootstrapWorktreeStore`
 *     exports above) so a test can force the POST-add failure + rollback
 *     path deterministically without needing a real bug.
 *
 * Every pre-flight check below is a typed, ZERO-MUTATION refusal (its own
 * stable `WorktreeCreateError.code`, nothing touched on disk or in git)
 * EXCEPT the last line of defense, `git worktree add` itself: the
 * pre-checks are advisory (best-effort races against concurrent/stale
 * state), git's own failure is authoritative and is caught and re-surfaced
 * typed too (`WORKTREE_ADD_FAILED`). A failure AFTER `git worktree add`
 * itself succeeded (deriving the id, writing the grant, or bootstrapping the
 * store throwing) is rolled back best-effort (`git worktree remove --force`
 * + best-effort `removeGrant`); if that rollback itself fails, the error
 * says the tree can be adopted via `bee worktree register`.
 */
export function createFeatureWorktree(mainRoot, options = {}) {
  const { feature, baseRef, _writeGrant = writeGrant, _bootstrapWorktreeStore = bootstrapWorktreeStore } = options;

  if (typeof feature !== 'string' || !FEATURE_SLUG_RE.test(feature)) {
    refuse(
      'WORKTREE_INVALID_SLUG',
      `feature slug ${JSON.stringify(feature)} must match ${FEATURE_SLUG_RE} (lowercase letters/digits, starting with a letter or digit, hyphens allowed after that).`,
    );
  }

  // Resolved once here (not re-derived later): the SAME sha this refusal
  // check proves resolvable is the sha `git worktree add` below actually
  // receives, so there is no gap between "we checked it exists" and "we
  // used it" for a ref that moves between the two (see the addArgs comment
  // below for why the resolved sha, not the original ref string, is what
  // gets passed to `git worktree add`).
  let baseRefSha;
  if (baseRef !== undefined && baseRef !== null && baseRef !== '') {
    if (typeof baseRef !== 'string') {
      refuse('WORKTREE_BASE_NOT_FOUND', `--base-ref must be a string, got ${JSON.stringify(baseRef)}.`);
    }
    baseRefSha = resolveBaseRefCommit(mainRoot, baseRef);
    if (!baseRefSha) {
      refuse(
        'WORKTREE_BASE_NOT_FOUND',
        `--base-ref ${JSON.stringify(baseRef)} does not resolve to a commit in ${mainRoot} ("git rev-parse --verify" found nothing) — check the ref/sha/tag exists (and isn't just a syntax typo).`,
      );
    }
  }

  if (!isOrdinaryCheckout(mainRoot)) {
    refuse(
      'WORKTREE_CALLER_NOT_ORDINARY',
      `"bee worktree new" must be run from the main checkout, not a linked worktree (${mainRoot} is not an ordinary checkout).`,
    );
  }

  const repoBasename = path.basename(mainRoot);
  const siblingDirName = `${repoBasename}--wt--${feature}`;
  const worktreeRoot = path.resolve(mainRoot, '..', siblingDirName);
  const branch = `wt/${feature}`;
  const mainStoreRoot = path.join(mainRoot, '.bee');

  if (fs.existsSync(worktreeRoot)) {
    refuse('WORKTREE_TARGET_EXISTS', `${worktreeRoot} already exists.`);
  }

  if (branchExists(mainRoot, branch)) {
    refuse('WORKTREE_BRANCH_EXISTS', `branch "${branch}" already exists in ${mainRoot}.`);
  }

  // Advisory only: git assigns a new worktree's id from the sibling
  // directory's own basename whenever that id is free, and only falls back
  // to a suffixed id on collision — so this precheck catches the common
  // "target dir removed by hand, grant registry never cleaned up" case
  // BEFORE any mutating git call runs, at the cost of occasionally missing a
  // collision-suffixed id. `git worktree add` failing at runtime (below) is
  // the real, unconditional guard.
  const likelyId = siblingDirName;
  if (readGrants(mainStoreRoot)[likelyId] === true) {
    refuse(
      'WORKTREE_GRANT_EXISTS',
      `a worktree grant already exists for id "${likelyId}" — run "bee worktree unregister --id ${likelyId}" (or "git worktree prune") before retrying.`,
    );
  }

  // Pass the RESOLVED SHA, not the original `baseRef` string, to `git
  // worktree add` — deterministic even if `baseRef` names something that
  // moves (a branch tip, `HEAD`) in the window between the resolve above
  // and this call, and immune to the same leading-dash/argument-injection
  // concern `resolveBaseRefCommit`'s `--end-of-options` already guards
  // (a raw sha can never be mistaken for a git flag).
  const addArgs = ['worktree', 'add', '-b', branch, '--', worktreeRoot];
  if (baseRefSha) addArgs.push(baseRefSha);
  const addResult = runGit(mainRoot, addArgs);
  if (addResult.status !== 0) {
    refuse(
      'WORKTREE_ADD_FAILED',
      `git worktree add failed: ${(addResult.stderr || addResult.stdout || '').trim() || `exit ${addResult.status}`}`,
    );
  }

  let id;
  try {
    id = readWorktreeGitVerifiedId(worktreeRoot);
    _writeGrant(mainStoreRoot, id);
    const bootstrap = _bootstrapWorktreeStore(worktreeRoot, mainStoreRoot, feature);
    return { id, worktreeRoot, branch, baseRef: baseRef || null, baseRefSha: baseRefSha || null, bootstrap };
  } catch (postAddError) {
    // git worktree add itself succeeded, but deriving the id / writing the
    // grant / bootstrapping the store threw. Roll back best-effort so a
    // failed "new" never leaves a half-registered worktree as its only
    // trace — the pre-checks above are what keep the COMMON refusal path
    // zero-mutation; this is the atomic real guard's own failure mode.
    if (id) {
      try {
        removeGrant(mainStoreRoot, id);
      } catch {
        // best-effort — the typed error below still fires either way.
      }
    }
    const removeResult = runGit(mainRoot, ['worktree', 'remove', '--force', worktreeRoot]);
    const stillPresent = fs.existsSync(worktreeRoot);
    const postAddMessage = postAddError instanceof Error ? postAddError.message : String(postAddError);
    if (removeResult.status === 0 && !stillPresent) {
      // Worktree gone — also drop the branch `git worktree add -b` created,
      // best-effort, so a rolled-back "new" leaves TRUE zero mutation behind
      // (no dir, no grant, no branch), not just no dir/grant. Only reachable
      // once the worktree itself is confirmed gone: git refuses to delete a
      // branch still checked out by a live worktree, so this is never
      // attempted while stillPresent is true.
      try {
        runGit(mainRoot, ['branch', '-D', branch]);
      } catch {
        // best-effort — the typed error below still fires either way.
      }
      refuse(
        'WORKTREE_POST_ADD_FAILED',
        `${worktreeRoot} was created but could not be registered (${postAddMessage}); it has been rolled back (worktree and branch "${branch}" removed).`,
      );
    }
    refuse(
      'WORKTREE_POST_ADD_ROLLBACK_FAILED',
      `${worktreeRoot} was created but could not be registered (${postAddMessage}), and the rollback itself failed — the tree still exists on disk; run "bee worktree register --feature ${feature}" from inside it to adopt it.`,
    );
  }
}

// ---------------------------------------------------------------------------
// mergeFeatureWorktree — "bee worktree merge --id <id>" (GH #21, decision D8;
// reworked into a STAGED transaction by decision D2-REVISED, user review
// P1-2): merge a granted worktree's branch back into MAIN as a staged,
// uncommitted merge (`git merge --no-ff --no-commit`), run the host
// project's configured verify command against that merged-but-uncommitted
// tree, and only ever `git commit` once verify is green. A textual conflict
// or a red verify both `git merge --abort` and PROVE (mainUntouchedProof
// above) that main was left byte-untouched — no known-red merge commit and
// no stranded conflict state can reach main anymore, superseding the old
// D8 contract where a red verify left a real, never-rolled-back merge
// commit on main. `mainRoot` MUST already be a resolved ORDINARY checkout
// root — see createFeatureWorktree's header comment for why this module
// re-derives that distinction itself instead of importing resolveRoots
// (state.mjs cycle) — and per decision D8/advisor-R5, running merge from
// inside ANY linked worktree (including the very one being merged) already
// fails this SAME check, since a linked worktree's own `.git` is a file,
// never a directory: there is no separate "own worktree" code, the
// not-ordinary refusal IS the own-worktree guard (see mergeFeatureWorktree's
// own doc comment below).
//
// verifyCommand is deliberately a CALLER-PASSED option, not something this
// module reads from .bee/config.json itself: worktree-store.mjs keeps
// createFeatureWorktree's "zero deps beyond node builtins" contract (the
// state.mjs-imports-readGrants-FROM-here cycle note above still applies), so
// the CLI handler in bee.mjs resolves `readConfig(mainRoot).commands.verify`
// and passes the string down as `options.verifyCommand`.
// ---------------------------------------------------------------------------

/** Typed refusal for mergeFeatureWorktree: same `[CODE] message` / `.code`
 * convention as WorktreeCreateError above. */
export class WorktreeMergeError extends Error {
  constructor(code, message) {
    super(`[${code}] ${message}`);
    this.name = 'WorktreeMergeError';
    this.code = code;
  }
}

function refuseMerge(code, message) {
  throw new WorktreeMergeError(code, message);
}

/** `git status --porcelain` — deliberately WITHOUT `--ignored` (decision D8a):
 * a worktree whose only "dirty" content is its fully-bootstrapped gitignored
 * `.bee` store must NOT read as dirty. Throws a plain (untyped) Error only
 * when git itself cannot be asked at all — a git failure here is an
 * environment problem, not a typed merge refusal. */
function gitStatusPorcelain(cwd) {
  const r = runGit(cwd, ['status', '--porcelain']);
  if (r.status !== 0) {
    throw new Error(`"git status --porcelain" failed in ${cwd}: ${(r.stderr || r.stdout || '').trim() || `exit ${r.status}`}`);
  }
  return r.stdout;
}

function isTreeDirty(cwd) {
  return gitStatusPorcelain(cwd).trim().length > 0;
}

/**
 * The three-part "main was left byte-untouched" proof (decision D2-REVISED)
 * required after EVERY `git merge --abort` this module runs — a textual
 * conflict, a red post-merge verify, or the exception-safety net around the
 * verify call. Deliberately checks all three independently rather than
 * trusting `git merge --abort`'s own exit code, because the whole point of
 * this rework is that a claim of "main untouched" is proven, not asserted:
 *   1. `git rev-parse HEAD` is unchanged from the pre-merge value.
 *   2. `.git/MERGE_HEAD` no longer exists (no merge-in-progress state).
 *   3. `git status --porcelain --untracked-files=no` is clean (tracked-file
 *      dirt only — untracked litter from an unrelated source is not this
 *      check's concern, same scope `--untracked-files=no` always implies).
 * Returns `{ ok, reason? }` instead of throwing so the caller can build a
 * SPECIFIC typed refusal when the proof fails, instead of a generic throw.
 */
function mainUntouchedProof(mainRoot, preMergeHead, mergeHeadFile) {
  const headNow = runGit(mainRoot, ['rev-parse', 'HEAD']).stdout.trim();
  if (headNow !== preMergeHead) {
    return { ok: false, reason: `HEAD moved from ${preMergeHead} to ${headNow}` };
  }
  if (fs.existsSync(mergeHeadFile)) {
    return { ok: false, reason: '.git/MERGE_HEAD is still present' };
  }
  const status = runGit(mainRoot, ['status', '--porcelain', '--untracked-files=no']).stdout;
  if (status.trim().length > 0) {
    return { ok: false, reason: `"git status --porcelain --untracked-files=no" is not clean:\n${status}` };
  }
  return { ok: true };
}

/** The worktree's CURRENT checked-out branch, or `null` on detached HEAD (or
 * no HEAD ref at all). */
function currentBranch(cwd) {
  const r = runGit(cwd, ['symbolic-ref', '-q', '--short', 'HEAD']);
  if (r.status !== 0) return null;
  return r.stdout.trim();
}

/** Best-effort read of the worktree's OWN bootstrapped `.bee/state.json`
 * `feature` field — used to derive the branch merge expects to consume
 * (`wt/<feature>`, the convention `createFeatureWorktree` always uses).
 * Never throws: a missing/corrupt/foreign state.json just means "unknown",
 * handled by the caller via the pattern-only fallback below. */
function readWorktreeFeature(worktreeRoot) {
  try {
    const raw = fs.readFileSync(path.join(worktreeRoot, '.bee', 'state.json'), 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.feature === 'string' && parsed.feature ? parsed.feature : null;
  } catch {
    return null;
  }
}

// Pattern-only fallback when the worktree's own state.json has no readable
// `feature` (e.g. a worktree adopted via `worktree register` whose state.json
// predates this field, or was hand-edited) — still requires SOME "wt/<slug>"
// shaped branch rather than accepting anything checked out.
const WT_BRANCH_RE = /^wt\/[a-z0-9][a-z0-9-]*$/;

/**
 * Resolves a granted worktree id to its worktreeRoot using the SAME
 * bidirectional gitdir validation `resolveRoots` uses (see state.mjs), just
 * keyed by `id` instead of by walking up from a cwd: reads
 * `<mainRoot>/.git/worktrees/<id>/gitdir` (which should point at
 * `<worktreeRoot>/.git`), then reverse-reads `<worktreeRoot>/.git` (which
 * should point back at `<mainRoot>/.git/worktrees/<id>`). Returns `null` on
 * ANY mismatch, missing file, or unreadable content — never throws, so the
 * caller can fold "no such id" and "id's link is broken" into the same typed
 * WORKTREE_MERGE_UNKNOWN_ID refusal.
 */
function resolveWorktreeById(mainRoot, id) {
  const gitWorktreeDir = path.join(mainRoot, '.git', 'worktrees', id);
  let stat;
  try {
    stat = fs.statSync(gitWorktreeDir);
  } catch {
    return null;
  }
  if (!stat.isDirectory()) return null;

  let forwardRaw;
  try {
    forwardRaw = fs.readFileSync(path.join(gitWorktreeDir, 'gitdir'), 'utf8').trim();
  } catch {
    return null;
  }
  if (!forwardRaw) return null;
  const resolvedGitFile = path.resolve(gitWorktreeDir, forwardRaw.replace(/\\/g, path.sep));
  const worktreeRoot = path.dirname(resolvedGitFile);

  let reverseRaw;
  try {
    reverseRaw = fs.readFileSync(path.join(worktreeRoot, '.git'), 'utf8').trim();
  } catch {
    return null;
  }
  const match = reverseRaw.match(/^gitdir:\s*(.+)$/);
  if (!match) return null;
  const reverseResolved = path.resolve(worktreeRoot, match[1].trim().replace(/\\/g, path.sep));
  if (path.resolve(reverseResolved) !== path.resolve(gitWorktreeDir)) return null;

  return { worktreeRoot };
}

/**
 * Re-checks freshness immediately before removal, then `git worktree remove
 * --force` + `git branch -d` (NEVER -D), in that order (decision D8b —
 * advisor R4). `--force` is used ONLY to push past git's own removal-safety
 * check tripping on the disposable gitignored `.bee` store (runtime/cache
 * tier files are untracked-but-ignored, not a real dirty signal) — it is
 * NEVER used to push through a genuinely dirty worktree, because the
 * freshness re-check below (same `git status --porcelain`, no `--ignored`,
 * as the pre-merge dirty check) already refuses, typed, before `remove` is
 * ever invoked, whenever a tracked-modified or untracked file sits at a
 * TRACKED path. Never throws: every outcome is a returned `{ok, code?}`
 * object folded into the merge result's `.cleanup` field, per D8b ("cleanup
 * refuses, typed, merge result still reported ok"). Also drops the id's
 * grant from the MAIN store's registry once the worktree and branch are both
 * gone — the same removeGrant call `createFeatureWorktree`'s own rollback
 * path makes, so a merged-and-cleaned-up id never lingers in `bee worktree
 * list` pointing at a directory that no longer exists (best-effort: a grant
 * removal failure does not turn an otherwise-successful cleanup into a
 * failure, since the worktree and branch are already gone by that point).
 */
function performCleanup(mainRoot, { worktreeRoot, branch, id, verifySkipped = false }) {
  let status;
  try {
    status = gitStatusPorcelain(worktreeRoot);
  } catch (error) {
    return { ok: false, code: 'WORKTREE_MERGE_CLEANUP_CHECK_FAILED', reason: error instanceof Error ? error.message : String(error) };
  }
  if (status.trim().length > 0) {
    return {
      ok: false,
      code: 'WORKTREE_MERGE_CLEANUP_DIRTY',
      reason: `${worktreeRoot} has tracked-modified or untracked files at tracked paths — cleanup refuses. Remove them (a bootstrapped, gitignored .bee store alone does not block cleanup) and retry, or clean up manually.`,
      status,
    };
  }

  const removeResult = runGit(mainRoot, ['worktree', 'remove', '--force', '--', worktreeRoot]);
  if (removeResult.status !== 0) {
    return {
      ok: false,
      code: 'WORKTREE_MERGE_CLEANUP_REMOVE_FAILED',
      reason: (removeResult.stderr || removeResult.stdout || '').trim() || `exit ${removeResult.status}`,
    };
  }

  const branchDeleteResult = runGit(mainRoot, ['branch', '-d', '--', branch]);
  if (branchDeleteResult.status !== 0) {
    return {
      ok: false,
      code: 'WORKTREE_MERGE_CLEANUP_BRANCH_DELETE_FAILED',
      removed: true,
      reason: (branchDeleteResult.stderr || branchDeleteResult.stdout || '').trim() || `exit ${branchDeleteResult.status}`,
    };
  }

  try {
    removeGrant(path.join(mainRoot, '.bee'), id);
  } catch {
    // best-effort — the worktree and branch are already gone either way.
  }

  const outcome = { ok: true, removed: true, branch_deleted: true };
  if (verifySkipped) {
    // D8 only names "verify green" for the unconditional --cleanup trigger;
    // it does not address a repo with no commands.verify recorded at all.
    // Extending eligibility to verify:'skipped' (advisor-confirmed gap
    // resolution, not literal D8 text) is conditioned on this NEVER being
    // silent: cleanup that ran with no semantic gate must say so loudly,
    // every time, right here in the result the caller sees.
    outcome.warning = 'verify skipped — no commands.verify recorded; cleaned up unchecked.';
  }
  return outcome;
}

/** With `--cleanup`, runs cleanup unconditionally on any positive merge
 * outcome (`verify: 'green'` OR `'skipped'` — the only outcomes that ever
 * reach this function; `MERGE_CONFLICT`/`MERGE_VERIFY_RED` both return
 * earlier in `mergeFeatureWorktree` and never call this). Without the flag,
 * attaches the suggested command instead of running anything (decision D8b:
 * "never prompt" — the suggestion is informational, not a question). */
function attachCleanupOutcome(result, { mainRoot, worktreeRoot, branch, id, cleanup, verify }) {
  if (!cleanup) {
    result.cleanup_suggested_command = `bee worktree merge --id ${id} --cleanup --json`;
    return;
  }
  result.cleanup = performCleanup(mainRoot, { worktreeRoot, branch, id, verifySkipped: verify === 'skipped' });
}

/**
 * Merges a granted worktree's branch into `mainRoot` as a STAGED
 * transaction (decision D2-REVISED). Sequence, run with `mainRoot` as cwd:
 *
 *   1. Capture pre-merge HEAD (`git rev-parse HEAD`).
 *   2. `git merge --no-ff --no-commit <branch>` — stages the merge WITHOUT
 *      committing it. `--no-ff` also forces a real merge (never a
 *      fast-forward) even when `<branch>` is a fast-forward-eligible
 *      ancestor-of-main relationship, so a staged merge always means a
 *      TRUE merge commit once committed, not a silent ref move.
 *      - Non-zero exit: textual conflict (or another merge-attempt
 *        failure). `git merge --abort`, prove main is untouched
 *        (`mainUntouchedProof`), return typed `MERGE_CONFLICT`.
 *      - Zero exit but no `.git/MERGE_HEAD` created: "Already up to date"
 *        — branch has nothing new for main. Returns a typed no-op result;
 *        `git commit` is NEVER attempted here (there is nothing staged —
 *        committing would either error or produce an empty commit).
 *   3. A merge is now staged (MERGE_HEAD live, changes staged, nothing
 *      committed). If `verifyCommand` was given, it runs NOW, against this
 *      merged-but-UNCOMMITTED tree (MERGE_HEAD is live, changes are staged
 *      but not committed) — verify is deliberately run before any commit
 *      exists, so a semantic break is caught before it ever becomes a real
 *      commit on main, not after. The abort path for a red verify runs
 *      inside a `finally`-guarded try (see body): a verify crash/timeout
 *      can never strand a staged merge on main.
 *      - Verify red: `git merge --abort`, prove main untouched, return
 *        typed `MERGE_VERIFY_RED` — the semantic-conflict alarm. Unlike
 *        the old D8 contract, NO merge commit exists at this point, so
 *        there is nothing to roll back: main was left byte-untouched.
 *   4. Verify green (or no `verifyCommand` given at all): `git commit`
 *      names the id in its message. Post-commit guard: `git status
 *      --porcelain --untracked-files=no` MUST be empty; if verify itself
 *      left tracked files modified (a misbehaving verify command), the
 *      result carries a typed `warning.code: 'verify_mutated_tracked_files'`
 *      instead of silently claiming the tree matches the commit. Recovery
 *      if a LATER independent verify goes red on an already-committed
 *      merge: `git revert -m 1 <merge-commit>` (documented, not automated).
 *
 * Returns a plain result object for every outcome that follows a real git
 * mutation (`MERGE_CONFLICT`, `ALREADY_UP_TO_DATE`, `MERGE_VERIFY_RED`, or a
 * green/skipped success) — those are settled facts about repo state the
 * caller needs to inspect, not refusals to retry. Every check BEFORE the
 * merge itself is a typed, ZERO-MUTATION `WorktreeMergeError` throw
 * (unknown/ungranted id, caller checkout not ordinary, dirty main, dirty
 * worktree, detached HEAD, or a branch other than the worktree's expected
 * `wt/<slug>`-style branch) — same error-class style as
 * `createFeatureWorktree`'s `WorktreeCreateError`. A `WorktreeMergeError` is
 * ALSO thrown (not returned) if an abort-then-prove step itself fails
 * (`WORKTREE_MERGE_ABORT_FAILED`) or the commit step itself fails
 * (`WORKTREE_MERGE_COMMIT_FAILED`) — both are environment-level defects,
 * never a normal outcome to fold into a typed result.
 *
 * `options`:
 *   - `id` (required): the worktree's git-verified id (as granted via
 *     `worktree new`/`worktree register`).
 *   - `cleanup` (optional, default false): see `attachCleanupOutcome` above.
 *     Strictly post-commit — never attempted on conflict, red verify, or
 *     the already-up-to-date no-op.
 *   - `verifyCommand` (optional): a shell command string, run via
 *     `spawnSync(verifyCommand, { cwd: mainRoot, shell: true })`. Omit (or
 *     pass a falsy value) when the host project has no `commands.verify`
 *     recorded — the CLI handler is what resolves this from
 *     `readConfig(mainRoot).commands.verify` (see module header note above).
 *
 * "Own worktree" refusal: running merge from inside a linked worktree —
 * including the very worktree named by `id` — is caught by the SAME
 * `WORKTREE_MERGE_CALLER_NOT_ORDINARY` check below (a linked worktree's own
 * `.git` is a file, never a directory, so `isOrdinaryCheckout(mainRoot)` is
 * already false); there is deliberately no second, distinct code for this
 * (decision D8 / advisor R5 belt-and-braces framing, not a separate rule).
 */
export function mergeFeatureWorktree(mainRoot, options = {}) {
  const { id, cleanup = false, verifyCommand } = options;

  if (typeof id !== 'string' || !id) {
    refuseMerge('WORKTREE_MERGE_INVALID_ID', `id ${JSON.stringify(id)} must be a non-empty string.`);
  }

  if (!isOrdinaryCheckout(mainRoot)) {
    refuseMerge(
      'WORKTREE_MERGE_CALLER_NOT_ORDINARY',
      `"bee worktree merge" must be run from the MAIN checkout, not a linked worktree (${mainRoot} is not an ordinary checkout) — a worktree, including the one being merged, cannot merge itself.`,
    );
  }

  const mainStoreRoot = path.join(mainRoot, '.bee');
  const grants = readGrants(mainStoreRoot);
  if (grants[id] !== true) {
    refuseMerge('WORKTREE_MERGE_UNKNOWN_ID', `no granted worktree found for id ${JSON.stringify(id)} — run "bee worktree list" to see granted ids.`);
  }

  const resolved = resolveWorktreeById(mainRoot, id);
  if (!resolved || !fs.existsSync(resolved.worktreeRoot)) {
    refuseMerge(
      'WORKTREE_MERGE_UNKNOWN_ID',
      `id ${JSON.stringify(id)} is granted but no matching, bidirectionally-valid git worktree link was found under ${mainRoot} (or the worktree no longer exists on disk) — run "git worktree prune" and "bee worktree unregister --id ${id}" if it was removed by hand.`,
    );
  }
  const { worktreeRoot } = resolved;

  if (isTreeDirty(mainRoot)) {
    refuseMerge('WORKTREE_MERGE_MAIN_DIRTY', `the MAIN checkout at ${mainRoot} has uncommitted changes ("git status --porcelain" is non-empty) — commit or stash before merging.`);
  }
  if (isTreeDirty(worktreeRoot)) {
    refuseMerge(
      'WORKTREE_MERGE_WORKTREE_DIRTY',
      `the worktree at ${worktreeRoot} has uncommitted changes ("git status --porcelain" is non-empty) — commit or stash before merging. (A bootstrapped, gitignored .bee store alone is NOT dirty, per decision D8a.)`,
    );
  }

  const branch = currentBranch(worktreeRoot);
  if (!branch) {
    refuseMerge('WORKTREE_MERGE_DETACHED_HEAD', `the worktree at ${worktreeRoot} is on a detached HEAD — check out its branch before merging.`);
  }

  const feature = readWorktreeFeature(worktreeRoot);
  const expectedBranch = feature ? `wt/${feature}` : null;
  const branchOk = expectedBranch ? branch === expectedBranch : WT_BRANCH_RE.test(branch);
  if (!branchOk) {
    refuseMerge(
      'WORKTREE_MERGE_BRANCH_MISMATCH',
      `the worktree at ${worktreeRoot} is checked out to "${branch}", not its expected ${expectedBranch ? `"${expectedBranch}"` : '"wt/<slug>"-style'} branch — merge refuses to guess which branch to consume.`,
    );
  }

  // ── everything above is zero-mutation; the staged merge below is the
  // first real write. It is deliberately staged with `--no-commit` so verify
  // always runs against a merged-but-UNCOMMITTED tree (or is skipped for a
  // no-op / verify-less repo) and NOTHING is committed to main until a
  // semantic gate says it's safe — decision D2-REVISED. ────────────────────
  const preMergeHead = runGit(mainRoot, ['rev-parse', 'HEAD']).stdout.trim();
  const mergeHeadFile = path.join(mainRoot, '.git', 'MERGE_HEAD');
  const mergeMessage = `Merge worktree ${id} (branch ${branch}) via bee worktree merge`;

  const mergeResult = runGit(mainRoot, ['merge', '--no-ff', '--no-commit', '--', branch]);
  if (mergeResult.status !== 0) {
    // Textual conflict (or another merge-attempt failure) — abort whatever
    // git staged, then PROVE main is back to its pre-merge state before ever
    // telling the caller so; a claim of "main untouched" that isn't checked
    // is exactly the bug this staged-transaction rework replaces.
    runGit(mainRoot, ['merge', '--abort']);
    const proof = mainUntouchedProof(mainRoot, preMergeHead, mergeHeadFile);
    if (!proof.ok) {
      refuseMerge(
        'WORKTREE_MERGE_ABORT_FAILED',
        `"git merge --no-ff --no-commit ${branch}" failed and "git merge --abort" did NOT fully restore ${mainRoot} to its pre-merge state (${proof.reason}) — main may be left mid-merge; inspect it by hand before retrying.`,
      );
    }
    return {
      ok: false,
      code: 'MERGE_CONFLICT',
      id,
      branch,
      worktreeRoot,
      message: `"git merge --no-ff ${branch}" hit a textual conflict — the merge was aborted and ${mainRoot} was left byte-untouched (HEAD unchanged, no MERGE_HEAD, clean tracked status); bee does not auto-resolve a textual conflict.`,
      output: `${mergeResult.stdout || ''}${mergeResult.stderr || ''}`,
    };
  }

  if (!fs.existsSync(mergeHeadFile)) {
    // Zero exit but nothing staged: "Already up to date" — branch has
    // nothing new for main. Never attempt a commit here; there is nothing
    // staged, so "git commit" would either error or produce an empty commit.
    return {
      ok: true,
      merged: false,
      id,
      branch,
      worktreeRoot,
      code: 'ALREADY_UP_TO_DATE',
      verify: 'skipped',
      message: `"${branch}" is already up to date with ${mainRoot} — nothing to merge.`,
    };
  }

  // A merge is now staged (MERGE_HEAD live, changes staged, nothing yet
  // committed). Every exit from here must either commit (verify green / no
  // verify configured) or abort (conflict already handled above; red
  // verify below; any unexpected throw) — the `finally` is the safety net
  // for that last case, so a verify crash/timeout can never strand a
  // staged merge on main.
  let committed = false;
  try {
    if (verifyCommand) {
      const verifyResult = spawnSync(verifyCommand, { cwd: mainRoot, shell: true, encoding: 'utf8' });
      if (verifyResult.status !== 0) {
        const combined = `${verifyResult.stdout || ''}${verifyResult.stderr || ''}`;
        const tail = combined.split('\n').slice(-30).join('\n');
        runGit(mainRoot, ['merge', '--abort']);
        const proof = mainUntouchedProof(mainRoot, preMergeHead, mergeHeadFile);
        if (!proof.ok) {
          refuseMerge(
            'WORKTREE_MERGE_ABORT_FAILED',
            `verify failed and "git merge --abort" did NOT fully restore ${mainRoot} to its pre-merge state (${proof.reason}) — main may be left mid-merge; inspect it by hand before retrying.`,
          );
        }
        return {
          ok: false,
          code: 'MERGE_VERIFY_RED',
          id,
          branch,
          worktreeRoot,
          merged: false,
          verify: 'red',
          message:
            `the merge was textually clean but the post-merge verify failed against the merged-but-uncommitted tree — this is the semantic-conflict alarm: behavior broke even though git found no textual conflict. The merge was aborted and ${mainRoot} was left byte-untouched (HEAD unchanged, no MERGE_HEAD, clean tracked status); no merge commit exists. Fix-first before release.`,
          output_tail: tail,
        };
      }
    }

    const commitResult = runGit(mainRoot, ['commit', '-m', mergeMessage]);
    if (commitResult.status !== 0) {
      // Should not happen — a live MERGE_HEAD always has something staged
      // to commit — but never silently swallow it: abort rather than leave
      // a half-done staged merge sitting on main.
      runGit(mainRoot, ['merge', '--abort']);
      refuseMerge(
        'WORKTREE_MERGE_COMMIT_FAILED',
        `"git commit" failed for the staged merge of ${branch} (${(commitResult.stderr || commitResult.stdout || '').trim() || `exit ${commitResult.status}`}) — the staged merge was aborted; ${mainRoot} was left untouched.`,
      );
    }
    committed = true;

    const result = { ok: true, merged: true, id, branch, worktreeRoot, verify: verifyCommand ? 'green' : 'skipped' };

    // Post-commit guard (D2-REVISED): the commit above only ever contains
    // what git staged for the merge itself. If the verify command mutated
    // TRACKED files without bee's knowledge, those changes are now dirty
    // working-tree state sitting on top of an otherwise-clean merge commit
    // — surface that loudly instead of silently treating tree === commit.
    const postCommitStatus = runGit(mainRoot, ['status', '--porcelain', '--untracked-files=no']).stdout;
    if (postCommitStatus.trim().length > 0) {
      result.warning = {
        code: 'verify_mutated_tracked_files',
        message: `the post-merge verify command left tracked files modified after the merge commit landed ("git status --porcelain --untracked-files=no" is non-empty) — the merge commit itself is clean, but verify mutated the working tree afterward; inspect and commit/discard those changes separately. Recovery if a LATER independent verify goes red on this merge: "git revert -m 1 <merge-commit>".`,
        status: postCommitStatus,
      };
    }

    attachCleanupOutcome(result, { mainRoot, worktreeRoot, branch, id, cleanup, verify: result.verify });
    return result;
  } finally {
    if (!committed && fs.existsSync(mergeHeadFile)) {
      // Exception-safety net only: every normal exit above already aborted
      // (and proved it) before returning/throwing, so this fires only when
      // something unexpected blew up mid-verify/mid-commit without going
      // through either handled path yet.
      runGit(mainRoot, ['merge', '--abort']);
    }
  }
}
