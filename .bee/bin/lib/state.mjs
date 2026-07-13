// state.mjs — repo root discovery, runtime state, config, gates.

import fs from 'node:fs';
import path from 'node:path';
import { readJson, writeJsonAtomic } from './fsutil.mjs';
// Leaf-module imports only — no cycle: claims.mjs and reservations.mjs import
// nothing but fsutil/node builtins (unlike cells.mjs, which imports THIS file).
import { readSession, readClaim, isClaimActive, claimsDir, adoptClaim } from './claims.mjs';
import { pathsOverlap } from './reservations.mjs';

export const BEE_VERSION = '0.1.35';

export const GATE_NAMES = ['context', 'shape', 'execution', 'review'];

// The phase enum (02-architecture state model). 'compounding-complete' is the
// one blessed terminal alias written at feature close (07-contracts, hook 6).
// Anything else is agent drift — bee_status flags it (decision 0004).
export const PHASES = [
  'idle',
  'exploring',
  'planning',
  'validating',
  'swarming',
  'reviewing',
  'scribing',
  'compounding',
  'grooming',
];
export const KNOWN_PHASES = [...PHASES, 'compounding-complete'];

export function isKnownPhase(phase) {
  return KNOWN_PHASES.includes(phase);
}

// Host-project standard commands (docs/09 item 1, decision D1): the record is
// the primitive — .bee/config.json `commands`, no init.sh, no second location.
export const COMMAND_KEYS = ['setup', 'start', 'test', 'verify'];

function normalizeCommands(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const commands = {};
  for (const key of COMMAND_KEYS) {
    if (typeof raw[key] === 'string' && raw[key].trim()) commands[key] = raw[key].trim();
  }
  return commands;
}

const DEFAULT_HOOKS = {
  'session-init': true,
  'prompt-context': true,
  'write-guard': true,
  'state-sync': true,
  'chain-nudge': true,
  'session-close': true,
};

// Decision 0012 — model tiers, runtime-keyed. bee is dual-runtime, and each
// runtime names its models differently, so the map is keyed by runtime first,
// then tier. `extraction` = cheapest capable, `generation` = mid, `ceiling` =
// the strongest (kept scarce — the orchestrator's own model). A null value
// means "this runtime cannot select a per-agent model" → the tier is enforced
// via read budgets + output caps in the worker prompt instead (Codex today).
// Cells can be tiered at any of these; `ceiling` is a concept ("keep it on the
// session model"), not a configured value (decision 0015).
export const MODEL_TIERS = ['extraction', 'generation', 'ceiling'];
// Only these two are configured — the CHEAPER tiers you downgrade workers to.
// The ceiling is never configured: it is always the session/orchestrator model,
// so it has no entry and resolves to "inherit the session model".
export const CONFIGURABLE_TIERS = ['extraction', 'generation'];
// Decision 0021 (P16) — `review` is a configurable ROLE beside the tiers: the
// model that reviews what generation implemented (reviewing specialists,
// fresh-eyes, plan-checker). Independent reviewer > self-review; a review slot
// stronger than generation catches what the implementer's own model misses.
// null → falls back to the generation tier.
export const CONFIGURABLE_SLOTS = [...CONFIGURABLE_TIERS, 'review'];
// Decision D2 (advisor feature) — `advisor` is normalized alongside the
// configurable slots but is deliberately NOT one of them: CONFIGURABLE_SLOTS
// stays exactly [extraction, generation, review] so resolveTier's slot gate
// and its review-falls-back-to-generation semantics never apply to it
// (decision 0015 collision avoided — the ceiling tier stays unconfigured and
// `advisor` is not a tier either). Only normalizeModels loops this extended
// list; resolveAdvisor (below, beside resolveTier) is the sole reader.
const MODEL_NORMALIZE_SLOTS = [...CONFIGURABLE_SLOTS, 'advisor'];
// Decision 0021 (P17) — per-slot reasoning effort, applied where the runtime
// has a per-agent effort switch; ignored (recorded only) where it does not.
export const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'];
export const RUNTIMES = ['claude', 'codex'];
const DEFAULT_MODELS = {
  // Claude Code Agent tool accepts short model names: haiku | sonnet | opus | fable.
  // The all-Claude default role split (owner, 2026-07-10): session model
  // orchestrates (ceiling), opus reviews, sonnet implements, haiku extracts —
  // every slot editable per repo to whatever models the user actually has.
  claude: { extraction: 'haiku', generation: 'sonnet', review: 'opus' },
  // Codex has no per-agent model selection today → null tiers = budget/cap fallback.
  // Set real model ids here if your runtime supports switching (e.g. generation: 'gpt-5').
  codex: { extraction: null, generation: null, review: null },
};

// Decisions 0019/0021 (P14/P16/P17) — a configurable slot value is one of:
//   "model-name"                       → the runtime's per-agent model switch
//   null                               → budget/cap fallback (no per-agent
//     switch); for the `review` slot: fall back to the generation tier
//   { model: "...", effort: "..." }    → model + reasoning effort, applied
//     where the runtime has a per-agent effort switch (invalid efforts drop)
//   { kind: "cli", command: "..." }    → an EXTERNAL executor: a separate CLI
//     process (codex exec, a GLM/Kimi CLI, ...) dispatched by the orchestrator
//     under the same bee-executing contract; effort rides inside the command.
// Invalid shapes are ignored (the default for that slot stays).
function normalizeTierValue(value) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value === null) return null;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (value.kind === 'cli' && typeof value.command === 'string' && value.command.trim()) {
      return { kind: 'cli', command: value.command.trim() };
    }
    if (value.kind === undefined && typeof value.model === 'string' && value.model.trim()) {
      const out = { model: value.model.trim() };
      if (typeof value.effort === 'string' && EFFORT_LEVELS.includes(value.effort.trim())) {
        out.effort = value.effort.trim();
      }
      return out;
    }
  }
  return undefined;
}

// Decision 8cd4c84e / D2b (P18, evolving loop) — dogfood_repos: the foreign repos
// whose ALREADY-WRITTEN .bee/feedback-digest.json bee's evolving loop consumes.
// Each entry normalizes to { path, label }: a bare string is the path (label
// defaults to its basename), or an explicit { path, label } object. Absent key,
// or any other shape, → [] / skipped — never thrown. Every path is path.resolve()d
// THEN fs.realpath()ed here (critical pattern [20260708]: an MSYS /tmp string must
// never reach a node fs API unresolved), and a path that does not exist or is
// unreadable is WARNED and SKIPPED — one dead dogfood repo must never break the
// bee repo's own session. Mirrors normalizeCommands / normalizeModels: a
// single parse path lives in readConfig, nowhere else.
function normalizeDogfoodRepos(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    let rawPath = null;
    let label = null;
    if (typeof item === 'string') {
      rawPath = item;
    } else if (item && typeof item === 'object' && !Array.isArray(item) && typeof item.path === 'string') {
      rawPath = item.path;
      if (typeof item.label === 'string' && item.label.trim()) label = item.label.trim();
    } else {
      continue; // any other shape is ignored, never thrown
    }
    if (typeof rawPath !== 'string' || !rawPath.trim()) continue;
    const resolved = path.resolve(rawPath.trim());
    let real;
    try {
      real = fs.realpathSync(resolved);
    } catch (err) {
      // A missing or unreadable dogfood repo is warned and skipped, never thrown.
      console.warn(
        `dogfood_repos: skipping "${rawPath}" — ${err && err.code ? err.code : err} (dead or unreadable repo; the bee session continues)`,
      );
      continue;
    }
    out.push({ path: real, label: label || path.basename(resolved) });
  }
  return out;
}

function normalizeModels(raw) {
  const out = {
    claude: { ...DEFAULT_MODELS.claude },
    codex: { ...DEFAULT_MODELS.codex },
  };
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const rt of RUNTIMES) {
      const src = raw[rt];
      if (!src || typeof src !== 'object' || Array.isArray(src)) continue;
      for (const slot of MODEL_NORMALIZE_SLOTS) {
        const value = normalizeTierValue(src[slot]);
        if (value !== undefined) out[rt][slot] = value;
      }
    }
  }
  return out;
}

/**
 * Walk up from startDir looking for `.bee/onboarding.json`; if none found
 * anywhere up the tree, walk up again for the first `.git`; else null.
 * (Onboarding marker wins over .git even when .git is closer to startDir.)
 */
export function findRepoRoot(startDir) {
  const start = path.resolve(startDir || process.cwd());

  let dir = start;
  while (true) {
    if (fs.existsSync(path.join(dir, '.bee', 'onboarding.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  dir = start;
  while (true) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return null;
}

export function defaultState() {
  return {
    schema_version: '1.0',
    phase: 'idle',
    feature: null,
    mode: null,
    approved_gates: { context: false, shape: false, execution: false, review: false },
    workers: [],
    summary: '',
    next_action: 'Invoke bee-hive.',
  };
}

export function statePath(root) {
  return path.join(root, '.bee', 'state.json');
}

export function readState(root) {
  const state = readJson(statePath(root), null);
  if (!state || typeof state !== 'object' || Array.isArray(state)) return defaultState();
  const merged = { ...defaultState(), ...state };
  merged.approved_gates = { ...defaultState().approved_gates, ...(state.approved_gates || {}) };
  return merged;
}

// readStateStrict — the CLI-only sibling of readState (review P1-1). readState
// stays fail-open on purpose: hooks (bee-state-sync, bee-write-guard) and
// `bee.mjs status` read it constantly and must never throw on a corrupt file
// mid-session, so its "present-but-unparseable -> defaultState()" shape is
// untouched here and must stay untouched. readStateStrict is for `bee.mjs
// state`'s mutation verbs only, which is the one place a fail-open read is
// actively harmful: every verb re-reads-then-writes, so a corrupt file
// silently read as defaults gets written straight back as a fresh skeleton —
// gates reset, workers emptied, feature nulled, exit 0, no trace anything was
// lost. readStateStrict instead distinguishes:
//   - absent state.json           -> defaultState() (same as readState; a
//     first mutation on a fresh repo must still be able to create the file)
//   - present but unparseable, or -> throws, so the caller (bee.mjs state's
//     present but not a JSON object    main()) prints the message to stderr and
//                                       exits non-zero with the file untouched
export function readStateStrict(root) {
  const file = statePath(root);
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return defaultState();
    throw new Error(
      `readStateStrict: could not read "${file}" (${err && err.code ? err.code : err}). ` +
        'The bee CLI refuses to rebuild state from defaults when it cannot read the existing file — that could ' +
        'silently clobber real state (gates, workers, feature). ' +
        `FIX: inspect/restore the file (e.g. "git checkout -- ${path.relative(root, file)}"), then retry.`,
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      `readStateStrict: "${file}" exists but is not valid JSON. ` +
        'The bee CLI refuses to rebuild state from defaults over a present-but-corrupt file — that would silently ' +
        'clobber real state (gates, workers, feature) while reporting success. ' +
        `FIX: inspect/restore the file (e.g. "git checkout -- ${path.relative(root, file)}"), then retry.`,
    );
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(
      `readStateStrict: "${file}" exists but is not a JSON object (found ${Array.isArray(parsed) ? 'an array' : typeof parsed}). ` +
        'The bee CLI refuses to rebuild state from defaults over a present-but-corrupt file — that would silently ' +
        'clobber real state (gates, workers, feature) while reporting success. ' +
        `FIX: inspect/restore the file (e.g. "git checkout -- ${path.relative(root, file)}"), then retry.`,
    );
  }
  const merged = { ...defaultState(), ...parsed };
  merged.approved_gates = { ...defaultState().approved_gates, ...(parsed.approved_gates || {}) };
  return merged;
}

export function writeState(root, state) {
  writeJsonAtomic(statePath(root), state);
  return state;
}

export function gateApproved(state, gateName) {
  return Boolean(state && state.approved_gates && state.approved_gates[gateName] === true);
}

// ─── handoff kinds (fresh-session-handoff fsh-9, D1) ────────────────────────
// Two kinds, one file (.bee/HANDOFF.json): 'planned-next' (previous cell
// capped with a green verify, next cell already claimed by the writer —
// the only kind a fresh session may act on without confirmation) and 'pause'
// (today's mid-flight-interruption meaning — surface and WAIT, never
// auto-resume). readHandoff stays the fail-open DISPLAY read (unchanged
// shape/behavior for every existing caller) but now normalizes `kind` for
// display: a record with a missing or unknown kind reads as 'pause' — the
// fail-safe that keeps every handoff written before this cell, and any
// record some future bug corrupts, on the safe (surface-and-wait) side.
// writeHandoff/adoptHandoff below are the CLI-owned guarded mutators (hive
// law 12) — HANDOFF.json had no CLI writer before this cell.
export const HANDOFF_KINDS = ['planned-next', 'pause'];

function normalizeHandoffKind(kind) {
  return kind === 'planned-next' ? 'planned-next' : 'pause';
}

export function handoffPath(root) {
  return path.join(root, '.bee', 'HANDOFF.json');
}

export function readHandoff(root) {
  const handoff = readJson(handoffPath(root), null);
  if (!handoff || typeof handoff !== 'object' || Array.isArray(handoff)) return handoff;
  return { ...handoff, kind: normalizeHandoffKind(handoff.kind) };
}

/**
 * writeHandoff — the strict, guarded CLI-owned writer (mirrors this file's
 * own readStateStrict/readLaneStrict throw-on-refusal convention, hence
 * "(strict)" rather than claims.mjs's typed-return convention). --kind is
 * never guessed: the caller must say 'pause' or 'planned-next' explicitly.
 *
 * 'pause' keeps today's free-form shape (whatever fields the caller passes —
 * cell/files/done/remaining/next_action/phase/feature/mode, unchanged) plus
 * the kind and a written_at stamp. No new precondition: this is the same
 * "surface and WAIT" record as always, now CLI-written instead of prose-Write.
 *
 * 'planned-next' is where D1's preconditions live (in the verb, not prose):
 * refuses, with zero mutation, unless BOTH hold —
 *   (a) the named previous_cell's OWN cell record (read directly, not through
 *       lib/cells.mjs — that module imports THIS file, so importing it back
 *       here would cycle; mirrors the existing listAllCellsForStart pattern
 *       below) has status 'capped' and trace.verify_passed === true (the
 *       real cap precondition field capCell/recordVerify enforce);
 *   (b) the named next_cell already has a claim (claims.mjs, the
 *       cross-session primitive) OWNED by the given writer_session — the
 *       "carried claim" that survives the writing session's own /clear.
 * On success the record also stores writer_session/previous_cell/next_cell
 * alongside kind and written_at, so adoptHandoff below has everything it
 * needs without re-deriving anything.
 */
export function writeHandoff(root, input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('writeHandoff: an object record is required.');
  }
  if (input.kind !== 'planned-next' && input.kind !== 'pause') {
    throw new Error(
      `writeHandoff: --kind must be "planned-next" or "pause" (got ${JSON.stringify(input.kind)}) — D1 requires an explicit kind, never guessed. FIX: pass one of the two handoff kinds.`,
    );
  }
  const now = new Date().toISOString();

  if (input.kind === 'pause') {
    const { kind: _kind, ...rest } = input;
    const record = { ...rest, kind: 'pause', written_at: now };
    writeJsonAtomic(handoffPath(root), record);
    return record;
  }

  // planned-next: every precondition is READ before the single write below
  // (fails closed, zero mutations on refusal — mirrors startFeature's C1
  // discipline elsewhere in this file).
  const writerSession = typeof input.writer_session === 'string' ? input.writer_session.trim() : '';
  const previousCell = typeof input.previous_cell === 'string' ? input.previous_cell.trim() : '';
  const nextCell = typeof input.next_cell === 'string' ? input.next_cell.trim() : '';
  if (!writerSession || !previousCell || !nextCell) {
    throw new Error(
      'writeHandoff: a planned-next handoff requires non-empty writer_session, previous_cell, and next_cell (D1) — FIX: pass all three.',
    );
  }

  const previous = readJson(path.join(root, '.bee', 'cells', `${previousCell}.json`), null);
  if (!previous || previous.status !== 'capped' || previous.trace?.verify_passed !== true) {
    throw new Error(
      `writeHandoff: refused — previous cell "${previousCell}" is not capped with a passing verify (found status "${previous?.status ?? 'missing'}", verify_passed ${JSON.stringify(previous?.trace?.verify_passed ?? null)}). A planned-next handoff may only follow a green-verified cap. FIX: cap "${previousCell}" with a recorded passing verify first (bee.mjs cells verify then cap), then retry.`,
    );
  }

  const claim = readClaim(root, nextCell);
  if (!claim || claim.session !== writerSession) {
    throw new Error(
      `writeHandoff: refused — next cell "${nextCell}" has no claim owned by writer session "${writerSession}" (found ${claim ? `owner "${claim.session}"` : 'no claim'}). The next cell must already be claimed by the writing session before a planned-next handoff carries it. FIX: claim "${nextCell}" as session "${writerSession}" first (claims.mjs claimCellFile), then retry.`,
    );
  }

  const record = {
    ...input,
    kind: 'planned-next',
    writer_session: writerSession,
    previous_cell: previousCell,
    next_cell: nextCell,
    written_at: now,
  };
  writeJsonAtomic(handoffPath(root), record);
  return record;
}

/**
 * adoptHandoff — transfers the carried claim to `sessionId`, then clears the
 * handoff. PRECISION (validation-s4 panel W5): this is CLEAR-AFTER-ADOPT with
 * idempotent recovery, NOT a transaction spanning the claim store and
 * HANDOFF.json — there is no cross-file atomicity here. A crash landing
 * exactly between the two steps (claim adopted, handoff not yet cleared)
 * self-heals on the NEXT adoptHandoff call: re-reading the still-present
 * handoff and re-adopting its next_cell is a BENIGN SELF-ADOPT when the claim
 * already belongs to `sessionId` (adoptClaim has no "already owned" special
 * case — it happily rewrites session -> the same session, refreshing
 * timestamps), and the clear then goes through. Never claim this function is
 * atomic across the two files; it is idempotent, which is what makes the
 * crash window harmless.
 *
 * Typed-failure contract (mirrors claims.mjs, the module this wraps): every
 * refusal returns { ok:false, code, reason } and NEVER throws — a missing
 * handoff, a pause-kind handoff (never auto-resumed — D1's hard boundary),
 * or a failed underlying adoptClaim (propagated as-is) all leave BOTH the
 * claim and the handoff untouched. Only a genuinely bad `sessionId` argument
 * throws (requireId inside adoptClaim), matching claims.mjs's own bad-
 * argument convention.
 */
export function adoptHandoff(root, sessionId) {
  const handoff = readHandoff(root);
  if (!handoff) {
    return { ok: false, code: 'NO_HANDOFF', reason: 'no .bee/HANDOFF.json to adopt.' };
  }
  if (handoff.kind !== 'planned-next') {
    return {
      ok: false,
      code: 'NOT_PLANNED_NEXT',
      reason: `handoff kind "${handoff.kind}" is not "planned-next" — a pause handoff is never adopted, it must be surfaced and WAITED on (D1).`,
    };
  }
  const nextCell = typeof handoff.next_cell === 'string' ? handoff.next_cell.trim() : '';
  if (!nextCell) {
    return { ok: false, code: 'MALFORMED', reason: 'planned-next handoff has no next_cell to adopt.' };
  }

  const adopted = adoptClaim(root, nextCell, sessionId);
  if (!adopted.ok) {
    // adoptClaim's own typed failure (GATE_HELD / NOT_FOUND) — propagate
    // as-is; neither the claim nor the handoff has been touched by this call.
    return adopted;
  }

  fs.rmSync(handoffPath(root), { force: true });
  return { ok: true, claim: adopted.claim, previous_owner: adopted.previous_owner, next_cell: nextCell };
}

// ─── lanes: per-feature pipeline records beside the default state.json ──────
// (fresh-session-handoff fsh-3, decisions D2/D4). A lane record carries the
// same core as the default record — feature, mode, phase (closed vocabulary),
// approved_gates (all four), summary, next_action — plus created_at, and lives
// at .bee/lanes/<feature>.json. Lanes are ADDITIVE: a repo with no .bee/lanes/
// and no bound session behaves byte-identically to the single-pipeline model
// (D4 zero-lane parity). state.json remains the DEFAULT lane, authoritative
// whenever no session→lane binding says otherwise.

export function lanesDir(root) {
  return path.join(root, '.bee', 'lanes');
}

// Mirrors claims.mjs requireId: the feature becomes a filename under
// .bee/lanes/, so path separators and '..' are bad arguments (throw), while
// spaces and unicode are ordinary feature names.
function requireLaneFeature(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('lane feature is required.');
  }
  const feature = value.trim();
  if (/[\\/]/.test(feature) || feature.includes('..')) {
    throw new Error('lane feature must be a plain id (no path separators).');
  }
  return feature;
}

export function lanePath(root, feature) {
  return path.join(lanesDir(root), `${requireLaneFeature(feature)}.json`);
}

function defaultLaneRecord(feature) {
  return {
    schema_version: '1.0',
    feature,
    mode: null,
    phase: 'idle',
    approved_gates: { context: false, shape: false, execution: false, review: false },
    summary: '',
    next_action: '',
    created_at: null,
  };
}

// null when the parsed content is not a lane record for THIS feature: not a
// JSON object, or a record whose feature field names another feature (a
// mismatched record is corrupt, never trusted — mirrors readSession's id check).
function laneRecordFrom(feature, parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  if (parsed.feature !== feature) return null;
  const merged = { ...defaultLaneRecord(feature), ...parsed };
  merged.approved_gates = { ...defaultLaneRecord(feature).approved_gates, ...(parsed.approved_gates || {}) };
  return merged;
}

// readLane — fail-open DISPLAY read, the lane sibling of readState's fail-open
// discipline with one deliberate difference: there is no per-feature default
// to fall back to, so "missing" is null, and "present but corrupt" is WARNED
// and skipped (null) — a display surface keeps rendering the healthy lanes,
// and a corrupt record is never guessed at (mutations go through
// readLaneStrict, which refuses loudly instead).
export function readLane(root, feature) {
  let file;
  try {
    file = lanePath(root, feature); // fail-open: a malformed name reads as "no lane"
  } catch {
    return null;
  }
  if (!fs.existsSync(file)) return null;
  const record = laneRecordFrom(String(feature).trim(), readJson(file, null));
  if (!record) {
    console.warn(
      `readLane: skipping corrupt lane record "${path.relative(root, file)}" for display — mutations through readLaneStrict will refuse loudly. FIX: inspect/restore the file (e.g. "git checkout -- ${path.relative(root, file)}").`,
    );
    return null;
  }
  return record;
}

// readLaneStrict — the mutation sibling (mirrors the readStateStrict
// discipline): a missing lane reads as null (creation is the caller's explicit
// move — a lane is never implicitly defaulted into existence), while a
// present-but-unreadable/corrupt record THROWS with the file untouched, so no
// lane mutation can silently clobber real lane state (gates, phase).
export function readLaneStrict(root, feature) {
  const id = requireLaneFeature(feature); // bad names throw, matching claims.mjs requireId
  const file = lanePath(root, id);
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    throw new Error(
      `readLaneStrict: could not read lane record "${file}" (${err && err.code ? err.code : err}). The bee CLI refuses to mutate a lane it cannot read — that could silently clobber real lane state (gates, phase). FIX: inspect/restore the file (e.g. "git checkout -- ${path.relative(root, file)}"), then retry.`,
    );
  }
  let parsed;
  let parseFailed = false;
  try {
    parsed = JSON.parse(text);
  } catch {
    parseFailed = true;
  }
  const record = parseFailed ? null : laneRecordFrom(id, parsed);
  if (!record) {
    throw new Error(
      `readLaneStrict: lane record "${file}" exists but is corrupt (not a JSON object naming feature "${id}"). The bee CLI refuses to rebuild a lane from defaults over a present-but-corrupt file — that would silently clobber real lane state (gates, phase) while reporting success. FIX: inspect/restore the file (e.g. "git checkout -- ${path.relative(root, file)}"), then retry.`,
    );
  }
  return record;
}

export function writeLane(root, lane) {
  if (!lane || typeof lane !== 'object' || Array.isArray(lane)) {
    throw new Error('writeLane: a lane record object is required.');
  }
  writeJsonAtomic(lanePath(root, lane.feature), lane);
  return lane;
}

export function removeLane(root, feature) {
  fs.rmSync(lanePath(root, feature), { force: true });
}

/** Fail-open enumeration for display: corrupt records are warned and skipped by readLane. */
export function listLanes(root) {
  let entries;
  try {
    entries = fs.readdirSync(lanesDir(root));
  } catch {
    return [];
  }
  const lanes = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    const record = readLane(root, entry.slice(0, -'.json'.length));
    if (record) lanes.push(record);
  }
  return lanes;
}

/**
 * resolvePipeline — the ONE reader seam between a session and its pipeline
 * record (D2/D4): session record → bound lane → default state.json. Resolution
 * NEVER guesses and never scans: no sessionId, no session record, or no lane
 * binding all mean the default pipeline view. A binding that names a lane
 * which is invalid, missing, or corrupt is a TYPED refusal
 * ({ ok:false, code, reason, feature }) — silently falling back to the default
 * there would point a bound session at the wrong pipeline's gates.
 * Returns { ok:true, source:'default'|'lane', feature?, record } on success.
 */
export function resolvePipeline(root, { sessionId = null } = {}) {
  const defaults = () => ({ ok: true, source: 'default', record: readState(root) });
  if (typeof sessionId !== 'string' || !sessionId.trim()) return defaults();
  const session = readSession(root, sessionId);
  if (!session) return defaults();
  const bound = typeof session.lane === 'string' ? session.lane.trim() : '';
  if (!bound) return defaults();
  let file;
  try {
    file = lanePath(root, bound);
  } catch (err) {
    return {
      ok: false,
      code: 'LANE_INVALID',
      feature: bound,
      reason: `session "${session.id}" is bound to lane "${bound}", which is not a valid lane name (${err instanceof Error ? err.message : err}) — never guessed back to the default pipeline. FIX: rebind or unbind the session (claims.mjs bindSessionLane/unbindSessionLane).`,
    };
  }
  if (!fs.existsSync(file)) {
    return {
      ok: false,
      code: 'LANE_MISSING',
      feature: bound,
      reason: `session "${session.id}" is bound to lane "${bound}" but ${path.relative(root, file)} does not exist — resolution never guesses back to the default pipeline. FIX: start the lane (startFeature with lane mode) or unbind the session.`,
    };
  }
  const record = readLane(root, bound);
  if (!record) {
    return {
      ok: false,
      code: 'LANE_CORRUPT',
      feature: bound,
      reason: `session "${session.id}" is bound to lane "${bound}" but its record is corrupt — display never guesses and mutations must refuse. FIX: inspect/restore ${path.relative(root, file)}, then retry.`,
    };
  }
  return { ok: true, source: 'lane', feature: bound, record };
}

export function readOnboarding(root) {
  return readJson(path.join(root, '.bee', 'onboarding.json'), null);
}

export function readConfig(root) {
  const raw = readJson(path.join(root, '.bee', 'config.json'), null);
  const config = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  // Advisor mode is removed in full (D1, reverses decisions 0013/0015). A
  // stale `advisor` key left over in a repo's .bee/config.json must be
  // TOLERATED, never thrown on — but it must not flow through this spread
  // into the parsed result (a bare `...config` would let it ride through
  // untouched). Destructure it out here; onboard_bee.mjs/`bee.mjs status` warn
  // (never error) when the raw file still carries the key.
  const { advisor: _staleAdvisor, ...rest } = config;
  return {
    ...rest,
    hooks: { ...DEFAULT_HOOKS, ...(config.hooks || {}) },
    lanes: config.lanes || {},
    capabilities: config.capabilities || {},
    commands: normalizeCommands(config.commands),
    models: normalizeModels(config.models),
    dogfood_repos: normalizeDogfoodRepos(config.dogfood_repos),
  };
}

export function hookEnabled(root, name) {
  const config = readConfig(root);
  return config.hooks[name] !== false;
}

// D1 — one shared warning line for both surfacers (`bee.mjs status` and
// onboard_bee.mjs) so a stale `advisor` key reads identically wherever it is
// noticed. Warn only, never error: readConfig above already tolerates the key.
// Names the TOP-LEVEL key explicitly (advisor feature, D2 open question) so
// it cannot be misread as covering the new models.<runtime>.advisor slot,
// which is a different, still-valid config path resolved by resolveAdvisor.
export const STALE_ADVISOR_KEY_WARNING =
  'advisor mode was removed in 0.1.23; the top-level advisor key in .bee/config.json is ignored — delete it. (This does not affect the models.<runtime>.advisor slot, which is separate and still valid.)';

export function hasStaleAdvisorKey(root) {
  const raw = readJson(path.join(root, '.bee', 'config.json'), null);
  return Boolean(raw && typeof raw === 'object' && !Array.isArray(raw) && 'advisor' in raw);
}

/**
 * Resolve tier → model name for a runtime (decision 0012). Returns the
 * configured model, or null when the runtime cannot switch models per agent
 * (caller then enforces the tier via read budget + output cap in the prompt).
 * Unknown runtime falls back to 'claude'; unknown tier to 'generation'.
 */
export function modelForTier(root, tier, runtime = 'claude') {
  // The ceiling tier is never configured — it is always the session/orchestrator
  // model (decision 0015). null means "inherit the session model" (omit the
  // subagent model param). Only generation/extraction resolve to a pinned model.
  // A cli-executor tier (decision 0019) has no model NAME — callers that can
  // dispatch externally should use resolveTier(); here it degrades to null.
  const resolved = resolveTier(root, tier, runtime);
  return resolved.type === 'model' ? resolved.model : null;
}

/**
 * Typed slot resolution (decisions 0019/0021). `slot` is a tier
 * (extraction/generation/ceiling) or the `review` role. Returns one of:
 *   { type: 'inherit' }                — ceiling: omit the model param, the
 *     worker inherits the session model (decision 0015)
 *   { type: 'model', model, effort? }  — spawn a subagent with this model
 *     (and per-agent reasoning effort where the runtime supports it)
 *   { type: 'budget' }                 — no per-agent switch: enforce the tier
 *     as a read budget + output cap in the worker prompt
 *   { type: 'cli', command }           — dispatch an EXTERNAL executor process
 *     (protocol: bee-swarming reference, External Executors section)
 * A null `review` slot falls back to the generation tier (decision 0021).
 */
export function resolveTier(root, slot, runtime = 'claude') {
  if (slot === 'ceiling') return { type: 'inherit' };
  const { models } = readConfig(root);
  const rt = RUNTIMES.includes(runtime) ? runtime : 'claude';
  const s = CONFIGURABLE_SLOTS.includes(slot) ? slot : 'generation';
  let value = models[rt] ? models[rt][s] : null;
  if (value == null && s === 'review') {
    value = models[rt] ? models[rt].generation : null; // review falls back to generation
  }
  if (value == null) return { type: 'budget' };
  if (typeof value === 'string') return { type: 'model', model: value };
  if (value.kind === 'cli') return { type: 'cli', command: value.command };
  if (typeof value.model === 'string') {
    return value.effort
      ? { type: 'model', model: value.model, effort: value.effort }
      : { type: 'model', model: value.model };
  }
  return { type: 'budget' };
}

/**
 * Resolve the advisor slot (decision D2, advisor feature) for a runtime:
 * `models.<runtime>.advisor`, the `review`-slot shape reused for a new
 * purpose. Unlike resolveTier, this NEVER returns a budget type and NEVER
 * falls back to another tier — null unambiguously means "no advisor" (unset,
 * invalid, or a cli shape missing its command), which is exactly what a
 * degenerate-consult check (D2/D3) needs to skip straight to `[BLOCKED]`.
 * Deliberately NOT routed through resolveTier: `advisor` is not in
 * CONFIGURABLE_SLOTS (decision 0015 collision avoided), so resolveTier would
 * silently coerce an unrecognized slot to 'generation' — the one behavior
 * this function must never exhibit.
 */
export function resolveAdvisor(root, runtime = 'claude') {
  const { models } = readConfig(root);
  const rt = RUNTIMES.includes(runtime) ? runtime : 'claude';
  const value = models[rt] ? models[rt].advisor : undefined;
  if (value == null) return null; // unset, absent runtime, or explicit null -> no advisor
  if (typeof value === 'string') return { type: 'model', model: value };
  if (value.kind === 'cli') return { type: 'cli', command: value.command };
  if (typeof value.model === 'string') {
    return value.effort
      ? { type: 'model', model: value.model, effort: value.effort }
      : { type: 'model', model: value.model };
  }
  return null;
}

// ─── startFeature: guarded atomic feature start (decision D2, plan.md test ──
// matrix row 5 / codex-runtime-parity). ONE atomic operation for beginning a
// new feature so a new feature can never inherit approvals or silently step
// over abandoned work (plan-review.md P1: "feature start could clear evidence
// of active work"). Fails closed — every precondition is read BEFORE any
// write, so a refusal makes ZERO mutations — unless ALL of the following hold:
//   - the CURRENT phase is 'idle' or the terminal alias 'compounding-complete'
//     (a mid-flight prior feature must finish or be explicitly wound down —
//     never silently stepped over by starting a new one)
//   - no .bee/HANDOFF.json exists (a paused session must resume/close first)
//   - state.workers is empty (registered workers must be cleared through the
//     existing worker remove/clear verbs first)
//   - no active (unreleased, unexpired) reservation exists
//   - no cell anywhere has status 'claimed' (live worker state; only cap/drop
//     end a claim)
//   - no cell belonging to the PRIOR feature (state.feature) is in a
//     nonterminal status (open/claimed/blocked) — capped and dropped are the
//     only terminal statuses. An abandoned cell must first be resolved through
//     the EXISTING drop verb (bee.mjs cells drop --id ID --reason R) —
//     startFeature never auto-clears workers/cells/reservations as cleanup
//     (P1 repair, plan-review.md).
// On success, exactly one atomic write sets feature/mode/phase, resets ALL
// FOUR gates to false, and refreshes summary/next_action.
//
// Self-contained by design: cells.mjs already imports readState/gateApproved/
// MODEL_TIERS from this module, so this function reads .bee/cells/*.json and
// .bee/reservations.json directly (small local helpers below) rather than
// importing lib/cells.mjs or the stateful reservations.mjs verbs, avoiding a
// state.mjs <-> cells.mjs import cycle. (The pure pathsOverlap predicate IS
// imported from reservations.mjs — that module imports only fsutil, no cycle.)
//
// LANE MODE (fresh-session-handoff fsh-3, validated Q4): startFeature with
// { lane: true } starts the feature AS a lane record under .bee/lanes/ while
// the default pipeline and every other lane stay byte-untouched. The default
// (non-lane) path below keeps today's byte-identical semantics. Lane-scoped
// preconditions — attribution DERIVED from existing fields, never new ones:
//   (a) nonterminal cells whose cell.feature equals THIS lane's feature block;
//   (b) the global HANDOFF blocks a lane start only when its feature field
//       names this lane's feature (the default start keeps any-handoff-blocks);
//   (c) a registered worker blocks only when its cell derives to this lane's
//       feature (worker → cell → cell.feature);
//   (d) global holds check: when the caller declares intended paths, any
//       overlap with ANOTHER session's active holds — claimed cells' files or
//       active reservations — refuses (own-session claims and expired holds
//       never block; no declared paths, no check).

function listAllCellsForStart(root) {
  const dir = path.join(root, '.bee', 'cells');
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const cells = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    const cell = readJson(path.join(dir, entry), null);
    if (!cell || typeof cell !== 'object' || Array.isArray(cell)) continue;
    cells.push(cell);
  }
  return cells;
}

function listActiveReservationsForStart(root) {
  const store = readJson(path.join(root, '.bee', 'reservations.json'), null);
  const reservations = store && Array.isArray(store.reservations) ? store.reservations : [];
  const nowMs = Date.now();
  return reservations.filter((reservation) => {
    if (!reservation || reservation.released_at != null) return false;
    const ttl = reservation.ttl_seconds;
    if (Number.isFinite(ttl) && ttl > 0) {
      const reservedMs = Date.parse(reservation.reserved_at);
      if (Number.isFinite(reservedMs) && reservedMs + ttl * 1000 <= nowMs) return false; // expired, not active
    }
    return true;
  });
}

export function startFeature(
  root,
  { feature, mode = null, phase = 'exploring', lane = false, sessionId = null, paths = [] } = {},
) {
  if (typeof feature !== 'string' || !feature.trim()) {
    throw new Error('startFeature: a non-empty --feature slug is required.');
  }
  const phaseValue = String(phase);
  if (!isKnownPhase(phaseValue)) {
    throw new Error(
      `startFeature: invalid phase "${phaseValue}" — not in the known-phase enum (isKnownPhase). FIX: use one of ${KNOWN_PHASES.join(', ')}.`,
    );
  }

  if (lane) {
    return startLane(root, {
      feature: requireLaneFeature(feature),
      mode,
      phase: phaseValue,
      sessionId: typeof sessionId === 'string' && sessionId.trim() ? sessionId.trim() : null,
      paths,
    });
  }

  // Re-read immediately before any check (C1) — every read below happens
  // before the single write at the end, so a refusal leaves zero mutations.
  const state = readStateStrict(root);

  if (state.phase !== 'idle' && state.phase !== 'compounding-complete') {
    throw new Error(
      `startFeature: refused — current phase is "${state.phase}", not idle or the terminal alias "compounding-complete". A prior feature must finish or be explicitly wound down before a new feature starts. FIX: resume/close the current feature through its normal chain, or drop its remaining cells (bee.mjs cells drop), then retry.`,
    );
  }

  const handoffFile = handoffPath(root);
  if (fs.existsSync(handoffFile)) {
    throw new Error(
      'startFeature: refused — .bee/HANDOFF.json exists. A paused session must resume and clear the handoff before a new feature starts. FIX: resume the session (or explicitly delete HANDOFF.json once its work is truly abandoned), then retry.',
    );
  }

  const workers = Array.isArray(state.workers) ? state.workers : [];
  if (workers.length > 0) {
    const names = workers.map((w) => (w && w.nickname) || '?').join(', ');
    throw new Error(
      `startFeature: refused — ${workers.length} registered worker(s) remain (${names}). FIX: clear them first (bee.mjs state worker remove --nickname N, or worker clear).`,
    );
  }

  const activeReservations = listActiveReservationsForStart(root);
  if (activeReservations.length > 0) {
    throw new Error(
      `startFeature: refused — ${activeReservations.length} active reservation(s) remain (${activeReservations
        .map((r) => `${r.agent}:${r.path}`)
        .join(', ')}). FIX: release them first (bee.mjs reservations release).`,
    );
  }

  const cells = listAllCellsForStart(root);
  const claimed = cells.filter((cell) => cell.status === 'claimed');
  if (claimed.length > 0) {
    throw new Error(
      `startFeature: refused — claimed cell(s) remain: ${claimed.map((c) => c.id).join(', ')}. FIX: cap or drop them first (bee.mjs cells cap / bee.mjs cells drop).`,
    );
  }

  const priorFeature = state.feature;
  if (priorFeature) {
    const nonterminal = cells.filter(
      (cell) =>
        cell.feature === priorFeature &&
        (cell.status === 'open' || cell.status === 'claimed' || cell.status === 'blocked'),
    );
    if (nonterminal.length > 0) {
      throw new Error(
        `startFeature: refused — prior feature "${priorFeature}" has nonterminal cell(s): ${nonterminal
          .map((c) => `${c.id}(${c.status})`)
          .join(', ')}. An abandoned cell must first be resolved through the existing drop verb (bee.mjs cells drop --id ID --reason R) — startFeature never auto-clears cells as cleanup. FIX: cap or drop each listed cell, then retry.`,
      );
    }
  }

  // All preconditions hold — ONE atomic write: feature/mode/phase, reset all
  // four gates, refreshed summary/next_action. A new feature never inherits
  // approvals from whatever came before it.
  state.feature = feature.trim();
  state.mode = mode == null ? null : String(mode);
  state.phase = phaseValue;
  state.approved_gates = { context: false, shape: false, execution: false, review: false };
  state.summary = `Feature "${state.feature}" started at phase "${phaseValue}".`;
  state.next_action = `Invoke bee-hive for "${state.feature}" (phase: ${phaseValue}).`;
  writeState(root, state);
  return state;
}

// Active claim holds by ANOTHER session whose claimed cell's files overlap the
// declared paths (startFeature lane precondition (d)). Claims name a cell, not
// paths, so the held paths are DERIVED from the claimed cell's files list —
// same derivation discipline as the handoff/worker attribution above.
function listClaimHoldsForStart(root, sessionId, cellById, declared) {
  let entries;
  try {
    entries = fs.readdirSync(claimsDir(root));
  } catch {
    return [];
  }
  const nowMs = Date.now();
  const holds = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    let claim;
    try {
      claim = readClaim(root, entry.slice(0, -'.json'.length));
    } catch {
      continue; // a filename that is not a plain cell id is no claim of ours
    }
    if (!claim || !isClaimActive(claim, nowMs)) continue;
    if (sessionId && claim.session === sessionId) continue; // own holds never block
    const cell = cellById.get(claim.cell);
    const files = cell && Array.isArray(cell.files) ? cell.files : [];
    for (const file of files) {
      if (declared.some((declaredPath) => pathsOverlap(file, declaredPath))) {
        holds.push({ session: claim.session, cell: claim.cell, path: file });
        break;
      }
    }
  }
  return holds;
}

// startLane — the lane-mode body of startFeature (never called directly; the
// exported startFeature validates feature/phase first). Fails closed exactly
// like the default path: every precondition is read BEFORE the single write,
// so a refusal makes ZERO mutations — to this lane, to the default record, and
// to every other lane.
function startLane(root, { feature, mode, phase, sessionId, paths }) {
  // A corrupt existing lane record refuses loudly with the file untouched.
  const existing = readLaneStrict(root, feature);
  if (existing && existing.phase !== 'idle' && existing.phase !== 'compounding-complete') {
    throw new Error(
      `startFeature: refused — lane "${feature}" is mid-flight at phase "${existing.phase}", not idle or the terminal alias "compounding-complete". FIX: finish or explicitly wind down that lane first, then retry.`,
    );
  }

  const cells = listAllCellsForStart(root);

  // (a) nonterminal cells of THIS lane's feature block; other features' never do.
  const nonterminal = cells.filter(
    (cell) =>
      cell.feature === feature &&
      (cell.status === 'open' || cell.status === 'claimed' || cell.status === 'blocked'),
  );
  if (nonterminal.length > 0) {
    throw new Error(
      `startFeature: refused — feature "${feature}" already has nonterminal cell(s): ${nonterminal
        .map((c) => `${c.id}(${c.status})`)
        .join(', ')}. An abandoned cell must first be resolved through the existing drop verb (bee.mjs cells drop --id ID --reason R). FIX: cap or drop each listed cell, then retry.`,
    );
  }

  // (b) the global handoff blocks a LANE start only when it names this feature.
  const handoff = readHandoff(root);
  if (handoff && handoff.feature === feature) {
    throw new Error(
      `startFeature: refused — .bee/HANDOFF.json names feature "${feature}"; its paused work must resume or close before this lane restarts. FIX: resume the handoff (or explicitly delete HANDOFF.json once its work is truly abandoned), then retry.`,
    );
  }

  // (c) a registered worker blocks only when its cell derives to this feature.
  // readStateStrict: a corrupt default record would HIDE registered workers —
  // refuse loudly rather than start a lane over invisible work.
  const state = readStateStrict(root);
  const workers = Array.isArray(state.workers) ? state.workers : [];
  const cellById = new Map(cells.map((cell) => [cell.id, cell]));
  const laneWorkers = workers.filter((worker) => {
    const cell = worker && typeof worker.cell === 'string' ? cellById.get(worker.cell) : null;
    return Boolean(cell && cell.feature === feature);
  });
  if (laneWorkers.length > 0) {
    throw new Error(
      `startFeature: refused — registered worker(s) on feature "${feature}": ${laneWorkers
        .map((w) => `${(w && w.nickname) || '?'}(${w.cell})`)
        .join(', ')}. FIX: clear them first (bee.mjs state worker remove --nickname N, or worker clear).`,
    );
  }

  // (d) declared intended paths vs ANOTHER session's active holds.
  const declared = (Array.isArray(paths) ? paths : [paths])
    .filter((p) => typeof p === 'string' && p.trim())
    .map((p) => p.trim());
  if (declared.length > 0) {
    const reservationHolds = listActiveReservationsForStart(root).filter((reservation) =>
      declared.some((declaredPath) => pathsOverlap(reservation.path, declaredPath)),
    );
    if (reservationHolds.length > 0) {
      throw new Error(
        `startFeature: refused — declared path(s) overlap active reservation hold(s): ${reservationHolds
          .map((r) => `${r.agent}:${r.path}`)
          .join(', ')}. FIX: wait for release/expiry (bee.mjs reservations release), or start the lane over non-overlapping paths.`,
      );
    }
    const claimHolds = listClaimHoldsForStart(root, sessionId, cellById, declared);
    if (claimHolds.length > 0) {
      throw new Error(
        `startFeature: refused — declared path(s) overlap file(s) of cell(s) claimed by another session: ${claimHolds
          .map((h) => `${h.session}:${h.cell}(${h.path})`)
          .join(', ')}. FIX: wait for the claim to release or expire, or start the lane over non-overlapping paths.`,
      );
    }
  }

  // All preconditions hold — ONE atomic write to this lane's record: feature/
  // mode/phase, ALL FOUR gates reset (spec R1 applied per lane), refreshed
  // summary/next_action. created_at survives a restart; the default record and
  // every other lane stay byte-identical.
  const record = {
    schema_version: '1.0',
    feature,
    mode: mode == null ? null : String(mode),
    phase,
    approved_gates: { context: false, shape: false, execution: false, review: false },
    summary: `Feature "${feature}" started at phase "${phase}" (lane).`,
    next_action: `Invoke bee-hive for "${feature}" (phase: ${phase}).`,
    created_at:
      existing && typeof existing.created_at === 'string' && existing.created_at
        ? existing.created_at
        : new Date().toISOString(),
  };
  writeLane(root, record);
  return record;
}
