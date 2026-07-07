#!/usr/bin/env node
// bee_reservations.mjs — file reservation CLI. Thin wrapper over lib/reservations.mjs.
//
// Usage:
//   node .bee/bin/bee_reservations.mjs reserve --agent A --cell C --path P [--ttl N] [--json]
//   node .bee/bin/bee_reservations.mjs release --agent A [--cell C] [--json]
//   node .bee/bin/bee_reservations.mjs list [--active-only] [--json]
//   node .bee/bin/bee_reservations.mjs sweep [--json]

import { findRepoRoot } from './lib/state.mjs';
import { reserve, release, listReservations, sweepExpired } from './lib/reservations.mjs';

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
    else if (['json', 'active-only'].includes(name)) value = true;
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

function run(args) {
  const root = findRepoRoot(process.cwd());
  if (!root) {
    throw new Error(
      'No bee repo root found (no .bee/onboarding.json or .git up the tree). Run bee-hive onboarding.',
    );
  }
  const { flags } = args;

  switch (args.command) {
    case 'reserve': {
      const ttl = flags.ttl !== undefined ? Number.parseInt(String(flags.ttl), 10) : undefined;
      if (flags.ttl !== undefined && (!Number.isFinite(ttl) || ttl <= 0)) {
        throw new Error('--ttl must be a positive integer (seconds).');
      }
      const result = reserve(root, {
        agent: requireFlag(flags, 'agent'),
        cell: requireFlag(flags, 'cell'),
        path: requireFlag(flags, 'path'),
        ...(ttl !== undefined ? { ttl } : {}),
      });
      const text = result.ok
        ? `Reserved "${result.reservation.path}" for ${result.reservation.agent} (cell ${result.reservation.cell}, ttl ${result.reservation.ttl_seconds}s).`
        : [
            'Reservation CONFLICT — return [BLOCKED] to the orchestrator:',
            ...result.conflicts.map((c) => `- ${c.agent} holds "${c.path}" (cell ${c.cell})`),
          ].join('\n');
      return { result, text, exitCode: result.ok ? 0 : 1 };
    }
    case 'release': {
      const result = release(root, {
        agent: requireFlag(flags, 'agent'),
        cell: flags.cell ? String(flags.cell) : null,
      });
      return { result, text: `Released ${result.released} reservation(s).` };
    }
    case 'list': {
      const reservations = listReservations(root, { activeOnly: flags['active-only'] === true });
      const text = reservations.length
        ? reservations
            .map(
              (r) =>
                `${r.agent} | cell ${r.cell} | ${r.path} | reserved ${r.reserved_at} | ${r.released_at ? `released ${r.released_at}` : 'active/expired by TTL'}`,
            )
            .join('\n')
        : 'No reservations.';
      return { result: { reservations }, text };
    }
    case 'sweep': {
      const released = sweepExpired(root);
      return { result: { released }, text: `Swept ${released} expired reservation(s).` };
    }
    default:
      throw new Error(
        `Unknown command "${args.command || '(missing)'}". Use: reserve, release, list, sweep.`,
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
