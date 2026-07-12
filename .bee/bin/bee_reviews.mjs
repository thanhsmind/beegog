#!/usr/bin/env node
// bee_reviews.mjs — review-session + candidates-ledger CLI. Thin wrapper over
// lib/reviews.mjs (SPEC: docs/history/review-on-demand/SPEC.md §8).
//
// Usage:
//   node .bee/bin/bee_reviews.mjs create --file scope.json | --stdin [--json]
//     (scope JSON carries: id, requested_by, scope_description, included,
//      excluded [optional pre-exclusions], baseline, head. Runs the A10
//      verification preflight and A6 in-progress auto-exclusion BEFORE any
//      write; fails closed with non-zero exit and zero files written on
//      missing evidence or an id that already exists — ids are never reused.)
//   node .bee/bin/bee_reviews.mjs list [--json]
//   node .bee/bin/bee_reviews.mjs show --id ID [--json]
//   node .bee/bin/bee_reviews.mjs record --id ID --kind manifest|preflight|finding|uat|decision --file payload.json | --stdin [--json]
//     (manifest/preflight/decision SET the field; finding/uat APPEND one
//      entry per call. Refuses any payload touching baseline/head/included/
//      excluded — those are frozen at create, R5.)
//   node .bee/bin/bee_reviews.mjs candidate add --feature F --head SHA --mode MODE [--baseline SHA] [--cells a,b] [--json]
//     (--mode is required: docs|tiny|small|spike|standard|high-risk — the
//      closing feature's lane. Appends one line to .bee/review-candidates.jsonl.)
//   node .bee/bin/bee_reviews.mjs candidates [--json]

import fs from 'node:fs';
import { findRepoRoot } from './lib/state.mjs';
import {
  createReview,
  listReviews,
  readReview,
  recordOnReview,
  addCandidate,
  listCandidates,
  REVIEW_MODES,
} from './lib/reviews.mjs';

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
    else if (name === 'json' || name === 'stdin') value = true;
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

function readFileText(file, label) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    throw new Error(`Cannot read ${label} file: ${file}`);
  }
}

function readJsonInput(flags, label) {
  const text = flags.stdin === true ? fs.readFileSync(0, 'utf8') : readFileText(requireFlag(flags, 'file'), label);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label}: input is not valid JSON.`);
  }
}

function summarizeReview(session) {
  return `${session.id} [${session.decision && session.decision.status}] ${session.scope_description}`;
}

function splitList(raw) {
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
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
    case 'create': {
      const scope = readJsonInput(flags, 'scope');
      const session = createReview(root, scope);
      return { result: session, text: `Created review session ${session.id}.` };
    }
    case 'list': {
      const sessions = listReviews(root);
      return {
        result: sessions,
        text: sessions.length ? sessions.map(summarizeReview).join('\n') : 'No review sessions.',
      };
    }
    case 'show': {
      const id = requireFlag(flags, 'id');
      const session = readReview(root, id);
      if (!session) throw new Error(`Review session "${id}" not found.`);
      return { result: session, text: JSON.stringify(session, null, 2) };
    }
    case 'record': {
      const id = requireFlag(flags, 'id');
      const kind = requireFlag(flags, 'kind');
      const payload = readJsonInput(flags, 'payload');
      const session = recordOnReview(root, id, { kind, payload });
      return { result: session, text: `Recorded ${kind} on ${session.id} (updated_at ${session.updated_at}).` };
    }
    case 'candidate': {
      if (args.sub !== 'add') {
        throw new Error(`Unknown "candidate" subcommand "${args.sub || '(missing)'}". Use: candidate add.`);
      }
      const entry = addCandidate(root, {
        feature: requireFlag(flags, 'feature'),
        head: requireFlag(flags, 'head'),
        mode: requireFlag(flags, 'mode'),
        baseline: flags.baseline ? String(flags.baseline) : null,
        cells: flags.cells ? splitList(flags.cells) : [],
      });
      return { result: entry, text: `Added candidate ${entry.id} for feature "${entry.feature}" (mode ${entry.mode}).` };
    }
    case 'candidates': {
      const entries = listCandidates(root);
      return {
        result: entries,
        text: entries.length
          ? entries.map((e) => `${e.date} ${e.feature} @${e.head} (${e.mode})`).join('\n')
          : 'No review candidates.',
      };
    }
    default:
      throw new Error(
        `Unknown command "${args.command || '(missing)'}". Use: create, list, show, record, candidate add, candidates. ` +
          `(review modes: ${REVIEW_MODES.join(', ')})`,
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
