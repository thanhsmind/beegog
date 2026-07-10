#!/usr/bin/env node
// bee_backlog.mjs — mechanical backlog passes (P2 rank, P3 badges). Thin wrapper
// over lib/backlog.mjs. Status transitions stay prose-ruled (D7) — this CLI
// never flips a row's status, it only reorders rows and renders counts.
//
// Usage:
//   node .bee/bin/bee_backlog.mjs counts [--json]
//   node .bee/bin/bee_backlog.mjs rank [--write] [--json]
//   node .bee/bin/bee_backlog.mjs badges [--write] [--json]

import { findRepoRoot } from './lib/state.mjs';
import { readBacklogCounts, rankBacklog, updateReadmeBadges } from './lib/backlog.mjs';

function parseArgs(argv) {
  const args = { command: '', flags: {}, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      if (!args.command) args.command = arg;
      else throw new Error(`Unexpected argument: ${arg}`);
      continue;
    }
    const name = arg.slice(2);
    if (name === 'json') args.json = true;
    else if (name === 'write') args.flags.write = true;
    else throw new Error(`Unknown flag --${name}.`);
  }
  return args;
}

function run(args) {
  const root = findRepoRoot(process.cwd());
  if (!root) {
    throw new Error(
      'No bee repo root found (no .bee/onboarding.json or .git up the tree). Run bee-hive onboarding.',
    );
  }

  switch (args.command) {
    case 'counts': {
      const counts = readBacklogCounts(root);
      if (!counts) return { result: null, text: 'No docs/backlog.md found.' };
      return {
        result: counts,
        text: `PBI: ${counts.done} done / ${counts.inFlight} in-flight / ${counts.proposed} proposed (${counts.total} total)`,
      };
    }
    case 'rank': {
      const ranked = rankBacklog(root, { write: args.flags.write === true });
      if (!ranked) return { result: null, text: 'No parseable backlog table in docs/backlog.md.' };
      const verb = args.flags.write ? (ranked.changed ? 'Reordered' : 'Already ordered') : ranked.changed ? 'Would reorder to' : 'Already ordered';
      return {
        result: ranked,
        text: `${verb}: ${ranked.order.join(', ')}${args.flags.write || !ranked.changed ? '' : ' (re-run with --write to apply)'}`,
      };
    }
    case 'badges': {
      const badges = updateReadmeBadges(root, { write: args.flags.write === true });
      if (!badges) return { result: null, text: 'README.md or docs/backlog.md missing — nothing to badge.' };
      const verb = args.flags.write ? (badges.changed ? 'README badges refreshed' : 'README badges already current') : badges.changed ? 'README badges stale (re-run with --write to apply)' : 'README badges already current';
      return { result: badges, text: `${verb}: ${badges.badges}` };
    }
    default:
      throw new Error(`Unknown command "${args.command || '(missing)'}". Use: counts, rank, badges.`);
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
