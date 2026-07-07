// cells.mjs — one JSON file per cell in .bee/cells/. Enforces lane tiers,
// gate-locked claiming, cap-requires-verify.

import fs from 'node:fs';
import path from 'node:path';
import { readJson, writeJsonAtomic } from './fsutil.mjs';
import { readState, gateApproved } from './state.mjs';

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
      'claimCell: gate "execution" is not approved — cells cannot be claimed before the human approves execution.',
    );
  }
  const cell = readCell(root, id);
  if (!cell) throw new Error(`claimCell: cell "${id}" not found.`);
  if (cell.status !== 'open') {
    throw new Error(`claimCell: cell "${id}" is "${cell.status}", not "open".`);
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
