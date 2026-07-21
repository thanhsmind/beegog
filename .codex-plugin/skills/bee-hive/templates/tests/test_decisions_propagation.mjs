#!/usr/bin/env node
// test_decisions_propagation.mjs — decision-propagation dp-1 (CONTEXT D4a):
// structured recall for the decisions store. Covers: logDecision optional
// tags[] (lowercase-slug validated, additive/zero-migration), `decisions
// search` gaining --tag/--scope(alias --area)/--since composable with
// --text (--text becomes optional once a structured filter is present; zero
// filters still refuses), legacy metadata-less events (still text-searchable,
// excluded once a --tag filter is applied), and `decisions active` gaining
// the same filter set. Same PASS/FAIL/exit-1 contract as every other suite
// here — see scripts/lib/test-fixture.mjs.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runModuleWorker } from '../../../../scripts/lib/run-module-worker.mjs';
import {
  makeTempRepo,
  check,
  assert,
  assertThrows,
  printSummaryAndExit,
} from '../../../../scripts/lib/test-fixture.mjs';
import { logDecision, activeDecisions } from '../lib/decisions.mjs';

const beeMjsModulePath = fileURLToPath(new URL('../bee.mjs', import.meta.url));

function runBee(args, cwd) {
  return runModuleWorker(beeMjsModulePath, { args, cwd });
}

function decisionsFilePath(root) {
  return path.join(root, '.bee', 'decisions.jsonl');
}

// Test-only helper: rewrite one event's `date` in the raw JSONL store so
// --since filtering can be asserted deterministically instead of racing the
// real clock.
function setEventDate(root, id, isoDate) {
  const file = decisionsFilePath(root);
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l.trim());
  const rewritten = lines.map((line) => {
    const obj = JSON.parse(line);
    if (obj.id === id) obj.date = isoDate;
    return JSON.stringify(obj);
  });
  fs.writeFileSync(file, `${rewritten.join('\n')}\n`, 'utf8');
}

const root = makeTempRepo();

// ─── logDecision: optional tags[], lowercase-slug validated, additive ──────

await check('logDecision: tags omitted -> event carries no tags key at all (zero-migration parity)', async () => {
  const event = logDecision(root, { decision: 'Use SQLite for the queue', rationale: 'zero ops' });
  assert(!('tags' in event), `expected no tags key on a tagless decide event, got ${JSON.stringify(event)}`);
});

await check('logDecision: tags[] round-trips as a lowercase-slug array on the event', async () => {
  const event = logDecision(root, {
    decision: 'Use structured recall for decisions',
    rationale: 'GH #32',
    tags: ['recall', 'decisions-store'],
  });
  assert(Array.isArray(event.tags), `expected event.tags array, got ${JSON.stringify(event.tags)}`);
  assert(
    event.tags.join(',') === 'recall,decisions-store',
    `expected tags to round-trip verbatim, got ${JSON.stringify(event.tags)}`,
  );
});

await check('logDecision: rejects a non-array tags value and an invalid (non-lowercase-slug) tag entry', async () => {
  assertThrows(
    () => logDecision(root, { decision: 'x', rationale: 'y', tags: 'not-an-array' }),
    'tag',
    'non-array tags rejected',
  );
  assertThrows(
    () => logDecision(root, { decision: 'x', rationale: 'y', tags: ['Not-Lowercase'] }),
    'tag',
    'uppercase tag entry rejected',
  );
  assertThrows(
    () => logDecision(root, { decision: 'x', rationale: 'y', tags: ['has space'] }),
    'tag',
    'tag with a space rejected',
  );
});

// ─── CLI: decisions log --tags round-trips ─────────────────────────────────

await check('CLI: decisions log --tags a,b round-trips tags on the logged event', async () => {
  const run = await runBee(
    [
      'decisions',
      'log',
      '--decision',
      'Adopt tag-scoped recall',
      '--rationale',
      'GH #32 recall at scale',
      '--tags',
      'alpha,beta',
      '--scope',
      'decision-propagation',
      '--json',
    ],
    root,
  );
  assert(run.status === 0, `CLI log exited ${run.status} :: ${run.stderr || run.stdout}`);
  const event = JSON.parse(run.stdout);
  assert(event.tags.join(',') === 'alpha,beta', `expected tags alpha,beta round-tripped, got ${JSON.stringify(event.tags)}`);
  assert(event.scope === 'decision-propagation', `expected scope to round-trip, got ${event.scope}`);
});

await check('CLI: decisions log --tags rejects an invalid slug with a non-zero exit and a tag-naming error', async () => {
  const run = await runBee(
    ['decisions', 'log', '--decision', 'x', '--rationale', 'y', '--tags', 'Bad_Tag', '--json'],
    root,
  );
  assert(run.status !== 0, 'invalid tag exits non-zero');
  const payload = JSON.parse(run.stdout);
  assert(/tag/i.test(payload.error || ''), `error should name the tag problem, got ${JSON.stringify(payload)}`);
});

// ─── seed a scoped/tagged corpus for search/active filter tests ───────────

const billingA = logDecision(root, {
  decision: 'Reconcile billing invoices nightly',
  rationale: 'accuracy over latency',
  tags: ['billing', 'nightly-job'],
  scope: 'billing',
});
const billingB = logDecision(root, {
  decision: 'Retry failed billing webhooks with backoff',
  rationale: 'avoid thundering herd',
  tags: ['billing', 'webhooks'],
  scope: 'billing',
});
const authA = logDecision(root, {
  decision: 'Rotate auth tokens every 24h',
  rationale: 'reduce blast radius',
  tags: ['auth'],
  scope: 'auth',
});
// Legacy-shaped event: no tags field at all (matches the pre-dp-1 shape).
const legacy = logDecision(root, {
  decision: 'Use the legacy zenoflex queue for jobs',
  rationale: 'predates tag support',
});

// ─── decisions search: --tag / --scope / --area alias / --since, composed ──

await check('CLI: decisions search --tag matches exact (case-insensitive), excludes non-matching and legacy (tagless) events', async () => {
  const run = await runBee(['decisions', 'search', '--tag', 'BILLING', '--json'], root);
  assert(run.status === 0, `search --tag exited ${run.status} :: ${run.stderr || run.stdout}`);
  const { decisions } = JSON.parse(run.stdout);
  const ids = decisions.map((d) => d.id);
  assert(ids.includes(billingA.id) && ids.includes(billingB.id), 'both billing-tagged events matched');
  assert(!ids.includes(authA.id), 'auth-tagged event excluded');
  assert(!ids.includes(legacy.id), 'legacy (tagless) event excluded when --tag is given');
});

await check('CLI: decisions search --scope matches exact (case-insensitive); --area is an alias for --scope', async () => {
  const byScope = await runBee(['decisions', 'search', '--scope', 'BILLING', '--json'], root);
  assert(byScope.status === 0, `search --scope exited ${byScope.status} :: ${byScope.stderr || byScope.stdout}`);
  const scopeIds = JSON.parse(byScope.stdout).decisions.map((d) => d.id);
  assert(scopeIds.includes(billingA.id) && scopeIds.includes(billingB.id), 'both billing-scoped events matched via --scope');
  assert(!scopeIds.includes(authA.id), 'auth-scoped event excluded via --scope');

  const byArea = await runBee(['decisions', 'search', '--area', 'billing', '--json'], root);
  assert(byArea.status === 0, `search --area exited ${byArea.status} :: ${byArea.stderr || byArea.stdout}`);
  const areaIds = JSON.parse(byArea.stdout).decisions.map((d) => d.id).sort();
  assert(areaIds.join(',') === scopeIds.sort().join(','), '--area is an exact alias for --scope');
});

await check('CLI: decisions search --since is inclusive of the boundary date and excludes events strictly before it', async () => {
  setEventDate(root, billingA.id, '2026-01-10T00:00:00.000Z');
  setEventDate(root, billingB.id, '2026-01-15T00:00:00.000Z');

  const onBoundary = await runBee(['decisions', 'search', '--since', '2026-01-10', '--tag', 'billing', '--json'], root);
  assert(onBoundary.status === 0, `search --since exited ${onBoundary.status} :: ${onBoundary.stderr || onBoundary.stdout}`);
  const boundaryIds = JSON.parse(onBoundary.stdout).decisions.map((d) => d.id);
  assert(boundaryIds.includes(billingA.id), 'event dated exactly on --since is included (inclusive)');
  assert(boundaryIds.includes(billingB.id), 'later event still included');

  const afterA = await runBee(['decisions', 'search', '--since', '2026-01-11', '--tag', 'billing', '--json'], root);
  const afterIds = JSON.parse(afterA.stdout).decisions.map((d) => d.id);
  assert(!afterIds.includes(billingA.id), 'event strictly before --since is excluded');
  assert(afterIds.includes(billingB.id), 'event on/after --since still included');
});

await check('CLI: decisions search composes --tag + --scope + --text (AND, not OR)', async () => {
  const run = await runBee(
    ['decisions', 'search', '--tag', 'billing', '--scope', 'billing', '--text', 'webhook', '--json'],
    root,
  );
  assert(run.status === 0, `composed search exited ${run.status} :: ${run.stderr || run.stdout}`);
  const ids = JSON.parse(run.stdout).decisions.map((d) => d.id);
  assert(ids.length === 1 && ids[0] === billingB.id, `expected only the webhook billing event, got ${JSON.stringify(ids)}`);
});

await check('CLI: decisions search --text stays optional once a structured filter is present', async () => {
  const run = await runBee(['decisions', 'search', '--tag', 'auth', '--json'], root);
  assert(run.status === 0, `search --tag with no --text exited ${run.status} :: ${run.stderr || run.stdout}`);
  const ids = JSON.parse(run.stdout).decisions.map((d) => d.id);
  assert(ids.length === 1 && ids[0] === authA.id, `expected the auth event without --text, got ${JSON.stringify(ids)}`);
});

await check('CLI: decisions search with zero filters at all (no --text, no structured filter) still refuses', async () => {
  const run = await runBee(['decisions', 'search', '--json'], root);
  assert(run.status !== 0, 'search with no filters at all exits non-zero');
  const payload = JSON.parse(run.stdout);
  assert(typeof payload.error === 'string' && payload.error.length > 0, 'refusal carries an error message');
});

await check('CLI: decisions search --text alone (legacy call shape) still works and finds a legacy (tagless) event', async () => {
  const run = await runBee(['decisions', 'search', '--text', 'zenoflex', '--json'], root);
  assert(run.status === 0, `legacy --text-only search exited ${run.status} :: ${run.stderr || run.stdout}`);
  const ids = JSON.parse(run.stdout).decisions.map((d) => d.id);
  assert(ids.includes(legacy.id), 'legacy metadata-less event is still found by --text substring search');
});

// ─── decisions active: same filter set as a deliberate sibling extension ──

await check('CLI: decisions active (no flags) is unchanged — lists every active decision, newest first', async () => {
  const run = await runBee(['decisions', 'active', '--json'], root);
  assert(run.status === 0, `active exited ${run.status} :: ${run.stderr || run.stdout}`);
  const { decisions } = JSON.parse(run.stdout);
  const ids = decisions.map((d) => d.id);
  assert(ids.includes(legacy.id) && ids.includes(authA.id), 'active still lists everything without filters');
});

await check('CLI: decisions active --tag/--scope/--since filter and compose exactly like search', async () => {
  const byTag = await runBee(['decisions', 'active', '--tag', 'billing', '--json'], root);
  assert(byTag.status === 0, `active --tag exited ${byTag.status} :: ${byTag.stderr || byTag.stdout}`);
  const tagIds = JSON.parse(byTag.stdout).decisions.map((d) => d.id);
  assert(tagIds.includes(billingA.id) && tagIds.includes(billingB.id), 'active --tag matches billing events');
  assert(!tagIds.includes(authA.id) && !tagIds.includes(legacy.id), 'active --tag excludes non-matching and legacy events');

  const byArea = await runBee(['decisions', 'active', '--area', 'auth', '--json'], root);
  const areaIds = JSON.parse(byArea.stdout).decisions.map((d) => d.id);
  assert(areaIds.length === 1 && areaIds[0] === authA.id, `active --area (alias) should isolate the auth event, got ${JSON.stringify(areaIds)}`);

  const bySince = await runBee(['decisions', 'active', '--tag', 'billing', '--since', '2026-01-11', '--json'], root);
  const sinceIds = JSON.parse(bySince.stdout).decisions.map((d) => d.id);
  assert(!sinceIds.includes(billingA.id) && sinceIds.includes(billingB.id), 'active composes --tag with --since');

  const withRecent = await runBee(['decisions', 'active', '--tag', 'billing', '--recent', '1', '--json'], root);
  const recentIds = JSON.parse(withRecent.stdout).decisions.map((d) => d.id);
  assert(recentIds.length === 1, `--recent applies after filtering, expected exactly 1, got ${JSON.stringify(recentIds)}`);
});

// ─── empty store: filters degrade to an empty result, never throw ─────────

await check('empty store: search/active with a structured filter on a fresh repo with no decisions.jsonl returns [] without throwing', async () => {
  const emptyRoot = makeTempRepo();
  try {
    assert(!fs.existsSync(decisionsFilePath(emptyRoot)), 'precondition: no decisions.jsonl exists yet');
    assert(activeDecisions(emptyRoot).length === 0, 'lib-level activeDecisions on an empty store is []');

    const search = await runBee(['decisions', 'search', '--tag', 'anything', '--json'], emptyRoot);
    assert(search.status === 0, `empty-store search --tag exited ${search.status} :: ${search.stderr || search.stdout}`);
    assert(JSON.parse(search.stdout).decisions.length === 0, 'empty-store search --tag returns an empty array');

    const active = await runBee(['decisions', 'active', '--scope', 'anything', '--json'], emptyRoot);
    assert(active.status === 0, `empty-store active --scope exited ${active.status} :: ${active.stderr || active.stdout}`);
    assert(JSON.parse(active.stdout).decisions.length === 0, 'empty-store active --scope returns an empty array');

    // Zero filters at all: active still fine (matches its unchanged no-flags
    // behavior), search still refuses (matches the zero-filters refusal rule).
    const activeNoFlags = await runBee(['decisions', 'active', '--json'], emptyRoot);
    assert(activeNoFlags.status === 0, 'empty-store active with no flags does not throw');
    assert(JSON.parse(activeNoFlags.stdout).decisions.length === 0, 'empty-store active with no flags is []');

    const searchNoFlags = await runBee(['decisions', 'search', '--json'], emptyRoot);
    assert(searchNoFlags.status !== 0, 'empty-store search with zero filters still refuses, same as a non-empty store');
  } finally {
    fs.rmSync(emptyRoot, { recursive: true, force: true });
  }
});

printSummaryAndExit();
