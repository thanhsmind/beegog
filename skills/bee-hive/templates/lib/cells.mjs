// cells.mjs — one JSON file per cell in .bee/cells/. Enforces lane tiers,
// gate-locked claiming, cap-requires-verify.

import fs from 'node:fs';
import path from 'node:path';
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
import { sweepExpiredClaims, claimCellFile, releaseClaim } from './claims.mjs';
import { findSessionConflicts } from './reservations.mjs';
import { featureBacklogRank } from './backlog.mjs';

export const LANES = ['tiny', 'small', 'standard', 'high-risk', 'spike'];

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function utcNow() {
  return new Date().toISOString();
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

export function addCell(root, cell) {
  validateNewCell(root, cell);
  return writeCell(root, normalizeNewCell(cell));
}

// Batch add: validates EVERY cell (against disk and against duplicate ids
// within the batch itself) before writing any — all-or-nothing, so a failing
// cell in the middle of a slice never leaves partial state behind.
export function addCells(root, cells) {
  if (!Array.isArray(cells) || cells.length === 0) {
    throw new Error('addCells: expected a non-empty JSON array of cells.');
  }
  const seen = new Set();
  for (const cell of cells) {
    validateNewCell(root, cell);
    if (seen.has(cell.id)) {
      throw new Error(`addCells: duplicate id "${cell.id}" within the batch.`);
    }
    seen.add(cell.id);
  }
  return cells.map((cell) => writeCell(root, normalizeNewCell(cell)));
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
        : 'claimCell: gate "execution" is not approved — cells cannot be claimed before execution is approved. Surface Gate 3 to the user ("Feasibility validated. Approve execution?") and set approved_gates.execution once approved. Only the opt-in gate_bypass switch may self-approve, and only for tiny/small/standard non-hard-gate work (decision 0010) — never self-approve high-risk/hard-gate execution.',
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

export function recordVerify(root, id, { command, output = null, passed }) {
  const cell = readCell(root, id);
  if (!cell) throw new Error(`recordVerify: cell "${id}" not found.`);
  if (typeof command !== 'string' || !command.trim()) {
    throw new Error('recordVerify: command is required.');
  }
  if (typeof passed !== 'boolean') {
    throw new Error('recordVerify: passed must be true or false.');
  }
  cell.trace = { ...defaultTrace(), ...(cell.trace || {}) };
  cell.trace.verify_command = command;
  cell.trace.verify_output = output;
  cell.trace.verify_passed = passed;
  cell.trace.verified_at = utcNow();
  return writeCell(root, cell);
}

export function capCell(
  root,
  id,
  {
    files_changed = [],
    deviations = [],
    friction = null,
    behavior_change,
    verification_evidence = null,
    outcome,
  } = {},
) {
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
  const trace = { ...defaultTrace(), ...(cell.trace || {}) };
  if (trace.verify_passed !== true) {
    throw new Error(
      `capCell: cell "${id}" has no passing verify result — run the cell's verify command and record it (bee.mjs cells verify --id ${id} --command CMD --passed true) before capping.`,
    );
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
}

export function blockCell(root, id, reason) {
  if (typeof reason !== 'string' || !reason.trim()) {
    throw new Error('blockCell: a reason is required.');
  }
  const cell = readCell(root, id);
  if (!cell) throw new Error(`blockCell: cell "${id}" not found.`);
  cell.status = 'blocked';
  cell.trace = { ...defaultTrace(), ...(cell.trace || {}), blocked_reason: reason };
  return writeCell(root, cell);
}

export function dropCell(root, id, reason) {
  if (typeof reason !== 'string' || !reason.trim()) {
    throw new Error('dropCell: a reason is required.');
  }
  const cell = readCell(root, id);
  if (!cell) throw new Error(`dropCell: cell "${id}" not found.`);
  cell.status = 'dropped';
  cell.trace = { ...defaultTrace(), ...(cell.trace || {}), dropped_reason: reason };
  return writeCell(root, cell);
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
// while idle (no feature in flight). Pure read — never a blocker, only a signal.
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
export function claimCellCrossSession(root, { sessionId, worker, cellId, ttl } = {}) {
  if (typeof sessionId !== 'string' || !sessionId.trim()) {
    throw new Error('claimCellCrossSession: sessionId is required.');
  }
  if (typeof worker !== 'string' || !worker.trim()) {
    throw new Error('claimCellCrossSession: worker is required.');
  }
  if (typeof cellId !== 'string' || !cellId.trim()) {
    throw new Error('claimCellCrossSession: cellId is required.');
  }
  const session = sessionId.trim();
  const id = cellId.trim();

  const fileClaim = claimCellFile(root, session, id, ttl);
  if (!fileClaim.ok) return fileClaim; // typed CLAIMED failure, propagated as-is

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
//       sorts after one that has it.
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

  let candidate = null;
  if (ownFeature && gateApproved(resolved.record, 'execution')) {
    candidate = readyCells(root, ownFeature).find(holdFree) || null;
  }

  if (!candidate) {
    const state = readState(root);
    const pipelines = new Map(); // feature -> { approved, created_at }
    if (state.feature && state.feature !== ownFeature) {
      pipelines.set(state.feature, { approved: gateApproved(state, 'execution'), created_at: null });
    }
    for (const lane of listLanes(root)) {
      if (!lane.feature || lane.feature === ownFeature || pipelines.has(lane.feature)) continue;
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
        if (holdFree(cell)) pool.push({ cell, feature, meta });
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
