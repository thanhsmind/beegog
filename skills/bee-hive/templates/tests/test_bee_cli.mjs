#!/usr/bin/env node
// test_bee_cli.mjs — self-contained contract tests for the shared command
// registry and args validator (no framework). Creates a temp repo under
// os.tmpdir() (mirrors test_lib.mjs's isolation pattern) and NEVER runs a
// registry example against this checkout's real .bee/ state — several
// examples are state-mutating cell/decision/reservation operations that
// would corrupt this repo's own tracking data if run for real here.
//
// Covers:
//   1. every COMMAND_REGISTRY entry's `parameters` is valid JSON-Schema (D3 shape)
//   2. validate() rejects a missing required field with the structured
//      {ok:false, error:{field, reason, command}} shape, and never throws
//   3. every entry's examples[] executes successfully against the real
//      underlying helper script, inside the isolated temp repo

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { runModuleWorker } from '../../../../scripts/lib/run-module-worker.mjs';

import { SCHEMA_VERSION, COMMAND_REGISTRY } from '../lib/command-registry.mjs';
import { validate, isValidParameterSchema } from '../lib/validate-args.mjs';
import { addCell } from '../lib/cells.mjs';
import { writeJsonAtomic } from '../lib/fsutil.mjs';
import { defaultState, writeState, BEE_VERSION } from '../lib/state.mjs';
import {
  splitCommandTokens,
  resolveCommand,
  parseFlags,
  nearestCommandName,
  deprecatedRedirect,
  computeManifestHash,
} from '../bee.mjs';

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.dirname(TESTS_DIR);

// Declared here (not near their first heavy use further down) so that
// runExample — called from check() blocks starting near the top of the
// file — can reference BEE_MJS without a temporal-dead-zone ReferenceError.
const BEE_MJS = path.join(TEMPLATES_DIR, 'bee.mjs');

let passed = 0;
let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS  ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`FAIL  ${name}`);
    console.log(`      ${error instanceof Error ? error.message : error}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function entryByName(name) {
  const entry = COMMAND_REGISTRY.find((e) => e.name === name);
  assert(entry, `registry is missing entry "${name}"`);
  return entry;
}

// Tokenize a shell-like example string: whitespace-separated tokens, with
// "double-quoted segments" kept as one token. Every example in the registry
// deliberately avoids nested quotes, so this stays simple on purpose.
function tokenize(exampleString) {
  const tokens = [];
  const re = /"([^"]*)"|(\S+)/g;
  let match;
  while ((match = re.exec(exampleString)) !== null) {
    tokens.push(match[1] !== undefined ? match[1] : match[2]);
  }
  return tokens;
}

// ─── isolated temp repo (mirrors test_lib.mjs's os.tmpdir() pattern) ───────

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-cli-test-'));
fs.mkdirSync(path.join(root, '.bee'), { recursive: true });
writeJsonAtomic(path.join(root, '.bee', 'onboarding.json'), {
  schema_version: '1.0',
  bee_version: '0.1.0',
});
// cells.claim refuses unless Gate 3 (execution) is approved; the example
// sequence below claims a cell, so the fixture repo must already be past
// that gate.
writeState(root, {
  ...defaultState(),
  phase: 'swarming',
  feature: 'demo',
  approved_gates: { context: true, shape: true, execution: true, review: false },
});

// perf group: redirect the global perf log and the Claude transcript root into
// the temp repo so perf examples never touch the real ~/.config/beehive or
// ~/.claude. runModuleWorker inherits process.env by default, so these reach
// the dispatched worker. With no transcript under the fake CLAUDE_CONFIG_DIR,
// perf resolves an empty window and degrades to zeroed metrics (never throws).
process.env.BEEHIVE_PERF_DIR = path.join(root, 'perf-global');
process.env.CLAUDE_CONFIG_DIR = path.join(root, 'fake-claude');

const executedNames = new Set();

/** Run the executable-th (default 0) example of a registry entry inside `root`.
 * P1 fix (review-phase-1.md): examples are now full dispatcher-form commands
 * ("bee cells show --id demo-1 --json"), consistent with each entry's own
 * `invoke` string. Execute them through the real dispatcher (bee.mjs) — the
 * surface the manifest actually advertises — rather than the legacy helper,
 * which the manifest-as-tested-contract claim did not previously cover. */
async function runExample(entryName, { exampleIndex = 0, cwd = root } = {}) {
  const entry = entryByName(entryName);
  executedNames.add(entry.name);
  const exampleString = entry.examples[exampleIndex];
  assert(typeof exampleString === 'string' && exampleString.trim(), `${entry.name}: examples[${exampleIndex}] must be a non-empty string`);
  const tokens = tokenize(exampleString);
  assert(tokens[0] === 'bee', `${entry.name}: example must be full dispatcher-form starting with "bee", got "${exampleString}"`);
  const args = tokens.slice(1);
  const result = await runModuleWorker(BEE_MJS, {
    args,
    cwd,
  });
  return { entry, result };
}

async function assertExampleOk(entryName, opts) {
  const { entry, result } = await runExample(entryName, opts);
  assert(
    result.status === 0,
    `${entry.name} example "${entry.examples[0]}" exited ${result.status}: stdout=${result.stdout} stderr=${result.stderr}`,
  );
  return result;
}

// ─── registry shape (D3: JSON-Schema parameters, no bespoke format) ────────

await check('SCHEMA_VERSION is the top-level manifest field, not per-entry', async () => {
  assert(SCHEMA_VERSION === '1.0', `expected "1.0", got ${SCHEMA_VERSION}`);
  assert(
    COMMAND_REGISTRY.every((entry) => entry.schema_version === undefined),
    'schema_version must never appear on a per-entry basis',
  );
});

await check('every registry entry has the required manifest fields, no TODO/stub entries', async () => {
  assert(Array.isArray(COMMAND_REGISTRY) && COMMAND_REGISTRY.length > 0, 'registry must be a non-empty array');
  for (const entry of COMMAND_REGISTRY) {
    assert(typeof entry.name === 'string' && entry.name.trim(), `entry missing a name: ${JSON.stringify(entry)}`);
    assert(typeof entry.invoke === 'string' && entry.invoke.trim(), `${entry.name}: missing invoke`);
    assert(typeof entry.description === 'string' && entry.description.trim(), `${entry.name}: missing description`);
    assert(Array.isArray(entry.examples) && entry.examples.length > 0, `${entry.name}: examples must be non-empty`);
    assert('deprecated' in entry, `${entry.name}: deprecated field must be present (null when not deprecated)`);
  }
});

await check('every registry entry\'s parameters is valid JSON-Schema (D3 shape: type/properties/required)', async () => {
  for (const entry of COMMAND_REGISTRY) {
    assert(isValidParameterSchema(entry.parameters), `${entry.name}: parameters is not valid JSON-Schema — ${JSON.stringify(entry.parameters)}`);
    assert(entry.parameters.type === 'object', `${entry.name}: parameters.type must be "object"`);
  }
});

await check('registry names are unique and dot-namespaced by group (status, cells.*, reservations.*, decisions.*, state.*, backlog.*, capture.*, reviews.*, feedback.*, perf.*, worktree.*)', async () => {
  const names = COMMAND_REGISTRY.map((e) => e.name);
  assert(new Set(names).size === names.length, `duplicate names in registry: ${names.join(', ')}`);
  const groups = new Set(names.map((n) => (n.includes('.') ? n.split('.')[0] : n)));
  for (const group of groups) {
    assert(['status', 'cells', 'reservations', 'decisions', 'state', 'backlog', 'capture', 'reviews', 'feedback', 'perf', 'worktree', 'config'].includes(group), `unexpected group "${group}"`);
  }
});

await check('registry covers every subcommand of the 4 existing helpers', async () => {
  const names = new Set(COMMAND_REGISTRY.map((e) => e.name));
  const expected = [
    'status',
    'cells.list', 'cells.ready', 'cells.show', 'cells.add', 'cells.update', 'cells.claim',
    'cells.verify', 'cells.cap', 'cells.block', 'cells.drop', 'cells.tier', 'cells.judge',
    'reservations.reserve', 'reservations.release', 'reservations.list', 'reservations.sweep',
    'decisions.log', 'decisions.supersede', 'decisions.redact', 'decisions.active', 'decisions.search',
  ];
  for (const name of expected) {
    assert(names.has(name), `registry is missing subcommand "${name}"`);
  }
});

// ─── DA5: registry <-> runtime-verb bijection (drift guard) ────────────────
// Derives each group's verb list from RUNTIME BEHAVIOR — the "Unknown
// command ... Use: v1, v2, ..." contract line bee.mjs's own dispatcher
// already prints for an unrecognized top-level command in that group — never
// by reading/grepping bee.mjs's own source. Critical pattern 20260710: a
// drift guard that greps a module's own source pins syntax, not behavior,
// and pinned syntax can be the bug. This is the exact gap the PR shipped
// with: bee_cells.mjs's `update` verb existed on the helper but had no
// matching registry entry. The 9 bee_*.mjs shims are retired (shim-retire
// D1/D5) — the probe now spawns bee.mjs directly with the group token
// prepended, exactly what each shim used to do internally, so the observed
// "Unknown command" contract line is unchanged.

const GROUP_NAMES = ['cells', 'reservations', 'decisions', 'state', 'backlog', 'capture', 'reviews', 'feedback', 'perf', 'worktree'];

// Parse ONLY the stderr line that starts with "Unknown command" (trap t2:
// bee.mjs's own `cells update` verb separately emits an unrelated
// flag-level "Use: --id ID --file ..." line; anchoring on any "Use:"
// substring, rather than this specific contract line, would risk picking
// that one up under a different argv). Run inside `root`, an already
// bee-onboarded temp repo (created above) — bee.mjs refuses to run outside a
// bee repo root at all, so probing needs a real one, not a mutation of it
// (an unrecognized command never reaches any handler).
async function groupRuntimeVerbs(group) {
  const result = await runModuleWorker(BEE_MJS, {
    args: [group, '__bee_bijection_probe__'],
    cwd: root,
  });
  const contractLine = (result.stderr || '').split('\n').find((line) => line.startsWith('Unknown command'));
  assert(
    contractLine,
    `bee.mjs ${group}: expected a stderr line starting with "Unknown command" for an unrecognized top-level command, got stdout=${result.stdout} stderr=${result.stderr}`,
  );
  // Stop at the FIRST verb-list-terminating period, not necessarily end of
  // line: the reviews group's default message appends a trailing "(review
  // modes: ...)" annotation AFTER the verb list's own period (dispatcher-
  // unify du-3) — a greedy-to-end-of-line capture would swallow that
  // annotation as bogus extra "verbs". Every other group's Use: line puts
  // its own terminating period at the true end of the string, so this is a
  // no-op there (trap t1 still applies: without stopping at the period, the
  // last verb would parse as e.g. "judge.").
  const match = contractLine.match(/Use: (.+?)\.(?:\s|$)/);
  assert(match, `bee.mjs ${group}: "Unknown command" line has no "Use: ..." verb-list clause: ${contractLine}`);
  // Each comma-separated segment's FIRST word is the runtime verb: every
  // group spells a single-word verb per segment except the reviews group's
  // nested "candidate add" (two words) — collapsing to its first word
  // matches the registry-side collapse (name.split('.')[0] on the nested
  // "candidate.add" segment -> "candidate", dispatcher-unify du-3).
  return match[1]
    .split(',')
    .map((v) => v.trim().split(/\s+/)[0])
    .filter(Boolean);
}

await check('DA5 bijection: every runtime verb of bee.mjs cells/reservations/decisions/state/backlog/capture/reviews/feedback has a matching registry entry, and vice versa', async () => {
  for (const group of GROUP_NAMES) {
    const runtimeVerbs = new Set(await groupRuntimeVerbs(group));
    assert(runtimeVerbs.size > 0, `bee.mjs ${group}: parsed zero runtime verbs — the parser is broken, not the dispatcher`);
    // Collapse nested verbs to their top-level segment (state.worker.add ->
    // worker) so the bijection matches the dispatcher's runtime "Use:" line,
    // which lists only top-level verbs. For flat groups (cells/reservations/
    // decisions) this is a no-op — every verb is already single-segment.
    const registryVerbs = new Set(
      COMMAND_REGISTRY.filter((e) => e.name.startsWith(`${group}.`)).map(
        (e) => e.name.slice(group.length + 1).split('.')[0],
      ),
    );

    // (a) every runtime verb has a registry entry named `<group>.<verb>`
    const missingInRegistry = [...runtimeVerbs].filter((v) => !registryVerbs.has(v));
    assert(
      missingInRegistry.length === 0,
      `${group}: verb(s) [${missingInRegistry.join(', ')}] exist on the bee.mjs ${group} dispatcher (runtime) but have no "${group}.<verb>" entry in COMMAND_REGISTRY — registry side owns the fix (this is the exact cells.update gap the PR shipped with)`,
    );

    // (b) every registry `<group>.*` entry corresponds to a runtime verb
    const extraInRegistry = [...registryVerbs].filter((v) => !runtimeVerbs.has(v));
    assert(
      extraInRegistry.length === 0,
      `${group}: registry entr(y/ies) [${extraInRegistry.map((v) => `${group}.${v}`).join(', ')}] have no matching runtime verb on the bee.mjs ${group} dispatcher — registry side owns the fix (stale entry, or the dispatcher renamed/dropped this verb)`,
    );
  }
});

await check('DA5 bijection: the only dot-free registry entry is "status", and every entry\'s group is one of status|cells|reservations|decisions|state|backlog|capture|reviews|feedback|perf|worktree|config', async () => {
  const allowedGroups = new Set(['status', 'cells', 'reservations', 'decisions', 'state', 'backlog', 'capture', 'reviews', 'feedback', 'perf', 'worktree', 'config']);
  for (const entry of COMMAND_REGISTRY) {
    const group = entry.name.includes('.') ? entry.name.split('.')[0] : entry.name;
    assert(allowedGroups.has(group), `${entry.name}: group "${group}" is not one of status|cells|reservations|decisions|state|backlog|capture|reviews|feedback|perf|worktree|config`);
    if (!entry.name.includes('.')) {
      assert(entry.name === 'status', `dot-free registry entry "${entry.name}" is not "status" — only "status" may be dot-free`);
    }
  }
});

// ─── validate-args.mjs: structured rejection, never a throw ────────────────

await check('validate() rejects a missing required field with the structured {field,reason,command} shape', async () => {
  const showEntry = entryByName('cells.show');
  const result = validate(showEntry, {});
  assert(result.ok === false, 'missing required "id" must not validate ok');
  assert(result.error.field === 'id', `error.field should be "id", got ${JSON.stringify(result.error)}`);
  assert(result.error.reason === 'required, missing', `error.reason should name the miss, got ${result.error.reason}`);
  assert(result.error.command === 'cells.show', `error.command should be "cells.show", got ${result.error.command}`);
});

await check('validate() accepts a call with every required field present', async () => {
  const claimEntry = entryByName('cells.claim');
  const result = validate(claimEntry, { id: 'demo-1', worker: 'worker-a' });
  assert(result.ok === true, `expected ok:true, got ${JSON.stringify(result)}`);
});

await check('validate() flags a wrong-typed value without throwing', async () => {
  const tierEntry = entryByName('cells.tier');
  const result = validate(tierEntry, { id: 'demo-1', tier: 42 });
  assert(result.ok === false, 'a number where a string tier is expected must not validate ok');
  assert(result.error.field === 'tier', `error.field should be "tier", got ${JSON.stringify(result.error)}`);
  assert(result.error.command === 'cells.tier', 'error.command should name the command');
});

await check('validate() never throws on a malformed commandEntry', async () => {
  const result = validate({ name: 'bogus' }, { anything: 'x' });
  assert(result.ok === false, 'a command with no parameters schema must not validate ok');
  assert(result.error.command === 'bogus', 'error.command still names the command');
});

await check('isValidParameterSchema() rejects a bespoke (non-JSON-Schema) shape', async () => {
  assert(isValidParameterSchema({ id: 'string', worker: 'string' }) === false, 'a flat key->type map is not the D3 shape');
  assert(isValidParameterSchema({ type: 'object', properties: {}, required: ['missing'] }) === false, 'required field absent from properties must fail');
  assert(isValidParameterSchema({ type: 'object', properties: { id: { type: 'string' } }, required: [] }) === true, 'a minimal valid schema passes');
});

// ─── examples[] are tested contracts: every one runs for real, isolated ────
// Order matters here (unlike the registry's own array order): cells.add must
// run before show/claim/verify/cap/judge/tier/block/drop can succeed against
// the same fixture cell, and cells.claim needs the Gate-3 state written above.

await check('cells.add example creates the fixture cell used by the rest of the chain', async () => {
  const cellFixture = {
    id: 'demo-1',
    feature: 'demo',
    title: 'Demo cell for registry example test',
    lane: 'small',
    action: 'Exercise every cells.* example against a real fixture cell.',
    verify: 'node -e "process.exit(0)"',
  };
  fs.writeFileSync(path.join(root, 'cell-demo-1.json'), JSON.stringify(cellFixture, null, 2), 'utf8');
  await assertExampleOk('cells.add');
  assert(fs.existsSync(path.join(root, '.bee', 'cells', 'demo-1.json')), 'demo-1 cell file should now exist');
});

await check('cells.list example runs through the real dispatcher', async () => {
  const result = await assertExampleOk('cells.list');
  assert(result.stdout.includes('demo-1'), `expected demo-1 in list output, got ${result.stdout}`);
});

await check('cells.ready example runs through the real dispatcher', async () => {
  const result = await assertExampleOk('cells.ready');
  assert(result.stdout.includes('demo-1'), `demo-1 should be ready (open, no deps), got ${result.stdout}`);
});

await check('cells.show example runs through the real dispatcher', async () => {
  const result = await assertExampleOk('cells.show');
  assert(JSON.parse(result.stdout).id === 'demo-1', 'show should return the demo-1 cell');
});

await check('cells.update example runs through the real dispatcher', async () => {
  const patch = { title: 'Demo cell for registry example test (updated)' };
  fs.writeFileSync(path.join(root, 'cell-demo-1-update.json'), JSON.stringify(patch, null, 2), 'utf8');
  const result = await assertExampleOk('cells.update');
  const updated = JSON.parse(result.stdout);
  assert(updated.id === 'demo-1', `expected demo-1, got ${result.stdout}`);
  assert(updated.title === patch.title, `expected patched title, got ${result.stdout}`);
});

await check('cells.claim example runs through the real dispatcher', async () => {
  const result = await assertExampleOk('cells.claim');
  assert(JSON.parse(result.stdout).status === 'claimed', 'demo-1 should now be claimed');
});

await check('cells.verify example runs through the real dispatcher', async () => {
  const result = await assertExampleOk('cells.verify');
  assert(JSON.parse(result.stdout).trace.verify_passed === true, 'verify_passed should be true');
});

await check('cells.cap example runs through the real dispatcher', async () => {
  const result = await assertExampleOk('cells.cap');
  assert(JSON.parse(result.stdout).status === 'capped', 'demo-1 should now be capped');
});

await check('cells.judge example runs through the real dispatcher', async () => {
  const result = await assertExampleOk('cells.judge');
  assert(JSON.parse(result.stdout).hits.length === 0, 'a cell.json fixture file is not a frozen-judge pattern hit');
});

await check('cells.tier example runs through the real dispatcher', async () => {
  const result = await assertExampleOk('cells.tier');
  assert(JSON.parse(result.stdout).tier === 'generation', 'demo-1 tier should now be "generation"');
});

await check('cells.block example runs through the real dispatcher', async () => {
  const result = await assertExampleOk('cells.block');
  assert(JSON.parse(result.stdout).status === 'blocked', 'demo-1 should now be blocked');
});

await check('cells.drop example runs through the real dispatcher', async () => {
  const result = await assertExampleOk('cells.drop');
  assert(JSON.parse(result.stdout).status === 'dropped', 'demo-1 should now be dropped');
});

// cells.claim-next (fresh-session-handoff fsh-11, D2/D4) needs its OWN ready
// cell — demo-1 is dropped by this point in the chain — added directly via
// addCell (not through the dispatcher, so it never consumes a registry
// example slot of its own). The fixture repo's default pipeline (feature
// "demo") already has execution approved from the root setup above, and
// "sess-claim-next" has no prior session record, so resolvePipeline resolves
// it straight to that default pipeline (D4 zero-lane parity).
await check('cells.claim-next example runs through the real dispatcher (own-lane default-pipeline pick, no prior session/lane state)', async () => {
  addCell(root, {
    id: 'demo-2',
    feature: 'demo',
    title: 'Demo cell for claim-next registry example test',
    lane: 'small',
    action: 'Exercise the cells.claim-next example against a real fixture cell.',
    verify: 'node -e "process.exit(0)"',
  });
  const result = await assertExampleOk('cells.claim-next');
  const parsed = JSON.parse(result.stdout);
  assert(parsed.ok === true && parsed.cell.id === 'demo-2', `expected demo-2 claimed, got ${result.stdout}`);
  assert(parsed.cell.status === 'claimed', 'demo-2 should now be claimed');
});

// D1: cells.schedule — plan-time only, read-only. demo-1 is dropped by this
// point in the chain (excluded from the schedulable node-set); demo-2 is
// claimed with no deps and no files, so it lands alone in wave 1 with clean
// diagnostics. The example omits --feature (schedules every cell), matching
// handleCellsReady's own no-fallback resolution: this fixture repo only has
// "demo" cells, so that is exactly wave 1's content.
await check('cells.schedule example runs through the real dispatcher (D1: waves + diagnostics, exact computeSchedule shape)', async () => {
  const result = await assertExampleOk('cells.schedule');
  const parsed = JSON.parse(result.stdout);
  assert(Array.isArray(parsed.waves), `expected a waves array, got ${result.stdout}`);
  assert(
    parsed.waves.length === 1 && parsed.waves[0].length === 1 && parsed.waves[0][0] === 'demo-2',
    `expected demo-2 alone in wave 1, got ${JSON.stringify(parsed.waves)}`,
  );
  assert(
    Array.isArray(parsed.diagnostics.cycles) && parsed.diagnostics.cycles.length === 0,
    `expected zero cycles, got ${JSON.stringify(parsed.diagnostics.cycles)}`,
  );
  assert(
    Array.isArray(parsed.diagnostics.unsatisfiable_deps) && parsed.diagnostics.unsatisfiable_deps.length === 0,
    `expected zero unsatisfiable deps, got ${JSON.stringify(parsed.diagnostics.unsatisfiable_deps)}`,
  );
});

await check('cells.schedule on an empty/zero-cell store exits 0 with empty waves (no crash, no refusal)', async () => {
  const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-cli-schedule-empty-'));
  fs.mkdirSync(path.join(emptyRoot, '.bee'), { recursive: true });
  writeJsonAtomic(path.join(emptyRoot, '.bee', 'onboarding.json'), {
    schema_version: '1.0',
    bee_version: '0.1.0',
  });
  writeState(emptyRoot, {
    ...defaultState(),
    phase: 'swarming',
    feature: 'empty-demo',
    approved_gates: { context: true, shape: true, execution: true, review: false },
  });
  const result = await runModuleWorker(BEE_MJS, {
    args: ['cells', 'schedule', '--json'],
    cwd: emptyRoot,
  });
  assert(result.status === 0, `expected exit 0 on an empty store, got ${result.status}: stderr=${result.stderr}`);
  const parsed = JSON.parse(result.stdout);
  assert(Array.isArray(parsed.waves) && parsed.waves.length === 0, `expected empty waves, got ${result.stdout}`);
});

// cells.reopen / cells.unclaim (GitHub #12) run LAST in the demo-1 chain: demo-1
// is "dropped" by this point (excluded from the schedule assertions above), so
// reopening it here does not disturb them.
await check('cells.reopen example runs through the real dispatcher (dropped -> open)', async () => {
  const result = await assertExampleOk('cells.reopen');
  const cell = JSON.parse(result.stdout);
  assert(cell.status === 'open', `demo-1 should be open after reopen, got ${cell.status}`);
  assert(cell.trace.verify_passed !== true, 'reopen must clear a stale passing verify');
});

await check('cells.unclaim example runs through the real dispatcher (claimed -> open)', async () => {
  await assertExampleOk('cells.claim'); // demo-1 is open after reopen; re-claim it
  const result = await assertExampleOk('cells.unclaim');
  const cell = JSON.parse(result.stdout);
  assert(cell.status === 'open', `demo-1 should be open after unclaim, got ${cell.status}`);
  assert(!cell.trace.worker, 'unclaim must release the worker');
});

await check('reservations.reserve example runs through the real dispatcher', async () => {
  const result = await assertExampleOk('reservations.reserve');
  assert(JSON.parse(result.stdout).ok === true, 'reserve should succeed on a fresh path');
});

await check('reservations.reserve --session example (examples[1]) stamps the reservation with the owning session id (D3)', async () => {
  const result = await assertExampleOk('reservations.reserve', { exampleIndex: 1 });
  const parsed = JSON.parse(result.stdout);
  assert(parsed.ok === true, 'session-owned reserve should succeed on a fresh path');
  assert(parsed.reservation.session === 'sess-fsh7', `expected the reservation to carry session "sess-fsh7", got ${result.stdout}`);
});

await check('reservations.list example runs through the real dispatcher', async () => {
  const result = await assertExampleOk('reservations.list');
  assert(result.stdout.includes('worker-a'), `expected the reservation just made, got ${result.stdout}`);
});

await check('reservations.release example runs through the real dispatcher', async () => {
  const result = await assertExampleOk('reservations.release');
  assert(JSON.parse(result.stdout).released >= 1, 'release should free at least the one reservation just made');
});

await check('reservations.sweep example runs through the real dispatcher', async () => {
  const result = await assertExampleOk('reservations.sweep');
  assert(typeof JSON.parse(result.stdout).released === 'number', 'sweep should report a released count');
});

await check('decisions.log example runs through the real dispatcher', async () => {
  const result = await assertExampleOk('decisions.log');
  assert(typeof JSON.parse(result.stdout).id === 'string', 'log should return the new decision id');
});

await check('decisions.active example runs through the real dispatcher', async () => {
  const result = await assertExampleOk('decisions.active');
  assert(JSON.parse(result.stdout).decisions.length >= 1, 'the decision just logged should be active');
});

await check('decisions.search example runs through the real dispatcher', async () => {
  const result = await assertExampleOk('decisions.search');
  assert(JSON.parse(result.stdout).decisions.length >= 1, 'search for "registry" should match the decision just logged');
});

await check('decisions.supersede example runs through the real dispatcher (arbitrary id — event-sourced, no existence check)', async () => {
  const result = await assertExampleOk('decisions.supersede');
  assert(typeof JSON.parse(result.stdout).id === 'string', 'supersede should return the new event id');
});

await check('decisions.redact example runs through the real dispatcher (arbitrary id — event-sourced, no existence check)', async () => {
  const result = await assertExampleOk('decisions.redact');
  assert(typeof JSON.parse(result.stdout).id === 'string', 'redact should return the new event id');
});

await check('status example runs through the real dispatcher', async () => {
  const result = await assertExampleOk('status');
  assert(JSON.parse(result.stdout).phase === 'swarming', 'status should reflect the fixture repo\'s phase');
});

// ─── state.* examples: run in a dedicated fresh repo (dispatcher-unify du-1) ─
// State verbs mutate .bee/state.json, so they get their own isolated repo,
// never the demo-1 fixture chain. Order matters: start-feature requires a
// clean idle workspace, so it runs first, before any other state mutation.

const rootState = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-state-example-'));
fs.mkdirSync(path.join(rootState, '.bee'), { recursive: true });
writeJsonAtomic(path.join(rootState, '.bee', 'onboarding.json'), {
  schema_version: '1.0',
  bee_version: '0.1.0',
});

await check('state.start-feature example runs through the real dispatcher (clean idle repo)', async () => {
  const result = await assertExampleOk('state.start-feature', { cwd: rootState });
  assert(JSON.parse(result.stdout).feature === 'newf', `expected feature newf, got ${result.stdout}`);
});

await check('state.set example runs through the real dispatcher', async () => {
  const result = await assertExampleOk('state.set', { cwd: rootState });
  assert(JSON.parse(result.stdout).phase === 'planning', `expected phase planning, got ${result.stdout}`);
});

await check('state.gate example runs through the real dispatcher', async () => {
  const result = await assertExampleOk('state.gate', { cwd: rootState });
  assert(JSON.parse(result.stdout).approved_gates.execution === true, `expected execution approved, got ${result.stdout}`);
});

await check('state.worker.add example runs through the real dispatcher', async () => {
  const result = await assertExampleOk('state.worker.add', { cwd: rootState });
  assert(JSON.parse(result.stdout).workers.some((w) => w.nickname === 'w1'), `expected worker w1, got ${result.stdout}`);
});

await check('state.worker.update example runs through the real dispatcher (w1 added above)', async () => {
  const result = await assertExampleOk('state.worker.update', { cwd: rootState });
  assert(JSON.parse(result.stdout).workers.find((w) => w.nickname === 'w1').status === 'done', `expected w1 status done, got ${result.stdout}`);
});

await check('state.worker.remove example runs through the real dispatcher', async () => {
  const result = await assertExampleOk('state.worker.remove', { cwd: rootState });
  assert(!JSON.parse(result.stdout).workers.some((w) => w.nickname === 'w1'), `expected w1 removed, got ${result.stdout}`);
});

await check('state.worker.clear example runs through the real dispatcher', async () => {
  const result = await assertExampleOk('state.worker.clear', { cwd: rootState });
  assert(JSON.parse(result.stdout).workers.length === 0, `expected empty workers, got ${result.stdout}`);
});

await check('state.worker.prune example runs through the real dispatcher (no workers dir -> 0 pruned)', async () => {
  const result = await assertExampleOk('state.worker.prune', { cwd: rootState });
  assert(JSON.parse(result.stdout).pruned.length === 0, `expected 0 pruned, got ${result.stdout}`);
});

await check('state.scribing-run example runs through the real dispatcher (from an executed phase — chain-integrity D3)', async () => {
  // The shared rootState sits at `planning` from the state.set example above.
  // scribing-run used to advance to `compounding` from ANY phase; it now demands
  // a phase where execution actually happened. Walking the legal path first is
  // the point, not a workaround: this check now also proves swarming ->
  // scribing-run -> compounding runs end to end through the real dispatcher.
  const advance = await runBee(['state', 'set', '--owner', 'planning', '--phase', 'swarming', '--json'], rootState);
  assert(advance.status === 0, `advancing to swarming should succeed: ${advance.stderr}`);
  const result = await assertExampleOk('state.scribing-run', { cwd: rootState });
  assert(JSON.parse(result.stdout).phase === 'compounding', `expected phase compounding, got ${result.stdout}`);
});

await check('state.scribing-run is REFUSED from a phase where nothing was executed (chain-integrity D3)', async () => {
  const refused = await runBee(
    ['state', 'scribing-run', '--feature', 'newf', '--areas', 'x', '--next-action', 'n', '--json'],
    rootState,
  );
  // rootState is now `compounding` — not an executed phase.
  assert(refused.status !== 0, `scribing-run from compounding should be refused, got ${refused.stdout}`);
  // --json routes the failure to stdout as {"error": ...}; bare runs use stderr.
  assert(
    /scribing-run: refused from phase/.test(refused.stdout + refused.stderr),
    `expected the D3 refusal, got: ${refused.stdout}${refused.stderr}`,
  );
});

await check('state set --phase compounding-complete is REFUSED from swarming — the exact post-mortem call (chain-integrity D1-REVISED)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-tail-guard-'));
  fs.mkdirSync(path.join(dir, '.bee'), { recursive: true });
  writeJsonAtomic(path.join(dir, '.bee', 'onboarding.json'), { schema_version: '1.0', bee_version: '0.1.0' });
  try {
    writeJsonAtomic(path.join(dir, '.bee', 'state.json'), { phase: 'swarming' });
    const refused = await runBee(['state', 'set', '--owner', 'swarming', '--phase', 'compounding-complete', '--json'], dir);
    assert(refused.status !== 0, 'swarming -> compounding-complete must be refused');
    // --json routes the failure to stdout as {"error": ...}; bare runs use stderr.
    assert(
      /may only be entered from/.test(refused.stdout + refused.stderr),
      `expected the tail-guard refusal, got: ${refused.stdout}${refused.stderr}`,
    );
    assert(
      JSON.parse(fs.readFileSync(path.join(dir, '.bee', 'state.json'), 'utf8')).phase === 'swarming',
      'a refused close must leave the phase untouched — no partial write',
    );

    // `compounding` is never settable directly: only a real scribing run yields it.
    const direct = await runBee(['state', 'set', '--owner', 'swarming', '--phase', 'compounding', '--json'], dir);
    assert(direct.status !== 0, '--phase compounding must be refused outright');
    assert(
      /scribing-run/.test(direct.stdout + direct.stderr),
      `the refusal must name scribing-run as the way, got: ${direct.stdout}${direct.stderr}`,
    );

    // Backward moves and the de-facto abandon verb stay legal (hive law 5).
    assert((await runBee(['state', 'set', '--owner', 'swarming', '--phase', 'planning', '--json'], dir)).status === 0, 'backward move must stay legal');
    assert((await runBee(['state', 'set', '--owner', 'planning', '--phase', 'idle', '--json'], dir)).status === 0, '--phase idle must stay legal');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ─── state.lanes / state.set|gate|scribing-run --lane / state.session.* :
// fresh-session-handoff fsh-4 (D2/D4) CLI surface over fsh-3's lane store +
// session→lane binding. Lane records live at .bee/lanes/<feature>.json,
// entirely separate from rootState's default state.json above, so these
// checks can run in any order relative to the default-pipeline checks
// above/below without disturbing either.

await check('state.start-feature --as-lane example (examples[1]) starts a lane record beside the untouched default state.json', async () => {
  const beforeDefault = fs.readFileSync(path.join(rootState, '.bee', 'state.json'), 'utf8');
  const result = await assertExampleOk('state.start-feature', { exampleIndex: 1, cwd: rootState });
  const lane = JSON.parse(result.stdout);
  assert(lane.feature === 'demo-lane', `expected lane feature demo-lane, got ${result.stdout}`);
  assert(lane.approved_gates.execution === false, `expected a fresh lane's gates all reset, got ${result.stdout}`);
  assert(fs.existsSync(path.join(rootState, '.bee', 'lanes', 'demo-lane.json')), 'lane file should now exist');
  const afterDefault = fs.readFileSync(path.join(rootState, '.bee', 'state.json'), 'utf8');
  assert(beforeDefault === afterDefault, 'default state.json must stay byte-untouched by a lane-mode start (D4)');
});

await check('state.lanes example lists the demo-lane record just started', async () => {
  const result = await assertExampleOk('state.lanes', { cwd: rootState });
  const lanes = JSON.parse(result.stdout);
  assert(Array.isArray(lanes) && lanes.some((l) => l.feature === 'demo-lane'), `expected demo-lane in lanes list, got ${result.stdout}`);
});

await check('state.set --lane example (examples[1]) routes the mutation to the lane record, not state.json', async () => {
  const beforeDefault = fs.readFileSync(path.join(rootState, '.bee', 'state.json'), 'utf8');
  const result = await assertExampleOk('state.set', { exampleIndex: 1, cwd: rootState });
  const lane = JSON.parse(result.stdout);
  assert(lane.feature === 'demo-lane' && lane.phase === 'planning', `expected lane phase planning, got ${result.stdout}`);
  const afterDefault = fs.readFileSync(path.join(rootState, '.bee', 'state.json'), 'utf8');
  assert(beforeDefault === afterDefault, 'default state.json must stay byte-untouched by a --lane routed set');
});

await check('state.gate --lane example (examples[1]) approves a gate on the lane record only', async () => {
  const result = await assertExampleOk('state.gate', { exampleIndex: 1, cwd: rootState });
  const lane = JSON.parse(result.stdout);
  assert(lane.feature === 'demo-lane' && lane.approved_gates.execution === true, `expected lane execution gate approved, got ${result.stdout}`);
});

await check('state.scribing-run --lane example (examples[1]) stamps the lane record only', async () => {
  // Same D3 rule on the lane record: the tail guard reads `from` off whichever
  // record is being mutated, so the lane must reach an executed phase too.
  const advance = await runBee(['state', 'set', '--lane', 'demo-lane', '--owner', 'planning', '--phase', 'swarming', '--json'], rootState);
  assert(advance.status === 0, `advancing the lane to swarming should succeed: ${advance.stderr}`);
  const result = await assertExampleOk('state.scribing-run', { exampleIndex: 1, cwd: rootState });
  const lane = JSON.parse(result.stdout);
  assert(
    lane.feature === 'demo-lane' && lane.phase === 'compounding' && lane.last_scribing_run.feature === 'demo-lane',
    `expected lane scribing stamp, got ${result.stdout}`,
  );
});

await check('state.set --lane refuses loudly when the named lane does not exist, no partial write (must-have truth)', async () => {
  const result = await runModuleWorker(BEE_MJS, {
    args: ['state', 'set', '--lane', 'ghost-lane', '--owner', 'exploring', '--phase', 'planning'],
    cwd: rootState,
  });
  assert(result.status !== 0, `expected non-zero exit, got ${result.status}`);
  assert(/ghost-lane/.test(result.stderr) && /does not exist/.test(result.stderr), `expected a named-lane refusal, got stderr=${result.stderr}`);
  assert(!fs.existsSync(path.join(rootState, '.bee', 'lanes', 'ghost-lane.json')), 'no partial lane file should be created on refusal');
});

await check('state.gate --lane refuses loudly over a corrupt lane record, file left byte-untouched (must-have truth)', async () => {
  const corruptPath = path.join(rootState, '.bee', 'lanes', 'corrupt-lane.json');
  fs.writeFileSync(corruptPath, '{ this is not a valid lane record', 'utf8');
  const before = fs.readFileSync(corruptPath, 'utf8');
  const result = await runModuleWorker(BEE_MJS, {
    args: ['state', 'gate', '--lane', 'corrupt-lane', '--name', 'execution', '--approved', 'true'],
    cwd: rootState,
  });
  assert(result.status !== 0, `expected non-zero exit, got ${result.status}`);
  const after = fs.readFileSync(corruptPath, 'utf8');
  assert(before === after, 'corrupt lane file must be byte-identical after the refused mutation');
});

await check('state.set --lane refuses when combined with --feature (a lane\'s identity is not a mutable field)', async () => {
  const result = await runModuleWorker(BEE_MJS, {
    args: ['state', 'set', '--lane', 'demo-lane', '--owner', 'planning', '--feature', 'renamed-lane', '--phase', 'planning'],
    cwd: rootState,
  });
  assert(result.status !== 0, `expected non-zero exit, got ${result.status}`);
  assert(/--feature/.test(result.stderr) && /--lane/.test(result.stderr), `expected a --feature/--lane conflict refusal, got stderr=${result.stderr}`);
});

await check('state.session.list example lists a manually-seeded session record', async () => {
  writeJsonAtomic(path.join(rootState, '.bee', 'sessions', 'sess-demo.json'), {
    id: 'sess-demo',
    started_at: new Date().toISOString(),
    last_heartbeat: new Date().toISOString(),
  });
  const result = await assertExampleOk('state.session.list', { cwd: rootState });
  assert(result.stdout.includes('sess-demo'), `expected sess-demo in session list, got ${result.stdout}`);
});

await check('state.session.bind example binds the seeded session to demo-lane', async () => {
  const result = await assertExampleOk('state.session.bind', { cwd: rootState });
  const session = JSON.parse(result.stdout);
  assert(session.id === 'sess-demo' && session.lane === 'demo-lane', `expected sess-demo bound to demo-lane, got ${result.stdout}`);
});

await check('state.session.unbind example removes the binding (lane key omitted, not null)', async () => {
  const result = await assertExampleOk('state.session.unbind', { cwd: rootState });
  const session = JSON.parse(result.stdout);
  assert(session.id === 'sess-demo' && !('lane' in session), `expected the lane key omitted after unbind, got ${result.stdout}`);
});

// ─── state.handoff.*: fresh-session-handoff fsh-9 (D1) — the guarded two-kind
// handoff lifecycle CLI surface. Uses its own prev/next cell + claim fixtures
// inside rootState so it never disturbs the demo-lane/session rows above.

await check('state.handoff.write --kind pause example (examples[0]) writes a free-form pause handoff', async () => {
  const result = await assertExampleOk('state.handoff.write', { cwd: rootState });
  const record = JSON.parse(result.stdout);
  assert(record.kind === 'pause', `expected a pause handoff, got ${result.stdout}`);
  assert(fs.existsSync(path.join(rootState, '.bee', 'HANDOFF.json')), 'HANDOFF.json should now exist');
});

await check('state.handoff.show example shows the pause handoff just written', async () => {
  const result = await assertExampleOk('state.handoff.show', { cwd: rootState });
  const record = JSON.parse(result.stdout);
  assert(record.kind === 'pause', `expected pause kind on show, got ${result.stdout}`);
});

await check('state.handoff.write --kind planned-next example (examples[1]) succeeds once its cap/claim fixtures are seeded, carries writer_session/previous_cell/next_cell', async () => {
  writeJsonAtomic(path.join(rootState, '.bee', 'cells', 'handoff-prev.json'), {
    id: 'handoff-prev',
    status: 'capped',
    trace: { verify_passed: true },
  });
  writeJsonAtomic(path.join(rootState, '.bee', 'claims', 'handoff-next.json'), {
    cell: 'handoff-next',
    session: 'sess-handoff-writer',
    ttl_seconds: 3600,
    claimed_at: new Date().toISOString(),
  });
  const result = await assertExampleOk('state.handoff.write', { exampleIndex: 1, cwd: rootState });
  const record = JSON.parse(result.stdout);
  assert(
    record.kind === 'planned-next' &&
      record.writer_session === 'sess-handoff-writer' &&
      record.previous_cell === 'handoff-prev' &&
      record.next_cell === 'handoff-next',
    `expected the carried planned-next identifiers, got ${result.stdout}`,
  );
});

await check('state.handoff.write --kind planned-next refuses (typed, non-zero exit) when the previous cell is not capped, no partial file (must-have truth)', async () => {
  const result = await runModuleWorker(BEE_MJS, {
    args: [
      'state',
      'handoff',
      'write',
      '--kind',
      'planned-next',
      '--writer-session',
      'sess-handoff-writer',
      '--previous-cell',
      'ghost-cell',
      '--next-cell',
      'handoff-next',
    ],
    cwd: rootState,
  });
  assert(result.status !== 0, `expected non-zero exit, got ${result.status}`);
  assert(/capped/.test(result.stderr), `expected a capped-precondition refusal, got stderr=${result.stderr}`);
});

await check('state.handoff.adopt example transfers the carried claim and clears the handoff', async () => {
  const result = await assertExampleOk('state.handoff.adopt', { cwd: rootState });
  const parsed = JSON.parse(result.stdout);
  assert(parsed.ok === true, `expected adoption to succeed, got ${result.stdout}`);
  assert(!fs.existsSync(path.join(rootState, '.bee', 'HANDOFF.json')), 'handoff should be cleared after adopt');
  const claim = JSON.parse(fs.readFileSync(path.join(rootState, '.bee', 'claims', 'handoff-next.json'), 'utf8'));
  assert(claim.session === 'sess-handoff-adopter', `expected the claim transferred to the adopting session, got ${JSON.stringify(claim)}`);
});

await check('state.handoff.show reports no handoff (null result) once cleared; the text form (no --json) prints "No handoff."', async () => {
  const result = await assertExampleOk('state.handoff.show', { cwd: rootState });
  assert(JSON.parse(result.stdout) === null, `expected a null result once cleared, got ${result.stdout}`);
  const textResult = await runModuleWorker(BEE_MJS, {
    args: ['state', 'handoff', 'show'],
    cwd: rootState,
  });
  assert(/No handoff\./.test(textResult.stdout), `expected "No handoff." in the text render, got stdout=${textResult.stdout}`);
});

// ─── backlog.* / capture.* examples: run in a dedicated fresh repo
// (dispatcher-unify du-2). Neither group touches .bee/state.json or the
// demo-1/demo-2 cell fixtures, so they get their own isolated repo with a
// docs/backlog.md table and a README.md heading for the badges pass to
// insert under.

const rootBacklogCapture = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-backlog-capture-example-'));
fs.mkdirSync(path.join(rootBacklogCapture, '.bee'), { recursive: true });
writeJsonAtomic(path.join(rootBacklogCapture, '.bee', 'onboarding.json'), {
  schema_version: '1.0',
  bee_version: '0.1.0',
});
fs.mkdirSync(path.join(rootBacklogCapture, 'docs'), { recursive: true });
fs.writeFileSync(
  path.join(rootBacklogCapture, 'docs', 'backlog.md'),
  '# Backlog\n\n| ID | Story | Status |\n|----|-------|--------|\n| 1 | A | done |\n| 2 | B | proposed |\n| 3 | C | in-flight |\n',
  'utf8',
);
fs.writeFileSync(path.join(rootBacklogCapture, 'README.md'), '# Demo repo\n', 'utf8');

await check('backlog.counts example runs through the real dispatcher', async () => {
  const result = await assertExampleOk('backlog.counts', { cwd: rootBacklogCapture });
  const counts = JSON.parse(result.stdout);
  assert(counts.done === 1 && counts.proposed === 1 && counts.inFlight === 1, `expected 1/1/1, got ${result.stdout}`);
});

await check('backlog.rank example runs through the real dispatcher', async () => {
  const result = await assertExampleOk('backlog.rank', { cwd: rootBacklogCapture });
  assert(Array.isArray(JSON.parse(result.stdout).order), `expected an order array, got ${result.stdout}`);
});

await check('backlog.badges example runs through the real dispatcher', async () => {
  const result = await assertExampleOk('backlog.badges', { cwd: rootBacklogCapture });
  assert(typeof JSON.parse(result.stdout).badges === 'string', `expected a badges string, got ${result.stdout}`);
});

await check('backlog.add example runs through the real dispatcher and appends to .bee/backlog.jsonl', async () => {
  const result = await assertExampleOk('backlog.add', { cwd: rootBacklogCapture });
  const row = JSON.parse(result.stdout);
  assert(row.type === 'friction' && row.severity === 'P2', `expected the example row, got ${result.stdout}`);
  assert(fs.existsSync(path.join(rootBacklogCapture, '.bee', 'backlog.jsonl')), 'backlog.jsonl should now exist');
});

await check('capture.add example runs through the real dispatcher and returns a stub id', async () => {
  const result = await assertExampleOk('capture.add', { cwd: rootBacklogCapture });
  const stub = JSON.parse(result.stdout);
  assert(typeof stub.id === 'string' && stub.id, `expected a stub id, got ${result.stdout}`);
});

await check('capture.list example runs through the real dispatcher and includes the stub just added', async () => {
  const result = await assertExampleOk('capture.list', { cwd: rootBacklogCapture });
  const listed = JSON.parse(result.stdout);
  assert(listed.count >= 1, `expected at least 1 pending stub, got ${result.stdout}`);
});

await check('capture.flush example runs through the real dispatcher against a pre-seeded stub id', async () => {
  // flushCaptureStub refuses an id with no matching pending stub (lib/capture.mjs,
  // never edited by this cell) — capture.add's own example generates a random
  // crypto.randomUUID(), so the literal fixed id in capture.flush's own
  // registry example is seeded directly into the queue file here first.
  const seededId = '00000000-0000-0000-0000-000000000000';
  fs.appendFileSync(
    path.join(rootBacklogCapture, '.bee', 'capture-queue.jsonl'),
    `${JSON.stringify({ kind: 'stub', id: seededId, at: new Date().toISOString(), outcome: 'seeded for capture.flush example', dids: [], area: null, files: [], lane: null })}\n`,
    'utf8',
  );
  const result = await assertExampleOk('capture.flush', { cwd: rootBacklogCapture });
  const record = JSON.parse(result.stdout);
  assert(record.id === seededId, `expected the seeded stub id flushed, got ${result.stdout}`);
});

// ─── chain-integrity D2/D4: scribing debt is a WALL at the close boundary ────
// The post-mortem's real damage: six capped behavior_change cells whose settled
// behavior never reached docs/specs/, while `last_scribing_run` stayed null and
// the feature was marked closed anyway. That state used to be perfectly valid.

function makeDebtRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-scribing-debt-'));
  fs.mkdirSync(path.join(dir, '.bee', 'cells'), { recursive: true });
  writeJsonAtomic(path.join(dir, '.bee', 'onboarding.json'), { schema_version: '1.0', bee_version: '0.1.0' });
  // At `compounding`, so the tail-guard predecessor check passes and the DEBT
  // check is the only thing left standing between here and the terminal phase.
  writeJsonAtomic(path.join(dir, '.bee', 'state.json'), { phase: 'compounding', feature: 'demo' });
  for (const id of ['d-1', 'd-2']) {
    writeJsonAtomic(path.join(dir, '.bee', 'cells', `${id}.json`), {
      id,
      feature: 'demo',
      status: 'capped',
      trace: { behavior_change: true, capped_at: new Date().toISOString() },
    });
  }
  return dir;
}

await check('state set --phase compounding-complete is REFUSED while capped behavior_change cells are unscribed, naming every cell (chain-integrity D2)', async () => {
  const dir = makeDebtRepo();
  try {
    const refused = await runBee(['state', 'set', '--owner', 'compounding', '--phase', 'compounding-complete', '--json'], dir);
    assert(refused.status !== 0, 'closing with scribing debt must be refused');
    const out = refused.stdout + refused.stderr;
    assert(/d-1/.test(out) && /d-2/.test(out), `the refusal must name every unscribed cell, got: ${out}`);
    assert(/waive-scribing-debt/.test(out), `the refusal must disclose the sanctioned door, got: ${out}`);
    assert(
      JSON.parse(fs.readFileSync(path.join(dir, '.bee', 'state.json'), 'utf8')).phase === 'compounding',
      'a refused close must leave the phase untouched — no partial write',
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

await check('--waive-scribing-debt permits the close but is never silent: it logs a decision naming the waived cells (chain-integrity D4)', async () => {
  const dir = makeDebtRepo();
  try {
    const ok = await runBee(['state', 'set', '--owner', 'compounding', '--phase', 'compounding-complete', '--waive-scribing-debt', '--json'], dir);
    assert(ok.status === 0, `the waiver must permit the close, got: ${ok.stdout}${ok.stderr}`);
    assert(
      JSON.parse(fs.readFileSync(path.join(dir, '.bee', 'state.json'), 'utf8')).phase === 'compounding-complete',
      'the waived close must actually write the terminal phase',
    );
    const log = fs.readFileSync(path.join(dir, '.bee', 'decisions.jsonl'), 'utf8');
    assert(/d-1/.test(log) && /d-2/.test(log), `the waiver decision must name every waived cell, got: ${log}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

await check('a close with ZERO scribing debt passes and writes no waiver decision (chain-integrity D2)', async () => {
  const dir = makeDebtRepo();
  try {
    // Stamp a scribing run that post-dates both cells: debt cleared honestly.
    const state = JSON.parse(fs.readFileSync(path.join(dir, '.bee', 'state.json'), 'utf8'));
    state.last_scribing_run = { feature: 'demo', at: new Date(Date.now() + 60_000).toISOString() };
    writeJsonAtomic(path.join(dir, '.bee', 'state.json'), state);
    const ok = await runBee(['state', 'set', '--owner', 'compounding', '--phase', 'compounding-complete', '--json'], dir);
    assert(ok.status === 0, `a debt-free close must pass, got: ${ok.stdout}${ok.stderr}`);
    assert(
      !fs.existsSync(path.join(dir, '.bee', 'decisions.jsonl')),
      'a debt-free close must not log a waiver decision — nothing was waived',
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

await check('capture.count example runs through the real dispatcher', async () => {
  const result = await assertExampleOk('capture.count', { cwd: rootBacklogCapture });
  assert(typeof JSON.parse(result.stdout).count === 'number', `expected a numeric count, got ${result.stdout}`);
});

// ─── reviews.* / feedback.* examples: run in a dedicated fresh repo
// (dispatcher-unify du-3). reviews.create's A10 preflight requires a real
// capped behavior_change cell WITH recorded verification_evidence in scope,
// so a fixture cell ("ok-1") is built here through the real dispatcher
// (add/claim/verify/cap) before the reviews.create example runs. feedback's
// digest/count/collect/rank examples run over whatever sources are in scope
// in this same repo (an empty/near-empty source set is fine — buildDigest
// degrades to a low-count snapshot rather than throwing).

const rootReviewsFeedback = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-reviews-feedback-example-'));
fs.mkdirSync(path.join(rootReviewsFeedback, '.bee'), { recursive: true });
writeJsonAtomic(path.join(rootReviewsFeedback, '.bee', 'onboarding.json'), {
  schema_version: '1.0',
  bee_version: '0.1.0',
});
writeState(rootReviewsFeedback, {
  ...defaultState(),
  phase: 'swarming',
  feature: 'demo3',
  approved_gates: { context: true, shape: true, execution: true, review: false },
});

async function runBeeReviewsFeedbackFixture(args) {
  return await runModuleWorker(BEE_MJS, { args, cwd: rootReviewsFeedback });
}

await check('reviews fixture setup: a capped behavior_change cell ("ok-1") with recorded verification_evidence exists in scope', async () => {
  const cellFixture = {
    id: 'ok-1',
    feature: 'demo3',
    title: 'Fixture cell for reviews.* registry examples',
    lane: 'small',
    action: 'Exercise every reviews.* example against a real fixture cell.',
    verify: 'node -e "process.exit(0)"',
    behavior_change: true,
  };
  fs.writeFileSync(path.join(rootReviewsFeedback, 'cell-ok-1.json'), JSON.stringify(cellFixture, null, 2), 'utf8');
  const added = await runBeeReviewsFeedbackFixture(['cells', 'add', '--file', 'cell-ok-1.json', '--json']);
  assert(added.status === 0, `cells add setup failed: ${added.status}: stdout=${added.stdout} stderr=${added.stderr}`);

  const claimed = await runBeeReviewsFeedbackFixture(['cells', 'claim', '--id', 'ok-1', '--worker', 'worker-rev', '--json']);
  assert(claimed.status === 0, `cells claim setup failed: ${claimed.status}: stdout=${claimed.stdout} stderr=${claimed.stderr}`);

  const verified = await runBeeReviewsFeedbackFixture(['cells', 'verify', '--id', 'ok-1', '--command', 'node -e 0', '--output', 'ok', '--passed', 'true', '--json']);
  assert(verified.status === 0, `cells verify setup failed: ${verified.status}: stdout=${verified.stdout} stderr=${verified.stderr}`);

  const capped = await runModuleWorker(BEE_MJS, {
    args: ['cells', 'cap', '--id', 'ok-1', '--outcome', 'done', '--files', 'a.js', '--behavior-change', '--evidence-stdin', '--json'],
    cwd: rootReviewsFeedback,
    input: JSON.stringify({ red_failure_evidence: 'prior behavior', verification_run: 'node -e 0' }),
  });
  assert(capped.status === 0, `cells cap setup failed: ${capped.status}: stdout=${capped.stdout} stderr=${capped.stderr}`);
  assert(JSON.parse(capped.stdout).trace.verification_evidence, 'ok-1 should carry recorded verification_evidence for the A10 preflight');
});

await check('reviews.create example runs through the real dispatcher (A10 preflight satisfied by the ok-1 fixture cell)', async () => {
  const scope = {
    id: 'rev-example',
    requested_by: 'user',
    scope_description: 'review the demo3 feature',
    included: [{ type: 'cell', id: 'ok-1' }],
    baseline: 'sha-base',
    head: 'sha-head',
  };
  fs.writeFileSync(path.join(rootReviewsFeedback, 'scope.json'), JSON.stringify(scope), 'utf8');
  const result = await assertExampleOk('reviews.create', { cwd: rootReviewsFeedback });
  assert(JSON.parse(result.stdout).id === 'rev-example', `expected rev-example, got ${result.stdout}`);
});

await check('reviews.list example runs through the real dispatcher', async () => {
  const result = await assertExampleOk('reviews.list', { cwd: rootReviewsFeedback });
  assert(result.stdout.includes('rev-example'), `expected rev-example in list output, got ${result.stdout}`);
});

await check('reviews.show example runs through the real dispatcher', async () => {
  const result = await assertExampleOk('reviews.show', { cwd: rootReviewsFeedback });
  assert(JSON.parse(result.stdout).id === 'rev-example', `expected rev-example, got ${result.stdout}`);
});

await check('reviews.record example runs through the real dispatcher', async () => {
  fs.writeFileSync(path.join(rootReviewsFeedback, 'finding.json'), JSON.stringify({ severity: 'P2', description: 'nit' }), 'utf8');
  const result = await assertExampleOk('reviews.record', { cwd: rootReviewsFeedback });
  assert(JSON.parse(result.stdout).id === 'rev-example', `expected the updated rev-example session, got ${result.stdout}`);
});

await check('reviews.candidate.add example runs through the real dispatcher (nested 3-token verb)', async () => {
  const result = await assertExampleOk('reviews.candidate.add', { cwd: rootReviewsFeedback });
  const entry = JSON.parse(result.stdout);
  assert(entry.feature === 'demo3' && entry.mode === 'standard', `expected the example candidate, got ${result.stdout}`);
});

await check('reviews candidate add auto-fills cells from the feature capped cells when --cells is omitted (GitHub #16)', async () => {
  const rr = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-cli-cand-cells-'));
  try {
    fs.mkdirSync(path.join(rr, '.bee', 'cells'), { recursive: true });
    writeJsonAtomic(path.join(rr, '.bee', 'onboarding.json'), { schema_version: '1.0', bee_version: '0.1.0' });
    writeJsonAtomic(path.join(rr, '.bee', 'cells', 'revfeat-1.json'), { id: 'revfeat-1', feature: 'revfeat', title: 't', lane: 'small', action: 'a', status: 'capped' });
    writeJsonAtomic(path.join(rr, '.bee', 'cells', 'revfeat-2.json'), { id: 'revfeat-2', feature: 'revfeat', title: 't2', lane: 'small', action: 'a', status: 'open' });
    writeJsonAtomic(path.join(rr, '.bee', 'cells', 'other-1.json'), { id: 'other-1', feature: 'other', title: 't3', lane: 'small', action: 'a', status: 'capped' });
    const res = await runModuleWorker(BEE_MJS, { args: ['reviews', 'candidate', 'add', '--feature', 'revfeat', '--head', 'abc123', '--mode', 'small', '--json'], cwd: rr });
    assert(res.status === 0, `candidate add exit ${res.status}: ${res.stderr}`);
    const entry = JSON.parse(res.stdout);
    assert(
      Array.isArray(entry.cells) && entry.cells.length === 1 && entry.cells[0] === 'revfeat-1',
      `cells should auto-fill to the feature's CAPPED cell only (not open/other-feature), got ${JSON.stringify(entry.cells)}`,
    );
  } finally {
    fs.rmSync(rr, { recursive: true, force: true });
  }
});

await check('reviews.candidates example runs through the real dispatcher (flat 2-token verb, distinct from candidate add)', async () => {
  const result = await assertExampleOk('reviews.candidates', { cwd: rootReviewsFeedback });
  const entries = JSON.parse(result.stdout);
  assert(entries.length === 1 && entries[0].feature === 'demo3', `expected the candidate just added, got ${result.stdout}`);
});

await check('reviews.status example runs through the real dispatcher', async () => {
  const result = await assertExampleOk('reviews.status', { cwd: rootReviewsFeedback });
  const summary = JSON.parse(result.stdout);
  assert(summary.counts.verified === 1, `expected 1 verified candidate, got ${result.stdout}`);
});

await check('feedback.digest example runs through the real dispatcher', async () => {
  const result = await assertExampleOk('feedback.digest', { cwd: rootReviewsFeedback });
  assert(typeof JSON.parse(result.stdout).digest === 'object', `expected a digest object, got ${result.stdout}`);
});

await check('feedback.count example runs through the real dispatcher', async () => {
  const result = await assertExampleOk('feedback.count', { cwd: rootReviewsFeedback });
  assert(typeof JSON.parse(result.stdout).entries === 'number', `expected a numeric entries count, got ${result.stdout}`);
});

await check('feedback.collect example runs through the real dispatcher', async () => {
  const result = await assertExampleOk('feedback.collect', { cwd: rootReviewsFeedback });
  assert(typeof JSON.parse(result.stdout).counts === 'object', `expected a counts object, got ${result.stdout}`);
});

await check('feedback.rank example runs through the real dispatcher', async () => {
  const result = await assertExampleOk('feedback.rank', { cwd: rootReviewsFeedback });
  assert(Array.isArray(JSON.parse(result.stdout)), `expected a ranked cluster array, got ${result.stdout}`);
});

// ─── perf group examples (global perf log; env redirected to the temp repo) ─
// start must run before stop (stop reads the marker start writes). All five run
// against a transcript-less window (fake CLAUDE_CONFIG_DIR) and must still exit 0.
await check('perf.start example writes an open-section marker and exits 0', async () => {
  const result = await assertExampleOk('perf.start');
  const marker = JSON.parse(fs.readFileSync(path.join(root, '.bee', 'cache', 'perf-open.json'), 'utf8'));
  assert(marker.started_at, 'marker records a start time');
  assert(result.status === 0, 'perf start exits 0');
});
await check('perf.stop example closes the section, appends to the global log, clears the marker', async () => {
  const result = await assertExampleOk('perf.stop');
  const rec = JSON.parse(result.stdout);
  assert(rec.schema === 'bee-perf/v1', `section schema tag, got ${result.stdout}`);
  assert(!fs.existsSync(path.join(root, '.bee', 'cache', 'perf-open.json')), 'marker cleared after stop');
  const log = fs.readFileSync(path.join(root, 'perf-global', 'performance.jsonl'), 'utf8').trim();
  assert(log.split('\n').length >= 1, 'section appended to the global log');
});
await check('perf.section one-shot example computes + appends and exits 0', async () => {
  const result = await assertExampleOk('perf.section');
  assert(JSON.parse(result.stdout).schema === 'bee-perf/v1', 'one-shot section logged');
});
await check('perf.log example reads sections back and exits 0', async () => {
  const result = await assertExampleOk('perf.log');
  assert(Array.isArray(JSON.parse(result.stdout)), 'perf log --json returns an array');
});
await check('perf.render example emits Markdown and exits 0', async () => {
  const result = await assertExampleOk('perf.render');
  assert(/bee performance log/.test(result.stdout), 'render emits the report heading');
});
await check('perf.report example reads the store (transcript-less temp env) and exits 0', async () => {
  const result = await assertExampleOk('perf.report');
  const matrix = JSON.parse(result.stdout);
  assert(Array.isArray(matrix.projects), 'perf report --json returns a matrix with a projects array');
});
await check('perf.sync example scans + writes the log (transcript-less temp env) and exits 0', async () => {
  const result = await assertExampleOk('perf.sync');
  const res = JSON.parse(result.stdout);
  assert(typeof res.sessions === 'number', 'perf sync --json reports a session count');
});

// ─── worktree group examples: a REAL git repo + real `git worktree add`,
// mirroring the fixture pattern scripts/test_worktree_cli.mjs already proved
// end-to-end. A dedicated temp tree (not the shared `root` above, which has
// no .git and is deliberately classified 'ordinary') so register's own
// "must run from inside a linked worktree" requirement is satisfiable. ─────
await check('worktree.register/list/unregister examples run through the real dispatcher against a real linked git worktree', async () => {
  const wtTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-cli-worktree-'));
  try {
    const git = (cwd, args) => {
      const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
      assert(r.status === 0, `git ${args.join(' ')} (cwd=${cwd}) failed: ${r.stderr}`);
      return r.stdout;
    };

    const wtMain = path.join(wtTmp, 'main');
    fs.mkdirSync(wtMain);
    git(wtMain, ['init', '-q', '-b', 'main']);
    git(wtMain, ['config', 'user.email', 's@e']);
    git(wtMain, ['config', 'user.name', 's']);
    fs.writeFileSync(path.join(wtMain, 'f'), 'x');
    git(wtMain, ['add', '.']);
    git(wtMain, ['commit', '-q', '-m', 'init']);
    fs.mkdirSync(path.join(wtMain, '.bee'), { recursive: true });
    writeJsonAtomic(path.join(wtMain, '.bee', 'onboarding.json'), { schema_version: '1.0', bee_version: '0.1.0' });

    const wtLinked = path.join(wtTmp, 'wt');
    git(wtMain, ['worktree', 'add', '-q', '-b', 'wt-example-feature', wtLinked]);

    // registry example: 'bee worktree register --feature demo-feature --json'
    await assertExampleOk('worktree.register', { cwd: wtLinked });
    const worktreeStateFile = path.join(wtLinked, '.bee', 'state.json');
    assert(fs.existsSync(worktreeStateFile), 'worktree.register example should bootstrap .bee/state.json');
    const worktreeState = JSON.parse(fs.readFileSync(worktreeStateFile, 'utf8'));
    assert(worktreeState.feature === 'demo-feature' && worktreeState.phase === 'idle', `expected a fresh idle demo-feature state, got ${JSON.stringify(worktreeState)}`);
    const grantsFile = path.join(wtMain, '.bee', 'runtime', 'worktree-grants.json');
    const grantedIds = Object.keys(JSON.parse(fs.readFileSync(grantsFile, 'utf8')));
    assert(grantedIds.length === 1, `expected exactly one grant after register, got ${JSON.stringify(grantedIds)}`);
    const realId = grantedIds[0];

    // registry example: 'bee worktree list --json'
    const listResult = await assertExampleOk('worktree.list', { cwd: wtLinked });
    const listed = JSON.parse(listResult.stdout);
    assert(listed.grants[realId] === true, `worktree.list example should show the real grant, got ${listResult.stdout}`);

    // registry example: 'bee worktree unregister --id abc123 --json' — a real
    // dispatcher call for an id that was never granted, scoped-removal no-op
    // (never an error): proves the example runs cleanly AND that unregister
    // never touches an unrelated id's grant.
    await assertExampleOk('worktree.unregister', { cwd: wtLinked });
    const afterExampleGrants = JSON.parse(fs.readFileSync(grantsFile, 'utf8'));
    assert(afterExampleGrants[realId] === true, `unregister --id abc123 must not remove the real grant, got ${JSON.stringify(afterExampleGrants)}`);

    // Now exercise the real (no --id) default path directly, proving it
    // resolves the CURRENT worktree's own id and actually removes it.
    const realUnregisterResult = await runModuleWorker(BEE_MJS, { args: ['worktree', 'unregister', '--json'], cwd: wtLinked });
    assert(realUnregisterResult.status === 0, `real unregister (no --id) should exit 0, got status=${realUnregisterResult.status} stderr=${realUnregisterResult.stderr}`);
    const finalGrants = JSON.parse(fs.readFileSync(grantsFile, 'utf8'));
    assert(!(realId in finalGrants), `real unregister (no --id) should remove the current worktree's own grant, got ${JSON.stringify(finalGrants)}`);
  } finally {
    fs.rmSync(wtTmp, { recursive: true, force: true });
  }
});

await check('config.validate example runs through the real dispatcher: clean config exits 0, a malformed/prompt-less/unsafe cli-tier config exits 1 with named problems', async () => {
  // registry example: 'bee config validate --json' — the shared fixture repo
  // (`root`) has no .bee/config.json at all, the common "fresh repo" case
  // this validator must treat as clean, never a problem.
  const cleanResult = await assertExampleOk('config.validate', { cwd: root });
  const cleanParsed = JSON.parse(cleanResult.stdout);
  assert(cleanParsed.ok === true && cleanParsed.problem_count === 0, `expected a clean config to report ok, got ${cleanResult.stdout}`);

  // A second, isolated repo whose config.json carries every kind of models
  // problem this cell exists to catch — proves the real dispatcher path
  // (not just the unit-level validateModelsConfig calls in
  // test_config_validate.mjs) surfaces them and exits non-zero.
  const cfgTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-cli-config-validate-'));
  try {
    fs.mkdirSync(path.join(cfgTmp, '.bee'), { recursive: true });
    writeJsonAtomic(path.join(cfgTmp, '.bee', 'onboarding.json'), { schema_version: '1.0', bee_version: '0.1.0' });
    writeJsonAtomic(path.join(cfgTmp, '.bee', 'config.json'), {
      models: {
        claude: {
          generation: { kind: 'cli', command: 'some-cli exec --yolo' }, // no promptVia AND an unsafe flag
          review: { command: 'missing-kind-cli' }, // (a) malformed: no kind:'cli'
        },
      },
    });
    const badResult = await runModuleWorker(BEE_MJS, { args: ['config', 'validate', '--json'], cwd: cfgTmp });
    assert(badResult.status === 1, `expected exit 1 on a problem config, got ${badResult.status}: ${badResult.stdout}`);
    const badParsed = JSON.parse(badResult.stdout);
    assert(badParsed.ok === false && badParsed.problem_count >= 3, `expected ok:false with >= 3 problems, got ${badResult.stdout}`);
    const codes = badParsed.problems.map((p) => p.code);
    assert(codes.includes('cli-prompt-transport-missing'), `expected cli-prompt-transport-missing, got ${JSON.stringify(codes)}`);
    assert(codes.includes('cli-unsafe-flag'), `expected cli-unsafe-flag, got ${JSON.stringify(codes)}`);
    assert(codes.includes('cli-malformed'), `expected cli-malformed, got ${JSON.stringify(codes)}`);
  } finally {
    fs.rmSync(cfgTmp, { recursive: true, force: true });
  }
});

await check('config set/get/unset examples round-trip through the real dispatcher (GitHub #15)', async () => {
  const cfgRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-cli-config-getset-'));
  try {
    fs.mkdirSync(path.join(cfgRoot, '.bee'), { recursive: true });
    writeJsonAtomic(path.join(cfgRoot, '.bee', 'onboarding.json'), { schema_version: '1.0', bee_version: '0.1.0' });
    // set: `--value false` is JSON-coerced to boolean false, not the string "false".
    const setRes = await assertExampleOk('config.set', { cwd: cfgRoot });
    assert(JSON.parse(setRes.stdout).value === false, `set should coerce false to boolean, got ${setRes.stdout}`);
    const onDisk = JSON.parse(fs.readFileSync(path.join(cfgRoot, '.bee', 'config.json'), 'utf8'));
    assert(onDisk.gate_bypass === false, `config.json should carry gate_bypass:false, got ${JSON.stringify(onDisk)}`);
    // get: reads it back.
    const got = JSON.parse((await assertExampleOk('config.get', { cwd: cfgRoot })).stdout);
    assert(got.present === true && got.value === false, `get should read gate_bypass:false, got ${JSON.stringify(got)}`);
    // unset: removes it.
    const unset = JSON.parse((await assertExampleOk('config.unset', { cwd: cfgRoot })).stdout);
    assert(unset.removed === true, `unset should remove the key, got ${JSON.stringify(unset)}`);
    assert(!('gate_bypass' in JSON.parse(fs.readFileSync(path.join(cfgRoot, '.bee', 'config.json'), 'utf8'))), 'gate_bypass should be gone');
  } finally {
    fs.rmSync(cfgRoot, { recursive: true, force: true });
  }
});

await check('config set: nested dot-key, string coercion, refuse-on-invalid, no-clobber of a malformed file (GitHub #15)', async () => {
  const cfgRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-cli-config-edge-'));
  try {
    fs.mkdirSync(path.join(cfgRoot, '.bee'), { recursive: true });
    writeJsonAtomic(path.join(cfgRoot, '.bee', 'onboarding.json'), { schema_version: '1.0', bee_version: '0.1.0' });
    // nested dot-key -> creates guards.idle_gate = false
    let r = await runModuleWorker(BEE_MJS, { args: ['config', 'set', '--key', 'guards.idle_gate', '--value', 'false', '--json'], cwd: cfgRoot });
    assert(r.status === 0, `nested set exit ${r.status}: ${r.stderr}`);
    let disk = JSON.parse(fs.readFileSync(path.join(cfgRoot, '.bee', 'config.json'), 'utf8'));
    assert(disk.guards && disk.guards.idle_gate === false, `guards.idle_gate should be false, got ${JSON.stringify(disk)}`);
    // unset prunes the now-empty parent: no stray "guards": {} left behind
    r = await runModuleWorker(BEE_MJS, { args: ['config', 'unset', '--key', 'guards.idle_gate', '--json'], cwd: cfgRoot });
    assert(r.status === 0 && JSON.parse(r.stdout).removed === true, `nested unset exit ${r.status}: ${r.stdout}`);
    disk = JSON.parse(fs.readFileSync(path.join(cfgRoot, '.bee', 'config.json'), 'utf8'));
    assert(!('guards' in disk), `unset should prune the empty guards parent, got ${JSON.stringify(disk)}`);
    // a non-JSON value stays a string
    r = await runModuleWorker(BEE_MJS, { args: ['config', 'set', '--key', 'product_root', '--value', 'repo', '--json'], cwd: cfgRoot });
    assert(r.status === 0 && JSON.parse(r.stdout).value === 'repo', `product_root should be string "repo", got ${r.stdout}`);
    // refuse-on-invalid: an unsafe cli command must be rejected and NOT written
    r = await runModuleWorker(BEE_MJS, { args: ['config', 'set', '--key', 'models.claude.generation', '--value', '{"kind":"cli","command":"x --yolo"}', '--json'], cwd: cfgRoot });
    assert(r.status !== 0, `an unsafe cli set should be refused, got exit ${r.status}: ${r.stdout}`);
    disk = JSON.parse(fs.readFileSync(path.join(cfgRoot, '.bee', 'config.json'), 'utf8'));
    assert(!(disk.models && disk.models.claude), `the refused set must not have been written, got ${JSON.stringify(disk)}`);
    // no-clobber: a malformed config file must be left intact, set refused
    fs.writeFileSync(path.join(cfgRoot, '.bee', 'config.json'), '{ broken', 'utf8');
    r = await runModuleWorker(BEE_MJS, { args: ['config', 'set', '--key', 'product_root', '--value', 'x', '--json'], cwd: cfgRoot });
    assert(r.status !== 0, `set on a malformed config must refuse, got exit ${r.status}`);
    assert(fs.readFileSync(path.join(cfgRoot, '.bee', 'config.json'), 'utf8').includes('broken'), 'the malformed file must be left intact');
  } finally {
    fs.rmSync(cfgRoot, { recursive: true, force: true });
  }
});

await check('every registry entry had its example executed at least once (nothing silently skipped)', async () => {
  const allNames = new Set(COMMAND_REGISTRY.map((e) => e.name));
  const missing = [...allNames].filter((name) => !executedNames.has(name));
  assert(missing.length === 0, `these registry entries were never exercised: ${missing.join(', ')}`);
  assert(executedNames.size === allNames.size, 'executed-name count should match registry size exactly');
});

// ─── bee.mjs (harness-integration-2): unified dispatcher tests ─────────────
// A SECOND isolated temp repo, kept fully separate from the demo-1 fixture
// chain above so bee.mjs's own mutating calls never collide with it.

const root2 = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-mjs-test-'));
fs.mkdirSync(path.join(root2, '.bee'), { recursive: true });
writeJsonAtomic(path.join(root2, '.bee', 'onboarding.json'), {
  schema_version: '1.0',
  bee_version: '0.1.0',
});
writeState(root2, {
  ...defaultState(),
  phase: 'swarming',
  feature: 'demo2',
  approved_gates: { context: true, shape: true, execution: true, review: false },
});

async function runBee(args, cwd = root2) {
  return await runModuleWorker(BEE_MJS, { args, cwd });
}

// ─── pure-logic unit tests (direct import, no spawn — no side effects since
// bee.mjs guards main() behind a direct-run check) ──────────────────────────

await check('splitCommandTokens separates leading command tokens from the flag section', async () => {
  const { leading, rest } = splitCommandTokens(['cells', 'show', '--id', 'demo-1', '--json']);
  assert(leading.length === 2 && leading[0] === 'cells' && leading[1] === 'show', `leading: ${JSON.stringify(leading)}`);
  assert(rest.length === 3 && rest[0] === '--id', `rest: ${JSON.stringify(rest)}`);
});

await check('resolveCommand special-cases "status" (no subcommand) and dot-joins other groups', async () => {
  assert(resolveCommand([]).commandName === null, 'empty leading -> no command');
  assert(resolveCommand(['status']).commandName === 'status', 'status alone');
  const statusExtra = resolveCommand(['status', 'extra']);
  assert(statusExtra.commandName === 'status' && statusExtra.extra.length === 1, `status extra: ${JSON.stringify(statusExtra)}`);
  const ready = resolveCommand(['cells', 'ready']);
  assert(ready.commandName === 'cells.ready' && ready.extra.length === 0, `cells ready: ${JSON.stringify(ready)}`);
  const bareGroup = resolveCommand(['cells']);
  assert(bareGroup.commandName === 'cells' && bareGroup.extra.length === 0, 'a bare group with no action stays ungrouped (misses the registry -> nearest-match)');
});

await check('parseFlags treats json/stdin/behavior-change/evidence-stdin/active-only as flag-alone booleans', async () => {
  const { flags, json } = parseFlags(['--stdin', '--json']);
  assert(json === true, 'json should be stripped into the json flag');
  assert(flags.stdin === true, 'stdin should be boolean true with no value consumed');
});

await check('parseFlags requires an explicit value for a non-boolean-alone flag, even one the schema types boolean (cells.verify --passed)', async () => {
  const { flags, error } = parseFlags(['--id', 'demo-1', '--command', 'manual check', '--passed', 'true']);
  assert(!error, `unexpected parse error: ${JSON.stringify(error)}`);
  assert(flags.id === 'demo-1' && flags.command === 'manual check' && flags.passed === 'true', `flags: ${JSON.stringify(flags)}`);
});

await check('parseFlags returns a structured error (never throws) for a flag missing its value', async () => {
  const { error } = parseFlags(['--id']);
  assert(error && error.field === 'id' && /requires a value/.test(error.reason), `error: ${JSON.stringify(error)}`);
});

await check('parseFlags returns a structured error for a stray non-flag argument', async () => {
  const { error } = parseFlags(['not-a-flag']);
  assert(error && /unexpected argument/.test(error.reason), `error: ${JSON.stringify(error)}`);
});

await check("parseFlags supports the --name=value form for any flag, taking precedence over the boolean-alone default", async () => {
  const { flags } = parseFlags(['--id=demo-1', '--behavior-change=false']);
  assert(flags.id === 'demo-1', 'id should read from the = form');
  assert(flags['behavior-change'] === 'false', '= form overrides flag-alone boolean handling, matching the original CLIs\' own eq-first parsing order');
});

await check('nearestCommandName suggests the closest real command for a typo', async () => {
  assert(nearestCommandName('cells.lst') === 'cells.list', `got ${nearestCommandName('cells.lst')}`);
  assert(nearestCommandName('staus') === 'status', `got ${nearestCommandName('staus')}`);
});

await check('deprecatedRedirect is null for a live (non-deprecated) registry entry', async () => {
  assert(deprecatedRedirect(entryByName('status')) === null, 'status.deprecated is null -> no redirect');
});

await check('deprecatedRedirect returns a structured redirect naming use_instead for a synthetic deprecated entry, without executing anything', async () => {
  const fakeEntry = { name: 'cells.oldAction', deprecated: { since: '2026-01-01', use_instead: 'cells.newAction' } };
  const redirect = deprecatedRedirect(fakeEntry);
  assert(redirect && redirect.result.ok === false && redirect.result.deprecated === true, `redirect: ${JSON.stringify(redirect)}`);
  assert(redirect.result.use_instead === 'cells.newAction', 'use_instead should name the replacement');
  assert(/use "cells.newAction" instead/.test(redirect.text), `text: ${redirect.text}`);
});

await check('computeManifestHash is deterministic and sensitive to content', async () => {
  const h1 = computeManifestHash();
  const h2 = computeManifestHash();
  assert(h1 === h2, 'the same registry content must hash the same');
  const h3 = computeManifestHash([{ name: 'x' }], '1.0');
  assert(h3 !== h1, 'different registry content must hash differently');
});

// ─── end-to-end: --help / --help --json (D3 tool-schema manifest) ─────────

await check('bee --help --json parses as valid JSON and lists every existing subcommand', async () => {
  const result = await runBee(['--help', '--json']);
  assert(result.status === 0, `exit ${result.status}: ${result.stderr}`);
  const manifest = JSON.parse(result.stdout);
  assert(manifest.schema_version === SCHEMA_VERSION, `schema_version: ${manifest.schema_version}`);
  const names = new Set(manifest.commands.map((c) => c.name));
  for (const entry of COMMAND_REGISTRY) {
    assert(names.has(entry.name), `--help --json is missing "${entry.name}"`);
  }
  assert(manifest.commands.every((c) => !('helper' in c)), 'the public manifest must never leak the internal `helper` dispatch field');
});

await check('bee --help renders non-empty prose naming known commands', async () => {
  const result = await runBee(['--help']);
  assert(result.status === 0, `exit ${result.status}: ${result.stderr}`);
  assert(result.stdout.includes('bee cells ready'), `expected "bee cells ready" invoke text, got: ${result.stdout}`);
});

// ─── demo-2 fixture chain, driven entirely through the bee.mjs dispatcher ──

await check('bee cells add creates the demo-2 fixture cell used by the rest of this dispatcher chain', async () => {
  const cellFixture = {
    id: 'demo-2',
    feature: 'demo2',
    title: 'Demo cell for bee.mjs dispatcher test',
    lane: 'small',
    action: 'Exercise every cells.* command through the bee.mjs dispatcher.',
    verify: 'node -e "process.exit(0)"',
  };
  fs.writeFileSync(path.join(root2, 'cell-demo-2.json'), JSON.stringify(cellFixture, null, 2), 'utf8');
  const result = await runBee(['cells', 'add', '--file', 'cell-demo-2.json', '--json']);
  assert(result.status === 0, `exit ${result.status}: stdout=${result.stdout} stderr=${result.stderr}`);
  assert(fs.existsSync(path.join(root2, '.bee', 'cells', 'demo-2.json')), 'demo-2 cell file should now exist');
});

await check('bee cells list --json includes demo-2', async () => {
  const result = await runBee(['cells', 'list', '--json']);
  assert(result.status === 0, `exit ${result.status}`);
  const cells = JSON.parse(result.stdout);
  assert(cells.some((c) => c.id === 'demo-2'), `expected demo-2 in list, got ${result.stdout}`);
});

await check('bee cells ready --json lists demo-2 (open, no deps)', async () => {
  const result = await runBee(['cells', 'ready', '--json']);
  assert(result.status === 0, `exit ${result.status}: stdout=${result.stdout} stderr=${result.stderr}`);
  assert(JSON.parse(result.stdout).some((c) => c.id === 'demo-2'), 'demo-2 should be ready (open, no deps)');
});

await check('bee cells show --id demo-2 --json returns the cell', async () => {
  const result = await runBee(['cells', 'show', '--id', 'demo-2', '--json']);
  assert(JSON.parse(result.stdout).id === 'demo-2', `expected demo-2, got ${result.stdout}`);
});

await check('bee cells update patches an allowed field on the open demo-2 fixture, through the dispatcher', async () => {
  const patch = { title: 'Demo cell for bee.mjs dispatcher test (updated)' };
  fs.writeFileSync(path.join(root2, 'cell-demo-2-update.json'), JSON.stringify(patch, null, 2), 'utf8');
  const result = await runBee(['cells', 'update', '--id', 'demo-2', '--file', 'cell-demo-2-update.json', '--json']);
  assert(result.status === 0, `exit ${result.status}: stdout=${result.stdout} stderr=${result.stderr}`);
  assert(JSON.parse(result.stdout).title === patch.title, `expected patched title, got ${result.stdout}`);
});

await check('bee cells update refuses a frozen key (status)', async () => {
  const patch = { status: 'capped' };
  fs.writeFileSync(path.join(root2, 'cell-demo-2-frozen.json'), JSON.stringify(patch, null, 2), 'utf8');
  const result = await runBee(['cells', 'update', '--id', 'demo-2', '--file', 'cell-demo-2-frozen.json']);
  assert(result.status === 1, `expected exit 1, got ${result.status}: stdout=${result.stdout} stderr=${result.stderr}`);
  assert(/status/.test(result.stderr), `expected the frozen field named in stderr, got: ${result.stderr}`);
});

await check('bee cells claim --id demo-2 --worker claims it', async () => {
  const result = await runBee(['cells', 'claim', '--id', 'demo-2', '--worker', 'worker-test', '--json']);
  assert(JSON.parse(result.stdout).status === 'claimed', `expected claimed, got ${result.stdout}`);
});

await check('bee cells verify --passed true (explicit "true" argument, not a bare flag) records a passing verify', async () => {
  const result = await runBee([
    'cells', 'verify', '--id', 'demo-2', '--command', 'manual check', '--output', '0 failing', '--passed', 'true', '--json',
  ]);
  assert(result.status === 0, `exit ${result.status}: stdout=${result.stdout} stderr=${result.stderr}`);
  assert(JSON.parse(result.stdout).trace.verify_passed === true, `expected verify_passed true, got ${result.stdout}`);
});

await check('bee cells cap --id demo-2 caps the cell', async () => {
  const result = await runBee(['cells', 'cap', '--id', 'demo-2', '--outcome', 'dispatcher test cap', '--files', 'cell-demo-2.json', '--json']);
  assert(JSON.parse(result.stdout).status === 'capped', `expected capped, got ${result.stdout}`);
});

await check('bee cells judge --id demo-2 reports no frozen-judge hits', async () => {
  const result = await runBee(['cells', 'judge', '--id', 'demo-2', '--json']);
  assert(JSON.parse(result.stdout).hits.length === 0, `expected no hits, got ${result.stdout}`);
});

await check('bee cells tier --id demo-2 --tier generation sets the tier', async () => {
  const result = await runBee(['cells', 'tier', '--id', 'demo-2', '--tier', 'generation', '--json']);
  assert(JSON.parse(result.stdout).tier === 'generation', `expected generation, got ${result.stdout}`);
});

await check('bee cells block --id demo-2 --reason blocks the cell', async () => {
  const result = await runBee(['cells', 'block', '--id', 'demo-2', '--reason', 'dispatcher test block', '--json']);
  assert(JSON.parse(result.stdout).status === 'blocked', `expected blocked, got ${result.stdout}`);
});

await check('bee cells drop --id demo-2 --reason drops the cell', async () => {
  const result = await runBee(['cells', 'drop', '--id', 'demo-2', '--reason', 'dispatcher test drop', '--json']);
  assert(JSON.parse(result.stdout).status === 'dropped', `expected dropped, got ${result.stdout}`);
});

// ─── reservations, through the dispatcher ──────────────────────────────────

await check('bee reservations reserve/list/release/sweep round-trip through the dispatcher', async () => {
  const reserveResult = await runBee(['reservations', 'reserve', '--agent', 'worker-test', '--cell', 'demo-2', '--path', 'src/dispatcher-test.js', '--json']);
  assert(JSON.parse(reserveResult.stdout).ok === true, `reserve failed: ${reserveResult.stdout}`);

  const listResult = await runBee(['reservations', 'list', '--active-only', '--json']);
  assert(listResult.stdout.includes('worker-test'), `expected worker-test in list, got ${listResult.stdout}`);

  const releaseResult = await runBee(['reservations', 'release', '--agent', 'worker-test', '--json']);
  assert(JSON.parse(releaseResult.stdout).released >= 1, `expected at least 1 released, got ${releaseResult.stdout}`);

  const sweepResult = await runBee(['reservations', 'sweep', '--json']);
  assert(typeof JSON.parse(sweepResult.stdout).released === 'number', `expected a released count, got ${sweepResult.stdout}`);
});

await check('bee reservations reserve returns a CONFLICT (exit 1) when another agent already holds an overlapping path', async () => {
  const first = await runBee(['reservations', 'reserve', '--agent', 'agent-a', '--cell', 'demo-2', '--path', 'src/conflict-test.js', '--json']);
  assert(JSON.parse(first.stdout).ok === true, `first reserve should succeed: ${first.stdout}`);
  const second = await runBee(['reservations', 'reserve', '--agent', 'agent-b', '--cell', 'demo-2', '--path', 'src/conflict-test.js', '--json']);
  assert(second.status === 1, `expected exit 1 on conflict, got ${second.status}`);
  assert(JSON.parse(second.stdout).ok === false, `expected ok:false on conflict, got ${second.stdout}`);
});

// ─── decisions, through the dispatcher ─────────────────────────────────────

await check('bee decisions log/active/search round-trip through the dispatcher', async () => {
  const logResult = await runBee(['decisions', 'log', '--decision', 'Use the unified bee.mjs dispatcher', '--rationale', 'Single discoverable CLI surface', '--json']);
  assert(typeof JSON.parse(logResult.stdout).id === 'string', `log failed: ${logResult.stdout}`);

  const activeResult = await runBee(['decisions', 'active', '--recent', '5', '--json']);
  assert(JSON.parse(activeResult.stdout).decisions.length >= 1, `expected at least 1 active decision, got ${activeResult.stdout}`);

  const searchResult = await runBee(['decisions', 'search', '--text', 'dispatcher', '--json']);
  assert(JSON.parse(searchResult.stdout).decisions.length >= 1, `expected the logged decision to match, got ${searchResult.stdout}`);
});

// ─── malformed input / unknown command (never a bare not-found or a stack trace) ─

await check('a call missing a required parameter returns a structured {ok:false,error} shape, never a stack trace', async () => {
  const result = await runBee(['cells', 'show', '--json']);
  assert(result.status === 1, `expected exit 1, got ${result.status}`);
  const parsed = JSON.parse(result.stdout);
  assert(parsed.ok === false && parsed.error && parsed.error.field === 'id', `expected structured id-missing error, got ${result.stdout}`);
  assert(!result.stdout.includes('at Object.'), 'a stack trace must never reach stdout');
});

await check('an unrecognized command returns a nearest-match suggestion, not a bare not-found', async () => {
  // Retargeted off "cells lst" (dispatcher-unify du-4): now that "cells" is
  // one of the 8 GROUP_USAGE_FALLBACKS groups (DB3 — the dispatcher must
  // reproduce the group's legacy "Use: ..." text for ANY unrecognized
  // cells.* command, not just a bare group), that probe now
  // legitimately hits the group fallback instead of the generic nearest-
  // match path — a deliberate, cell-mandated behavior change, not a
  // weakening. A single unregistered top-level token ("staus", a typo of
  // "status", the one dot-free registry entry) has no group of its own to
  // fall back to, so it still exercises the exact same generic
  // nearestCommandName suggestion path end-to-end.
  const result = await runBee(['staus', '--json']);
  assert(result.status === 1, `expected exit 1, got ${result.status}`);
  const parsed = JSON.parse(result.stdout);
  assert(parsed.ok === false && parsed.suggestion === 'status', `expected suggestion "status", got ${result.stdout}`);
});

await check('a call shaped like a bee.mjs invocation with an unregistered command is denied with a structured error, never executed', async () => {
  const result = await runBee(['not', 'a-real-command', '--json']);
  assert(result.status === 1, `expected exit 1, got ${result.status}`);
  assert(JSON.parse(result.stdout).ok === false, `expected ok:false, got ${result.stdout}`);
});

// ─── manifest content-hash drift ───────────────────────────────────────────

await check('a registry content change surfaces manifest_changed on stderr, never reshaping stdout (P1 fix, review-phase-1.md)', async () => {
  // Baseline call: persists the real hash to .bee/manifest-hash.json.
  const baseline = await runBee(['status', '--json']);
  assert(baseline.status === 0, `baseline exit ${baseline.status}`);
  const baselineBody = JSON.parse(baseline.stdout);
  assert(!('manifest_changed' in baselineBody), 'steady state must never carry manifest_changed on stdout (byte-parity requirement)');

  // Simulate drift by corrupting the persisted hash directly — this cell
  // never edits the real command-registry.mjs (out of its file scope).
  const hashFile = path.join(root2, '.bee', 'cache', 'manifest-hash.json');
  writeJsonAtomic(hashFile, { hash: 'deadbeef', checked_at: new Date().toISOString() });

  const drifted = await runBee(['status', '--json']);
  const driftedBody = JSON.parse(drifted.stdout);
  // stdout's top-level shape is IDENTICAL to the baseline's — same keys, no
  // manifest_changed / manifest_changed_hint / result nesting — a consumer
  // parsing stdout never has to special-case a drift call.
  assert(
    JSON.stringify(Object.keys(driftedBody).sort()) === JSON.stringify(Object.keys(baselineBody).sort()),
    `drifted stdout shape must match steady-state shape; baseline keys=${Object.keys(baselineBody)}, drifted keys=${Object.keys(driftedBody)}`,
  );
  assert(driftedBody.phase === 'swarming', 'the underlying result must be the same bare shape as steady state, not nested under .result');
  assert(drifted.stderr.includes('manifest_changed: true'), `expected the drift hint on stderr, got: ${drifted.stderr}`);

  // The drifted call re-persists the real hash, so the very next call is steady again (no stderr hint).
  const settled = await runBee(['status', '--json']);
  assert(!settled.stderr.includes('manifest_changed'), 'the hash should self-heal to steady state after one drift report');
});

// ─── honest runtime drift (codex-harness-hardening 1c) ───────────────────────
// bee status must compare LIVE .bee/bin managed bytes against the per-file
// sha256 the onboarding ledger recorded — content drift is drift even at the
// same bee_version (PROJ-08), and an absent ledger degrades fail-open.

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function buildDriftFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-drift-test-'));
  const libDir = path.join(dir, '.bee', 'bin', 'lib');
  fs.mkdirSync(libDir, { recursive: true });
  const libBody = 'export const SAMPLE = 1;\n';
  const helperBody = '// vendored dispatcher\n';
  fs.writeFileSync(path.join(libDir, 'sample.mjs'), libBody);
  fs.writeFileSync(path.join(dir, '.bee', 'bin', 'bee.mjs'), helperBody);
  writeJsonAtomic(path.join(dir, '.bee', 'onboarding.json'), {
    schema_version: '1.0',
    bee_version: BEE_VERSION, // version matches so any drift is CONTENT drift
    managed: {
      lib: { 'sample.mjs': sha256(Buffer.from(libBody)) },
      helpers: { 'bee.mjs': sha256(Buffer.from(helperBody)) },
    },
  });
  writeState(dir, defaultState());
  return dir;
}

async function statusOnboarding(dir) {
  const r = await runBee(['status', '--json'], dir);
  assert(r.status === 0, `status must render (exit 0), got ${r.status}: ${r.stderr}`);
  return JSON.parse(r.stdout).onboarding;
}

await check('drift: an intact runtime (live hashes == recorded managed map) reads drift:false, no drift_detail', async () => {
  const dir = buildDriftFixture();
  const ob = await statusOnboarding(dir);
  assert(ob.drift === false, `expected drift:false on an intact runtime, got ${JSON.stringify(ob)}`);
  assert(ob.drift_detail === undefined, `intact runtime must carry no drift_detail, got ${JSON.stringify(ob.drift_detail)}`);
});

await check('drift: a content-edited managed lib file reads drift:true and names it, even at the same bee_version (PROJ-08)', async () => {
  const dir = buildDriftFixture();
  fs.writeFileSync(path.join(dir, '.bee', 'bin', 'lib', 'sample.mjs'), 'export const SAMPLE = 999;\n');
  const ob = await statusOnboarding(dir);
  assert(ob.drift === true, `expected drift:true after a content edit, got ${JSON.stringify(ob)}`);
  assert(typeof ob.drift === 'boolean', 'drift must stay a boolean (public contract)');
  assert(
    Array.isArray(ob.drift_detail) && ob.drift_detail.includes('.bee/bin/lib/sample.mjs'),
    `drift_detail must name the exact drifted path, got ${JSON.stringify(ob.drift_detail)}`,
  );
});

await check('drift: a content-edited managed HELPER (bee.mjs, not lib) reads drift:true and names it (review P1)', async () => {
  const dir = buildDriftFixture();
  fs.writeFileSync(path.join(dir, '.bee', 'bin', 'bee.mjs'), '// tampered dispatcher\n');
  const ob = await statusOnboarding(dir);
  assert(ob.drift === true, `expected drift:true after a helper edit, got ${JSON.stringify(ob)}`);
  assert(
    Array.isArray(ob.drift_detail) && ob.drift_detail.some((d) => d.includes('bee.mjs') && !d.includes('lib/')),
    `drift_detail must name .bee/bin/bee.mjs (no lib/ prefix), got ${JSON.stringify(ob.drift_detail)}`,
  );
});

await check('drift: a legacy ledger (no managed map) with a mismatched bee_version reads drift:true (version-only signal is live)', async () => {
  const dir = buildDriftFixture();
  writeJsonAtomic(path.join(dir, '.bee', 'onboarding.json'), { schema_version: '1.0', bee_version: '0.0.1' });
  const ob = await statusOnboarding(dir);
  assert(ob.drift === true, `legacy ledger with a mismatched version must read drift:true, got ${JSON.stringify(ob)}`);
  assert(ob.drift_detail === undefined, 'version-only drift carries no drift_detail');
});

await check('drift: a corrupt (non-JSON) onboarding.json degrades fail-open — status renders exit 0, never throws', async () => {
  const dir = buildDriftFixture();
  fs.writeFileSync(path.join(dir, '.bee', 'onboarding.json'), '{ broken not json');
  const r = await runBee(['status', '--json'], dir);
  assert(r.status === 0, `status must still render on a corrupt ledger, got exit ${r.status}: ${r.stderr}`);
  const ob = JSON.parse(r.stdout).onboarding;
  assert(ob.drift === false, `corrupt ledger must degrade to drift:false, got ${JSON.stringify(ob)}`);
});

await check('drift: a missing managed file reads drift:true (file-set drift)', async () => {
  const dir = buildDriftFixture();
  fs.rmSync(path.join(dir, '.bee', 'bin', 'lib', 'sample.mjs'));
  const ob = await statusOnboarding(dir);
  assert(ob.drift === true, `expected drift:true for a missing managed file, got ${JSON.stringify(ob)}`);
  assert(ob.drift_detail.some((d) => d.includes('sample.mjs') && d.includes('missing')), `expected a "(missing)" detail, got ${JSON.stringify(ob.drift_detail)}`);
});

await check('drift: an extra .mjs in the managed lib dir reads drift:true (file-set drift)', async () => {
  const dir = buildDriftFixture();
  fs.writeFileSync(path.join(dir, '.bee', 'bin', 'lib', 'rogue.mjs'), 'export const X = 1;\n');
  const ob = await statusOnboarding(dir);
  assert(ob.drift === true, `expected drift:true for an extra managed lib file, got ${JSON.stringify(ob)}`);
  assert(ob.drift_detail.some((d) => d.includes('rogue.mjs') && d.includes('extra')), `expected an "(extra)" detail, got ${JSON.stringify(ob.drift_detail)}`);
});

await check('drift: an absent/legacy managed map degrades fail-open — status renders, drift falls back to version-only, never throws (sentinel)', async () => {
  const dir = buildDriftFixture();
  // Legacy ledger: no managed map, version matches the running constant.
  writeJsonAtomic(path.join(dir, '.bee', 'onboarding.json'), { schema_version: '1.0', bee_version: BEE_VERSION });
  const ob = await statusOnboarding(dir); // must not throw
  assert(ob.drift === false, `legacy ledger with matching version must degrade to drift:false, got ${JSON.stringify(ob)}`);
  assert(ob.drift_detail === undefined, 'legacy fail-open path carries no drift_detail');
});

// ─── source identity in status (SRC-01 / DIST-04) ────────────────────────────

await check('status: surfaces a report-only source field classifying the repo bee-hive (project_projection for a host projection)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-src-status-'));
  fs.mkdirSync(path.join(dir, '.claude', 'skills', 'bee-hive', 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.bee'), { recursive: true });
  writeJsonAtomic(path.join(dir, '.bee', 'onboarding.json'), { schema_version: '1.0', bee_version: BEE_VERSION });
  writeState(dir, defaultState());
  const r = await runBee(['status', '--json'], dir);
  assert(r.status === 0, `status must render: ${r.stderr}`);
  const j = JSON.parse(r.stdout);
  assert(j.source && j.source.kind === 'project_projection', `expected source.kind project_projection, got ${JSON.stringify(j.source)}`);
  assert(typeof j.onboarding.drift === 'boolean', 'existing onboarding.drift field must remain (additive change)');
});

// ─── summary ────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed > 0 ? 1 : 0;
