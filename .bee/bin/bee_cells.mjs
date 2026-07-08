#!/usr/bin/env node
// bee_cells.mjs — cell lifecycle CLI. Thin wrapper over lib/cells.mjs.
//
// Usage:
//   node .bee/bin/bee_cells.mjs list [--feature F] [--status S] [--json]
//   node .bee/bin/bee_cells.mjs ready [--feature F] [--json]
//   node .bee/bin/bee_cells.mjs show --id ID [--json]
//   node .bee/bin/bee_cells.mjs add --file cell.json | --stdin [--json]
//   node .bee/bin/bee_cells.mjs claim --id ID --worker NAME [--json]
//   node .bee/bin/bee_cells.mjs verify --id ID --command CMD --passed true|false [--output TEXT | --output-file F] [--json]
//     (small+ lanes refuse to cap without recorded verify output or evidence — decision 0004)
//   node .bee/bin/bee_cells.mjs cap --id ID [--outcome TEXT] [--files a,b] [--behavior-change]
//                                  [--evidence-file F] [--deviations-file F] [--friction TEXT] [--json]
//   node .bee/bin/bee_cells.mjs block --id ID --reason R [--json]
//   node .bee/bin/bee_cells.mjs drop --id ID --reason R [--json]

import fs from 'node:fs';
import { findRepoRoot } from './lib/state.mjs';
import {
  listCells,
  readyCells,
  readCell,
  addCell,
  claimCell,
  recordVerify,
  capCell,
  blockCell,
  dropCell,
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
    } else if (['json', 'stdin', 'behavior-change'].includes(name)) {
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
      const added = addCell(root, cell);
      return { result: added, text: `Added ${summarize(added)}` };
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
        behavior_change: flags['behavior-change'] === true,
        verification_evidence: flags['evidence-file']
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
    default:
      throw new Error(
        `Unknown command "${args.command || '(missing)'}". Use: list, ready, show, add, claim, verify, cap, block, drop.`,
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
