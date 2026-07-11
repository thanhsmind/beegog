#!/usr/bin/env node
// bee_backlog.mjs — mechanical backlog passes (P2 rank, P3 badges) plus the
// `add` verb (cli-mutations-2, decision from cli-mutations plan.md: agents
// never hand-edit .bee/*.json(l)). counts/rank/badges are a thin wrapper over
// lib/backlog.mjs and operate on docs/backlog.md; `add` is unrelated — it
// validates-then-appends one line to .bee/backlog.jsonl (the feedback-digest
// source lib/feedback.mjs's collectFeedback reads), fixing the "kind: vs
// type:" hand-edit drift class at the door. Status transitions stay
// prose-ruled (D7) — this CLI never flips a docs/backlog.md row's status, it
// only reorders rows, renders counts, and appends validated backlog.jsonl rows.
//
// Usage:
//   node .bee/bin/bee_backlog.mjs counts [--json]
//   node .bee/bin/bee_backlog.mjs rank [--write] [--json]
//   node .bee/bin/bee_backlog.mjs badges [--write] [--json]
//   node .bee/bin/bee_backlog.mjs add --type T --title S --severity P1|P2|P3 --layer L [--detail S] [--feature F] [--json]
//     (--type must be a KIND_ALIASES key, e.g. "friction", or an
//      already-normalized NORMALIZED_KINDS value, e.g. "deviation" — both
//      imported from lib/feedback.mjs, the same vocabulary the digest merge
//      path (mergeDigests) already accepts, so a valid --type is NEVER
//      dropped as unknown_type. --severity is P1|P2|P3. --layer is a free
//      non-empty string <=40 chars — no allowlist, matching
//      lib/feedback.mjs's own free-string treatment of layer. --title is
//      required, <=200 chars. Appends {ts, type, title, detail, severity,
//      layer, feature} — no source field: the collector always overrides
//      source with the fixed SRC_BACKLOG label and never reads a row's own
//      source. Any rejection leaves .bee/backlog.jsonl untouched.)

import path from 'node:path';
import { findRepoRoot } from './lib/state.mjs';
import { readBacklogCounts, rankBacklog, updateReadmeBadges } from './lib/backlog.mjs';
import { appendJsonl } from './lib/fsutil.mjs';
import { KIND_ALIASES, NORMALIZED_KINDS } from './lib/feedback.mjs';

const SEVERITIES = ['P1', 'P2', 'P3'];
const MAX_TITLE = 200;
const MAX_LAYER = 40;

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
    if (name === 'json') {
      args.json = true;
      continue;
    }
    if (args.command === 'add') {
      // `add` takes value flags (--type, --title, --severity, --layer,
      // --detail, --feature) — a separate, permissive branch so the existing
      // counts/rank/badges strict boolean-flag parsing below is untouched.
      let value;
      if (eq !== -1) value = arg.slice(eq + 1);
      else {
        value = argv[i + 1];
        if (value === undefined) throw new Error(`Flag --${name} requires a value.`);
        i += 1;
      }
      args.flags[name] = value;
      continue;
    }
    if (name === 'write') {
      args.flags.write = true;
      continue;
    }
    throw new Error(`Unknown flag --${name}.`);
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

function allowedTypes() {
  return [...new Set([...Object.keys(KIND_ALIASES), ...NORMALIZED_KINDS])].sort();
}

function runAdd(root, flags) {
  const type = requireFlag(flags, 'type');
  if (!Object.prototype.hasOwnProperty.call(KIND_ALIASES, type) && !NORMALIZED_KINDS.has(type)) {
    throw new Error(
      `add: invalid --type "${type}" — not a KIND_ALIASES key or an already-normalized NORMALIZED_KINDS value (lib/feedback.mjs), so buildDigest would drop it as unknown_type. FIX: use one of ${allowedTypes().join(', ')}.`,
    );
  }
  const title = requireFlag(flags, 'title');
  if (title.length > MAX_TITLE) {
    throw new Error(`add: --title is ${title.length} chars, over the ${MAX_TITLE}-char limit. FIX: shorten the title.`);
  }
  const severity = requireFlag(flags, 'severity');
  if (!SEVERITIES.includes(severity)) {
    throw new Error(`add: invalid --severity "${severity}". FIX: use one of ${SEVERITIES.join(', ')}.`);
  }
  const layer = requireFlag(flags, 'layer');
  if (layer.length > MAX_LAYER) {
    throw new Error(`add: --layer is ${layer.length} chars, over the ${MAX_LAYER}-char limit. FIX: shorten the layer.`);
  }
  const detail = flags.detail !== undefined && flags.detail !== true ? String(flags.detail) : '';
  const feature = flags.feature !== undefined && flags.feature !== true ? String(flags.feature) : '';
  const line = {
    ts: new Date().toISOString(),
    type,
    title,
    detail,
    severity,
    layer,
    feature,
  };
  appendJsonl(path.join(root, '.bee', 'backlog.jsonl'), line);
  return { result: line, text: `Appended ${severity} ${type} row to .bee/backlog.jsonl: "${title}"` };
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
    case 'add':
      return runAdd(root, args.flags);
    default:
      throw new Error(`Unknown command "${args.command || '(missing)'}". Use: counts, rank, badges, add.`);
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
