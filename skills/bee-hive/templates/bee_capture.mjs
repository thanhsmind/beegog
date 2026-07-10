#!/usr/bin/env node
// bee_capture.mjs — capture-queue CLI (decision 0017). Thin wrapper over lib/capture.mjs.
//
// Usage:
//   node .bee/bin/bee_capture.mjs add --outcome "..." [--did D1,D2] [--area <area>] [--files a,b] [--lane small] [--json]
//   node .bee/bin/bee_capture.mjs list [--json]
//   node .bee/bin/bee_capture.mjs flush --id <uuid> [--into docs/specs/<area>.md] [--json]
//   node .bee/bin/bee_capture.mjs count [--json]

import { findRepoRoot } from './lib/state.mjs';
import { addCaptureStub, pendingCaptureStubs, flushCaptureStub, captureQueue } from './lib/capture.mjs';

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

function formatStub(stub) {
  const parts = [`[${stub.at}] ${stub.outcome} (id ${stub.id})`];
  if (stub.dids && stub.dids.length) parts.push(`  decisions: ${stub.dids.join(', ')}`);
  if (stub.area) parts.push(`  area: ${stub.area}`);
  if (stub.files && stub.files.length) parts.push(`  files: ${stub.files.join(', ')}`);
  return parts.join('\n');
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
    case 'add': {
      const stub = addCaptureStub(root, {
        outcome: requireFlag(flags, 'outcome'),
        dids: flags.did ? String(flags.did) : null,
        area: flags.area ? String(flags.area) : null,
        files: flags.files ? String(flags.files) : null,
        lane: flags.lane ? String(flags.lane) : null,
      });
      return {
        result: stub,
        text: `Queued capture stub ${stub.id}. Flush via bee-scribing at wrap-up, before compact/clear, or next session (decision 0017).`,
      };
    }
    case 'list': {
      const stubs = pendingCaptureStubs(root);
      const text = stubs.length
        ? stubs.map(formatStub).join('\n')
        : 'Capture queue is empty.';
      return { result: { count: stubs.length, stubs }, text };
    }
    case 'flush': {
      const record = flushCaptureStub(root, requireFlag(flags, 'id'), {
        into: flags.into ? String(flags.into) : null,
      });
      return {
        result: record,
        text: `Flushed stub ${record.id}${record.into ? ` into ${record.into}` : ''}.`,
      };
    }
    case 'count': {
      const queue = captureQueue(root);
      return {
        result: { count: queue.count },
        text: `${queue.count} pending capture stub(s).`,
      };
    }
    default:
      throw new Error(
        `Unknown command "${args.command || '(missing)'}". Use: add, list, flush, count.`,
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
