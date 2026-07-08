#!/usr/bin/env node
// bee_decisions.mjs — event-sourced decision log CLI. Thin wrapper over lib/decisions.mjs.
//
// Usage:
//   node .bee/bin/bee_decisions.mjs log --decision D --rationale R [--alternatives A] [--scope S] [--confidence N] [--source S] [--json]
//   node .bee/bin/bee_decisions.mjs supersede --id UUID --decision D --rationale R [--json]
//   node .bee/bin/bee_decisions.mjs redact --id UUID --reason R [--json]
//   node .bee/bin/bee_decisions.mjs active [--recent N] [--json]
//   node .bee/bin/bee_decisions.mjs search --text T [--json]

import { findRepoRoot } from './lib/state.mjs';
import {
  logDecision,
  supersedeDecision,
  redactDecision,
  activeDecisions,
  datamark,
} from './lib/decisions.mjs';

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

function formatDecision(event) {
  const head = `[${event.date}] ${datamark(event.decision)} (id ${event.id}, ${event.type})`;
  const why = `  why: ${datamark(event.rationale)}`;
  const alt = event.alternatives ? `  alternatives: ${datamark(event.alternatives)}` : null;
  return [head, why, alt].filter(Boolean).join('\n');
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
    case 'log': {
      const confidence =
        flags.confidence !== undefined ? Number.parseInt(String(flags.confidence), 10) : null;
      if (flags.confidence !== undefined && !Number.isFinite(confidence)) {
        throw new Error('--confidence must be an integer.');
      }
      const event = logDecision(root, {
        decision: requireFlag(flags, 'decision'),
        rationale: requireFlag(flags, 'rationale'),
        alternatives: flags.alternatives ? String(flags.alternatives) : null,
        scope: flags.scope ? String(flags.scope) : 'repo',
        source: flags.source ? String(flags.source) : 'user',
        confidence,
      });
      return { result: event, text: `Logged decision ${event.id}.` };
    }
    case 'supersede': {
      const event = supersedeDecision(root, {
        supersedes: requireFlag(flags, 'id'),
        decision: requireFlag(flags, 'decision'),
        rationale: requireFlag(flags, 'rationale'),
      });
      return { result: event, text: `Superseded ${event.supersedes} with ${event.id}.` };
    }
    case 'redact': {
      const event = redactDecision(root, {
        redacts: requireFlag(flags, 'id'),
        reason: requireFlag(flags, 'reason'),
      });
      return { result: event, text: `Redacted ${event.redacts}.` };
    }
    case 'active': {
      const recent =
        flags.recent !== undefined ? Number.parseInt(String(flags.recent), 10) : null;
      if (flags.recent !== undefined && (!Number.isFinite(recent) || recent <= 0)) {
        throw new Error('--recent must be a positive integer.');
      }
      const decisions = activeDecisions(root, { recent });
      const text = decisions.length
        ? decisions.map(formatDecision).join('\n')
        : 'No active decisions.';
      return { result: { decisions }, text };
    }
    case 'search': {
      const needle = requireFlag(flags, 'text').toLowerCase();
      const decisions = activeDecisions(root).filter((event) =>
        [event.decision, event.rationale, event.alternatives]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(needle)),
      );
      const text = decisions.length
        ? decisions.map(formatDecision).join('\n')
        : `No active decisions matching "${needle}".`;
      return { result: { decisions }, text };
    }
    default:
      throw new Error(
        `Unknown command "${args.command || '(missing)'}". Use: log, supersede, redact, active, search.`,
      );
  }
}

function main(argv) {
  let json = argv.includes('--json');
  try {
    const args = parseArgs(argv);
    json = args.json;
    const { result, text, exitCode = 0 } = run(args);
    process.stdout.write(json ? `${JSON.stringify(result, null, 2)}\n` : `${text}\n`);
    return exitCode;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (json) process.stdout.write(`${JSON.stringify({ error: message })}\n`);
    else process.stderr.write(`${message}\n`);
    return 1;
  }
}

process.exitCode = main(process.argv.slice(2));
