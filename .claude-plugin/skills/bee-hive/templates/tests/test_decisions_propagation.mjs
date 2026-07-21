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
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { runModuleWorker } from '../../../../scripts/lib/run-module-worker.mjs';
import {
  makeTempRepo,
  check,
  assert,
  assertThrows,
  printSummaryAndExit,
} from '../../../../scripts/lib/test-fixture.mjs';
import { logDecision, activeDecisions, supersedeDecision, redactDecision, archiveDecisions, DECISIONS_LOCK_NAME } from '../lib/decisions.mjs';
import { appendJsonl, readJsonl } from '../lib/fsutil.mjs';
import { pendingCaptureStubs } from '../lib/capture.mjs';
import { acquireStoreLockOnceSync } from '../lib/lock.mjs';

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

// ─── dp-2: supersede metadata inheritance + propagation sweep + capture
// stubs (CONTEXT D2/D6). Own temp repo so the docs/** sweep never sees the
// dp-1 corpus above, and never scans the real repo's docs/ tree. ──────────

const dpRoot = makeTempRepo();

await check('dp-2: supersede without --tags/--scope inherits both from the superseded target', async () => {
  const target = logDecision(dpRoot, {
    decision: 'Use queue A',
    rationale: 'perf',
    scope: 'billing',
    tags: ['queue', 'billing'],
  });
  const event = supersedeDecision(dpRoot, {
    supersedes: target.id,
    decision: 'Use queue B instead',
    rationale: 'queue A deprecated upstream',
  });
  assert(event.scope === 'billing', `expected inherited scope "billing", got ${event.scope}`);
  assert(
    Array.isArray(event.tags) && event.tags.join(',') === 'queue,billing',
    `expected inherited tags, got ${JSON.stringify(event.tags)}`,
  );
});

await check('dp-2: supersede of a metadata-less target (no scope/tags field at all) falls back to scope "repo" and carries no tags key', async () => {
  // Simulate a pre-dp-2 legacy event (or a legacy supersede target) by
  // appending a raw event that skips logDecision's scope default entirely —
  // this is the "metadata-less target" case D6 names explicitly.
  const legacyTargetId = crypto.randomUUID();
  appendJsonl(path.join(dpRoot, '.bee', 'decisions.jsonl'), {
    id: legacyTargetId,
    type: 'decide',
    date: new Date().toISOString(),
    decision: 'Legacy target with no scope field',
    rationale: 'predates D6',
  });
  const event = supersedeDecision(dpRoot, {
    supersedes: legacyTargetId,
    decision: 'Replace legacy target',
    rationale: 'D6 fallback path',
  });
  assert(event.scope === 'repo', `expected fallback scope "repo", got ${event.scope}`);
  assert(!('tags' in event), `expected no tags key when target has none, got ${JSON.stringify(event)}`);
});

await check('dp-2: explicit --tags/--scope on supersede override inheritance from the target', async () => {
  const target = logDecision(dpRoot, {
    decision: 'Use queue X',
    rationale: 'perf',
    scope: 'billing',
    tags: ['queue'],
  });
  const event = supersedeDecision(dpRoot, {
    supersedes: target.id,
    decision: 'Use queue Y',
    rationale: 'explicit override',
    tags: ['override-tag'],
    scope: 'checkout',
  });
  assert(event.scope === 'checkout', `expected explicit scope override, got ${event.scope}`);
  assert(event.tags.join(',') === 'override-tag', `expected explicit tags override, got ${JSON.stringify(event.tags)}`);
});

const sweepTarget = logDecision(dpRoot, {
  decision: 'Old sweep target decision',
  rationale: 'to be superseded',
  scope: 'checkout',
});
const sweepShort8 = sweepTarget.id.slice(0, 8);
const specDir = path.join(dpRoot, 'docs', 'specs');
fs.mkdirSync(specDir, { recursive: true });
const checkoutSpecPath = path.join(specDir, 'checkout.md');
const specLines = [
  '# Checkout',
  '',
  `Full id citation: ${sweepTarget.id} appears here.`,
  `Short citation: ${sweepShort8} appears here.`,
  `False positive embedded: abc${sweepShort8}def should not match.`,
  '',
];
fs.writeFileSync(checkoutSpecPath, specLines.join('\n'));
// Outside docs/** — must never be scanned (D2 pins the sweep root to docs/**).
fs.writeFileSync(
  path.join(dpRoot, 'src', 'notes.md'),
  `Outside docs/**, also cites ${sweepTarget.id} but must not count.\n`,
);

await check(
  'dp-2: propagation sweep finds full-id and standalone short8 citations under docs/**, rejects an embedded (non-boundary) short8, and rides the single append',
  async () => {
    const decisionsFile = path.join(dpRoot, '.bee', 'decisions.jsonl');
    const beforeLineCount = fs.readFileSync(decisionsFile, 'utf8').split(/\r?\n/).filter((l) => l.trim()).length;

    const event = supersedeDecision(dpRoot, {
      supersedes: sweepTarget.id,
      decision: 'Replace the sweep target',
      rationale: 'dp-2 sweep coverage',
    });

    assert(event.sweep, `expected event.sweep to be present, got ${JSON.stringify(event)}`);
    assert(
      event.sweep.hit_count === 2,
      `expected 2 sweep hits (full id + standalone short8), got ${JSON.stringify(event.sweep)}`,
    );
    assert(event.sweep.files.length === 2, `expected 2 hit records, got ${JSON.stringify(event.sweep.files)}`);
    const relSpecPath = path.relative(dpRoot, checkoutSpecPath);
    const hitFiles = event.sweep.files.map((h) => h.file);
    assert(
      hitFiles.every((f) => f === relSpecPath),
      `expected every hit under ${relSpecPath}, got ${JSON.stringify(hitFiles)}`,
    );
    const hitLines = event.sweep.files.map((h) => h.line).sort((a, b) => a - b);
    assert(hitLines.join(',') === '3,4', `expected hits on lines 3 and 4 only, got ${JSON.stringify(hitLines)}`);
    const embeddedHit = event.sweep.files.find((h) => h.line === 5);
    assert(!embeddedHit, 'the embedded (non-word-boundary) short8 occurrence on line 5 must NOT be a hit');

    // Lock doctrine: sweep computed BEFORE the append — the store gains
    // exactly one new line, and that line already carries the sweep result
    // inline (never a post-append rewrite of an already-written line).
    const afterLines = fs.readFileSync(decisionsFile, 'utf8').split(/\r?\n/).filter((l) => l.trim());
    assert(
      afterLines.length === beforeLineCount + 1,
      `expected exactly one new line appended, before ${beforeLineCount} after ${afterLines.length}`,
    );
    const appendedEvent = JSON.parse(afterLines[afterLines.length - 1]);
    assert(appendedEvent.id === event.id, 'the last line in the store is the returned supersede event');
    assert(
      appendedEvent.sweep && appendedEvent.sweep.hit_count === 2,
      'the appended line already carries the sweep result inline, not a later rewrite',
    );
  },
);

await check(
  'dp-2 CLI: one capture stub per sweep hit, source "supersede-sweep", outcome naming file:line and the new decision id',
  async () => {
    const stubTarget = logDecision(dpRoot, { decision: 'Stub target', rationale: 'isolated stub check', scope: 'billing' });
    const stubSpecPath = path.join(specDir, 'stub-target.md');
    fs.writeFileSync(stubSpecPath, `Cites ${stubTarget.id} once.\n`);

    const beforePending = pendingCaptureStubs(dpRoot).length;
    const run = await runBee(
      ['decisions', 'supersede', '--id', stubTarget.id, '--decision', 'Stub replacement', '--rationale', 'stub check', '--json'],
      dpRoot,
    );
    assert(run.status === 0, `CLI supersede exited ${run.status} :: ${run.stderr || run.stdout}`);
    const event = JSON.parse(run.stdout);
    assert(event.sweep.hit_count === 1, `expected exactly 1 hit, got ${JSON.stringify(event.sweep)}`);

    const pending = pendingCaptureStubs(dpRoot);
    assert(
      pending.length === beforePending + 1,
      `expected exactly one new capture stub, before ${beforePending} after ${pending.length}`,
    );
    const stub = pending[pending.length - 1];
    assert(stub.source === 'supersede-sweep', `expected stub.source "supersede-sweep", got ${stub.source}`);
    const hit = event.sweep.files[0];
    assert(stub.outcome.includes(`${hit.file}:${hit.line}`), `expected outcome to name file:line, got ${stub.outcome}`);
    assert(stub.outcome.includes(event.id), `expected outcome to name the new decision id, got ${stub.outcome}`);
  },
);

await check('dp-2 CLI: zero-hits sweep is a clean path — hit_count 0, empty files array, no capture stub, clean human message', async () => {
  const cleanTarget = logDecision(dpRoot, { decision: 'Never cited anywhere', rationale: 'clean path check' });
  const beforePending = pendingCaptureStubs(dpRoot).length;

  const jsonRun = await runBee(
    ['decisions', 'supersede', '--id', cleanTarget.id, '--decision', 'Replace never-cited', '--rationale', 'clean path', '--json'],
    dpRoot,
  );
  assert(jsonRun.status === 0, `CLI supersede exited ${jsonRun.status} :: ${jsonRun.stderr || jsonRun.stdout}`);
  const event = JSON.parse(jsonRun.stdout);
  assert(event.sweep.hit_count === 0, `expected 0 hits, got ${JSON.stringify(event.sweep)}`);
  assert(
    Array.isArray(event.sweep.files) && event.sweep.files.length === 0,
    `expected empty files array, got ${JSON.stringify(event.sweep.files)}`,
  );

  const pending = pendingCaptureStubs(dpRoot);
  assert(
    pending.length === beforePending,
    `expected no new capture stub on a zero-hit sweep, before ${beforePending} after ${pending.length}`,
  );

  const humanRun = await runBee(
    ['decisions', 'supersede', '--id', cleanTarget.id, '--decision', 'Replace again', '--rationale', 'human text check'],
    dpRoot,
  );
  assert(humanRun.status === 0, `human supersede exited ${humanRun.status} :: ${humanRun.stderr || humanRun.stdout}`);
  assert(
    /no citations/i.test(humanRun.stdout),
    `expected a clean no-citations message, got ${JSON.stringify(humanRun.stdout)}`,
  );
});

// ─── dp-3: archive verb + --all union reads (CONTEXT D4c) ─────────────────
// Own temp repo per check group to keep the archive split assertions free of
// the dp-1/dp-2 corpora above.

function decisionsArchiveFilePath(root) {
  return path.join(root, '.bee', 'decisions-archive.jsonl');
}

function rewriteEventDate(root, id, isoDate) {
  setEventDate(root, id, isoDate);
}

await check('dp-3: archive refuses (typed) when --before is omitted — no default age window', async () => {
  const root = makeTempRepo();
  logDecision(root, { decision: 'needs a before', rationale: 'refusal check' });
  assertThrows(() => archiveDecisions(root, {}), 'before', 'archiveDecisions with no --before at all refuses');
  assertThrows(() => archiveDecisions(root, { before: '' }), 'before', 'archiveDecisions with an empty --before refuses');
  assertThrows(
    () => archiveDecisions(root, { before: 'not-a-date' }),
    'before',
    'archiveDecisions with an unparsable --before refuses',
  );

  const run = await runBee(['decisions', 'archive', '--json'], root);
  assert(run.status !== 0, 'CLI archive with no --before exits non-zero');
  const payload = JSON.parse(run.stdout);
  // The registry's `required: ['before']` schema check intercepts before the
  // handler ever runs, so the refusal carries the CLI's structured
  // {field, reason, command} shape (test_bee_cli.mjs:296) rather than a
  // free-string `error`.
  const errorField = payload.error && typeof payload.error === 'object' ? payload.error.field : null;
  assert(errorField === 'before', `error should name field "before", got ${JSON.stringify(payload)}`);
});

await check('dp-3: archive refuses (typed) when nothing qualifies — a fresh event, --before far in the past', async () => {
  const root = makeTempRepo();
  logDecision(root, { decision: 'brand new, nothing to archive', rationale: 'refusal check' });
  assertThrows(
    () => archiveDecisions(root, { before: '2000-01-01' }),
    'nothing qualifies',
    'archiveDecisions refuses typed when zero events qualify',
  );
  assert(!fs.existsSync(decisionsArchiveFilePath(root)), 'a refused archive call never creates the archive file');
});

await check(
  'dp-3: archive split — superseded/redacted events move ALWAYS (regardless of age); plain decide events move only when strictly older than --before; everything else stays',
  async () => {
    const root = makeTempRepo();

    // Old, still-active decide event — old enough to be swept by age alone.
    const oldActive = logDecision(root, { decision: 'old active decide', rationale: 'age sweep target', scope: 'archive-test' });
    rewriteEventDate(root, oldActive.id, '2020-01-01T00:00:00.000Z');

    // Recent, still-active decide event — must survive (not old enough).
    const recentActive = logDecision(root, { decision: 'recent active decide', rationale: 'must survive', scope: 'archive-test' });

    // Recent supersede target — becomes superseded, must ALWAYS archive even
    // though it is recent (newer than --before).
    const supersedeTarget = logDecision(root, { decision: 'to be superseded', rationale: 'supersede target', scope: 'archive-test' });
    const supersedeEvent = supersedeDecision(root, {
      supersedes: supersedeTarget.id,
      decision: 'replacement decision',
      rationale: 'dp-3 archive split check',
    });

    // Recent redact target — becomes redacted, must ALWAYS archive even
    // though it is recent.
    const redactTarget = logDecision(root, { decision: 'to be redacted', rationale: 'redact target', scope: 'archive-test' });
    const redactEvent = redactDecision(root, { redacts: redactTarget.id, reason: 'dp-3 archive split check' });

    // --before sits strictly between oldActive's date and everything else's
    // "now" date — only oldActive should ever be swept by the age rule.
    const result = archiveDecisions(root, { before: '2021-01-01T00:00:00.000Z' });

    const archivedIds = result.archived.slice().sort();
    const expectedArchived = [oldActive.id, supersedeTarget.id, redactTarget.id].sort();
    assert(
      archivedIds.join(',') === expectedArchived.join(','),
      `expected exactly [old, supersedeTarget, redactTarget] archived, got ${JSON.stringify(archivedIds)}`,
    );

    const activeIds = new Set(readJsonl(path.join(root, '.bee', 'decisions.jsonl')).map((e) => e.id));
    assert(!activeIds.has(oldActive.id), 'old active decide event left the active file');
    assert(!activeIds.has(supersedeTarget.id), 'superseded target left the active file');
    assert(!activeIds.has(redactTarget.id), 'redacted target left the active file');
    assert(activeIds.has(recentActive.id), 'recent active decide event stayed in the active file');
    assert(activeIds.has(supersedeEvent.id), 'the supersede ACTION record itself stays in the active file');
    assert(activeIds.has(redactEvent.id), 'the redact ACTION record itself stays in the active file');

    const archivedEvents = readJsonl(decisionsArchiveFilePath(root));
    const archivedFileIds = new Set(archivedEvents.map((e) => e.id));
    assert(archivedFileIds.has(oldActive.id) && archivedFileIds.has(supersedeTarget.id) && archivedFileIds.has(redactTarget.id),
      `archive file missing an expected id, got ${JSON.stringify([...archivedFileIds])}`);
    assert(archivedFileIds.size === 3, `expected exactly 3 archived events on disk, got ${archivedFileIds.size}`);

    // Never rewrite surviving active events (append-only integrity):
    // recentActive/supersedeEvent/redactEvent must be byte-identical to
    // their pre-archive shape.
    const survivingRecent = readJsonl(path.join(root, '.bee', 'decisions.jsonl')).find((e) => e.id === recentActive.id);
    assert(
      JSON.stringify(survivingRecent) === JSON.stringify(recentActive),
      'surviving active decide event must never be rewritten by archive',
    );
  },
);

await check('dp-3: idempotent second run — nothing new qualifies, refuses cleanly, files untouched', async () => {
  const root = makeTempRepo();
  const old = logDecision(root, { decision: 'old one', rationale: 'idempotency check' });
  rewriteEventDate(root, old.id, '2020-01-01T00:00:00.000Z');
  const first = archiveDecisions(root, { before: '2021-01-01' });
  assert(first.archived.includes(old.id), 'first run archives the old event');

  const activeBefore = fs.readFileSync(path.join(root, '.bee', 'decisions.jsonl'), 'utf8');
  const archiveBefore = fs.readFileSync(decisionsArchiveFilePath(root), 'utf8');

  assertThrows(
    () => archiveDecisions(root, { before: '2021-01-01' }),
    'nothing qualifies',
    'second run with the same cutoff finds nothing left to archive',
  );

  const activeAfter = fs.readFileSync(path.join(root, '.bee', 'decisions.jsonl'), 'utf8');
  const archiveAfter = fs.readFileSync(decisionsArchiveFilePath(root), 'utf8');
  assert(activeAfter === activeBefore, 'a refused idempotent second run never touches the active file');
  assert(archiveAfter === archiveBefore, 'a refused idempotent second run never touches the archive file');
});

await check('dp-3: search/active --all reaches archived events; default (no --all) stays limited to the active store', async () => {
  const root = makeTempRepo();
  const old = logDecision(root, { decision: 'archived tag target', rationale: 'union read check', tags: ['archived-tag'] });
  rewriteEventDate(root, old.id, '2020-01-01T00:00:00.000Z');
  const recent = logDecision(root, { decision: 'recent tag target', rationale: 'union read check', tags: ['archived-tag'] });
  archiveDecisions(root, { before: '2021-01-01' });

  const defaultActive = await runBee(['decisions', 'active', '--json'], root);
  assert(defaultActive.status === 0, `default active exited ${defaultActive.status} :: ${defaultActive.stderr || defaultActive.stdout}`);
  const defaultIds = JSON.parse(defaultActive.stdout).decisions.map((d) => d.id);
  assert(!defaultIds.includes(old.id), 'default active (no --all) never reaches the archived event');
  assert(defaultIds.includes(recent.id), 'default active still lists the recent unarchived event');

  const allActive = await runBee(['decisions', 'active', '--all', '--json'], root);
  assert(allActive.status === 0, `active --all exited ${allActive.status} :: ${allActive.stderr || allActive.stdout}`);
  const allIds = JSON.parse(allActive.stdout).decisions.map((d) => d.id);
  assert(allIds.includes(old.id), 'active --all reaches the archived event');
  assert(allIds.includes(recent.id), 'active --all still includes the recent active event');
  assert(allIds.indexOf(recent.id) < allIds.indexOf(old.id), 'active --all is newest-first: recent event ranks before the older archived one');

  const defaultSearch = await runBee(['decisions', 'search', '--tag', 'archived-tag', '--json'], root);
  const defaultSearchIds = JSON.parse(defaultSearch.stdout).decisions.map((d) => d.id);
  assert(!defaultSearchIds.includes(old.id), 'default search (no --all) never reaches the archived event');

  const allSearch = await runBee(['decisions', 'search', '--tag', 'archived-tag', '--all', '--json'], root);
  assert(allSearch.status === 0, `search --all exited ${allSearch.status} :: ${allSearch.stderr || allSearch.stdout}`);
  const allSearchIds = JSON.parse(allSearch.stdout).decisions.map((d) => d.id);
  assert(allSearchIds.includes(old.id) && allSearchIds.includes(recent.id), 'search --tag --all reaches both the active and archived matches');
});

await check('dp-3: default reads are byte-identical to today for a store with no archive file at all', async () => {
  const root = makeTempRepo();
  logDecision(root, { decision: 'one', rationale: 'byte-identical check', tags: ['parity'] });
  logDecision(root, { decision: 'two', rationale: 'byte-identical check', tags: ['parity'] });
  assert(!fs.existsSync(decisionsArchiveFilePath(root)), 'precondition: no archive file exists yet');

  const withoutAll = activeDecisions(root);
  const withAllButNoArchive = activeDecisions(root, { all: true });
  assert(
    JSON.stringify(withoutAll) === JSON.stringify(withAllButNoArchive),
    'activeDecisions({all:true}) on an unarchived store must equal the default result exactly',
  );

  const cliDefault = await runBee(['decisions', 'active', '--json'], root);
  const cliAll = await runBee(['decisions', 'active', '--all', '--json'], root);
  assert(cliDefault.stdout === cliAll.stdout, 'CLI active --all output is byte-identical to default output on an unarchived store');
});

await check('dp-3: simulated partial-crash duplicate id — union read de-dupes by id, the ACTIVE copy wins, never a duplicate entry', async () => {
  const root = makeTempRepo();
  const dupId = crypto.randomUUID();
  const now = new Date().toISOString();
  // Simulate a crash between step (1) archive-append and step (2)
  // active-prune-rewrite: the same id lands in both files. The two payloads
  // differ deliberately so the winning copy is observable.
  appendJsonl(path.join(root, '.bee', 'decisions.jsonl'), {
    id: dupId,
    type: 'decide',
    date: now,
    decision: 'ACTIVE VERSION (post-crash, still the source of truth)',
    rationale: 'dp-3 crash-dedup check',
    scope: 'repo',
  });
  appendJsonl(decisionsArchiveFilePath(root), {
    id: dupId,
    type: 'decide',
    date: now,
    decision: 'ARCHIVE VERSION (stale, pre-crash copy — must lose)',
    rationale: 'dp-3 crash-dedup check',
    scope: 'repo',
  });

  const union = activeDecisions(root, { all: true });
  const matches = union.filter((event) => event.id === dupId);
  assert(matches.length === 1, `expected exactly one entry for the duplicated id, got ${matches.length}`);
  assert(
    matches[0].decision.startsWith('ACTIVE VERSION'),
    `expected the active copy to win the dedup, got ${JSON.stringify(matches[0])}`,
  );
});

await check(
  'dp-3: append writers (logDecision) and archive share the SAME store lock — a lock held externally blocks a logDecision call rather than corrupting the file',
  async () => {
    const root = makeTempRepo();
    logDecision(root, { decision: 'seed', rationale: 'lock-sharing check' });
    const preLockContents = fs.readFileSync(path.join(root, '.bee', 'decisions.jsonl'), 'utf8');

    const lock = acquireStoreLockOnceSync(root, DECISIONS_LOCK_NAME);
    assert(lock.acquired, 'precondition: test can acquire the decisions store lock directly');
    try {
      assertThrows(
        () => logDecision(root, { decision: 'should never land while the lock is held', rationale: 'lock-sharing check' }),
        'lock',
        'logDecision refuses/times out while the decisions store lock is externally held',
      );
      assertThrows(
        () => archiveDecisions(root, { before: '2099-01-01' }),
        'lock',
        'archiveDecisions also refuses/times out on the SAME externally-held lock (proves shared lock name)',
      );
    } finally {
      lock.release();
    }

    const postLockContents = fs.readFileSync(path.join(root, '.bee', 'decisions.jsonl'), 'utf8');
    assert(postLockContents === preLockContents, 'a refused write under lock contention never partially/corruptly writes the store');

    // Lock released — a normal call now succeeds.
    const event = logDecision(root, { decision: 'after release', rationale: 'lock-sharing check' });
    assert(event.id, 'logDecision succeeds again once the externally-held lock is released');
  },
);

// ─── dp-3: concurrent log-vs-archive under the shared lock (real OS-thread
// concurrency — see race_decisions_child.mjs for why this cannot be
// simulated single-threaded: the lock's bounded retry uses a synchronous
// Atomics.wait sleep, which blocks the event loop, so no same-thread timer
// could ever release a simulated holder mid-wait). ───────────────────────

const raceDecisionsChildScript = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'race_decisions_child.mjs',
);

await check('race: log-vs-archive — concurrent loggers and an archiver under the shared decisions lock lose no writes and never duplicate an id across both files', async () => {
  const result = await runModuleWorker(raceDecisionsChildScript, { args: ['log-vs-archive'], timeout: 60000 });
  const stdout = result.stdout || '(empty)';
  const stderr = result.stderr || '(empty)';
  assert(result.status === 0, `log-vs-archive race failed (status ${result.status}): stdout=${stdout} stderr=${stderr}`);
  assert(/^PASS +log-vs-archive/m.test(stdout), `expected a PASS summary line, got: ${stdout}`);
});

printSummaryAndExit();
