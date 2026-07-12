#!/usr/bin/env node
// bee_cells.mjs — cell lifecycle CLI. Thin wrapper over lib/cells.mjs.
//
// Usage:
//   node .bee/bin/bee_cells.mjs list [--feature F] [--status S] [--json]
//   node .bee/bin/bee_cells.mjs ready [--feature F] [--json]
//   node .bee/bin/bee_cells.mjs show --id ID [--json]
//   node .bee/bin/bee_cells.mjs add --file cell.json | --stdin [--json]
//     (input is one cell object OR a JSON array of cells — an array is a batch:
//      every cell validated before any is written, all-or-nothing)
//   node .bee/bin/bee_cells.mjs claim --id ID --worker NAME [--json]
//   node .bee/bin/bee_cells.mjs verify --id ID --command CMD --passed true|false [--output TEXT | --output-file F] [--json]
//     (small+ lanes refuse to cap without recorded verify output or evidence — decision 0004)
//   node .bee/bin/bee_cells.mjs cap --id ID [--outcome TEXT] [--files a,b] [--behavior-change]
//                                  [--evidence-stdin | --evidence-file F] [--deviations-file F] [--friction TEXT] [--json]
//     (prefer --evidence-stdin: pipe the evidence JSON so NO evidence file is persisted;
//      the trace is the single source, decision 0009)
//     (behavior_change cells refuse to cap without a "before" characterization —
//      red_failure_evidence in the evidence JSON, or a deliberate_exceptions note
//      for a brand-new surface — decision 0009. Evidence lives in the cell trace,
//      the single source; reports/<cell>.md links it, never re-embeds the JSON.)
//   node .bee/bin/bee_cells.mjs update --id ID --file patch.json | --stdin [--json]
//     (door-validated in-place revision for validation-repair loops: only
//      open|blocked cells; plan fields only — id/feature/status/trace/tier and
//      unknown keys refuse the whole patch; corrupt cell files fail closed)
//   node .bee/bin/bee_cells.mjs block --id ID --reason R [--json]
//   node .bee/bin/bee_cells.mjs drop --id ID --reason R [--json]
//   node .bee/bin/bee_cells.mjs tier --id ID --tier extraction|generation|ceiling [--json]
//     (the orchestrator's dispatch-time model-tier judgment, decision 0016)

import fs from 'node:fs';
import { findRepoRoot } from './lib/state.mjs';
import {
  listCells,
  readyCells,
  readCell,
  addCell,
  addCells,
  updateCell,
  claimCell,
  recordVerify,
  capCell,
  blockCell,
  dropCell,
  setTier,
  judgeCell,
} from './lib/cells.mjs';

function parseArgs(argv) {
  const args = { command: '', flags: {}, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      if (!args.command) args.command = arg;
      else throw new Error(`Unexpected argument: ${arg}`);
      continue;
    }
    const eq = arg.indexOf('=');
    let name = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    let value;
    if (eq !== -1) {
      value = arg.slice(eq + 1);
    } else if (['json', 'stdin', 'behavior-change', 'evidence-stdin'].includes(name)) {
      value = true;
    } else {
      value = argv[i + 1];
      if (value === undefined) throw new Error(`Flag --${name} requires a value.`);
      i += 1;
    }
    if (name === 'json') args.json = true;
    else args.flags[name] = value;
  }
  return args;
}

function readFileText(file, label) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    throw new Error(`Cannot read ${label} file: ${file}`);
  }
}

function requireFlag(flags, name) {
  const value = flags[name];
  if (value === undefined || value === '' || value === true) {
    throw new Error(`Missing required flag --${name}.`);
  }
  return String(value);
}

function summarize(cell) {
  return `${cell.id} [${cell.status}] (${cell.lane}) ${cell.title}`;
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
    case 'list': {
      const cells = listCells(root, {
        feature: flags.feature ? String(flags.feature) : null,
        status: flags.status ? String(flags.status) : null,
      });
      return { result: cells, text: cells.length ? cells.map(summarize).join('\n') : 'No cells.' };
    }
    case 'ready': {
      const cells = readyCells(root, flags.feature ? String(flags.feature) : null);
      return {
        result: cells,
        text: cells.length ? cells.map(summarize).join('\n') : 'No ready cells.',
      };
    }
    case 'show': {
      const id = requireFlag(flags, 'id');
      const cell = readCell(root, id);
      if (!cell) throw new Error(`Cell "${id}" not found.`);
      return { result: cell, text: JSON.stringify(cell, null, 2) };
    }
    case 'add': {
      let text;
      if (flags.stdin === true) text = fs.readFileSync(0, 'utf8');
      else text = readFileText(requireFlag(flags, 'file'), 'cell');
      let cell;
      try {
        cell = JSON.parse(text);
      } catch {
        throw new Error('add: input is not valid JSON.');
      }
      // A JSON array is a batch: every cell validated before any is written
      // (all-or-nothing), so one heredoc creates a whole slice in one call.
      if (Array.isArray(cell)) {
        const added = addCells(root, cell);
        return {
          result: added,
          text: added.map((c) => `Added ${summarize(c)}`).join('\n'),
        };
      }
      const added = addCell(root, cell);
      return { result: added, text: `Added ${summarize(added)}` };
    }
    case 'update': {
      // Strict flag validation (workers-prune discipline): a typoed flag on a
      // mutating verb must refuse, never silently no-op into a bad patch.
      for (const name of Object.keys(flags)) {
        if (!['id', 'file', 'stdin'].includes(name)) {
          throw new Error(`update: unknown flag --${name}. Use: --id ID --file patch.json | --stdin [--json].`);
        }
      }
      const id = requireFlag(flags, 'id');
      let text;
      if (flags.stdin === true) text = fs.readFileSync(0, 'utf8');
      else text = readFileText(requireFlag(flags, 'file'), 'patch');
      let patch;
      try {
        patch = JSON.parse(text);
      } catch {
        throw new Error('update: patch input is not valid JSON.');
      }
      const updated = updateCell(root, id, patch);
      return {
        result: updated,
        text: `Updated ${updated.id} (${Object.keys(patch).join(', ')}).`,
      };
    }
    case 'claim': {
      const cell = claimCell(root, requireFlag(flags, 'id'), requireFlag(flags, 'worker'));
      return { result: cell, text: `Claimed ${cell.id} for ${cell.trace.worker}.` };
    }
    case 'verify': {
      const id = requireFlag(flags, 'id');
      const command = requireFlag(flags, 'command');
      const passedRaw = requireFlag(flags, 'passed');
      if (passedRaw !== 'true' && passedRaw !== 'false') {
        throw new Error('--passed must be "true" or "false".');
      }
      const output = flags['output-file']
        ? readFileText(String(flags['output-file']), 'output')
        : flags.output
          ? String(flags.output)
          : null;
      const cell = recordVerify(root, id, { command, output, passed: passedRaw === 'true' });
      return {
        result: cell,
        text: `Recorded verify on ${cell.id}: passed=${cell.trace.verify_passed}.`,
      };
    }
    case 'cap': {
      const id = requireFlag(flags, 'id');
      const deviations = flags['deviations-file']
        ? (() => {
            const raw = readFileText(String(flags['deviations-file']), 'deviations');
            try {
              const parsed = JSON.parse(raw);
              return Array.isArray(parsed) ? parsed : [String(parsed)];
            } catch {
              return raw.split(/\r?\n/).filter((line) => line.trim());
            }
          })()
        : [];
      const cell = capCell(root, id, {
        outcome: flags.outcome ? String(flags.outcome) : undefined,
        files_changed: flags.files
          ? String(flags.files)
              .split(',')
              .map((f) => f.trim())
              .filter(Boolean)
          : [],
        // Omit when the flag is absent so capCell falls back to the cell's
        // declared behavior_change (grooming fix); present flag forces true.
        behavior_change: flags['behavior-change'] === true ? true : undefined,
        // Evidence goes straight into the trace (the single source, decision 0009).
        // Prefer --evidence-stdin so no evidence file is ever persisted; --evidence-file
        // remains for back-compat but the file must be a throwaway, never under reports/.
        verification_evidence: flags['evidence-stdin']
          ? fs.readFileSync(0, 'utf8')
          : flags['evidence-file']
            ? readFileText(String(flags['evidence-file']), 'evidence')
            : null,
        deviations,
        friction: flags.friction ? String(flags.friction) : null,
      });
      return { result: cell, text: `Capped ${cell.id} at ${cell.trace.capped_at}.` };
    }
    case 'block': {
      const cell = blockCell(root, requireFlag(flags, 'id'), requireFlag(flags, 'reason'));
      return { result: cell, text: `Blocked ${cell.id}.` };
    }
    case 'drop': {
      const cell = dropCell(root, requireFlag(flags, 'id'), requireFlag(flags, 'reason'));
      return { result: cell, text: `Dropped ${cell.id}.` };
    }
    case 'tier': {
      const cell = setTier(root, requireFlag(flags, 'id'), String(requireFlag(flags, 'tier')));
      return { result: cell, text: `Cell ${cell.id} tier set to ${cell.tier}.` };
    }
    case 'judge': {
      // P12 / decision 0018 — frozen-judge check: judge-pattern files changed
      // outside the cell's declared scope. Hits mean the worker touched the
      // test/CI/lockfile surface it was not asked to touch — flag for review.
      const verdict = judgeCell(root, requireFlag(flags, 'id'));
      const text = verdict.hits.length
        ? `FROZEN-JUDGE HITS for ${verdict.id}: ${verdict.hits
            .map((h) => `${h.file} (${h.rule})`)
            .join('; ')} — do not count this cell toward a clean wave; flag it for review (decision 0018).`
        : `Judge intact for ${verdict.id}: no undeclared test/CI/lockfile changes.`;
      return { result: verdict, text };
    }
    default:
      throw new Error(
        `Unknown command "${args.command || '(missing)'}". Use: list, ready, show, add, update, claim, verify, cap, block, drop, tier, judge.`,
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
