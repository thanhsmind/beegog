// cells.mjs — one JSON file per cell in .bee/cells/. Enforces lane tiers,
// gate-locked claiming, cap-requires-verify.

import fs from 'node:fs';
import path from 'node:path';
import { readJson, writeJsonAtomic } from './fsutil.mjs';
import { readState, gateApproved, MODEL_TIERS } from './state.mjs';

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
  tier: 'use the tier verb (bee_cells.mjs tier --id ID --tier T)',
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

export function claimCell(root, id, worker) {
  if (typeof worker !== 'string' || !worker.trim()) {
    throw new Error('claimCell: worker name is required.');
  }
  const state = readState(root);
  if (!gateApproved(state, 'execution')) {
    throw new Error(
      'claimCell: gate "execution" is not approved — cells cannot be claimed before execution is approved. Surface Gate 3 to the user ("Feasibility validated. Approve execution?") and set approved_gates.execution once approved. Only the opt-in gate_bypass switch may self-approve, and only for tiny/small/standard non-hard-gate work (decision 0010) — never self-approve high-risk/hard-gate execution.',
    );
  }
  const cell = readCell(root, id);
  if (!cell) throw new Error(`claimCell: cell "${id}" not found.`);
  if (cell.status !== 'open') {
    throw new Error(
      `claimCell: cell "${id}" is "${cell.status}", not "open" — only open cells can be claimed. Run bee_cells.mjs ready to list claimable cells.`,
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
      `capCell: cell "${id}" has no passing verify result — run the cell's verify command and record it (bee_cells.mjs verify --id ${id} --command CMD --passed true) before capping.`,
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
        `capCell: lane "${cell.lane}" cell "${id}" has a passing verify flag but no recorded proof — re-record the verify with its output (bee_cells.mjs verify --id ${id} --command CMD --output "..." --passed true) or attach verification_evidence (--evidence-file). An assertion is not evidence.`,
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
