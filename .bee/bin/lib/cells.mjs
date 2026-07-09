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

export function addCell(root, cell) {
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

  const normalized = {
    ...cell,
    status: cell.status || 'open',
    deps: Array.isArray(cell.deps) ? cell.deps : [],
    decisions: Array.isArray(cell.decisions) ? cell.decisions : [],
    files: Array.isArray(cell.files) ? cell.files : [],
    read_first: Array.isArray(cell.read_first) ? cell.read_first : [],
    trace: { ...defaultTrace(), ...(cell.trace || {}) },
  };
  return writeCell(root, normalized);
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
    behavior_change = false,
    verification_evidence = null,
    outcome,
  } = {},
) {
  const cell = readCell(root, id);
  if (!cell) throw new Error(`capCell: cell "${id}" not found.`);
  if (cell.status === 'capped') throw new Error(`capCell: cell "${id}" is already capped.`);
  if (cell.status === 'dropped') throw new Error(`capCell: cell "${id}" was dropped.`);
  const trace = { ...defaultTrace(), ...(cell.trace || {}) };
  if (trace.verify_passed !== true) {
    throw new Error(
      `capCell: cell "${id}" has no passing verify result — run the cell's verify command and record it (bee_cells.mjs verify --id ${id} --command CMD --passed true) before capping.`,
    );
  }
  if (behavior_change === true && !verification_evidence) {
    throw new Error(
      `capCell: cell "${id}" declares behavior_change but provides no verification_evidence — attach evidence (--evidence-file) or drop the behavior_change flag.`,
    );
  }
  // Decision 0009: a behavior_change cell must record the "before" it changed —
  // a characterization of prior behavior — not just an assertion that the new
  // behavior works. This blocks assertion-capping at the source (worker must
  // capture the git-show / failing pre-change check at cap time) instead of
  // letting reviewing catch it later and spawn a whole evidence-backfill cell.
  if (behavior_change === true && verification_evidence) {
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
    behavior_change: behavior_change === true,
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
