#!/usr/bin/env node
// bee_feedback.mjs — feedback digest CLI (P18, evolving loop, decision 8cd4c84e / D2).
// Thin wrapper over lib/feedback.mjs. NO collection, redaction, or pain logic lives
// here — that all lives in lib/feedback.mjs. This file only parses args, calls the
// lib, formats a one-line summary, and writes the digest to disk when asked.
//
// Usage:
//   node .bee/bin/bee_feedback.mjs digest [--out <path>] [--json]
//   node .bee/bin/bee_feedback.mjs count [--json]
//   node .bee/bin/bee_feedback.mjs collect [--json]
//
// `collect` returns the LOCAL digest only (this repo's own feedback). The
// dogfood_repos merge across foreign repos belongs to evolving-3, which depends
// on this cell: it redirects the single buildDigest(...) call inside the
// 'collect' case to mergeDigests(...) instead of adding a second code path.

import path from 'node:path';
import { findRepoRoot } from './lib/state.mjs';
import { writeJsonAtomic } from './lib/fsutil.mjs';
import { buildDigest, mergeDigests } from './lib/feedback.mjs';

const DEFAULT_DIGEST_PATH = path.join('.bee', 'feedback-digest.json');

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

// Presentation only — groups the digest's own `dropped[].reason` values for a
// human-readable one-line summary. No new drop reasons are invented here; the
// category vocabulary is DROP_REASONS in lib/feedback.mjs.
function summarizeDropped(dropped) {
  const byReason = {};
  for (const d of dropped) {
    const key = (d && d.reason) || 'unknown';
    byReason[key] = (byReason[key] || 0) + 1;
  }
  const keys = Object.keys(byReason).sort();
  if (keys.length === 0) return 'none';
  return keys.map((k) => `${k}: ${byReason[k]}`).join(', ');
}

function summaryLine(digest) {
  const { counts, dropped } = digest;
  const entryWord = counts.entries === 1 ? 'entry' : 'entries';
  return `${counts.entries} ${entryWord}, ${counts.dropped} dropped (${summarizeDropped(dropped)})`;
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
    case 'digest': {
      const digest = buildDigest(root, { now: new Date() });
      const outRel = flags.out ? String(flags.out) : DEFAULT_DIGEST_PATH;
      const outPath = path.resolve(root, outRel);
      writeJsonAtomic(outPath, digest);
      return {
        result: { path: outRel, digest },
        text: `Digest written to ${outRel} — ${summaryLine(digest)}.`,
      };
    }
    case 'count': {
      const digest = buildDigest(root, { now: new Date() });
      return {
        result: digest.counts,
        text: `${summaryLine(digest)}.`,
      };
    }
    case 'collect': {
      // D2b — the CONSUMER revalidates. mergeDigests folds each dogfood repo's
      // ALREADY-WRITTEN digest into the local one, re-running both pattern sets
      // and datamark()ing every surviving foreign title before it can enter a
      // prompt. With dogfood_repos absent it returns the local digest only.
      const digest = mergeDigests(root, { now: new Date() });
      const foreign = Array.isArray(digest.merged) ? digest.merged.length : 0;
      const suffix = foreign > 0 ? ` + ${foreign} dogfood repo${foreign === 1 ? '' : 's'}` : '';
      return {
        result: digest,
        text: `Merged digest — ${summaryLine(digest)}${suffix}.`,
      };
    }
    default:
      throw new Error(
        `Unknown command "${args.command || '(missing)'}". Use: digest, count, collect.`,
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
