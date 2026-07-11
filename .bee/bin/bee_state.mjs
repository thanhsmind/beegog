#!/usr/bin/env node
// bee_state.mjs — .bee/state.json mutation CLI (decision from cli-mutations
// plan.md: agents never hand-edit .bee/*.json(l)). Thin wrapper over
// lib/state.mjs's read/write/validation exports; the mutation logic for each
// verb lives directly here — there is no dedicated lib/state-mutations module,
// and lib/state.mjs's own semantics are never touched by this file.
//
// Usage:
//   node .bee/bin/bee_state.mjs set [--phase P] [--mode M] [--feature F] [--next-action S] [--summary S] [--json]
//     (only the flags given are written; every other field is preserved as-is.
//      --phase is validated with isKnownPhase — the KNOWN_PHASES enum
//      including the terminal alias "compounding-complete", NOT the bare
//      PHASES array, or feature close deadlocks once the write-guard rule
//      lands, decision 0004.)
//   node .bee/bin/bee_state.mjs gate --name context|shape|execution|review --approved true|false [--json]
//     (idempotent: the same call run twice yields an identical file.)
//   node .bee/bin/bee_state.mjs worker add --nickname N --cell C [--tier extraction|generation|ceiling] [--status S] [--json]
//   node .bee/bin/bee_state.mjs worker update --nickname N [--cell C] [--tier T] [--status S] [--json]
//   node .bee/bin/bee_state.mjs worker remove --nickname N [--json]
//   node .bee/bin/bee_state.mjs worker clear [--json]
//     (add appends; update merges only the given fields onto the existing
//      entry found by nickname; remove drops the matching entry; clear empties
//      the whole array. --tier, when given, is validated against MODEL_TIERS —
//      the same locked enum bee_cells.mjs tier already uses.)
//   node .bee/bin/bee_state.mjs scribing-run --feature F --areas "a,b" --next-action S [--json]
//     (stamps last_scribing_run.date + an ISO-precise last_scribing_run.at,
//      decision 0011 — the .at stamp is what clears scribing debt, per
//      bee-scribing SKILL.md:112. Also mirrors --next-action into the
//      top-level next_action and advances the top-level phase to
//      "compounding" — the fixed next node after bee-scribing in the
//      workflow chain (AGENTS.md) — per SKILL.md:112's "plus top-level
//      phase/next_action".)

import {
  findRepoRoot,
  readState,
  writeState,
  isKnownPhase,
  KNOWN_PHASES,
  GATE_NAMES,
  MODEL_TIERS,
} from './lib/state.mjs';

function parseArgs(argv) {
  const args = { command: '', sub: '', flags: {}, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      if (!args.command) args.command = arg;
      else if (!args.sub) args.sub = arg;
      else throw new Error(`Unexpected argument: ${arg}`);
      continue;
    }
    const eq = arg.indexOf('=');
    const name = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    let value;
    if (eq !== -1) value = arg.slice(eq + 1);
    else if (name === 'json') value = true;
    else {
      value = argv[i + 1];
      if (value === undefined) throw new Error(`Flag --${name} requires a value.`);
      i += 1;
    }
    if (name === 'json') args.json = true;
    else args.flags[name] = value;
  }
  return args;
}

function requireFlag(flags, name) {
  const value = flags[name];
  if (value === undefined || value === '' || value === true) {
    throw new Error(`Missing required flag --${name}.`);
  }
  return String(value);
}

function requireBoolFlag(flags, name) {
  const raw = requireFlag(flags, name);
  if (raw !== 'true' && raw !== 'false') {
    throw new Error(`--${name} must be "true" or "false", got "${raw}".`);
  }
  return raw === 'true';
}

function splitList(raw) {
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function runSet(root, flags) {
  if (flags.phase !== undefined) {
    const phase = String(flags.phase);
    if (!isKnownPhase(phase)) {
      throw new Error(
        `set: invalid phase "${phase}" — not in the known-phase enum (isKnownPhase, not the bare PHASES array — the terminal alias "compounding-complete" must pass). FIX: use one of ${KNOWN_PHASES.join(', ')}.`,
      );
    }
  }
  if (
    flags.phase === undefined &&
    flags.mode === undefined &&
    flags.feature === undefined &&
    flags['next-action'] === undefined &&
    flags.summary === undefined
  ) {
    throw new Error(
      'set: at least one of --phase, --mode, --feature, --next-action, --summary is required.',
    );
  }
  // Re-read immediately before the atomic write (C1) — no I/O happens between
  // this read and the write below, so the read-modify-write window stays at
  // its minimum, matching bee_cells.mjs's own claim/verify/cap pattern.
  const state = readState(root);
  const changed = [];
  if (flags.phase !== undefined) {
    state.phase = String(flags.phase);
    changed.push(`phase=${state.phase}`);
  }
  if (flags.mode !== undefined) {
    state.mode = String(flags.mode);
    changed.push(`mode=${state.mode}`);
  }
  if (flags.feature !== undefined) {
    state.feature = String(flags.feature);
    changed.push(`feature=${state.feature}`);
  }
  if (flags['next-action'] !== undefined) {
    state.next_action = String(flags['next-action']);
    changed.push('next_action');
  }
  if (flags.summary !== undefined) {
    state.summary = String(flags.summary);
    changed.push('summary');
  }
  writeState(root, state);
  return { result: state, text: `Updated state: ${changed.join(' ')}.` };
}

function runGate(root, flags) {
  const name = requireFlag(flags, 'name');
  if (!GATE_NAMES.includes(name)) {
    throw new Error(
      `gate: invalid gate name "${name}" — must be one of ${GATE_NAMES.join(', ')}. FIX: pass --name <one of these>.`,
    );
  }
  const approved = requireBoolFlag(flags, 'approved');
  // Re-read immediately before the atomic write (C1).
  const state = readState(root);
  state.approved_gates = { ...state.approved_gates, [name]: approved };
  writeState(root, state);
  return { result: state, text: `Gate "${name}" set to ${approved}.` };
}

function runWorker(root, sub, flags) {
  // Re-read immediately before the atomic write (C1) — the find/merge/filter
  // below is pure in-memory work on the array, so reading here keeps the
  // read-to-write window at its minimum.
  const state = readState(root);
  const workers = Array.isArray(state.workers) ? [...state.workers] : [];
  let text;
  switch (sub) {
    case 'add': {
      const nickname = requireFlag(flags, 'nickname');
      const cell = requireFlag(flags, 'cell');
      let tier = null;
      if (flags.tier !== undefined) {
        tier = String(flags.tier);
        if (!MODEL_TIERS.includes(tier)) {
          throw new Error(
            `worker add: invalid tier "${tier}" — must be one of ${MODEL_TIERS.join(', ')}.`,
          );
        }
      }
      const status = flags.status !== undefined ? String(flags.status) : null;
      workers.push({ nickname, cell, tier, status });
      text = `Added worker "${nickname}" (cell ${cell}).`;
      break;
    }
    case 'update': {
      const nickname = requireFlag(flags, 'nickname');
      const idx = workers.findIndex((w) => w && w.nickname === nickname);
      if (idx === -1) {
        throw new Error(
          `worker update: nickname "${nickname}" not found — use "worker add" to create it first.`,
        );
      }
      const worker = { ...workers[idx] };
      if (flags.cell !== undefined) worker.cell = String(flags.cell);
      if (flags.tier !== undefined) {
        const tier = String(flags.tier);
        if (!MODEL_TIERS.includes(tier)) {
          throw new Error(
            `worker update: invalid tier "${tier}" — must be one of ${MODEL_TIERS.join(', ')}.`,
          );
        }
        worker.tier = tier;
      }
      if (flags.status !== undefined) worker.status = String(flags.status);
      workers[idx] = worker;
      text = `Updated worker "${nickname}".`;
      break;
    }
    case 'remove': {
      const nickname = requireFlag(flags, 'nickname');
      const next = workers.filter((w) => !(w && w.nickname === nickname));
      if (next.length === workers.length) {
        throw new Error(`worker remove: nickname "${nickname}" not found.`);
      }
      workers.length = 0;
      workers.push(...next);
      text = `Removed worker "${nickname}".`;
      break;
    }
    case 'clear': {
      const removedCount = workers.length;
      workers.length = 0;
      text = `Cleared ${removedCount} worker(s).`;
      break;
    }
    default:
      throw new Error(`Unknown worker action "${sub || '(missing)'}". Use: add, update, remove, clear.`);
  }
  state.workers = workers;
  writeState(root, state);
  return { result: state, text };
}

function runScribingRun(root, flags) {
  const feature = requireFlag(flags, 'feature');
  const areas = splitList(requireFlag(flags, 'areas'));
  const nextAction = requireFlag(flags, 'next-action');
  const now = new Date();
  const at = now.toISOString();
  const date = at.slice(0, 10);
  // Re-read immediately before the atomic write (C1).
  const state = readState(root);
  state.last_scribing_run = { feature, date, at, areas_synced: areas, next_action: nextAction };
  // "plus top-level phase/next_action" (bee-scribing SKILL.md:112): mirror
  // next_action at the top level, and advance phase to "compounding" — the
  // fixed next node after bee-scribing in the workflow chain (AGENTS.md).
  state.phase = 'compounding';
  state.next_action = nextAction;
  writeState(root, state);
  return { result: state, text: `Recorded scribing run for "${feature}" at ${at}.` };
}

function run(args) {
  const root = findRepoRoot(process.cwd());
  if (!root) {
    throw new Error(
      'No bee repo root found (no .bee/onboarding.json or .git up the tree). Run bee-hive onboarding.',
    );
  }
  const { flags } = args;

  switch (args.command) {
    case 'set':
      return runSet(root, flags);
    case 'gate':
      return runGate(root, flags);
    case 'worker':
      return runWorker(root, args.sub, flags);
    case 'scribing-run':
      return runScribingRun(root, flags);
    default:
      throw new Error(
        `Unknown command "${args.command || '(missing)'}". Use: set, gate, worker, scribing-run.`,
      );
  }
}

function main(argv) {
  let json = argv.includes('--json');
  try {
    const args = parseArgs(argv);
    json = args.json;
    const { result, text } = run(args);
    process.stdout.write(json ? `${JSON.stringify(result, null, 2)}\n` : `${text}\n`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (json) process.stdout.write(`${JSON.stringify({ error: message })}\n`);
    else process.stderr.write(`${message}\n`);
    return 1;
  }
}

process.exitCode = main(process.argv.slice(2));
