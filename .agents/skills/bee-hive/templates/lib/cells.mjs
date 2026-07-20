// cells.mjs — one JSON file per cell in .bee/cells/. Enforces lane tiers,
// gate-locked claiming, cap-requires-verify.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readJson, writeJsonAtomic } from './fsutil.mjs';
import {
  readState,
  gateApproved,
  MODEL_TIERS,
  lanePath,
  readLaneStrict,
  resolvePipeline,
  listLanes,
} from './state.mjs';
// fsh-11 (D2/D4): claim-next's cross-session selection + throw-safe two-store
// claim needs claims.mjs's atomic primitive, reservations.mjs's cross-session
// hold check, and backlog.mjs's Feature-column rank — none of these create an
// import cycle (claims.mjs/reservations.mjs import only fsutil/node builtins;
// backlog.mjs imports only fs/path — same discipline state.mjs already relies
// on for pathsOverlap/readSession above it in the module graph).
import {
  sweepExpiredClaims,
  claimCellFile,
  releaseClaim,
  clearClaim,
  listSessionRecords,
  heartbeatStale,
  readClaim,
  isClaimActive,
  claimExpiry,
  resolveSessionId,
} from './claims.mjs';
import { findSessionConflicts } from './reservations.mjs';
import { featureBacklogRank } from './backlog.mjs';
// D2 (self-correcting-loop) — resetCellBudget logs a decision through the
// SAME event-sourced log every other decision-logging verb uses (bee-bypass-
// gate toggles, etc.). decisions.mjs imports only fsutil/node builtins, so
// this creates no import cycle.
import { logDecision } from './decisions.mjs';
// parallel-scheduler D2: cycle refusal at every dep-mutating write reuses the
// SAME structural check schedule.mjs runs for diagnostics (one algorithm, one
// definition of "cycle") — cells.mjs -> schedule.mjs stays one-directional
// (schedule.mjs never imports cells.mjs back).
import { detectCycles } from './schedule.mjs';
// D5 (self-correcting-loop) — validateJudgeVerdict/deriveModelIndependence
// are pure, zero-I/O (judge.mjs imports only dispatch-guard.mjs's
// PINNED_MODEL_STATUS, no cycle back to cells.mjs); recordJudgeVerdict below
// is the sole mutator that turns a validated verdict into a trace entry.
import { validateJudgeVerdict, deriveModelIndependence } from './judge.mjs';
// GH #27.2 (cell ghf-4) — the attempt ledger's read-mutate-write mutators
// below (recordVerify/capCell/blockCell/resetCellBudget) are wrapped in
// withStoreLock('cells:<id>', ...) so two concurrent verify/cap/block calls
// on the SAME cell can no longer both read the same trace.attempts snapshot
// and have the later write silently drop the earlier append — same
// discipline reservations.mjs's reserve/release and state.mjs's startFeature
// already use. The lock key includes the cell id (not a single 'cells' name)
// so distinct cells never serialize against each other. Pure readers
// (readCell, listCells, etc.) stay lock-free.
import { withStoreLock } from './lock.mjs';

export const LANES = ['tiny', 'small', 'standard', 'high-risk', 'spike'];

// D3 (self-correcting-loop) — judge-standard change classification. Optional
// cell field `change_class`; the ONLY auto-derivation this feature permits
// (CONTEXT prohibition: "no auto-derivation beyond behavior_change=>behavior")
// is absent field + `behavior_change:true` -> 'behavior'. Anything else
// absent derives null ("unclassified" — no matrix advisory at authoring, no
// cap teeth at cap; CONTEXT: "unclassified ⇒ no matrix check").
export const CHANGE_CLASSES = ['formatting', 'bugfix', 'behavior', 'api', 'security', 'migration'];

export function deriveChangeClass(cell) {
  if (!cell || typeof cell !== 'object') return null;
  if (typeof cell.change_class === 'string' && cell.change_class) return cell.change_class;
  return cell.behavior_change === true ? 'behavior' : null;
}

// Tolerant parse of `verification_evidence` shared by the D3 cap teeth below
// and by bee.mjs's own F5 STDERR advisory (recomputed from the returned cell,
// pah-2 precedent — never a side channel). Never throws: a string that fails
// to parse, or a non-object shape, degrades to {} so callers see "no
// evidence" rather than crashing on a malformed cell.
export function parseVerificationEvidence(raw) {
  let evidence = raw;
  if (typeof evidence === 'string') {
    try {
      evidence = JSON.parse(evidence);
    } catch {
      return {};
    }
  }
  return evidence && typeof evidence === 'object' && !Array.isArray(evidence) ? evidence : {};
}

// F5: a behavior-class cap riding the pre-existing deliberate_exceptions door
// keeps today's contract untouched (no length/duplicate floor) — this just
// answers "did it ride that door", shared by the cap teeth and the advisory.
export function evidenceRidesExceptionDoor(evidence) {
  const exceptions = evidence && evidence.deliberate_exceptions;
  return Array.isArray(exceptions)
    ? exceptions.some((e) => typeof e === 'string' && e.trim().length > 0)
    : typeof exceptions === 'string' && exceptions.trim().length > 0;
}

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function utcNow() {
  return new Date().toISOString();
}

// D1 — deterministic failure-signature normalizer, exported so `cells verify`
// (mechanical fallback) and any future caller share ONE definition of
// "logically the same failure". Strips the noise that makes two runs of the
// identical failure look different byte-for-byte — ISO timestamps, absolute
// paths (never leaked into the signature even before hashing — prohibition
// in CONTEXT D1), and hex-looking runs (commit SHAs, addresses) — then picks
// the single most diagnostic line: the first line that reads as a failure
// (`FAIL|Error|refus|denied`, case-insensitive), else the first non-empty
// line, else "" for genuinely empty output. sha256 of that line, first 12
// hex chars: short enough to eyeball in a ledger row, long enough that two
// unrelated failures collide only by coincidence.
const ISO_TIMESTAMP_RE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/g;
const WIN_ABS_PATH_RE = /[A-Za-z]:\\[^\s"'<>]*/g;
// Requires at least two path segments (two slashes) so ordinary fraction-
// shaped text ("3/45 passed") is never mistaken for a path.
const UNIX_ABS_PATH_RE = /\/(?:[\w.-]+\/)+[\w.-]*/g;
const HEX_RUN_RE = /\b[0-9a-fA-F]{6,}\b/g;
const FAILING_LINE_RE = /FAIL|Error|refus|denied/i;

export function normalizeFailureSignature(output) {
  const text = typeof output === 'string' ? output : '';
  const scrubbed = text
    .replace(ISO_TIMESTAMP_RE, '<ts>')
    .replace(WIN_ABS_PATH_RE, '<path>')
    .replace(UNIX_ABS_PATH_RE, '<path>')
    .replace(HEX_RUN_RE, '<hex>');
  const lines = scrubbed.split(/\r?\n/).map((line) => line.trim());
  const chosen = lines.find((line) => line && FAILING_LINE_RE.test(line)) || lines.find((line) => line) || '';
  return crypto.createHash('sha256').update(chosen, 'utf8').digest('hex').slice(0, 12);
}

// D1 (+Δ1) — revision ledger: append-only per-cell attempt history, written
// by every recordVerify outcome and by blockCell. Appended to
// trace.attempts, NEVER trace.deviations (capCell REPLACES that key wholesale
// from its own `deviations` argument — see appendOwnershipOverride's comment
// above for the same trap with ownership_overrides). Every mutator's own
// `...trace` spread is what keeps this array alive across later transitions;
// no verb here ever rewrites or removes an existing entry.
//
// claim_session/claimed_at are read from the LIVE claim file (Δ1), not from
// the cell's own trace.claimed_at (a separate, claim-time-only stamp) —
// budget counting (D2) must key off exactly what claims.mjs itself considers
// the current acquisition. A swept/absent/sessionless claim reads as
// null/null; that undercount is conservative-safe (F2), never a refusal.
//
// GH #27.1 (D-GHF-B): acquired_at is read alongside claimed_at, falling back
// to claimed_at when the claim file predates acquired_at (legacy claims) —
// it is the immutable acquisition identity checkCellBudgets pairs on below.
// claimed_at stays exactly as before for compat (it is the heartbeat-mutated
// expiry clock, still recorded verbatim).
function appendAttempt(root, id, trace, { verdict, failureSignature = null, note = null }) {
  const attempts = Array.isArray(trace.attempts) ? trace.attempts : [];
  const claim = readClaim(root, id);
  return {
    ...trace,
    attempts: [
      ...attempts,
      {
        n: attempts.length + 1,
        at: utcNow(),
        claim_session: claim && typeof claim.session === 'string' ? claim.session : null,
        claimed_at: claim && typeof claim.claimed_at === 'string' ? claim.claimed_at : null,
        acquired_at:
          claim && typeof claim.acquired_at === 'string'
            ? claim.acquired_at
            : claim && typeof claim.claimed_at === 'string'
              ? claim.claimed_at
              : null,
        worker: typeof trace.worker === 'string' ? trace.worker : null,
        verdict,
        failure_signature: failureSignature,
        note,
      },
    ],
  };
}

// D1 (Δ2-amended): release the O_EXCL claim file on EVERY claim-clearing
// transition — cap, unclaim, block, drop, reopen — not only the claim-next
// unwind path. Without this a same-session block -> reopen -> claim round
// trip self-refuses CLAIMED for the claim's full TTL, since nothing else
// ever removes the file the original claim created. Best-effort by design:
// a rare GATE_HELD (another in-flight adopt/sweep on the SAME cell,
// millisecond-scale) or an unexpected fs error here must never fail a cell
// transition that has already been written to disk by the time this runs —
// the claim file is a secondary, TTL-bounded artifact, never the source of
// truth for cell status. Ownership checking on these verbs is a separate,
// later concern (D4/msh-4); this only guarantees the claim file never
// outlives the "claimed" status it was created for.
function releaseClaimFileBestEffort(root, id) {
  try {
    clearClaim(root, id);
  } catch {
    // never let claim-file cleanup fail a cell transition that already committed
  }
}

// D4 (msh-4) — typed ownership guard: composes readClaim/isClaimActive/
// claimExpiry (never a new claims.mjs reader). Never throws for contention,
// matching claims.mjs's own typed-failure convention (claimCellFile,
// releaseClaim) — the mutators below are the guard-CONSUMED callers that turn
// a refusal into their own thrown Error, the same style every other
// cells.mjs refusal already uses.
//
// ok:true (proceed unchanged) when: no claim file, an expired claim (rescue
// stays possible), a sessionless claim (single-session `cells claim` writes
// exactly this shape — D1 Δ2 — so single-session use never reaches a
// refusal), or the caller's resolved session (D3) matches the claim's. A
// LIVE claim carrying a session that differs from the caller ⇒ typed
// NOT_OWNER, naming owner + expiry in claimCellFile's own wording.
function checkClaimOwnership(root, id, sessionId) {
  const claim = readClaim(root, id);
  if (!claim || !isClaimActive(claim)) return { ok: true };
  const owner = claim.session;
  if (!owner) return { ok: true };
  const caller = resolveSessionId({ flag: sessionId });
  if (caller === owner) return { ok: true };
  return {
    ok: false,
    code: 'NOT_OWNER',
    reason: `cell "${id}" is claimed by session "${owner}" (${claimExpiry(claim)}) — another session owns it. Pass --force-ownership to override (audited).`,
    holder: owner,
  };
}

// D4 Δ5-amended — the force-ownership audit is a DISTINCT append-only trace
// key, trace.ownership_overrides, never trace.deviations: capCell REPLACES
// trace.deviations wholesale from its own `deviations` argument, so an
// append there would be silently wiped at the very next cap; the `...trace`
// spread every mutator already does preserves this unknown key across every
// transition. "Force always leaves an audit line" (must-have truth) — every
// call made with forceOwnership true appends one row here, whether or not a
// live conflicting claim actually existed to bypass (owner_bypassed is null
// when there was nothing to bypass, so the line still tells the truth).
function appendOwnershipOverride(trace, { verb, sessionId, ownership }) {
  const overrides = Array.isArray(trace.ownership_overrides) ? trace.ownership_overrides : [];
  return {
    ...trace,
    ownership_overrides: [
      ...overrides,
      {
        verb,
        forced_by: resolveSessionId({ flag: sessionId }),
        owner_bypassed: ownership.ok ? null : ownership.holder,
        at: utcNow(),
      },
    ],
  };
}

// Shared guard entrypoint for every D4-covered mutator: runs the ownership
// check, and either throws the typed refusal (no force) or returns the
// possibly-audited trace to use going forward (force-ownership was passed).
// `verb` names the caller for both the thrown message and the audit row.
function guardClaimOwnership(root, id, trace, verb, { sessionId, forceOwnership = false } = {}) {
  const ownership = checkClaimOwnership(root, id, sessionId);
  if (!forceOwnership) {
    if (!ownership.ok) throw new Error(`${verb}: ${ownership.reason}`);
    return trace;
  }
  return appendOwnershipOverride(trace, { verb, sessionId, ownership });
}

function defaultTrace() {
  return {
    worker: null,
    outcome: null,
    files_changed: [],
    deviations: [],
    friction: null,
    capped_at: null,
    behavior_change: false,
    verification_evidence: null,
    verify_output: null,
    verify_passed: null,
  };
}

export function cellsDir(root) {
  return path.join(root, '.bee', 'cells');
}

function cellFile(root, id) {
  return path.join(cellsDir(root), `${id}.json`);
}

export function listCells(root, { feature = null, status = null } = {}) {
  const dir = cellsDir(root);
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
    if (!cell || typeof cell !== 'object') continue;
    if (feature && cell.feature !== feature) continue;
    if (status && cell.status !== status) continue;
    cells.push(cell);
  }
  cells.sort((a, b) => String(a.id).localeCompare(String(b.id), 'en', { numeric: true }));
  return cells;
}

export function readCell(root, id) {
  if (!id || !ID_PATTERN.test(String(id))) return null;
  return readJson(cellFile(root, id), null);
}

export function writeCell(root, cell) {
  if (!cell || !cell.id || !ID_PATTERN.test(String(cell.id))) {
    throw new Error(`writeCell: cell needs a valid id (got ${JSON.stringify(cell?.id)}).`);
  }
  writeJsonAtomic(cellFile(root, cell.id), cell);
  return cell;
}

function validateNewCell(root, cell) {
  if (!cell || typeof cell !== 'object' || Array.isArray(cell)) {
    throw new Error('addCell: cell must be a JSON object.');
  }
  for (const field of ['id', 'feature', 'title', 'action', 'verify']) {
    if (typeof cell[field] !== 'string' || !cell[field].trim()) {
      throw new Error(`addCell: cell is missing required field "${field}" (non-empty string).`);
    }
  }
  if (!ID_PATTERN.test(cell.id)) {
    throw new Error(
      `addCell: invalid id "${cell.id}" — use letters, digits, dot, dash, underscore (e.g. "auth-3").`,
    );
  }
  if (!LANES.includes(cell.lane)) {
    throw new Error(
      `addCell: invalid lane "${cell.lane}" — must be one of: ${LANES.join(', ')}.`,
    );
  }
  if (cell.lane === 'standard' || cell.lane === 'high-risk') {
    const truths = cell.must_haves && cell.must_haves.truths;
    if (!Array.isArray(truths) || truths.length === 0) {
      throw new Error(
        `addCell: lane "${cell.lane}" requires non-empty must_haves.truths (observable truths to verify).`,
      );
    }
  }
  // D9: optional pbi field references a backlog id — persisted verbatim, no
  // validation coupling (a missing/stale reference is a grooming find, never a
  // cap/claim blocker). Only reject an outright non-string value.
  if (cell.pbi !== undefined && cell.pbi !== null && typeof cell.pbi !== 'string') {
    throw new Error('addCell: optional "pbi" must be a string backlog id when present.');
  }
  // D11/D12: optional model tier — planning assigns it so swarming can resolve
  // tier → model and the harness can keep the ceiling model scarce (P7). Absent
  // = untiered (never a blocker); a present value must be a known tier.
  if (cell.tier !== undefined && cell.tier !== null && !MODEL_TIERS.includes(cell.tier)) {
    throw new Error(
      `addCell: optional "tier" must be one of ${MODEL_TIERS.join(', ')} when present.`,
    );
  }
  // D3 (self-correcting-loop): optional judge-standard classification — the
  // enum itself is a hard validation (same shape as tier/lane above); the
  // MATRIX check that reads it is advisory-only and lives in bee.mjs (F4).
  if (
    cell.change_class !== undefined &&
    cell.change_class !== null &&
    !CHANGE_CLASSES.includes(cell.change_class)
  ) {
    throw new Error(
      `addCell: optional "change_class" must be one of ${CHANGE_CLASSES.join(', ')} when present.`,
    );
  }
  // GH #27.3 (D-GHF-C): an authored `budgets` object is validated strictly —
  // unlike resolveCellBudgets's forgiving runtime fallback (default on bad
  // input, clamp on over-ceiling input), a malformed value here is refused
  // outright so a typo at authoring time surfaces immediately instead of
  // silently degrading at claim time.
  if (cell.budgets !== undefined && cell.budgets !== null) {
    if (typeof cell.budgets !== 'object' || Array.isArray(cell.budgets)) {
      throw new Error('addCell: optional "budgets" must be a plain object when present.');
    }
    const knownKeys = Object.keys(DEFAULT_BUDGETS);
    for (const key of Object.keys(cell.budgets)) {
      if (!knownKeys.includes(key)) {
        throw new Error(
          `addCell: unknown "budgets" key "${key}" — must be one of: ${knownKeys.join(', ')}.`,
        );
      }
    }
    for (const key of knownKeys) {
      if (!(key in cell.budgets)) continue;
      const value = cell.budgets[key];
      const hardMax = BUDGET_HARD_MAX[key];
      if (!Number.isInteger(value) || value < 1 || value > hardMax) {
        throw new Error(
          `addCell: "budgets.${key}" must be an integer in [1, ${hardMax}] when present, got ${JSON.stringify(value)}.`,
        );
      }
    }
  }
  if (readCell(root, cell.id)) {
    throw new Error(`addCell: cell "${cell.id}" already exists.`);
  }
}

function normalizeNewCell(cell) {
  return {
    ...cell,
    status: cell.status || 'open',
    deps: Array.isArray(cell.deps) ? cell.deps : [],
    decisions: Array.isArray(cell.decisions) ? cell.decisions : [],
    files: Array.isArray(cell.files) ? cell.files : [],
    read_first: Array.isArray(cell.read_first) ? cell.read_first : [],
    trace: { ...defaultTrace(), ...(cell.trace || {}) },
  };
}

// assertNoCycle (D2) — the ONE cycle refusal used at every dep-mutating
// write: addCell, addCells, updateCell (when it changes deps). Union of ALL
// on-disk cells (every status — detectCycles is a structural check, not a
// schedulability one; overlap stays legal and is never checked here) with the
// incoming set (new cells being added, or an existing cell carrying a patched
// `deps`), overlaid by id so a batch/patch that also touches an on-disk id
// sees its OWN version, not the stale disk copy. Must run BEFORE any
// writeCell — a refusal here must never leave partial state behind (addCells
// stays all-or-nothing; addCell/updateCell touch nothing on a refusal).
// Refusal is scoped to cycles the WRITE introduces or participates in: a
// pre-existing cycle among untouched on-disk cells never blocks unrelated
// writes — per D2 those are reported by `cells schedule` diagnostics, not
// enforced here.
function assertNoCycle(root, verb, incomingCells) {
  const byId = new Map();
  for (const cell of listCells(root)) {
    if (cell && typeof cell.id === 'string' && cell.id) byId.set(cell.id, cell);
  }
  const incomingIds = new Set();
  for (const cell of incomingCells) {
    if (cell && typeof cell.id === 'string' && cell.id) {
      byId.set(cell.id, cell);
      incomingIds.add(cell.id);
    }
  }
  const cycles = detectCycles([...byId.values()]).filter((cycle) =>
    cycle.some((id) => incomingIds.has(id)),
  );
  if (cycles.length > 0) {
    const named = cycles.map((cycle) => cycle.join(' -> ')).join('; ');
    throw new Error(
      `${verb}: dependency cycle refused — ${named}. Cycles are illegal at every dep-mutating write (D2); file overlap stays legal and is never refused.`,
    );
  }
}

export function addCell(root, cell) {
  validateNewCell(root, cell);
  const normalized = normalizeNewCell(cell);
  assertNoCycle(root, 'addCell', [normalized]);
  return writeCell(root, normalized);
}

// Batch add: validates EVERY cell (against disk and against duplicate ids
// within the batch itself) before writing any — all-or-nothing, so a failing
// cell in the middle of a slice never leaves partial state behind. The cycle
// check (D2) runs over the whole batch + on-disk store, also before any
// write, so a cycle spanning two cells in the same batch (or a batch cell and
// an existing on-disk cell) refuses the entire batch, nothing written.
export function addCells(root, cells) {
  if (!Array.isArray(cells) || cells.length === 0) {
    throw new Error('addCells: expected a non-empty JSON array of cells.');
  }
  const seen = new Set();
  const normalized = [];
  for (const cell of cells) {
    validateNewCell(root, cell);
    if (seen.has(cell.id)) {
      throw new Error(`addCells: duplicate id "${cell.id}" within the batch.`);
    }
    seen.add(cell.id);
    normalized.push(normalizeNewCell(cell));
  }
  assertNoCycle(root, 'addCells', normalized);
  return normalized.map((cell) => writeCell(root, cell));
}

// ─── updateCell — door-validated in-place revision (cells-update-verb) ─────
// Validation repair loops legitimately revise a cell after creation (a plan
// checker or cell reviewer prescribes a fix). Before this verb the only path
// was rule 11's hand-edit fallback, which renders full JSON diffs into the
// user's working view — the exact noise the CLI-owned-state contract
// (decision bb4bb18e) removed for state.json/backlog.jsonl.
//
// The field list is derived FROM the validator map (critical pattern
// 20260710: a boundary that lists names leaks the field you forgot — an
// unmapped key is a refusal, not a pass-through). Frozen surfaces are named
// in the refusal so the caller learns the right verb: status/trace belong to
// claim/verify/cap/block/drop, tier to the tier verb, id/feature to nothing.

const UPDATE_FIELD_VALIDATORS = {
  title: (v) => (typeof v === 'string' && v.trim() ? null : 'must be a non-empty string'),
  action: (v) => (typeof v === 'string' && v.trim() ? null : 'must be a non-empty string'),
  verify: (v) => (typeof v === 'string' && v.trim() ? null : 'must be a non-empty string'),
  files: (v) => (isStringArray(v) ? null : 'must be an array of strings'),
  read_first: (v) => (isStringArray(v) ? null : 'must be an array of strings'),
  deps: (v) => (isStringArray(v) ? null : 'must be an array of strings'),
  decisions: (v) => (isStringArray(v) ? null : 'must be an array of strings'),
  must_haves: (v) =>
    v && typeof v === 'object' && !Array.isArray(v) ? null : 'must be a JSON object',
  behavior_change: (v) => (typeof v === 'boolean' ? null : 'must be a boolean'),
  lane: (v) => (LANES.includes(v) ? null : `must be one of: ${LANES.join(', ')}`),
  pbi: (v) => (v === null || typeof v === 'string' ? null : 'must be a string or null'),
  // D3: nullable so a cell can un-set an explicit change_class back to
  // "derive from behavior_change" — same null-allowed shape as pbi above.
  change_class: (v) =>
    v === null || CHANGE_CLASSES.includes(v) ? null : `must be null or one of: ${CHANGE_CLASSES.join(', ')}`,
};

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

const UPDATE_FROZEN_HINTS = {
  id: 'a cell id is permanent — add a new cell instead',
  feature: 'a cell never moves between features — drop and re-add instead',
  status: 'status moves only through claim/verify/cap/block/drop',
  trace: 'the trace is the frozen audit record — claim/verify/cap own it',
  tier: 'use the tier verb (bee.mjs cells tier --id ID --tier T)',
};

// Strict read for the update path only (readReviewStrict/readStateStrict
// pattern): fail-open reads elsewhere are untouched; a write verb must never
// merge a patch into defaults over a present-but-corrupt file.
function readCellStrictForUpdate(root, id) {
  const file = cellFile(root, id);
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      throw new Error(`updateCell: cell "${id}" not found.`);
    }
    throw new Error(
      `updateCell: could not read "${file}" (${err && err.code ? err.code : err}) — refusing to touch it. FIX: inspect/restore the file, then retry.`,
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      `updateCell: "${file}" exists but is not valid JSON — refusing to merge a patch over a corrupt cell. FIX: inspect/restore the file (e.g. "git checkout -- ${path.relative(root, file)}"), then retry.`,
    );
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(
      `updateCell: "${file}" exists but is not a JSON object — refusing to merge a patch over a corrupt cell.`,
    );
  }
  return parsed;
}

export function updateCell(root, id, patch) {
  if (!id || !ID_PATTERN.test(String(id))) {
    throw new Error(`updateCell: invalid id "${id}".`);
  }
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new Error('updateCell: patch must be a JSON object.');
  }
  const keys = Object.keys(patch);
  if (keys.length === 0) {
    throw new Error('updateCell: patch is empty — nothing to update.');
  }
  for (const key of keys) {
    const validator = UPDATE_FIELD_VALIDATORS[key];
    if (!validator) {
      const hint = UPDATE_FROZEN_HINTS[key];
      throw new Error(
        hint
          ? `updateCell: field "${key}" is frozen — ${hint}. The whole patch is refused; the cell is untouched.`
          : `updateCell: unknown field "${key}" — updatable fields: ${Object.keys(UPDATE_FIELD_VALIDATORS).join(', ')}. The whole patch is refused; the cell is untouched.`,
      );
    }
    const problem = validator(patch[key]);
    if (problem) {
      throw new Error(
        `updateCell: field "${key}" ${problem}. The whole patch is refused; the cell is untouched.`,
      );
    }
  }

  const cell = readCellStrictForUpdate(root, id);
  if (cell.status !== 'open' && cell.status !== 'blocked') {
    throw new Error(
      `updateCell: cell "${id}" has status "${cell.status}" — only open or blocked cells are updatable (claimed = a live worker owns it; capped/dropped = frozen audit). The cell is untouched.`,
    );
  }

  const merged = { ...cell, ...patch };
  if (merged.lane === 'standard' || merged.lane === 'high-risk') {
    const truths = merged.must_haves && merged.must_haves.truths;
    if (!Array.isArray(truths) || truths.length === 0) {
      throw new Error(
        `updateCell: lane "${merged.lane}" requires non-empty must_haves.truths — the patch would leave "${id}" without them. The cell is untouched.`,
      );
    }
  }
  // D2: only a patch that changes `deps` can reintroduce a cycle — checking
  // unconditionally would re-validate every unrelated field edit against the
  // whole store for no reason. Runs before writeCell; a refusal leaves the
  // cell untouched, same guarantee as every other updateCell refusal above.
  if (Object.prototype.hasOwnProperty.call(patch, 'deps')) {
    assertNoCycle(root, 'updateCell', [merged]);
  }
  return writeCell(root, merged);
}

function depsAllCapped(root, cell) {
  const missing = [];
  for (const dep of cell.deps || []) {
    const depCell = readCell(root, dep);
    if (!depCell || depCell.status !== 'capped') missing.push(dep);
  }
  return missing;
}

export function readyCells(root, feature = null) {
  return listCells(root, { feature, status: 'open' }).filter(
    (cell) => depsAllCapped(root, cell).length === 0,
  );
}

// fsh-5 (D2/D4) — the cell-feature → lane-record read for ENFORCEMENT. The
// per-feature lane is keyed by cell.feature (NAMING TRAP: the cell field named
// `lane` is the risk tier — tiny/small/standard/high-risk — a different thing
// entirely). A path-shaped feature can never name a lane record (null — the
// default gate governs, exactly today's behavior); a missing record is null;
// a present-but-corrupt record THROWS via readLaneStrict — the default gate
// must never silently authorize a lane cell over a corrupt lane record.
function laneRecordForFeature(root, feature) {
  if (typeof feature !== 'string' || !feature.trim()) return null;
  let file;
  try {
    file = lanePath(root, feature);
  } catch {
    return null;
  }
  if (!fs.existsSync(file)) return null;
  return readLaneStrict(root, feature);
}

export function claimCell(root, id, worker) {
  if (typeof worker !== 'string' || !worker.trim()) {
    throw new Error('claimCell: worker name is required.');
  }
  // fsh-5 (D2): the execution gate resolves from the CELL's own feature — a
  // lane record for cell.feature authorizes (or refuses) the claim with ITS
  // gate; no lane record means the default pipeline's gate, byte-identical to
  // the single-pipeline model (D4 zero-lane parity). A missing cell resolves
  // through the default gate so the error precedence (gate first, then
  // not-found) matches today exactly.
  const cell = readCell(root, id);
  const laneRecord = cell ? laneRecordForFeature(root, cell.feature) : null;
  const gateSource = laneRecord || readState(root);
  if (!gateApproved(gateSource, 'execution')) {
    throw new Error(
      laneRecord
        ? `claimCell: lane "${cell.feature}" gate "execution" is not approved — cells of this feature cannot be claimed before ITS lane passes Gate 3 (D2: only the lane's own approvals authorize its cells — the default pipeline's gate never does). Surface Gate 3 to the user for lane "${cell.feature}" and set its approved_gates.execution once approved.`
        : 'claimCell: gate "execution" is not approved — cells cannot be claimed before execution is approved. Surface Gate 3 to the user ("Feasibility validated. Approve execution?") and set approved_gates.execution once approved. The opt-in gate_bypass switch may self-approve: level "normal" covers tiny/small/standard non-hard-gate work only; levels "full" and "total" also self-approve high-risk/hard-gate execution (decision 0010, total-autopilot dcf01d7b).',
    );
  }
  if (!cell) throw new Error(`claimCell: cell "${id}" not found.`);
  if (cell.status !== 'open') {
    throw new Error(
      `claimCell: cell "${id}" is "${cell.status}", not "open" — only open cells can be claimed. Run bee.mjs cells ready to list claimable cells.`,
    );
  }
  const uncapped = depsAllCapped(root, cell);
  if (uncapped.length > 0) {
    throw new Error(
      `claimCell: cell "${id}" has uncapped deps: ${uncapped.join(', ')} — deps must be capped first.`,
    );
  }
  cell.status = 'claimed';
  cell.trace = { ...defaultTrace(), ...(cell.trace || {}), worker: worker.trim() };
  cell.trace.claimed_at = utcNow();
  return writeCell(root, cell);
}

export async function recordVerify(
  root,
  id,
  { command, output = null, passed, sessionId, forceOwnership = false, signature = null },
) {
  if (typeof command !== 'string' || !command.trim()) {
    throw new Error('recordVerify: command is required.');
  }
  if (typeof passed !== 'boolean') {
    throw new Error('recordVerify: passed must be true or false.');
  }
  return withStoreLock(root, `cells:${id}`, () => {
    const cell = readCell(root, id);
    if (!cell) throw new Error(`recordVerify: cell "${id}" not found.`);
    let trace = { ...defaultTrace(), ...(cell.trace || {}) };
    trace = guardClaimOwnership(root, id, trace, 'recordVerify', { sessionId, forceOwnership }); // D4
    trace.verify_command = command;
    trace.verify_output = output;
    trace.verify_passed = passed;
    trace.verified_at = utcNow();
    // D1: worker-suppliable --signature wins over the mechanical fallback; a
    // passing verify never carries a failure signature at all.
    const failureSignature = passed
      ? null
      : typeof signature === 'string' && signature.trim()
        ? signature.trim()
        : normalizeFailureSignature(output);
    trace = appendAttempt(root, id, trace, { verdict: passed ? 'pass' : 'fail', failureSignature });
    cell.trace = trace;
    return writeCell(root, cell);
  });
}

// D3+Δ5 — the anti-boilerplate floor for behavior-class cap teeth: 80 chars,
// and never byte-identical (sha256 of the trimmed text) to another cell's own
// recorded red evidence. Reuses listCells' own tolerant readJson (Δ5: "the
// cap-time duplicate scan tolerant-parses — skips unparseable sibling files,
// never throws") instead of a second hand-rolled readdir/parse loop.
const RED_EVIDENCE_MIN_CHARS = 80;

function findDuplicateRedEvidence(root, id, trimmed) {
  const hash = crypto.createHash('sha256').update(trimmed, 'utf8').digest('hex');
  for (const sibling of listCells(root)) {
    if (!sibling || sibling.id === id) continue;
    const evidence = parseVerificationEvidence(sibling.trace && sibling.trace.verification_evidence);
    const red = typeof evidence.red_failure_evidence === 'string' ? evidence.red_failure_evidence.trim() : '';
    if (red.length < RED_EVIDENCE_MIN_CHARS) continue;
    if (crypto.createHash('sha256').update(red, 'utf8').digest('hex') === hash) return sibling.id;
  }
  return null;
}

export async function capCell(
  root,
  id,
  {
    files_changed = [],
    deviations = [],
    friction = null,
    behavior_change,
    verification_evidence = null,
    outcome,
    sessionId,
    forceOwnership = false,
    overrideJudge = null,
  } = {},
) {
  const overrideReason = typeof overrideJudge === 'string' ? overrideJudge.trim() : '';
  const saved = await withStoreLock(root, `cells:${id}`, () => {
    const cell = readCell(root, id);
    if (!cell) throw new Error(`capCell: cell "${id}" not found.`);
    // Honor the cell's declared behavior_change when the caller omits it — the CLI
    // flag is opt-in, so a cell planned as behavior_change must not silently lose
    // its evidence/before-state guards (and its scribing debt) at cap just because
    // --behavior-change was not repeated. Explicit false/true from the caller wins.
    const bc =
      behavior_change === undefined ? cell.behavior_change === true : behavior_change === true;
    if (cell.status === 'capped') throw new Error(`capCell: cell "${id}" is already capped.`);
    if (cell.status === 'dropped') throw new Error(`capCell: cell "${id}" was dropped.`);
    let trace = { ...defaultTrace(), ...(cell.trace || {}) };
    trace = guardClaimOwnership(root, id, trace, 'capCell', { sessionId, forceOwnership }); // D4
    if (trace.verify_passed !== true) {
      throw new Error(
        `capCell: cell "${id}" has no passing verify result — run the cell's verify command and record it (bee.mjs cells verify --id ${id} --command CMD --passed true) before capping.`,
      );
    }
    // D-GHF-C (GH #27.5): a NEEDS_REVISION semantic-judge verdict (judge.mjs
    // JUDGE_VERDICTS — the enum has no 'FAIL', 'NEEDS_REVISION' is the fail
    // value) blocks cap unless an audited --override-judge reason is
    // supplied. Only the LATEST trace.semantic_judge entry is consulted — a
    // cell with no semantic_judge entries at all is untouched by this guard
    // (byte-identical to pre-ghf-6 behavior).
    const judgeEntries = Array.isArray(trace.semantic_judge) ? trace.semantic_judge : [];
    const latestJudge = judgeEntries.length ? judgeEntries[judgeEntries.length - 1] : null;
    if (latestJudge && latestJudge.verdict === 'NEEDS_REVISION' && !overrideReason) {
      const err = new Error(
        `capCell: cell "${id}" has a NEEDS_REVISION semantic-judge verdict — rework the cell and record a PASS verdict (bee.mjs cells judge-record), or cap with an audited override (bee.mjs cells cap --id ${id} --override-judge "<reason>").`,
      );
      err.code = 'JUDGE_REWORK_REQUIRED';
      throw err;
    }
    // Override always audited: appended to append-only trace.judge_overrides
    // and logged as a decision BEFORE the cell write (inside the lock,
    // mirroring resetCellBudget's D-GHF-C audit-before-write ordering) so the
    // decision record survives even if the write itself fails. Recorded
    // whenever a reason is supplied, not only when the guard above actually
    // fired — an override is audit-worthy on its own, regardless of whether
    // it was strictly needed.
    if (overrideReason) {
      const overrides = Array.isArray(trace.judge_overrides) ? trace.judge_overrides : [];
      const overrideEntry = {
        overridden_at: utcNow(),
        reason: overrideReason,
        last_verdict: latestJudge ? latestJudge.verdict : null,
      };
      logDecision(root, {
        decision: `«cells cap: cell "${id}" judge override by ${trace.worker || 'unknown'} — ${overrideReason}»`,
        rationale:
          'Audited cap over a NEEDS_REVISION (or absent) semantic-judge verdict (D-GHF-C, GH #27.5) — the verdict itself is never rewritten, only a judge_overrides marker appended.',
        scope: 'repo',
        source: 'user',
      });
      trace = { ...trace, judge_overrides: [...overrides, overrideEntry] };
    }
    if (bc && !verification_evidence) {
      throw new Error(
        `capCell: cell "${id}" declares behavior_change but provides no verification_evidence — attach evidence (--evidence-file) or drop the behavior_change flag.`,
      );
    }
    // Decision 0009: a behavior_change cell must record the "before" it changed —
    // a characterization of prior behavior — not just an assertion that the new
    // behavior works. This blocks assertion-capping at the source (worker must
    // capture the git-show / failing pre-change check at cap time) instead of
    // letting reviewing catch it later and spawn a whole evidence-backfill cell.
    if (bc && verification_evidence) {
      let evidence = verification_evidence;
      if (typeof evidence === 'string') {
        try {
          evidence = JSON.parse(evidence);
        } catch {
          evidence = null; // freeform evidence — the non-empty check above already applies
        }
      }
      if (evidence && typeof evidence === 'object' && !Array.isArray(evidence)) {
        const before = evidence.red_failure_evidence;
        const hasBefore = typeof before === 'string' && before.trim().length > 0;
        const exceptions = evidence.deliberate_exceptions;
        const hasException = Array.isArray(exceptions)
          ? exceptions.some((e) => typeof e === 'string' && e.trim().length > 0)
          : typeof exceptions === 'string' && exceptions.trim().length > 0;
        if (!hasBefore && !hasException) {
          throw new Error(
            `capCell: behavior_change cell "${id}" needs a "before" characterization — set red_failure_evidence in the evidence (the prior behavior this change alters: a git-show of the old state, or a pre-change check that failed). If there is genuinely no prior behavior (a brand-new surface), say so in deliberate_exceptions. An assertion that the new behavior works is not evidence that behavior changed.`,
          );
        }
      }
    }
    // D3 (self-correcting-loop) — behavior-class cap teeth, ADDITIVE to the
    // Decision 0009 "before" check above. Gated on the cell's (derived or
    // explicit) change_class, NOT on `bc` — an explicit change_class:"behavior"
    // cell still gets the teeth even if it forgot --behavior-change; the common
    // path (behavior_change:true, change_class absent) reaches here via the
    // same derivation either way (CONTEXT D3 prohibition: no auto-derivation
    // beyond behavior_change=>behavior). F5: a cap riding the deliberate_
    // exceptions door keeps today's contract untouched — no length/duplicate
    // floor; the STDERR advisory noting that lives in bee.mjs's handler layer
    // (F4 precedent), recomputed from the returned cell post-cap.
    if (deriveChangeClass({ ...cell, behavior_change: bc }) === 'behavior') {
      const evidence = parseVerificationEvidence(verification_evidence);
      if (!evidenceRidesExceptionDoor(evidence)) {
        const before = typeof evidence.red_failure_evidence === 'string' ? evidence.red_failure_evidence.trim() : '';
        if (!before) {
          throw new Error(
            `capCell: behavior-class cell "${id}" (D3 judge-standard matrix) is missing verification_evidence.red_failure_evidence — the matrix minimum for a "behavior" change. FIX: attach red_failure_evidence (>=${RED_EVIDENCE_MIN_CHARS} chars characterizing the prior behavior) or record deliberate_exceptions.`,
          );
        }
        if (before.length < RED_EVIDENCE_MIN_CHARS) {
          throw new Error(
            `capCell: behavior-class cell "${id}" red_failure_evidence is only ${before.length} char(s) — the D3 judge-standard matrix requires >=${RED_EVIDENCE_MIN_CHARS} chars (anti-boilerplate floor). FIX: expand the evidence to genuinely characterize the prior behavior, or record deliberate_exceptions.`,
          );
        }
        const collision = findDuplicateRedEvidence(root, id, before);
        if (collision) {
          throw new Error(
            `capCell: behavior-class cell "${id}" red_failure_evidence is byte-identical to cell "${collision}"'s recorded evidence — the D3 judge-standard matrix refuses reused boilerplate. FIX: write evidence specific to this cell's own prior behavior.`,
          );
        }
      }
    }
    // Decision 0004: small+ lanes cap only on recorded proof, never on an assertion.
    if (cell.lane === 'small' || cell.lane === 'standard' || cell.lane === 'high-risk') {
      const output = trace.verify_output;
      const hasOutput = typeof output === 'string' ? output.trim().length > 0 : output != null;
      const hasEvidence =
        verification_evidence != null &&
        (typeof verification_evidence !== 'string' || verification_evidence.trim().length > 0);
      if (!hasOutput && !hasEvidence) {
        throw new Error(
          `capCell: lane "${cell.lane}" cell "${id}" has a passing verify flag but no recorded proof — re-record the verify with its output (bee.mjs cells verify --id ${id} --command CMD --output "..." --passed true) or attach verification_evidence (--evidence-file). An assertion is not evidence.`,
        );
      }
      if (!Array.isArray(files_changed) || files_changed.length === 0) {
        throw new Error(
          `capCell: lane "${cell.lane}" cell "${id}" requires non-empty files_changed (--files a.js,b.js) — record what the worker actually touched. A cell that changed nothing is a drop or a NOOP, not a cap.`,
        );
      }
    }
    if (cell.lane === 'high-risk') {
      if (typeof outcome !== 'string' || !outcome.trim()) {
        throw new Error(`capCell: high-risk cell "${id}" requires an outcome summary.`);
      }
    }
    cell.status = 'capped';
    cell.trace = {
      ...trace,
      files_changed: Array.isArray(files_changed) ? files_changed : [],
      deviations: Array.isArray(deviations) ? deviations : [],
      friction: friction ?? null,
      behavior_change: bc,
      verification_evidence: verification_evidence ?? null,
      outcome: typeof outcome === 'string' && outcome.trim() ? outcome : trace.outcome,
      capped_at: utcNow(),
    };
    return writeCell(root, cell);
  });
  releaseClaimFileBestEffort(root, id); // D1 Δ2: cap is a claim-clearing transition
  return saved;
}

export async function blockCell(root, id, reason, { sessionId, forceOwnership = false } = {}) {
  if (typeof reason !== 'string' || !reason.trim()) {
    throw new Error('blockCell: a reason is required.');
  }
  const saved = await withStoreLock(root, `cells:${id}`, () => {
    const cell = readCell(root, id);
    if (!cell) throw new Error(`blockCell: cell "${id}" not found.`);
    let trace = { ...defaultTrace(), ...(cell.trace || {}) };
    trace = guardClaimOwnership(root, id, trace, 'blockCell', { sessionId, forceOwnership }); // D4
    // D1: block has no verify output to normalize — the reason text itself is
    // the closest analog, so it feeds both the ledger's note and its signature.
    trace = appendAttempt(root, id, trace, {
      verdict: 'blocked',
      failureSignature: normalizeFailureSignature(reason),
      note: reason,
    });
    cell.status = 'blocked';
    cell.trace = { ...trace, blocked_reason: reason };
    return writeCell(root, cell);
  });
  releaseClaimFileBestEffort(root, id); // D1 Δ2: block is a claim-clearing transition
  return saved;
}

export function dropCell(root, id, reason) {
  if (typeof reason !== 'string' || !reason.trim()) {
    throw new Error('dropCell: a reason is required.');
  }
  const cell = readCell(root, id);
  if (!cell) throw new Error(`dropCell: cell "${id}" not found.`);
  cell.status = 'dropped';
  cell.trace = { ...defaultTrace(), ...(cell.trace || {}), dropped_reason: reason };
  const saved = writeCell(root, cell);
  releaseClaimFileBestEffort(root, id); // D1 Δ2: drop is a claim-clearing transition
  return saved;
}

// Clear the claim and any recorded verify from a trace, so a cell returned to
// "open" must be re-claimed and re-verified before it can cap again — a stale
// verify_passed must never let a later re-cap skip its proof (capCell gates on
// trace.verify_passed === true). Keeps the rest of the trace for audit.
function releaseTrace(existing) {
  const trace = { ...defaultTrace(), ...(existing || {}) };
  trace.worker = null;
  trace.claimed_at = null;
  trace.verify_command = null;
  trace.verify_output = null;
  trace.verify_passed = null;
  trace.verified_at = null;
  return trace;
}

// unclaimCell — the inverse of claim: a mis-claimed or abandoned "claimed" cell
// goes back to "open" so another worker can pick it up. Refuses on any other
// status (GitHub #12). Mirrors claimCell's own-status assertion shape.
export function unclaimCell(root, id, { sessionId, forceOwnership = false } = {}) {
  const cell = readCell(root, id);
  if (!cell) throw new Error(`unclaimCell: cell "${id}" not found.`);
  if (cell.status !== 'claimed') {
    throw new Error(
      `unclaimCell: cell "${id}" is "${cell.status}", not "claimed" — only a claimed cell can be unclaimed (returned to open). For a capped/blocked/dropped cell use bee.mjs cells reopen.`,
    );
  }
  let trace = { ...defaultTrace(), ...(cell.trace || {}) };
  trace = guardClaimOwnership(root, id, trace, 'unclaimCell', { sessionId, forceOwnership }); // D4
  cell.status = 'open';
  cell.trace = releaseTrace(trace);
  const saved = writeCell(root, cell);
  releaseClaimFileBestEffort(root, id); // D1 Δ2: unclaim is a claim-clearing transition (forced unclaim also clears — D4 Δ5)
  return saved;
}

// reopenCell — bring a terminal cell (capped / blocked / dropped) back to "open"
// for rework, recording why. Refuses on "open" (already there) and on "claimed"
// (that is unclaim's job). Clears the recorded verify so the reopened cell must
// prove itself again before capping (GitHub #12).
export function reopenCell(root, id, reason, { sessionId, forceOwnership = false } = {}) {
  if (typeof reason !== 'string' || !reason.trim()) {
    throw new Error('reopenCell: a reason is required.');
  }
  const cell = readCell(root, id);
  if (!cell) throw new Error(`reopenCell: cell "${id}" not found.`);
  if (cell.status === 'open') {
    throw new Error(`reopenCell: cell "${id}" is already "open".`);
  }
  if (cell.status === 'claimed') {
    throw new Error(
      `reopenCell: cell "${id}" is "claimed" — use bee.mjs cells unclaim to release the claim back to open.`,
    );
  }
  let guardedTrace = { ...defaultTrace(), ...(cell.trace || {}) };
  guardedTrace = guardClaimOwnership(root, id, guardedTrace, 'reopenCell', { sessionId, forceOwnership }); // D4
  cell.status = 'open';
  const trace = releaseTrace(guardedTrace);
  trace.blocked_reason = null;
  trace.dropped_reason = null;
  trace.reopened_at = utcNow();
  trace.reopened_reason = reason;
  cell.trace = trace;
  const saved = writeCell(root, cell);
  releaseClaimFileBestEffort(root, id); // D1 Δ2: reopen is a claim-clearing transition
  return saved;
}

// Decision 0016 — the orchestrator assesses a cell's difficulty at dispatch and
// records the tier it chose (extraction/generation/ceiling), rather than a fixed
// planning-time label. Keeps tierMix/scarcity accurate against real dispatch
// decisions. Idempotent; validates the tier.
export function setTier(root, id, tier) {
  if (!MODEL_TIERS.includes(tier)) {
    throw new Error(`setTier: tier must be one of ${MODEL_TIERS.join(', ')}, got "${tier}".`);
  }
  const cell = readCell(root, id);
  if (!cell) throw new Error(`setTier: cell "${id}" not found.`);
  cell.tier = tier;
  return writeCell(root, cell);
}

// Decision 0011 — capture-mode spine. The behavior_change cells capped for the
// active feature since the last scribing run: the mechanical proxy for "settled
// behavior not yet in docs/specs/". Threshold prefers last_scribing_run.at
// (precise ISO, written by newer scribing runs) and falls back to .date (day
// granularity) for older runs. A last run for a DIFFERENT feature (or none)
// means the whole active feature is debt. Returns { count, cells: [ids] }; empty
// while idle (no feature in flight).
//
// Still a pure read — but it is no longer only a signal (chain-integrity D2).
// It is advisory everywhere it is DISPLAYED (status line, session preamble,
// Stop-hook nudge — all fail-open) and a WALL at exactly one place: entering
// phase `compounding-complete`, enforced at the bee.mjs choke point, which
// refuses the close while debt stands. That reversal is the whole point: debt
// being "never a blocker" is precisely why a feature could be marked closed
// with six capped behavior_change cells whose behavior never reached
// docs/specs/. Debt is a signal through the work, and a wall at the door.
export function scribingDebt(root) {
  const state = readState(root);
  const feature = state.feature;
  if (!feature) return { count: 0, cells: [] };
  const lastRun = state.last_scribing_run;
  let threshold = 0;
  if (lastRun && lastRun.feature === feature) {
    const parsed = Date.parse(lastRun.at || lastRun.date);
    if (Number.isFinite(parsed)) threshold = parsed;
  }
  const cells = listCells(root, { feature, status: 'capped' })
    .filter((cell) => {
      const trace = cell.trace || {};
      if (trace.behavior_change !== true) return false;
      const cappedAt = Date.parse(trace.capped_at);
      return Number.isFinite(cappedAt) && cappedAt > threshold;
    })
    .map((cell) => cell.id);
  return { count: cells.length, cells };
}

// P12 / decision 0018 — the frozen judge. A worker that rewrites the test
// suite, CI config, lockfiles, or the verify configuration has not passed the
// judge — it has replaced the judge. Files matching these patterns that were
// changed WITHOUT being declared in the cell's `files` scope are tamper
// signals: the orchestrator never counts such a cell toward a clean wave and
// flags it for review (source: delegator's frozen-judge globs, LOOP survey).
export const FROZEN_JUDGE_PATTERNS = [
  { rule: 'test sources', pattern: /(^|\/)(tests?|__tests__|specs?)\//i },
  { rule: 'test file', pattern: /\.(test|spec)\.[a-z]+$/i },
  { rule: 'snapshot', pattern: /(^|\/)__snapshots__\/|\.snap$/i },
  {
    rule: 'CI config',
    pattern: /(^|\/)\.github\/workflows\/|(^|\/)\.gitlab-ci\.yml$|(^|\/)Jenkinsfile$|(^|\/)azure-pipelines\.yml$|(^|\/)\.circleci\//i,
  },
  {
    rule: 'lockfile',
    pattern:
      /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|Cargo\.lock|poetry\.lock|uv\.lock|go\.sum|composer\.lock|Gemfile\.lock)$/i,
  },
  {
    rule: 'package manifest',
    pattern: /(^|\/)(package\.json|pyproject\.toml|Cargo\.toml|go\.mod|composer\.json|Gemfile)$/i,
  },
  {
    rule: 'test config',
    pattern: /(^|\/)(jest\.config|vitest\.config|playwright\.config|karma\.conf|pytest\.ini|tox\.ini|phpunit\.xml)[^/]*$/i,
  },
  { rule: 'bee verify config', pattern: /(^|\/)\.bee\/config\.json$/i },
];

function normalizePath(p) {
  return String(p).replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

// A declared entry covers a changed file when it matches exactly, is a
// directory prefix (entry ends with '/'), or is a simple '*' glob.
function declaredCovers(declared, file) {
  for (const raw of declared) {
    const entry = normalizePath(raw);
    if (!entry) continue;
    if (entry === file) return true;
    if (entry.endsWith('/') && file.startsWith(entry)) return true;
    if (entry.includes('*')) {
      // '**' crosses directories, '*' stays within one segment. Escape regex
      // metacharacters first, then translate the stars via a placeholder that
      // cannot appear in an escaped path (escaping leaves no bare '+').
      const DOUBLE_STAR = '+';
      const source = entry
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, DOUBLE_STAR)
        .replace(/\*/g, '[^/]*')
        .split(DOUBLE_STAR)
        .join('.*');
      if (new RegExp(`^${source}$`).test(file)) return true;
    }
  }
  return false;
}

/**
 * Frozen-judge check: judge-pattern files changed outside the declared scope.
 * @param {string[]} changedFiles - the worker's trace.files_changed
 * @param {string[]} declaredFiles - the cell's declared `files` scope
 * @returns {{file:string, rule:string}[]} hits — empty means the judge is intact.
 */
export function frozenJudgeHits(changedFiles, declaredFiles = []) {
  const declared = Array.isArray(declaredFiles) ? declaredFiles : [];
  const hits = [];
  for (const raw of Array.isArray(changedFiles) ? changedFiles : []) {
    const file = normalizePath(raw);
    if (!file) continue;
    const match = FROZEN_JUDGE_PATTERNS.find(({ pattern }) => pattern.test(file));
    if (!match) continue;
    if (declaredCovers(declared, file)) continue;
    hits.push({ file, rule: match.rule });
  }
  return hits;
}

/** Convenience: run the frozen-judge check on a capped/claimed cell's trace. */
export function judgeCell(root, id) {
  const cell = readCell(root, id);
  if (!cell) throw new Error(`judgeCell: cell "${id}" not found.`);
  const changed = (cell.trace && cell.trace.files_changed) || [];
  const declared = Array.isArray(cell.files) ? cell.files : [];
  return { id: cell.id, hits: frozenJudgeHits(changed, declared) };
}

// Decision 0012 / P7 — keep the ceiling (strongest) model scarce, measurably.
// Above this share of tiered cells on the ceiling tier, the scarcity is at risk
// (the cost lever of "the strong model touches few dispatches" is eroding).
export const CEILING_MAX_SHARE = 0.4;
const SCARCITY_MIN_TIERED = 3; // below this, any share is noise — stay silent.

/** Tier assignment across a feature's cells (all statuses). */
export function tierMix(root, { feature = null } = {}) {
  const cells = listCells(root, feature ? { feature } : {});
  const counts = { extraction: 0, generation: 0, ceiling: 0, untiered: 0 };
  for (const cell of cells) {
    if (MODEL_TIERS.includes(cell.tier)) counts[cell.tier] += 1;
    else counts.untiered += 1;
  }
  const tiered = counts.extraction + counts.generation + counts.ceiling;
  const ceilingShare = tiered > 0 ? counts.ceiling / tiered : 0;
  return { counts, tiered, ceilingShare };
}

/**
 * P7 scarcity signal: returns { pct, ceiling, tiered } when the active feature
 * leans too much on the ceiling model, else null (nothing to warn about).
 * Scoped to the active feature when set. Advisory — never a blocker.
 */
export function ceilingScarcityWarning(root) {
  const state = readState(root);
  const mix = tierMix(root, { feature: state.feature || null });
  if (mix.tiered < SCARCITY_MIN_TIERED) return null;
  if (mix.ceilingShare <= CEILING_MAX_SHARE) return null;
  return { pct: Math.round(mix.ceilingShare * 100), ceiling: mix.counts.ceiling, tiered: mix.tiered };
}

// ─── D2 (self-correcting-loop): cell-lifetime budgets at the claim door ────
// Closes gap #1 of the Builder-Judge-Manager assessment: budgets reset per
// claim by design (rescue rung 1 grants a fresh consult budget), so a
// claim -> block -> re-dispatch cycle could loop indefinitely at cell
// lifetime with no ceiling. `budgets` is an optional cell field; absent
// falls back to DEFAULT_BUDGETS (D6: additive, existing single-claim single-
// attempt cells behave byte-identically until a cell actually loops).
const DEFAULT_BUDGETS = { max_claims: 3, max_failed_attempts: 4, max_same_signature: 2 };

// GH #27.3 (D-GHF-C): a hard ceiling on every resolved budget, 3x
// DEFAULT_BUDGETS — closes the authoring-time gap the #27 claim verdicts
// flagged (workers can never raise budgets live, but an authored cell could
// declare an absurd budgets.max_claims and never hit the claim door at all).
// resolveCellBudgets clamps a too-high DECLARED value down to this ceiling
// (defensive at resolve time, for legacy/pre-guard cells); validateNewCell
// below refuses an over-ceiling value outright at authoring time instead.
const BUDGET_HARD_MAX = { max_claims: 9, max_failed_attempts: 12, max_same_signature: 6 };

export function resolveCellBudgets(cell) {
  const declared =
    cell && typeof cell.budgets === 'object' && cell.budgets && !Array.isArray(cell.budgets)
      ? cell.budgets
      : {};
  // A non-integer or below-floor (<1) declared value is untrustworthy input,
  // not merely "too big" — it falls back to DEFAULT_BUDGETS for that key
  // rather than being clamped. A valid integer >=1 that exceeds the hard max
  // is clamped down to it instead (D-GHF-C: no path ever raises a budget
  // above BUDGET_HARD_MAX).
  const pick = (key) => {
    const value = declared[key];
    if (!Number.isInteger(value) || value < 1) return DEFAULT_BUDGETS[key];
    return Math.min(value, BUDGET_HARD_MAX[key]);
  };
  return {
    max_claims: pick('max_claims'),
    max_failed_attempts: pick('max_failed_attempts'),
    max_same_signature: pick('max_same_signature'),
  };
}

// D2+Δ1: counters restart after the latest trace.budget_resets marker — an
// append-only audit array written ONLY by resetCellBudget below. Lexical
// (string) comparison is safe here because every `at`/`reset_at` value is
// the same utcNow() ISO-8601 shape, which sorts lexicographically exactly
// like it sorts chronologically.
function attemptsSinceBudgetReset(cell) {
  const trace = cell.trace || {};
  const attempts = Array.isArray(trace.attempts) ? trace.attempts : [];
  const resets = Array.isArray(trace.budget_resets) ? trace.budget_resets : [];
  const marker = resets.length > 0 ? resets[resets.length - 1].reset_at : null;
  if (typeof marker !== 'string' || !marker) return attempts;
  return attempts.filter((a) => a && typeof a.at === 'string' && a.at > marker);
}

function budgetExhaustedRefusal(id, name, limit, used, relevant) {
  const failed = relevant.filter((a) => a.verdict === 'fail' || a.verdict === 'blocked').length;
  const passed = relevant.filter((a) => a.verdict === 'pass').length;
  return {
    ok: false,
    code: 'CELL_BUDGET_EXHAUSTED',
    reason: `cell "${id}" exhausted its "${name}" budget (limit ${limit}, used ${used}) — the claim door is closed until an audited reset.`,
    budget: { name, limit },
    used,
    history_summary: `${relevant.length} attempt(s) recorded since the last reset (${failed} failed/blocked, ${passed} passed).`,
    fix: `bee.mjs cells reset-budget --id ${id} --reason "<why a retry is warranted>" — audited (logs a decision), never rewrites the attempt ledger.`,
  };
}

// D2+Δ2: the STRUCTURAL loop-safety check — deliberately never imports or
// reads gate_bypass/config.json (bypassLevel/readConfig never appear in this
// function). CELL_BUDGET_EXHAUSTED and REPEATED_FAILURE are not approval
// gates a human can wave through; the only door back open is
// resetCellBudget's audited reset below. Returns {ok:true} when the cell may
// proceed, else the typed refusal — surfaced as-is by claimCellCrossSession
// (direct `cells claim --id`) or used as a selection filter by
// claimNextCell (Δ3/F3: a bricked candidate is skipped, never surfaced).
export function checkCellBudgets(cell) {
  const budgets = resolveCellBudgets(cell);
  const relevant = attemptsSinceBudgetReset(cell);

  // D2+Δ1 (GH #27.1, D-GHF-B): claims_used = distinct (claim_session,
  // acquired_at ?? claimed_at) pairs, +1 for the acquisition currently being
  // attempted (it has no ledger entry yet — nothing has been
  // verified/blocked under it). The key is the heartbeat-invariant
  // acquisition identity: acquired_at is stamped once at claim creation and
  // never rewritten by renewClaimTTL, so N heartbeats between failures under
  // one claim epoch still collapse to a single pair (D-GHF-B) — the pre-fix
  // key of claimed_at alone changed on every heartbeat and inflated the
  // count. Legacy ledger entries with no acquired_at fall back to
  // claimed_at, counting exactly as before (D6). A legacy cell with no
  // ledger reads as 0 pairs, so its first claim is exactly 1 — byte-
  // identical to today (D6).
  const pairs = new Set();
  for (const a of relevant) {
    pairs.add(`${a.claim_session ?? ''} ${(a.acquired_at ?? a.claimed_at) ?? ''}`);
  }
  const claimsUsed = pairs.size + 1;
  if (claimsUsed > budgets.max_claims) {
    return budgetExhaustedRefusal(cell.id, 'max_claims', budgets.max_claims, claimsUsed, relevant);
  }

  const failedAttempts = relevant.filter((a) => a.verdict === 'fail' || a.verdict === 'blocked').length;
  if (failedAttempts >= budgets.max_failed_attempts) {
    return budgetExhaustedRefusal(cell.id, 'max_failed_attempts', budgets.max_failed_attempts, failedAttempts, relevant);
  }

  // Same-signature: two (or budgets.max_same_signature) fail/blocked entries
  // sharing an identical failure_signature mean the Manager is re-running
  // the exact same fix rather than changing approach — a distinct refusal
  // from generic exhaustion, so it is checked independently of max_claims/
  // max_failed_attempts above.
  const signatureCounts = new Map();
  for (const a of relevant) {
    if (a.verdict !== 'fail' && a.verdict !== 'blocked') continue;
    if (typeof a.failure_signature !== 'string' || !a.failure_signature) continue;
    signatureCounts.set(a.failure_signature, (signatureCounts.get(a.failure_signature) || 0) + 1);
  }
  for (const [signature, count] of signatureCounts) {
    if (count >= budgets.max_same_signature) {
      return {
        ok: false,
        code: 'REPEATED_FAILURE',
        reason: `cell "${cell.id}" failed ${count} time(s) with the identical signature "${signature}" — change approach or escalate, this is not a re-run.`,
        signature,
        fix: `bee.mjs cells reset-budget --id ${cell.id} --reason "<why a retry is warranted>" — audited (logs a decision), never rewrites the attempt ledger.`,
      };
    }
  }

  return { ok: true };
}

// D2 + GH #27.4 (D-GHF-C): the ONLY door that reopens a budget-exhausted or
// repeated-failure cell. Requires a reason (audited), logs a decision, and
// appends to the append-only trace.budget_resets — it NEVER touches
// trace.attempts, so the full attempt history the marker is scoped against
// stays intact for post-hoc review (mirrors trace.ownership_overrides'
// append-only shape).
//
// GUARD ORDERING (plan-check constraint, keeps existing error contracts
// byte-identical): reason-check first (outside the lock — cheapest, needs no
// disk read), then not-found (inside the lock, first thing after readCell),
// THEN the two new guards — actor-required, then budget-blocked. An unknown
// cell id refuses "not found" regardless of whether an actor was supplied;
// only once the cell is known to exist do the new guards get a say.
//
// D-GHF-C closes claim-verdict #4 (#27): reset previously had no exhaustion
// guard at all (any cell, blocked or not, could be "reset") and the actor
// was optional. Now: refuses (typed RESET_NOT_NEEDED) unless
// checkCellBudgets(cell) currently reports not-ok, and refuses without an
// actor (--operator flag or BEE_AGENT_NAME env fallback). The audit
// logDecision runs BEFORE writeCell so a crash/failure in the write itself
// still leaves the decision recorded — the audit trail never silently loses
// a reset just because the store write failed.
export async function resetCellBudget(root, id, reason, { sessionId, operator } = {}) {
  if (typeof reason !== 'string' || !reason.trim()) {
    throw new Error('resetCellBudget: a reason is required.');
  }
  const reasonText = reason.trim();
  const bySession = resolveSessionId({ flag: sessionId }) || null;
  const actor =
    typeof operator === 'string' && operator.trim()
      ? operator.trim()
      : typeof process.env.BEE_AGENT_NAME === 'string' && process.env.BEE_AGENT_NAME.trim()
        ? process.env.BEE_AGENT_NAME.trim()
        : null;
  const saved = await withStoreLock(root, `cells:${id}`, () => {
    const cell = readCell(root, id);
    if (!cell) throw new Error(`resetCellBudget: cell "${id}" not found.`);
    if (!actor) {
      throw new Error(
        `resetCellBudget: an actor is required — pass --operator "<name>" or set BEE_AGENT_NAME in the environment before resetting cell "${id}"'s budget.`,
      );
    }
    const budgetCheck = checkCellBudgets(cell);
    if (budgetCheck.ok) {
      const err = new Error(
        `resetCellBudget: cell "${id}" is not budget-blocked (checkCellBudgets reports ok) — a reset is only needed once the claim door is actually closed by CELL_BUDGET_EXHAUSTED or REPEATED_FAILURE.`,
      );
      err.code = 'RESET_NOT_NEEDED';
      throw err;
    }
    const trace = { ...defaultTrace(), ...(cell.trace || {}) };
    const resets = Array.isArray(trace.budget_resets) ? trace.budget_resets : [];
    const resetEntry = { reset_at: utcNow(), reason: reasonText, by_session: bySession, by_actor: actor };
    // Audit BEFORE write (D-GHF-C): logDecision is synchronous and completes
    // here first, so the decision record survives even if writeCell below
    // throws (e.g. an unwritable store).
    logDecision(root, {
      decision: `«cells reset-budget: cell "${id}" claim-lifetime budget reset by ${actor} — ${reasonText}»`,
      rationale:
        'Audited reopening of a D2 loop-safety door (self-correcting-loop); the attempt ledger itself is never rewritten, only a budget_resets marker appended.',
      scope: 'repo',
      source: 'user',
    });
    cell.trace = { ...trace, budget_resets: [...resets, resetEntry] };
    return writeCell(root, cell);
  });
  return saved;
}

// ─── D5 (self-correcting-loop): trace.semantic_judge — one structured judge
// verdict schema, append-only, stamped with honest model independence ──────
// validateJudgeVerdict/deriveModelIndependence live in judge.mjs (pure, zero
// I/O — CONTEXT D5 prohibition "no dispatching logic in lib, validation
// only"); recordJudgeVerdict is the sole mutator that turns a validated
// verdict into a trace entry, mirroring appendAttempt's append-only
// discipline (D1) and resetCellBudget's own dedicated-trace-key split (D2).
// semantic_judge is its OWN append-only array, never folded into
// trace.attempts or trace.deviations (capCell REPLACES deviations wholesale
// on every cap — the same trap appendOwnershipOverride's own comment names
// above); the `...trace` spread every mutator already does is what keeps
// semantic_judge alive across a LATER verify/cap/block on the same cell.
//
// Δ6: builder_model/judge_model are CALLER-supplied (the orchestrator's own
// pinned dispatch params at record time) — this function never reads
// .bee/logs/dispatch.jsonl itself; that fail-open audit log is corroboration
// only and must never feed a fail-closed guard (a missing/absent log here
// simply means the caller passed no model, which already degrades
// model_independence to 'unverified' via deriveModelIndependence — never a
// refusal).
export function recordJudgeVerdict(
  root,
  id,
  verdictInput,
  { builderModel = null, builderStatus = null, judgeModel = null, judgeStatus = null, sessionId, forceOwnership = false } = {},
) {
  const cell = readCell(root, id);
  if (!cell) throw new Error(`recordJudgeVerdict: cell "${id}" not found.`);
  const { ok, errors } = validateJudgeVerdict(verdictInput);
  if (!ok) {
    throw new Error(
      `recordJudgeVerdict: cell "${id}" verdict rejected against schema "judge-verdict/1" — ${errors.join(' ')} FIX: the judge dispatch must return the schema verbatim (never free prose); re-dispatch once, then record model_independence "unverified" if it fails again (D5).`,
    );
  }
  const independence = deriveModelIndependence(builderModel, builderStatus, judgeModel, judgeStatus);
  const entry = {
    schema: verdictInput.schema,
    verdict: verdictInput.verdict,
    checks: verdictInput.checks,
    failure_signature: verdictInput.failure_signature ?? null,
    fixability: verdictInput.fixability,
    confidence: verdictInput.confidence,
    builder_model: typeof builderModel === 'string' && builderModel.trim() ? builderModel : null,
    judge_model: typeof judgeModel === 'string' && judgeModel.trim() ? judgeModel : null,
    model_independence: independence,
    recorded_at: utcNow(),
  };
  let trace = { ...defaultTrace(), ...(cell.trace || {}) };
  trace = guardClaimOwnership(root, id, trace, 'recordJudgeVerdict', { sessionId, forceOwnership });
  const existing = Array.isArray(trace.semantic_judge) ? trace.semantic_judge : [];
  cell.trace = { ...trace, semantic_judge: [...existing, entry] };
  return writeCell(root, cell);
}

// ─── claim-next: cross-session selection + throw-safe two-store claim ──────
// (fresh-session-handoff fsh-11, D2/D4).

// claimCellCrossSession — the CLAIMING primitive alone, exported separately
// from claimNextCell below so the throw-unwind guarantee is directly
// testable without re-deriving a whole selection scenario.
//
// UNWIND PIN (validation-s4 panel W4): claims.mjs's claimCellFile is a typed
// return ({ok:false,...} on contention, never throws for that), but this
// module's OWN claimCell signals every failure by THROW (gate refused, cell
// not found, wrong status, uncapped deps — there is no {ok:false} shape to
// check). Skipping the try/catch here would let a real claimCell failure
// leave the just-created claims-store file behind FOREVER — an orphaned
// cross-session lock with no cells.mjs-side owner, since nothing else ever
// looks at it again. Every throw here releases the claim via claims.mjs's own
// releaseClaim before surfacing a typed failure; this function itself never
// throws for a claimCell failure, only for bad arguments (mirrors claims.mjs
// requireId's bad-argument convention).
//
// D1/D3 (msh-2): sessionId is nullable — null/undefined is a legal
// SESSIONLESS claim (this is now the CLI's `cells claim --id` path too, via
// bee.mjs's handleCellsClaim, for single-user use with no
// CLAUDE_CODE_SESSION_ID and no explicit --session-id). claimNextCell (the
// only other caller) still enforces a non-empty sessionId at its OWN
// boundary before ever reaching here, so the cross-session selection flow is
// byte-unchanged for a real session id.
export function claimCellCrossSession(root, { sessionId, worker, cellId, ttl } = {}) {
  if (sessionId !== null && sessionId !== undefined && (typeof sessionId !== 'string' || !sessionId.trim())) {
    throw new Error('claimCellCrossSession: sessionId must be a non-empty string, or null/absent for a sessionless claim.');
  }
  if (typeof worker !== 'string' || !worker.trim()) {
    throw new Error('claimCellCrossSession: worker is required.');
  }
  if (typeof cellId !== 'string' || !cellId.trim()) {
    throw new Error('claimCellCrossSession: cellId is required.');
  }
  const session = sessionId == null ? null : sessionId.trim();
  const id = cellId.trim();

  const fileClaim = claimCellFile(root, session, id, ttl);
  if (!fileClaim.ok) return fileClaim; // typed CLAIMED failure, propagated as-is

  // D2+Δ2: budget check runs INSIDE the O_EXCL critical section — only after
  // claimCellFile's atomic acquisition succeeded, so the count below can
  // never be raced by a concurrent claimant (TOCTOU-safe by construction:
  // claimCellFile's O_EXCL is the only door anyone can win). A missing cell
  // is left to claimCell's own not-found error a few lines down, unchanged.
  // A refusal here unwinds the just-acquired claim file via releaseClaim —
  // same precedent as the CLAIM_CELL_FAILED unwind below — so a refused
  // acquisition never orphans a claims-store file. Enforcement therefore
  // lands at the NEXT claim attempt; this claim's own bounded overrun (the
  // O_EXCL file briefly existed for one refusal-length window) is the
  // documented tradeoff over a pre-acquire check, which would be TOCTOU-racy
  // against a concurrent claim-fail-release.
  const cellForBudget = readCell(root, id);
  if (cellForBudget) {
    const budgetCheck = checkCellBudgets(cellForBudget);
    if (!budgetCheck.ok) {
      releaseClaim(root, session, id);
      return budgetCheck;
    }
  }

  try {
    const cell = claimCell(root, id, worker);
    return { ok: true, cell, claim: fileClaim.claim };
  } catch (err) {
    releaseClaim(root, session, id); // never orphan the claim file we just created
    return {
      ok: false,
      code: 'CLAIM_CELL_FAILED',
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

// claimNextCell — the SELECTION half. Given the acting session, picks the
// next open cell to claim and runs it through claimCellCrossSession above.
// Selection order:
//   (1) the acting session's OWN pipeline (its bound lane, or the default
//       state.json pipeline when unbound/no binding — resolvePipeline's own
//       session -> lane -> default resolution seam) — ONLY when that
//       pipeline's execution gate is approved. An own pipeline whose gate is
//       unapproved contributes nothing here, on purpose: D2's authority
//       boundary ("only a human's, or a recorded bypass's, gate decision
//       authorizes a lane's cells, never the puller") holds for the acting
//       session's own lane too — never select from an unapproved lane even
//       when its cells are the only ready ones.
//   (2) empty (no ready cells, or the gate is unapproved) -> every OTHER
//       pipeline (the default state.json pipeline plus every
//       .bee/lanes/*.json record) whose OWN execution gate is approved,
//       pooled and ordered by backlog rank (docs/backlog.md's Feature
//       column, via backlog.mjs's featureBacklogRank) then lane created_at,
//       oldest first; a pipeline with no backlog row, or no created_at,
//       sorts after one that has it. GH#20: a LANE (never the default
//       state.json pipeline, which has no binding concept) actively owned by
//       another live session — some OTHER session record has lane === that
//       feature and a fresh heartbeat (!heartbeatStale, claims.mjs's own
//       staleness rule) — is skipped entirely, never pooled, so claim-next
//       cannot steal a cell out from under a session mid-lane on it; a lane
//       whose only owner's heartbeat has gone stale is fair game again
//       (steal-after-death is preserved, only live ownership blocks).
//   (3) any candidate whose declared files intersect ANOTHER session's
//       active reservation hold (findSessionConflicts, D3) is skipped
//       outright — the acting session's own holds never exclude a cell.
//   (4) nothing claimable anywhere -> typed { ok:false, code:'NO_APPROVED_WORK' }.
//
// SWEEP PIN (validation-s4 panel B1): sweepExpiredClaims runs FIRST, every
// call, unconditionally — this is sweepExpiredClaims's production trigger (it
// had zero production callers before this, tests only). A dead session's
// stale claim (TTL expired AND heartbeat stale, re-verified under its own
// gate by sweepExpiredClaims itself) is reclaimed in THIS SAME pass, before
// selection reads anything else, so a just-swept cell is immediately
// claimable and the typed NO_APPROVED_WORK stop is never returned while one
// still exists.
export function claimNextCell(root, { sessionId, worker, ttl } = {}) {
  if (typeof sessionId !== 'string' || !sessionId.trim()) {
    throw new Error('claimNextCell: sessionId is required.');
  }
  if (typeof worker !== 'string' || !worker.trim()) {
    throw new Error('claimNextCell: worker is required.');
  }
  const session = sessionId.trim();

  // Unconditional, first thing — the production sweep trigger (C10). A swept
  // cell's stale claims-store file is gone by the time selection below reads
  // anything, so it is claimable in this exact pass.
  sweepExpiredClaims(root);

  const resolved = resolvePipeline(root, { sessionId: session });
  if (!resolved.ok) {
    // A bound-but-broken lane (missing/corrupt) refuses loudly rather than
    // silently falling back to the default pipeline — same discipline
    // resolvePipeline itself documents; claim-next never masks it.
    return { ok: false, code: resolved.code, reason: resolved.reason };
  }
  const ownFeature = resolved.record.feature || null;

  const holdFree = (cell) => {
    const files = Array.isArray(cell.files) ? cell.files : [];
    return files.length === 0 || findSessionConflicts(root, session, files).length === 0;
  };
  // D2 Δ3/F3: a budget-exhausted or repeated-failure candidate is skipped at
  // SELECTION (reads the candidate's own ledger cheaply, no extra I/O) so a
  // single bricked cell never bricks the whole pool — only a direct
  // `cells claim --id` surfaces the typed refusal.
  const candidateOk = (cell) => holdFree(cell) && checkCellBudgets(cell).ok;

  let candidate = null;
  if (ownFeature && gateApproved(resolved.record, 'execution')) {
    candidate = readyCells(root, ownFeature).find(candidateOk) || null;
  }

  if (!candidate) {
    const state = readState(root);
    const pipelines = new Map(); // feature -> { approved, created_at }
    if (state.feature && state.feature !== ownFeature) {
      // The default state.json pipeline stays poolable here on purpose: it
      // has no binding concept, so the live-owner guard below (which is
      // strictly a lane-record check) never applies to it.
      pipelines.set(state.feature, { approved: gateApproved(state, 'execution'), created_at: null });
    }
    // GH#20: build the set of lanes actively owned by another live session
    // ONCE, from every session record, so the lane loop below is a plain
    // membership check. "Owned" = some OTHER session (id !== the acting
    // session — rule: the acting session's own binding never blocks
    // anything) is bound to that lane (record.lane) with a fresh heartbeat
    // (!heartbeatStale, claims.mjs's own staleness rule/threshold — the same
    // rule claim-sweep uses). An unreadable/corrupt session record already
    // reads as absent via listSessionRecords' fail-open posture, matching
    // heartbeatStale's own "missing/unparseable = stale" posture: it can
    // never mark a lane as live-owned.
    const liveOwnedLanes = new Set();
    for (const record of listSessionRecords(root)) {
      if (!record || record.id === session) continue;
      const boundLane = typeof record.lane === 'string' ? record.lane.trim() : '';
      if (!boundLane || heartbeatStale(record)) continue;
      liveOwnedLanes.add(boundLane);
    }
    for (const lane of listLanes(root)) {
      if (!lane.feature || lane.feature === ownFeature || pipelines.has(lane.feature)) continue;
      if (liveOwnedLanes.has(lane.feature)) continue; // GH#20: a lane actively owned by another live session is never pooled
      pipelines.set(lane.feature, {
        approved: gateApproved(lane, 'execution'),
        created_at: lane.created_at || null,
      });
    }

    const rank = featureBacklogRank(root);
    const pool = [];
    for (const [feature, meta] of pipelines) {
      if (!meta.approved) continue; // D2: an unapproved lane is never touched
      for (const cell of readyCells(root, feature)) {
        if (candidateOk(cell)) pool.push({ cell, feature, meta });
      }
    }
    pool.sort((a, b) => {
      const rankA = rank.has(a.feature) ? rank.get(a.feature) : Infinity;
      const rankB = rank.has(b.feature) ? rank.get(b.feature) : Infinity;
      if (rankA !== rankB) return rankA - rankB;
      const createdA = a.meta.created_at ? Date.parse(a.meta.created_at) : NaN;
      const createdB = b.meta.created_at ? Date.parse(b.meta.created_at) : NaN;
      const aKnown = Number.isFinite(createdA);
      const bKnown = Number.isFinite(createdB);
      if (aKnown && bKnown && createdA !== createdB) return createdA - createdB;
      if (aKnown !== bKnown) return aKnown ? -1 : 1; // a known created_at outranks an unknown one
      return 0;
    });
    candidate = pool.length > 0 ? pool[0].cell : null;
  }

  if (!candidate) {
    return {
      ok: false,
      code: 'NO_APPROVED_WORK',
      reason:
        "no claimable cell: the acting session's own pipeline has none ready, and no other execution-approved pipeline has a ready cell free of another session's hold.",
    };
  }

  return claimCellCrossSession(root, { sessionId: session, worker, cellId: candidate.id, ttl });
}
