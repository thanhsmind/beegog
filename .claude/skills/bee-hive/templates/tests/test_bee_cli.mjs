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
import { writeJsonAtomic, hashFile } from '../lib/fsutil.mjs';
import { defaultState, writeState, BEE_VERSION } from '../lib/state.mjs';
import {
  splitCommandTokens,
  resolveCommand,
  parseFlags,
  nearestCommandName,
  deprecatedRedirect,
  computeManifestHash,
  manifestLintWarning,
  judgeStandardWarning,
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
    assert(['status', 'doctor', 'cells', 'reservations', 'decisions', 'state', 'backlog', 'capture', 'reviews', 'feedback', 'perf', 'worktree', 'config', 'dispatch'].includes(group), `unexpected group "${group}"`);
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

const GROUP_NAMES = ['cells', 'reservations', 'decisions', 'state', 'backlog', 'capture', 'reviews', 'feedback', 'perf', 'worktree', 'dispatch'];

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

await check('DA5 bijection: the only dot-free registry entries are "status" and "doctor", and every entry\'s group is one of status|doctor|cells|reservations|decisions|state|backlog|capture|reviews|feedback|perf|worktree|config', async () => {
  const allowedGroups = new Set(['status', 'doctor', 'cells', 'reservations', 'decisions', 'state', 'backlog', 'capture', 'reviews', 'feedback', 'perf', 'worktree', 'config', 'dispatch']);
  const allowedDotFree = new Set(['status', 'doctor']);
  for (const entry of COMMAND_REGISTRY) {
    const group = entry.name.includes('.') ? entry.name.split('.')[0] : entry.name;
    assert(allowedGroups.has(group), `${entry.name}: group "${group}" is not one of status|doctor|cells|reservations|decisions|state|backlog|capture|reviews|feedback|perf|worktree|config|dispatch`);
    if (!entry.name.includes('.')) {
      assert(allowedDotFree.has(entry.name), `dot-free registry entry "${entry.name}" is not one of status|doctor — only those may be dot-free`);
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

// D2 + GH #27.4 (D-GHF-C): cells.reset-budget's registry example now runs
// against a deliberately budget-blocked demo-1 — resetCellBudget refuses
// (typed RESET_NOT_NEEDED) on a healthy cell, so the dispatcher-wiring proof
// must first close the door for real. The forced attempts below are
// injected directly (rather than via a claim/verify/unclaim loop) so this
// test stays independent of exactly how many ledger entries the claim/
// verify/block/drop chain above already left behind. The full exhaustion/
// refusal/reopen behavior is covered end to end in test_lib.mjs; this test
// proves the registry example (including its --operator actor) runs
// through the real dispatcher (registry -> handler -> resetCellBudget).
await check('cells.reset-budget example runs through the real dispatcher, after the door is actually closed by CELL_BUDGET_EXHAUSTED', async () => {
  const cellFile = path.join(root, '.bee', 'cells', 'demo-1.json');
  const demo1 = JSON.parse(fs.readFileSync(cellFile, 'utf8'));
  const forcedAttempts = [0, 1, 2, 3].map((i) => ({
    n: i + 1,
    at: new Date(Date.now() - (10 - i) * 1000).toISOString(),
    claim_session: `sess-reset-example-${i}`,
    claimed_at: new Date(Date.now() - (10 - i) * 1000).toISOString(),
    worker: 'w',
    verdict: 'blocked',
    failure_signature: `forced-reset-example-${i}`,
    note: null,
  }));
  demo1.trace = { ...(demo1.trace || {}), attempts: [...((demo1.trace && demo1.trace.attempts) || []), ...forcedAttempts] };
  fs.writeFileSync(cellFile, JSON.stringify(demo1, null, 2), 'utf8');

  const result = await assertExampleOk('cells.reset-budget');
  const cell = JSON.parse(result.stdout);
  assert(cell.id === 'demo-1', `expected demo-1, got ${result.stdout}`);
  assert(
    Array.isArray(cell.trace.budget_resets) && cell.trace.budget_resets.length === 1,
    `expected one budget_resets entry, got ${JSON.stringify(cell.trace.budget_resets)}`,
  );
  assert(
    typeof cell.trace.budget_resets[0].by_actor === 'string' && cell.trace.budget_resets[0].by_actor,
    `expected the example's --operator to land as by_actor, got ${JSON.stringify(cell.trace.budget_resets[0])}`,
  );
});

// D5 (self-correcting-loop): cells.judge-record's registry example, run
// against demo-1 with --builder-model/--judge-model both present and
// differing — exercises the full dispatcher wiring (registry -> handler ->
// recordJudgeVerdict -> validateJudgeVerdict/deriveModelIndependence) and
// proves the CLI's "flag presence implies pinned" derivation end to end;
// the pure-function accept/reject/independence rows are covered exhaustively
// in test_lib.mjs.
await check('cells.judge-record example runs through the real dispatcher, validates the --file payload, and stamps model_independence from --builder-model/--judge-model presence', async () => {
  const verdict = {
    schema: 'judge-verdict/1',
    verdict: 'PASS',
    checks: [{ id: 'must_haves', status: 'PASS', evidence: 'diff matches CONTEXT D5 citations' }],
    fixability: 'automatic',
    confidence: 'high',
  };
  fs.writeFileSync(path.join(root, 'verdict-demo-1.json'), JSON.stringify(verdict), 'utf8');
  const result = await assertExampleOk('cells.judge-record');
  const cell = JSON.parse(result.stdout);
  assert(cell.id === 'demo-1', `expected demo-1, got ${result.stdout}`);
  const entries = cell.trace.semantic_judge;
  assert(Array.isArray(entries) && entries.length === 1, `expected one semantic_judge entry, got ${JSON.stringify(entries)}`);
  assert(entries[0].builder_model === 'sonnet' && entries[0].judge_model === 'opus', `expected the --builder-model/--judge-model flags stored verbatim, got ${JSON.stringify(entries[0])}`);
  assert(entries[0].model_independence === 'confirmed', `two differing --*-model flags must derive confirmed (CLI-level pinned-by-presence), got ${entries[0].model_independence}`);
});

await check('cells.judge-record refuses (non-zero exit) a free-prose --file payload, and leaves the ledger untouched', async () => {
  fs.writeFileSync(path.join(root, 'verdict-demo-1-bad.json'), 'looks fine to me', 'utf8');
  const result = await runModuleWorker(BEE_MJS, {
    args: ['cells', 'judge-record', '--id', 'demo-1', '--file', 'verdict-demo-1-bad.json', '--json'],
    cwd: root,
  });
  assert(result.status !== 0, `a free-prose verdict payload must be refused, got exit ${result.status}: stdout=${result.stdout}`);
  // --json routes a thrown error's message to stdout as {"error": "..."} (emitError), not stderr.
  assert(/verdict rejected/i.test(result.stdout), `expected a "verdict rejected" refusal, got stdout=${result.stdout} stderr=${result.stderr}`);
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
    input: JSON.stringify({
      red_failure_evidence:
        'ok-1: prior behavior characterized before this reviews-fixture change, meeting the D3 anti-boilerplate floor (>=80 chars).',
      verification_run: 'node -e 0',
    }),
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

// ─── dispatch group example (g22-1, GH #22 P0-3): a read-only "gather" kind
// needs no --cell and no extra fixture state, so it runs safely against the
// shared `root` fixture above (no config.json there -> the seeded default
// claude.generation model "sonnet" resolves, matching state.mjs's
// DEFAULT_MODELS). Full behavioral coverage (codex/claude payload shapes,
// the cli-cell refusal, advisor resolution, the prepare-time dispatch
// record) lives in scripts/test_dispatch_prepare.mjs — this is the
// registry-example-is-a-tested-contract proof for the new group.
await check('dispatch.prepare example runs through the real dispatcher', async () => {
  const result = await assertExampleOk('dispatch.prepare');
  const out = JSON.parse(result.stdout);
  assert(out.tool === 'Agent', `expected tool Agent, got ${result.stdout}`);
  assert(out.payload.subagent_type === 'bee-gather', `expected pinned type bee-gather, got ${result.stdout}`);
  assert(typeof out.dispatch_id === 'string' && out.dispatch_id, `expected a dispatch_id, got ${result.stdout}`);
  assert(out.economics && out.economics.channel === 'claude-agent', `expected channel claude-agent, got ${result.stdout}`);
});

// ─── worktree group examples: a REAL git repo + real `git worktree add`,
// mirroring the fixture pattern scripts/test_worktree_cli.mjs already proved
// end-to-end. A dedicated temp tree (not the shared `root` above, which has
// no .git and is deliberately classified 'ordinary') so register's own
// "must run from inside a linked worktree" requirement is satisfiable. ─────
await check('worktree.new example runs through the real dispatcher against a real ORDINARY checkout, creating and granting a linked worktree in one move (wsr-1, GH #21)', async () => {
  const wtNewTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-cli-worktree-new-'));
  try {
    const git = (cwd, args) => {
      const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
      assert(r.status === 0, `git ${args.join(' ')} (cwd=${cwd}) failed: ${r.stderr}`);
      return r.stdout;
    };

    const wtNewMain = path.join(wtNewTmp, 'main');
    fs.mkdirSync(wtNewMain);
    git(wtNewMain, ['init', '-q', '-b', 'main']);
    git(wtNewMain, ['config', 'user.email', 's@e']);
    git(wtNewMain, ['config', 'user.name', 's']);
    fs.writeFileSync(path.join(wtNewMain, 'f'), 'x');
    git(wtNewMain, ['add', '.']);
    git(wtNewMain, ['commit', '-q', '-m', 'init']);
    fs.mkdirSync(path.join(wtNewMain, '.bee'), { recursive: true });
    writeJsonAtomic(path.join(wtNewMain, '.bee', 'onboarding.json'), { schema_version: '1.0', bee_version: '0.1.0' });

    // registry example: 'bee worktree new --feature demo-feature --json'
    const result = await assertExampleOk('worktree.new', { cwd: wtNewMain });
    const created = JSON.parse(result.stdout);
    assert(typeof created.id === 'string' && created.id, `worktree.new example should report a git-verified id, got ${result.stdout}`);
    assert(created.branch === 'wt/demo-feature', `worktree.new example should create branch "wt/demo-feature", got ${JSON.stringify(created)}`);
    assert(fs.existsSync(created.worktreeRoot), `worktree.new example should create ${created.worktreeRoot}`);
    const newStateFile = path.join(created.worktreeRoot, '.bee', 'state.json');
    assert(fs.existsSync(newStateFile), 'worktree.new example should bootstrap .bee/state.json');
    const newState = JSON.parse(fs.readFileSync(newStateFile, 'utf8'));
    assert(
      newState.feature === 'demo-feature' && newState.phase === 'idle',
      `expected a fresh idle demo-feature state, got ${JSON.stringify(newState)}`,
    );
    const grantsFile = path.join(wtNewMain, '.bee', 'runtime', 'worktree-grants.json');
    const grants = JSON.parse(fs.readFileSync(grantsFile, 'utf8'));
    assert(grants[created.id] === true, `worktree.new example should grant the new worktree's id, got ${JSON.stringify(grants)}`);

    // Running the SAME example again from the same ordinary checkout must
    // typed-refuse (the target directory now exists), never crash.
    const repeatResult = await runExample('worktree.new', { cwd: wtNewMain });
    assert(repeatResult.result.status !== 0, 'a second "worktree new --feature demo-feature" from the same checkout must not exit 0');
    assert(
      /WORKTREE_TARGET_EXISTS/.test(repeatResult.result.stdout + repeatResult.result.stderr),
      `expected a typed WORKTREE_TARGET_EXISTS refusal, got stdout=${repeatResult.result.stdout} stderr=${repeatResult.result.stderr}`,
    );
  } finally {
    fs.rmSync(wtNewTmp, { recursive: true, force: true });
  }
});

await check('worktree.merge example (registry refusal-shaped: unknown id) runs through the real dispatcher against a real ORDINARY checkout (wsr-2, GH #21)', async () => {
  const wtMergeTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-cli-worktree-merge-'));
  try {
    const git = (cwd, args) => {
      const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
      assert(r.status === 0, `git ${args.join(' ')} (cwd=${cwd}) failed: ${r.stderr}`);
      return r.stdout;
    };

    const wtMergeMain = path.join(wtMergeTmp, 'main');
    fs.mkdirSync(wtMergeMain);
    git(wtMergeMain, ['init', '-q', '-b', 'main']);
    git(wtMergeMain, ['config', 'user.email', 's@e']);
    git(wtMergeMain, ['config', 'user.name', 's']);
    fs.writeFileSync(path.join(wtMergeMain, 'f'), 'x');
    git(wtMergeMain, ['add', '.']);
    git(wtMergeMain, ['commit', '-q', '-m', 'init']);
    fs.mkdirSync(path.join(wtMergeMain, '.bee'), { recursive: true });
    writeJsonAtomic(path.join(wtMergeMain, '.bee', 'onboarding.json'), { schema_version: '1.0', bee_version: '0.1.0' });

    // registry example: 'bee worktree merge --id demo-feature-missing --json'
    // — deliberately refusal-shaped (an unknown/ungranted id): no worktree
    // fixture is needed just to prove the example is runnable through the
    // real dispatcher from a real ORDINARY checkout. The full green-path /
    // MERGE_CONFLICT / MERGE_VERIFY_RED / cleanup surface is proven
    // end-to-end, with real git worktrees, in scripts/test_worktree_cli.mjs
    // (part of the mandatory verify chain) — this check only satisfies the
    // "every registry example is executed" guard below.
    const { result } = await runExample('worktree.merge', { cwd: wtMergeMain });
    assert(result.status !== 0, `expected the unknown-id example to refuse (non-zero exit), got status 0: ${result.stdout}`);
    assert(
      /WORKTREE_MERGE_UNKNOWN_ID/.test(result.stdout + result.stderr),
      `expected a typed WORKTREE_MERGE_UNKNOWN_ID refusal, got stdout=${result.stdout} stderr=${result.stderr}`,
    );
  } finally {
    fs.rmSync(wtMergeTmp, { recursive: true, force: true });
  }
});

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

await check('state.advisor-ref examples run through the real dispatcher', async () => {
  // makeAdvisorRoot is a hoisted function declaration (defined in the advisor
  // block below); an active feature + a present digest file let the record
  // example succeed, and show round-trips it.
  const dir = makeAdvisorRoot({ mode: 'standard' });
  fs.writeFileSync(path.join(dir, 'consult.txt'), 'example consult digest body');
  await assertExampleOk('state.advisor-ref.record', { cwd: dir });
  const show = await assertExampleOk('state.advisor-ref.show', { cwd: dir });
  assert(JSON.parse(show.stdout).advisor_ref.advisor === 'gpt-5.6-sol', `show example returns the recorded advisor, got ${show.stdout}`);
});

// ─── doctor (codex-native-runtime-v2 cnr2-13, D11): fail-closed runtime
// health report. A dedicated isolated fixture repo per test — doctor reads
// .codex/hooks.json, .claude/settings.json, hooks/*.mjs, and
// .bee/onboarding.json's recorded baseline hash, none of which the shared
// `root`/`root2` fixtures carry in the exact shape these tests need.

const DOCTOR_HOOKS_JSON = {
  hooks: {
    PreToolUse: [
      {
        matcher: 'spawn_agent',
        hooks: [{ type: 'command', command: 'exec node "$r"/hooks/bee-model-guard.mjs --source=repo' }],
      },
    ],
    Stop: [{ hooks: [{ type: 'command', command: 'exec node "$r"/hooks/bee-state-sync.mjs --source=repo' }] }],
  },
};

function buildDoctorFixture({ withHandlerFiles = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-doctor-test-'));
  fs.mkdirSync(path.join(dir, '.bee'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.codex'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'hooks'), { recursive: true });
  const hooksJsonPath = path.join(dir, '.codex', 'hooks.json');
  fs.writeFileSync(hooksJsonPath, `${JSON.stringify(DOCTOR_HOOKS_JSON, null, 2)}\n`, 'utf8');
  if (withHandlerFiles) {
    fs.writeFileSync(path.join(dir, 'hooks', 'bee-model-guard.mjs'), '// stub\n', 'utf8');
    fs.writeFileSync(path.join(dir, 'hooks', 'bee-state-sync.mjs'), '// stub\n', 'utf8');
  }
  fs.writeFileSync(path.join(dir, '.codex', 'config.toml'), 'approval_policy = "never"\n', 'utf8');
  writeJsonAtomic(path.join(dir, '.bee', 'onboarding.json'), {
    schema_version: '1.0',
    bee_version: '0.1.0',
    managed: { repo_hooks: { '.codex/hooks.json': hashFile(hooksJsonPath) } },
    agents_sync: { files: [] },
  });
  // g22-4/D7: bee-render/2 with an empty skills[] — this fixture creates no
  // actual bee-* skill dirs under either root, so the deep audit's expected
  // set is trivially empty and skills_installed stays 'ok'/blocking, exactly
  // like the old shallow v1 check did for every OTHER doctor test in this
  // file that does not care about the skill-inventory audit itself (that
  // audit gets its own dedicated fixture matrix in scripts/test_conformance.mjs
  // scenarios 14/15 — deep-audit pass/missing/stray/drift, and legacy v1
  // warn-not-block — against the real .bee/bin/bee.mjs binary).
  fs.mkdirSync(path.join(dir, '.agents', 'skills'), { recursive: true });
  writeJsonAtomic(path.join(dir, '.agents', 'skills', '.bee-render.json'), { schema: 'bee-render/2', target_runtime: 'codex', skills: [] });
  fs.mkdirSync(path.join(dir, '.claude', 'skills'), { recursive: true });
  writeJsonAtomic(path.join(dir, '.claude', 'skills', '.bee-render.json'), { schema: 'bee-render/2', target_runtime: 'claude', skills: [] });
  writeJsonAtomic(path.join(dir, '.claude', 'settings.json'), {
    permissions: { defaultMode: 'bypassPermissions' },
    hooks: {
      SessionStart: [{ hooks: [{ type: 'command', command: 'node .bee/bin/hooks/bee-session-init.mjs' }] }],
      UserPromptSubmit: [{ hooks: [{ type: 'command', command: 'node .bee/bin/hooks/bee-prompt-context.mjs' }] }],
      PreToolUse: [
        { matcher: 'Edit|Write', hooks: [{ type: 'command', command: 'node .bee/bin/hooks/bee-write-guard.mjs' }] },
        { matcher: 'Agent|Task', hooks: [{ type: 'command', command: 'node .bee/bin/hooks/bee-model-guard.mjs' }] },
      ],
      PostToolUse: [{ hooks: [{ type: 'command', command: 'node .bee/bin/hooks/bee-tools-logger.mjs' }] }],
      Stop: [{ hooks: [{ type: 'command', command: 'node .bee/bin/hooks/bee-state-sync.mjs' }] }],
    },
  });
  fs.mkdirSync(path.join(dir, '.bee', 'bin', 'hooks'), { recursive: true });
  // bee-model-guard.mjs / bee-state-sync.mjs are the SAME two filenames the
  // codex fixture above references (GH #22 P1-1: doctor's dual-location
  // check resolves a codex handler at .bee/bin/hooks/<f> OR hooks/<f>) —
  // when withHandlerFiles is false, both locations must lack them for the
  // codex missing-handler assertion below to still hold; the other four
  // stay so claude's own handlers_resolvable row (a distinct check, not
  // exercised by that assertion) is unaffected.
  const beeBinHandlerFiles = withHandlerFiles
    ? ['bee-session-init.mjs', 'bee-prompt-context.mjs', 'bee-write-guard.mjs', 'bee-model-guard.mjs', 'bee-tools-logger.mjs', 'bee-state-sync.mjs']
    : ['bee-session-init.mjs', 'bee-prompt-context.mjs', 'bee-write-guard.mjs', 'bee-tools-logger.mjs'];
  for (const f of beeBinHandlerFiles) {
    fs.writeFileSync(path.join(dir, '.bee', 'bin', 'hooks', f), '// stub\n', 'utf8');
  }
  return dir;
}

await check('doctor: ok fixture — checkable codex rows pass ok, mechanical-green codex reaches degraded (no attestation), claude reaches overall_status ready', async () => {
  const dir = buildDoctorFixture();
  try {
    const codexResult = await assertExampleOk('doctor', { exampleIndex: 0, cwd: dir });
    const codex = JSON.parse(codexResult.stdout);
    assert(codex.runtime === 'codex', `expected runtime codex, got ${JSON.stringify(codex)}`);
    const byRow = Object.fromEntries(codex.rows.map((r) => [r.row, r]));
    assert(byRow.hooks_file_present.status === 'ok', `hooks_file_present should be ok, got ${JSON.stringify(byRow.hooks_file_present)}`);
    assert(byRow.capability_baseline_match.status === 'ok', `capability_baseline_match should be ok on a matching baseline, got ${JSON.stringify(byRow.capability_baseline_match)}`);
    assert(byRow.hook_handlers_resolvable.status === 'ok', `hook_handlers_resolvable should be ok when every handler file exists, got ${JSON.stringify(byRow.hook_handlers_resolvable)}`);
    // D4 three-state: mechanical rows are all ok, but codex's structurally-
    // unknown trust rows still `degrades` readiness with no attestation
    // recorded — 'degraded', never a bare "ready" from file presence alone,
    // and never 'blocked' either since nothing mechanical failed.
    assert(codex.overall_status === 'degraded', `codex overall_status must be degraded (mechanical green, trust rows unknown, no attestation), got ${codex.overall_status}`);
    assert(codex.reasons.some((r) => r.startsWith('hooks_discovered:')), `reasons must name the degrading trust rows, got ${JSON.stringify(codex.reasons)}`);
    assert(codex.reasons.some((r) => r.startsWith('no_attestation:')), `reasons must name no_attestation, got ${JSON.stringify(codex.reasons)}`);
    assert(codex.attestation && codex.attestation.status === 'invalid' && codex.attestation.reason === 'no_attestation', `attestation summary must report invalid/no_attestation, got ${JSON.stringify(codex.attestation)}`);

    const claudeResult = await assertExampleOk('doctor', { exampleIndex: 1, cwd: dir });
    const claude = JSON.parse(claudeResult.stdout);
    assert(claude.runtime === 'claude', `expected runtime claude, got ${JSON.stringify(claude)}`);
    assert(claude.overall_status === 'ready', `claude should reach ready on a fully-wired fixture with no blocking rows, got ${claude.overall_status}: ${JSON.stringify(claude.rows)}`);
    assert(!('attestation' in claude), `claude has no attestation model and must not carry an attestation field, got ${JSON.stringify(claude)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

await check('doctor attest: a valid attestation over a mechanical-green fixture reaches ready', async () => {
  const dir = buildDoctorFixture();
  try {
    const attestResult = await assertExampleOk('doctor.attest', { cwd: dir });
    const attested = JSON.parse(attestResult.stdout);
    assert(attested.ok === true && attested.attestation && typeof attested.attestation.hooks_file_sha256 === 'string', `doctor attest must record an attestation, got ${attestResult.stdout}`);
    assert(fs.existsSync(path.join(dir, '.bee', 'doctor-attest.json')), 'doctor attest must write .bee/doctor-attest.json');

    const result = await runModuleWorker(BEE_MJS, { args: ['doctor', '--runtime', 'codex', '--json'], cwd: dir });
    assert(result.status === 0, `doctor must not throw after attesting, got exit ${result.status}: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert(parsed.overall_status === 'ready', `a valid attestation over a mechanical-green fixture must reach ready, got ${parsed.overall_status}: ${JSON.stringify(parsed.reasons)}`);
    assert(parsed.attestation && parsed.attestation.status === 'valid', `attestation summary must report valid, got ${JSON.stringify(parsed.attestation)}`);
    assert(parsed.reasons.length === 0, `ready must carry no reasons, got ${JSON.stringify(parsed.reasons)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

await check('doctor attest: flipping .codex/hooks.json after attesting goes stale (hash_changed) -> degraded', async () => {
  const dir = buildDoctorFixture();
  try {
    await assertExampleOk('doctor.attest', { cwd: dir });
    // A real post-attestation drift — mutate the live file AFTER attesting.
    // Keeps the same hook commands (so hook_handlers_resolvable/capability_
    // baseline_match — re-baselined below — both stay mechanically ok) and
    // only adds a harmless marker field, isolating the assertion to the
    // attestation's own hash leg rather than the mechanical rows.
    fs.writeFileSync(
      path.join(dir, '.codex', 'hooks.json'),
      `${JSON.stringify({ ...DOCTOR_HOOKS_JSON, _post_attest_marker: true }, null, 2)}\n`,
      'utf8',
    );
    writeJsonAtomic(path.join(dir, '.bee', 'onboarding.json'), {
      schema_version: '1.0',
      bee_version: '0.1.0',
      managed: { repo_hooks: { '.codex/hooks.json': hashFile(path.join(dir, '.codex', 'hooks.json')) } },
      agents_sync: { files: [] },
    });
    const result = await runModuleWorker(BEE_MJS, { args: ['doctor', '--runtime', 'codex', '--json'], cwd: dir });
    assert(result.status === 0, `doctor must not throw on a stale attestation, got exit ${result.status}: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert(parsed.overall_status === 'degraded', `a stale (hash-changed) attestation must degrade, not block or ready, got ${parsed.overall_status}`);
    assert(parsed.attestation && parsed.attestation.status === 'invalid' && parsed.attestation.reason === 'hash_changed', `attestation summary must name hash_changed, got ${JSON.stringify(parsed.attestation)}`);
    assert(parsed.reasons.some((r) => r.startsWith('hash_changed:')), `reasons must name hash_changed, got ${JSON.stringify(parsed.reasons)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

await check('doctor attest: --runtime claude is refused (no attestation model)', async () => {
  const dir = buildDoctorFixture();
  try {
    const result = await runModuleWorker(BEE_MJS, { args: ['doctor', 'attest', '--runtime', 'claude', '--json'], cwd: dir });
    assert(result.status !== 0, `doctor attest --runtime claude must be refused, got exit ${result.status}: ${result.stdout}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

await check('doctor: missing .codex/hooks.json -> blocked (mechanical, not merely degraded)', async () => {
  const dir = buildDoctorFixture();
  try {
    fs.rmSync(path.join(dir, '.codex', 'hooks.json'));
    const result = await runModuleWorker(BEE_MJS, { args: ['doctor', '--runtime', 'codex', '--json'], cwd: dir });
    assert(result.status === 0, `doctor must not throw on a missing hooks file, got exit ${result.status}: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    assert(parsed.overall_status === 'blocked', `a missing mechanical hooks file must block readiness outright, got ${parsed.overall_status}`);
    assert(parsed.reasons.some((r) => r.startsWith('hooks_file_present:')), `reasons must name hooks_file_present, got ${JSON.stringify(parsed.reasons)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

await check('doctor: version-mismatch wording — a live codex --version other than the probed one reports unprobed_version, never the probed conclusions', async () => {
  const dir = buildDoctorFixture();
  const stubDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-doctor-codex-stub-'));
  try {
    // A tiny fake "codex" binary ahead on PATH that reports a version other
    // than PROBED_CODEX_VERSION ('0.144.4') — proves the wording switches
    // without needing an actually-different codex install on this machine.
    const stubPath = path.join(stubDir, 'codex');
    fs.writeFileSync(stubPath, '#!/bin/sh\necho "codex-cli 9.9.9"\n', { mode: 0o755 });
    const result = await runModuleWorker(BEE_MJS, {
      args: ['doctor', '--runtime', 'codex', '--json'],
      cwd: dir,
      env: { ...process.env, PATH: `${stubDir}${path.delimiter}${process.env.PATH || ''}` },
    });
    assert(result.status === 0, `doctor must not throw on an unprobed codex version, got exit ${result.status}: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    const row = parsed.rows.find((r) => r.row === 'hooks_discovered');
    assert(row.evidence.includes('unprobed_version'), `evidence must carry the unprobed_version token, got ${row.evidence}`);
    assert(!row.evidence.includes('0.144.4 exposes no machine-readable'), `evidence must not assert the probed-version conclusion verbatim, got ${row.evidence}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(stubDir, { recursive: true, force: true });
  }
});

await check('doctor: missing hook handler file -> hook_handlers_resolvable warns and names the missing file', async () => {
  const dir = buildDoctorFixture({ withHandlerFiles: false });
  try {
    const result = await runModuleWorker(BEE_MJS, { args: ['doctor', '--runtime', 'codex', '--json'], cwd: dir });
    assert(result.status === 0, `doctor must not throw, got exit ${result.status}: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    const row = parsed.rows.find((r) => r.row === 'hook_handlers_resolvable');
    assert(row.status === 'warn', `expected hook_handlers_resolvable warn on missing handler files, got ${JSON.stringify(row)}`);
    assert(row.evidence.includes('bee-model-guard.mjs') || row.evidence.includes('bee-state-sync.mjs'), `evidence should name a missing handler, got ${row.evidence}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

await check('doctor: codex binary absent from PATH -> codex_version warns instead of crashing', async () => {
  const dir = buildDoctorFixture();
  try {
    // An empty PATH inside the isolated worker's own env cannot resolve the
    // "codex" binary, regardless of what is actually installed on the
    // machine running this suite — the parent process's PATH is untouched.
    const result = await runModuleWorker(BEE_MJS, {
      args: ['doctor', '--runtime', 'codex', '--json'],
      cwd: dir,
      env: { ...process.env, PATH: '' },
    });
    assert(result.status === 0, `doctor must not throw when codex is absent, got exit ${result.status}: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout);
    const row = parsed.rows.find((r) => r.row === 'codex_version');
    assert(row.status === 'warn', `expected codex_version warn when the binary cannot be found, got ${JSON.stringify(row)}`);
    assert(row.value === null, `codex_version value should be null when unresolved, got ${JSON.stringify(row.value)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

await check('doctor: codex trust/discovery rows are always present, unknown, and degrading (D4 re-class: no longer blocking) — never inferred from file presence', async () => {
  const dir = buildDoctorFixture();
  try {
    const result = await runModuleWorker(BEE_MJS, { args: ['doctor', '--runtime', 'codex', '--json'], cwd: dir });
    const parsed = JSON.parse(result.stdout);
    for (const rowName of ['hooks_discovered', 'hooks_trusted', 'project_trust', 'pending_hook_review']) {
      const row = parsed.rows.find((r) => r.row === rowName);
      assert(row, `row "${rowName}" must always be present on --runtime codex`);
      assert(row.status === 'unknown', `${rowName} must stay unknown, got ${row.status}`);
      // D4 re-class: these rows carry `degrades: true`, never `blocking`
      // anymore — a bare unknown trust state degrades readiness (recoverable
      // via "doctor attest"), it no longer blocks it outright.
      assert(row.degrades === true, `${rowName} must be marked degrades, got ${JSON.stringify(row)}`);
      assert(!row.blocking, `${rowName} must no longer be marked blocking, got ${JSON.stringify(row)}`);
      assert(typeof row.degraded_reason === 'string' && row.degraded_reason.length > 0, `${rowName} must carry a degraded_reason, got ${JSON.stringify(row)}`);
    }
    assert(parsed.overall_status === 'degraded', 'unattested degrading trust rows must degrade (not block, not ready)');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

await check('doctor: custom_agents verdict is version-scoped, never a bare "unsupported"', async () => {
  const dir = buildDoctorFixture();
  try {
    const result = await runModuleWorker(BEE_MJS, { args: ['doctor', '--runtime', 'codex', '--json'], cwd: dir });
    const parsed = JSON.parse(result.stdout);
    const row = parsed.rows.find((r) => r.row === 'custom_agents');
    assert(row.status === 'unsupported', `expected unsupported, got ${JSON.stringify(row)}`);
    assert(row.evidence.includes('0.144.4'), `custom_agents evidence must cite the probed version, got ${row.evidence}`);
    assert(row.evidence.toLowerCase().includes('version-scoped') || row.evidence.toLowerCase().includes('other versions'), `custom_agents evidence must scope the verdict to the probed version, got ${row.evidence}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

await check('doctor: performs zero writes, even with an unwritable cache directory (read-only sandbox)', async () => {
  const dir = buildDoctorFixture();
  try {
    const cacheDir = path.join(dir, '.bee', 'cache');
    fs.mkdirSync(cacheDir, { recursive: true });
    const cacheFile = path.join(cacheDir, 'manifest-hash.json');
    fs.chmodSync(cacheDir, 0o500); // read+execute only: writes/creates inside must fail
    try {
      const result = await runModuleWorker(BEE_MJS, { args: ['doctor', '--runtime', 'codex', '--json'], cwd: dir });
      assert(result.status === 0, `doctor must not crash under an unwritable cache dir, got exit ${result.status}: stdout=${result.stdout} stderr=${result.stderr}`);
      assert(!fs.existsSync(cacheFile), `doctor must never create ${cacheFile} — it is read-only FOR REAL, not merely best-effort`);
    } finally {
      fs.chmodSync(cacheDir, 0o700);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

await check('doctor: a mutating command still persists the manifest-hash cache (best-effort, not weakened)', async () => {
  const dir = buildDoctorFixture();
  try {
    const cacheFile = path.join(dir, '.bee', 'cache', 'manifest-hash.json');
    assert(!fs.existsSync(cacheFile), 'precondition: no cache file yet');
    const result = await runModuleWorker(BEE_MJS, { args: ['status', '--json'], cwd: dir });
    assert(result.status === 0, `status must succeed, got ${result.status}: ${result.stderr}`);
    assert(fs.existsSync(cacheFile), 'a non-doctor command must still persist the manifest-hash cache');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

await check('doctor: --json shape is stable (runtime, overall_status, rows[], reasons[]) for both runtimes', async () => {
  const dir = buildDoctorFixture();
  try {
    for (const runtime of ['codex', 'claude']) {
      const result = await runModuleWorker(BEE_MJS, { args: ['doctor', '--runtime', runtime, '--json'], cwd: dir });
      assert(result.status === 0, `doctor --runtime ${runtime} must exit 0, got ${result.status}: ${result.stderr}`);
      const parsed = JSON.parse(result.stdout);
      assert(parsed.runtime === runtime, `runtime field mismatch, got ${JSON.stringify(parsed)}`);
      assert(['ready', 'degraded', 'blocked'].includes(parsed.overall_status), `overall_status must be ready|degraded|blocked, got ${parsed.overall_status}`);
      assert(Array.isArray(parsed.rows) && parsed.rows.length > 0, `rows must be a non-empty array, got ${JSON.stringify(parsed.rows)}`);
      for (const row of parsed.rows) {
        assert(typeof row.row === 'string' && row.row, `every row needs a name, got ${JSON.stringify(row)}`);
        assert(['ok', 'warn', 'unknown', 'unsupported'].includes(row.status), `row "${row.row}" has an unrecognized status "${row.status}"`);
        assert(typeof row.evidence === 'string' && row.evidence, `row "${row.row}" must carry non-empty evidence`);
      }
      assert(Array.isArray(parsed.reasons), `reasons must be an array, got ${JSON.stringify(parsed.reasons)}`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

await check('doctor: an unknown --runtime is refused, never silently defaulted', async () => {
  const dir = buildDoctorFixture();
  try {
    const result = await runModuleWorker(BEE_MJS, { args: ['doctor', '--runtime', 'windows', '--json'], cwd: dir });
    assert(result.status !== 0, `an unrecognized runtime must be refused, got exit ${result.status}: ${result.stdout}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
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

// ─── manifestLintWarning (H2, post-advisor-hardening): pure-logic unit tests
// for the advisory release-manifest trap lint (add/update never refuse — see
// the CLI-level end-to-end rows further down for the through-the-dispatcher
// coverage). ─────────────────────────────────────────────────────────────

await check('manifestLintWarning fires on the trap shape: verify mentions release_manifest, files lacks the manifest path', async () => {
  const warning = manifestLintWarning({
    id: 'trap-1',
    verify: 'node scripts/release_manifest.mjs --check',
    files: ['some/other/file.mjs'],
  });
  assert(warning && /trap-1/.test(warning), `expected a warning naming the cell id, got: ${warning}`);
  assert(/release_manifest\.mjs --write/.test(warning), `expected the FIX to name --write, got: ${warning}`);
});

await check('manifestLintWarning is silent when the manifest path is already listed in files', async () => {
  const warning = manifestLintWarning({
    id: 'trap-2',
    verify: 'node scripts/release_manifest.mjs --check',
    files: ['docs/history/codex-harness-hardening/release-manifest.json'],
  });
  assert(warning === null, `expected no warning, got: ${warning}`);
});

await check('manifestLintWarning is silent when verify does not mention release_manifest', async () => {
  const warning = manifestLintWarning({ id: 'trap-3', verify: 'node -e "process.exit(0)"', files: [] });
  assert(warning === null, `expected no warning, got: ${warning}`);
});

await check('manifestLintWarning tolerates malformed cell shapes without throwing', async () => {
  assert(manifestLintWarning(null) === null, 'null cell must not throw');
  assert(manifestLintWarning(undefined) === null, 'undefined cell must not throw');
  assert(manifestLintWarning({}) === null, 'empty object (no verify) must not throw');
  assert(manifestLintWarning({ id: 'trap-4', verify: null, files: [] }) === null, 'non-string verify must not throw');
  assert(
    manifestLintWarning({ id: 'trap-5', verify: 'node scripts/release_manifest.mjs --check' }) !== null,
    'missing files array defaults to [] and still fires — not treated as malformed-silent',
  );
  assert(
    manifestLintWarning({ id: 'trap-6', verify: 'node scripts/release_manifest.mjs --check', files: 'not-an-array' }) !== null,
    'non-array files also defaults to [] and still fires',
  );
});

// ─── judgeStandardWarning (D3, self-correcting-loop): pure-logic unit tests
// for the advisory judge-standard sufficiency matrix (F4) — add/update never
// refuse, see the CLI-level end-to-end rows further down for the through-the-
// dispatcher coverage, mirroring manifestLintWarning's own H2 layout above.

await check('judgeStandardWarning is silent for an unclassified cell — no change_class, no behavior_change:true (D3: no matrix check at all)', async () => {
  assert(judgeStandardWarning({ id: 'jsw-1', verify: 'node -e 0' }) === null, 'unclassified cell must never warn');
  assert(judgeStandardWarning({ id: 'jsw-2', verify: 'node -e 0', behavior_change: false }) === null, 'behavior_change:false stays unclassified');
});

await check('judgeStandardWarning fires per class when the verify string is missing that class\'s named minimum (formatting/bugfix/api/security/migration)', async () => {
  const cases = [
    ['formatting', { id: 'jsw-fmt', change_class: 'formatting', verify: 'node -e 0' }],
    ['bugfix', { id: 'jsw-bug', change_class: 'bugfix', verify: 'node -e 0' }],
    ['api', { id: 'jsw-api', change_class: 'api', verify: 'node -e 0' }],
    ['security', { id: 'jsw-sec', change_class: 'security', verify: 'node -e 0' }],
    ['migration', { id: 'jsw-mig', change_class: 'migration', verify: 'node -e 0' }],
  ];
  for (const [cls, cell] of cases) {
    const warning = judgeStandardWarning(cell);
    assert(warning && warning.includes('JUDGE_STANDARD_INSUFFICIENT'), `expected a JUDGE_STANDARD_INSUFFICIENT warning for class "${cls}", got: ${warning}`);
    assert(warning.includes(cell.id), `expected the warning to name the cell id for class "${cls}", got: ${warning}`);
    assert(warning.includes(cls), `expected the warning to name the class "${cls}", got: ${warning}`);
  }
});

await check('judgeStandardWarning stays silent per class once verify names that class\'s minimum', async () => {
  assert(judgeStandardWarning({ id: 'jsw-fmt-ok', change_class: 'formatting', verify: 'npm run lint && npm run typecheck' }) === null, 'formatting: lint/typecheck present');
  assert(judgeStandardWarning({ id: 'jsw-bug-ok', change_class: 'bugfix', verify: 'node tests/test_foo.mjs' }) === null, 'bugfix: a test path named');
  assert(judgeStandardWarning({ id: 'jsw-api-ok', change_class: 'api', verify: 'node tests/test_contract.mjs' }) === null, 'api: a contract test named');
  assert(judgeStandardWarning({ id: 'jsw-sec-ok', change_class: 'security', verify: 'node tests/test_negative_path.mjs' }) === null, 'security: a negative-path test named');
  assert(judgeStandardWarning({ id: 'jsw-mig-ok', change_class: 'migration', verify: 'node migrate.mjs forward && node migrate.mjs rollback' }) === null, 'migration: forward + rollback both named');
});

await check('judgeStandardWarning fires for a behavior-class cell with no pre-attached red_failure_evidence, and is silent once one is present', async () => {
  const warning = judgeStandardWarning({ id: 'jsw-behavior-1', behavior_change: true, verify: 'node -e 0' });
  assert(warning && warning.includes('jsw-behavior-1') && warning.includes('behavior'), `expected a behavior-class warning, got: ${warning}`);
  const silent = judgeStandardWarning({
    id: 'jsw-behavior-2',
    behavior_change: true,
    verify: 'node -e 0',
    verification_evidence: { red_failure_evidence: 'a pre-attached characterization of the prior behavior' },
  });
  assert(silent === null, 'a cell already carrying red_failure_evidence at authoring time must not warn');
});

await check('judgeStandardWarning tolerates malformed cell shapes without throwing', async () => {
  assert(judgeStandardWarning(null) === null, 'null cell must not throw');
  assert(judgeStandardWarning(undefined) === null, 'undefined cell must not throw');
  assert(judgeStandardWarning({}) === null, 'empty object (unclassified) must not throw');
  assert(judgeStandardWarning({ id: 'jsw-bad', change_class: 'behavior', verify: null }) !== null, 'non-string verify must not throw, and behavior still warns without evidence');
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

// ─── group/command-scoped --help (GH #23) ──────────────────────────────────

await check('bee state --help --json exits 0 and lists only state.* commands, including state.set', async () => {
  const result = await runBee(['state', '--help', '--json']);
  assert(result.status === 0, `exit ${result.status}: ${result.stderr}`);
  const manifest = JSON.parse(result.stdout);
  assert(manifest.schema_version === SCHEMA_VERSION, `schema_version: ${manifest.schema_version}`);
  const names = manifest.commands.map((c) => c.name);
  assert(names.includes('state.set'), `expected "state.set" among scoped commands, got: ${names.join(', ')}`);
  assert(names.every((n) => n.startsWith('state.')), `expected only state.* commands, got: ${names.join(', ')}`);
});

await check('bee cells --help (text) exits 0 and names only cells.* invokes', async () => {
  const result = await runBee(['cells', '--help']);
  assert(result.status === 0, `exit ${result.status}: ${result.stderr}`);
  assert(result.stdout.includes('bee cells ready'), `expected "bee cells ready" invoke text, got: ${result.stdout}`);
  assert(!result.stdout.includes('bee state set'), `scoped "cells --help" leaked an unrelated command: ${result.stdout}`);
});

await check('bee state handoff --help --json scopes to state.handoff.* only', async () => {
  const result = await runBee(['state', 'handoff', '--help', '--json']);
  assert(result.status === 0, `exit ${result.status}: ${result.stderr}`);
  const manifest = JSON.parse(result.stdout);
  const names = manifest.commands.map((c) => c.name);
  assert(names.length > 0, 'expected at least one state.handoff.* command');
  assert(names.every((n) => n.startsWith('state.handoff.')), `expected only state.handoff.* commands, got: ${names.join(', ')}`);
  assert(names.includes('state.handoff.show'), `expected "state.handoff.show" among scoped commands, got: ${names.join(', ')}`);
});

await check('bee bogusgroup --help still errors exactly like an unrecognized command (unknown group unaffected)', async () => {
  const result = await runBee(['bogusgroup', '--help']);
  assert(result.status === 1, `expected exit 1, got ${result.status}: stdout=${result.stdout}`);
  // No GROUP_USAGE_FALLBACKS entry for "bogusgroup" -> falls through to the
  // generic nearest-match suggestion path, which emits via emit() (stdout),
  // not emitError() (stderr) — unchanged from today's non-help behavior.
  assert(result.stdout.includes('Unknown command "bogusgroup"'), `expected the unchanged unknown-command message, got: ${result.stdout}`);
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

// ─── H2 manifest-lint, through the dispatcher: `cells add`/`cells update`
// warn (stderr, both --json and text) on the trap shape but never refuse the
// write or change the exit code — a separate fixture cell from demo-2 so this
// block never disturbs demo-2's own claim/verify/cap lifecycle below. ──────

await check('bee cells add fires the manifest lint WARNING on the trap shape and still succeeds', async () => {
  const cellFixture = {
    id: 'demo-2-lint-trap',
    feature: 'demo2',
    title: 'H2 lint fixture — trap shape',
    lane: 'small',
    action: 'H2 lint fixture only, never claimed/executed.',
    verify: 'node scripts/release_manifest.mjs --check',
  };
  fs.writeFileSync(path.join(root2, 'cell-lint-trap.json'), JSON.stringify(cellFixture, null, 2), 'utf8');
  const result = await runBee(['cells', 'add', '--file', 'cell-lint-trap.json', '--json']);
  assert(result.status === 0, `the write must always succeed: exit ${result.status}: stdout=${result.stdout} stderr=${result.stderr}`);
  assert(/WARNING/.test(result.stderr) && /demo-2-lint-trap/.test(result.stderr), `expected a WARNING naming the cell in stderr, got: ${result.stderr}`);
  assert(/release-manifest\.json/.test(result.stderr), `expected the missing manifest path named, got: ${result.stderr}`);
});

await check('bee cells add stays silent when the manifest path is already listed in files', async () => {
  const cellFixture = {
    id: 'demo-2-lint-listed',
    feature: 'demo2',
    title: 'H2 lint fixture — manifest already listed',
    lane: 'small',
    action: 'H2 lint fixture only, never claimed/executed.',
    verify: 'node scripts/release_manifest.mjs --check',
    files: ['docs/history/codex-harness-hardening/release-manifest.json'],
  };
  fs.writeFileSync(path.join(root2, 'cell-lint-listed.json'), JSON.stringify(cellFixture, null, 2), 'utf8');
  const result = await runBee(['cells', 'add', '--file', 'cell-lint-listed.json', '--json']);
  assert(result.status === 0, `exit ${result.status}: stdout=${result.stdout} stderr=${result.stderr}`);
  assert(!/WARNING/.test(result.stderr), `expected no WARNING, got stderr=${result.stderr}`);
});

await check('bee cells add stays silent when verify does not mention release_manifest', async () => {
  const cellFixture = {
    id: 'demo-2-lint-unrelated',
    feature: 'demo2',
    title: 'H2 lint fixture — unrelated verify',
    lane: 'small',
    action: 'H2 lint fixture only, never claimed/executed.',
    verify: 'node -e "process.exit(0)"',
  };
  fs.writeFileSync(path.join(root2, 'cell-lint-unrelated.json'), JSON.stringify(cellFixture, null, 2), 'utf8');
  const result = await runBee(['cells', 'add', '--file', 'cell-lint-unrelated.json', '--json']);
  assert(result.status === 0, `exit ${result.status}: stdout=${result.stdout} stderr=${result.stderr}`);
  assert(!/WARNING/.test(result.stderr), `expected no WARNING, got stderr=${result.stderr}`);
});

await check('bee cells update fires the manifest lint WARNING when a patch leaves the MERGED cell in the trap shape, and still succeeds', async () => {
  // demo-2-lint-unrelated was added above with a verify that does not mention
  // release_manifest; patching `verify` alone (files stays absent/[]) must
  // lint the MERGED result, not the raw one-field patch.
  const patch = { verify: 'node scripts/release_manifest.mjs --check' };
  fs.writeFileSync(path.join(root2, 'cell-lint-update-trap.json'), JSON.stringify(patch, null, 2), 'utf8');
  const result = await runBee(['cells', 'update', '--id', 'demo-2-lint-unrelated', '--file', 'cell-lint-update-trap.json', '--json']);
  assert(result.status === 0, `the write must always succeed: exit ${result.status}: stdout=${result.stdout} stderr=${result.stderr}`);
  assert(/WARNING/.test(result.stderr) && /demo-2-lint-unrelated/.test(result.stderr), `expected a WARNING naming the cell in stderr, got: ${result.stderr}`);
});

await check('bee cells update stays silent when the patched cell keeps the manifest path in files', async () => {
  // demo-2-lint-listed already carries the manifest path in files; patching
  // an unrelated field must keep the merged cell out of the trap shape.
  const patch = { title: 'H2 lint fixture — manifest already listed (updated)' };
  fs.writeFileSync(path.join(root2, 'cell-lint-update-listed.json'), JSON.stringify(patch, null, 2), 'utf8');
  const result = await runBee(['cells', 'update', '--id', 'demo-2-lint-listed', '--file', 'cell-lint-update-listed.json', '--json']);
  assert(result.status === 0, `exit ${result.status}: stdout=${result.stdout} stderr=${result.stderr}`);
  assert(!/WARNING/.test(result.stderr), `expected no WARNING, got stderr=${result.stderr}`);
});

// ─── D3 judge-standard matrix, through the dispatcher: `cells add`/`cells
// update` warn (stderr, JUDGE_STANDARD_INSUFFICIENT) on an under-specified
// change_class shape but never refuse the write (F4); `cells cap` warns when
// a behavior-class cap rides the deliberate_exceptions door (F5). Separate
// fixture cells from demo-2 so this block never disturbs demo-2's own
// claim/verify/cap lifecycle below (H2 layout precedent). ─────────────────

await check('bee cells add fires JUDGE_STANDARD_INSUFFICIENT on an under-specified api-class cell and still succeeds', async () => {
  const cellFixture = {
    id: 'demo-2-jsw-api',
    feature: 'demo2',
    title: 'D3 matrix fixture — api class, no contract/integration test named',
    lane: 'small',
    action: 'D3 matrix fixture only, never claimed/executed.',
    verify: 'node -e "process.exit(0)"',
    change_class: 'api',
  };
  fs.writeFileSync(path.join(root2, 'cell-jsw-api.json'), JSON.stringify(cellFixture, null, 2), 'utf8');
  const result = await runBee(['cells', 'add', '--file', 'cell-jsw-api.json', '--json']);
  assert(result.status === 0, `the write must always succeed: exit ${result.status}: stdout=${result.stdout} stderr=${result.stderr}`);
  assert(
    /JUDGE_STANDARD_INSUFFICIENT/.test(result.stderr) && /demo-2-jsw-api/.test(result.stderr),
    `expected a JUDGE_STANDARD_INSUFFICIENT warning naming the cell, got: ${result.stderr}`,
  );
});

await check('bee cells add stays silent on the matrix when the verify already names the class minimum', async () => {
  const cellFixture = {
    id: 'demo-2-jsw-api-ok',
    feature: 'demo2',
    title: 'D3 matrix fixture — api class, contract test named',
    lane: 'small',
    action: 'D3 matrix fixture only, never claimed/executed.',
    verify: 'node tests/test_contract.mjs',
    change_class: 'api',
  };
  fs.writeFileSync(path.join(root2, 'cell-jsw-api-ok.json'), JSON.stringify(cellFixture, null, 2), 'utf8');
  const result = await runBee(['cells', 'add', '--file', 'cell-jsw-api-ok.json', '--json']);
  assert(result.status === 0, `exit ${result.status}: stdout=${result.stdout} stderr=${result.stderr}`);
  assert(!/JUDGE_STANDARD_INSUFFICIENT/.test(result.stderr), `expected no JUDGE_STANDARD_INSUFFICIENT warning, got stderr=${result.stderr}`);
});

await check('bee cells add stays silent on the matrix for an unclassified cell (no change_class, no behavior_change:true)', async () => {
  const cellFixture = {
    id: 'demo-2-jsw-unclassified',
    feature: 'demo2',
    title: 'D3 matrix fixture — unclassified',
    lane: 'small',
    action: 'D3 matrix fixture only, never claimed/executed.',
    verify: 'node -e "process.exit(0)"',
  };
  fs.writeFileSync(path.join(root2, 'cell-jsw-unclassified.json'), JSON.stringify(cellFixture, null, 2), 'utf8');
  const result = await runBee(['cells', 'add', '--file', 'cell-jsw-unclassified.json', '--json']);
  assert(result.status === 0, `exit ${result.status}: stdout=${result.stdout} stderr=${result.stderr}`);
  assert(!/JUDGE_STANDARD_INSUFFICIENT/.test(result.stderr), `expected no warning for an unclassified cell, got stderr=${result.stderr}`);
});

await check('bee cells update fires JUDGE_STANDARD_INSUFFICIENT when a patch leaves the MERGED cell under-specified, and still succeeds', async () => {
  const patch = { change_class: 'security' };
  fs.writeFileSync(path.join(root2, 'cell-jsw-update.json'), JSON.stringify(patch, null, 2), 'utf8');
  const result = await runBee(['cells', 'update', '--id', 'demo-2-jsw-unclassified', '--file', 'cell-jsw-update.json', '--json']);
  assert(result.status === 0, `the write must always succeed: exit ${result.status}: stdout=${result.stdout} stderr=${result.stderr}`);
  assert(
    /JUDGE_STANDARD_INSUFFICIENT/.test(result.stderr) && /demo-2-jsw-unclassified/.test(result.stderr),
    `expected the warning naming the cell, got: ${result.stderr}`,
  );
});

await check('bee cells cap fires JUDGE_STANDARD_INSUFFICIENT (F5) when a behavior-class cap rides deliberate_exceptions, but still succeeds', async () => {
  const cellFixture = {
    id: 'demo-2-jsw-exception',
    feature: 'demo2',
    title: 'D3 F5 fixture — behavior class riding deliberate_exceptions',
    lane: 'small',
    action: 'D3 F5 fixture only.',
    verify: 'node -e "process.exit(0)"',
    change_class: 'behavior',
  };
  fs.writeFileSync(path.join(root2, 'cell-jsw-exception.json'), JSON.stringify(cellFixture, null, 2), 'utf8');
  const added = await runBee(['cells', 'add', '--file', 'cell-jsw-exception.json', '--json']);
  assert(added.status === 0, `add setup failed: ${added.status}: stdout=${added.stdout} stderr=${added.stderr}`);
  const claimed = await runBee(['cells', 'claim', '--id', 'demo-2-jsw-exception', '--worker', 'worker-jsw', '--json']);
  assert(claimed.status === 0, `claim setup failed: ${claimed.status}: stdout=${claimed.stdout} stderr=${claimed.stderr}`);
  const verified = await runBee([
    'cells', 'verify', '--id', 'demo-2-jsw-exception', '--command', 'node -e 0', '--output', 'ok', '--passed', 'true', '--json',
  ]);
  assert(verified.status === 0, `verify setup failed: ${verified.status}: stdout=${verified.stdout} stderr=${verified.stderr}`);

  const capped = await runModuleWorker(BEE_MJS, {
    args: ['cells', 'cap', '--id', 'demo-2-jsw-exception', '--outcome', 'done', '--files', 'a.js', '--evidence-stdin', '--json'],
    cwd: root2,
    input: JSON.stringify({ deliberate_exceptions: ['brand-new surface, no prior behavior to characterize'] }),
  });
  assert(capped.status === 0, `cap must succeed: exit ${capped.status}: stdout=${capped.stdout} stderr=${capped.stderr}`);
  assert(
    /JUDGE_STANDARD_INSUFFICIENT/.test(capped.stderr) && /demo-2-jsw-exception/.test(capped.stderr) && /deliberate_exceptions/.test(capped.stderr),
    `expected the F5 advisory naming the cell and the exception door, got stderr=${capped.stderr}`,
  );
});

await check('bee cells cap stays silent on the F5 advisory for a green-row behavior-class cap (sufficient, unique red_failure_evidence)', async () => {
  const cellFixture = {
    id: 'demo-2-jsw-green',
    feature: 'demo2',
    title: 'D3 F5 fixture — behavior class, sufficient evidence',
    lane: 'small',
    action: 'D3 F5 fixture only.',
    verify: 'node -e "process.exit(0)"',
    change_class: 'behavior',
  };
  fs.writeFileSync(path.join(root2, 'cell-jsw-green.json'), JSON.stringify(cellFixture, null, 2), 'utf8');
  const added = await runBee(['cells', 'add', '--file', 'cell-jsw-green.json', '--json']);
  assert(added.status === 0, `add setup failed: ${added.status}: stdout=${added.stdout} stderr=${added.stderr}`);
  const claimed = await runBee(['cells', 'claim', '--id', 'demo-2-jsw-green', '--worker', 'worker-jsw', '--json']);
  assert(claimed.status === 0, `claim setup failed: ${claimed.status}: stdout=${claimed.stdout} stderr=${claimed.stderr}`);
  const verified = await runBee([
    'cells', 'verify', '--id', 'demo-2-jsw-green', '--command', 'node -e 0', '--output', 'ok', '--passed', 'true', '--json',
  ]);
  assert(verified.status === 0, `verify setup failed: ${verified.status}: stdout=${verified.stdout} stderr=${verified.stderr}`);

  const capped = await runModuleWorker(BEE_MJS, {
    args: ['cells', 'cap', '--id', 'demo-2-jsw-green', '--outcome', 'done', '--files', 'a.js', '--evidence-stdin', '--json'],
    cwd: root2,
    input: JSON.stringify({
      red_failure_evidence:
        'demo-2-jsw-green: a genuinely unique characterization of the prior failing behavior before this change, clearing the D3 floor.',
    }),
  });
  assert(capped.status === 0, `cap must succeed: exit ${capped.status}: stdout=${capped.stdout} stderr=${capped.stderr}`);
  assert(!/JUDGE_STANDARD_INSUFFICIENT/.test(capped.stderr), `expected no F5 advisory on a green-row cap, got stderr=${capped.stderr}`);
});

await check('bee cells claim --id demo-2 --worker claims it', async () => {
  const result = await runBee(['cells', 'claim', '--id', 'demo-2', '--worker', 'worker-test', '--json']);
  assert(JSON.parse(result.stdout).status === 'claimed', `expected claimed, got ${result.stdout}`);
});

// D1 (msh-2): `cells claim --id` is re-backed by the same O_EXCL claim file
// claim-next uses — a second claim on the SAME cell must refuse loudly
// (typed CLAIMED, non-zero exit) instead of silently double-claiming.
await check('bee cells claim --id twice on the same cell: the second call refuses with a typed CLAIMED error, non-zero exit, cell untouched by the loser', async () => {
  addCell(root2, {
    id: 'claim-race-cli-1',
    feature: 'demo2',
    title: 'CLI claim-race fixture',
    lane: 'small',
    action: 'Exercise the double-claim refusal.',
    verify: 'node -e "process.exit(0)"',
  });
  const first = await runBee(['cells', 'claim', '--id', 'claim-race-cli-1', '--worker', 'worker-first', '--session-id', 'sess-cli-first', '--json']);
  assert(first.status === 0 && JSON.parse(first.stdout).status === 'claimed', `first claim should succeed, got status=${first.status} stdout=${first.stdout}`);

  const second = await runBee(['cells', 'claim', '--id', 'claim-race-cli-1', '--worker', 'worker-second', '--session-id', 'sess-cli-second']);
  assert(second.status !== 0, `second claim on the same cell must exit non-zero, got ${second.status}`);
  assert(/CLAIMED/.test(second.stderr), `expected a typed CLAIMED refusal on stderr, got ${second.stderr}`);
  assert(/sess-cli-first/.test(second.stderr), `refusal should name the actual owner, got ${second.stderr}`);
});

// D3: --session-id is optional on `cells claim --id` — a call with neither
// flag nor CLAUDE_CODE_SESSION_ID env still claims cleanly (sessionless).
await check('bee cells claim --id with no --session-id and no CLAUDE_CODE_SESSION_ID env still claims cleanly (single-session flow unaffected)', async () => {
  addCell(root2, {
    id: 'claim-sessionless-cli-1',
    feature: 'demo2',
    title: 'CLI sessionless-claim fixture',
    lane: 'small',
    action: 'Exercise the sessionless claim path.',
    verify: 'node -e "process.exit(0)"',
  });
  const { CLAUDE_CODE_SESSION_ID: _drop, ...envNoSession } = process.env;
  const result = await runModuleWorker(BEE_MJS, {
    args: ['cells', 'claim', '--id', 'claim-sessionless-cli-1', '--worker', 'worker-sessionless', '--json'],
    cwd: root2,
    env: envNoSession,
  });
  assert(result.status === 0, `sessionless claim should succeed, got ${result.status}: ${result.stderr}`);
  assert(JSON.parse(result.stdout).status === 'claimed', `expected claimed, got ${result.stdout}`);
});

// D3: claim-next's --session-id keeps working exactly as before; it now also
// resolves from CLAUDE_CODE_SESSION_ID, and a call with neither is refused
// by the handler (not silently treated as sessionless — claim-next's own
// cross-session selection genuinely needs a session id).
await check('bee cells claim-next: --session-id omitted resolves from CLAUDE_CODE_SESSION_ID env; omitted with no env at all is refused with a clear message', async () => {
  addCell(root2, {
    id: 'claim-next-env-1',
    feature: 'demo2',
    title: 'CLI claim-next env-fallback fixture',
    lane: 'small',
    action: 'Exercise the claim-next session-id env fallback.',
    verify: 'node -e "process.exit(0)"',
  });
  const withEnv = await runModuleWorker(BEE_MJS, {
    args: ['cells', 'claim-next', '--worker', 'worker-env', '--json'],
    cwd: root2,
    env: { ...process.env, CLAUDE_CODE_SESSION_ID: 'sess-from-env-cli' },
  });
  assert(withEnv.status === 0, `claim-next with only the env session id should succeed, got ${withEnv.status}: ${withEnv.stderr}`);
  const parsed = JSON.parse(withEnv.stdout);
  assert(parsed.ok === true && parsed.cell.id === 'claim-next-env-1', `expected claim-next-env-1 claimed, got ${withEnv.stdout}`);

  addCell(root2, {
    id: 'claim-next-noenv-1',
    feature: 'demo2',
    title: 'CLI claim-next no-session fixture',
    lane: 'small',
    action: 'Exercise the claim-next refusal with no session source at all.',
    verify: 'node -e "process.exit(0)"',
  });
  const { CLAUDE_CODE_SESSION_ID: _drop2, ...envNoSession2 } = process.env;
  const withoutEnv = await runModuleWorker(BEE_MJS, {
    args: ['cells', 'claim-next', '--worker', 'worker-noenv'], // no --json: refusal lands on stderr as plain text
    cwd: root2,
    env: envNoSession2,
  });
  assert(withoutEnv.status !== 0, 'claim-next with neither --session-id nor env must refuse');
  assert(/session-id|CLAUDE_CODE_SESSION_ID/.test(withoutEnv.stderr), `refusal should name the missing session source, got ${withoutEnv.stderr}`);
});

await check('bee cells verify --passed true (explicit "true" argument, not a bare flag) records a passing verify', async () => {
  const result = await runBee([
    'cells', 'verify', '--id', 'demo-2', '--command', 'manual check', '--output', '0 failing', '--passed', 'true', '--json',
  ]);
  assert(result.status === 0, `exit ${result.status}: stdout=${result.stdout} stderr=${result.stderr}`);
  assert(JSON.parse(result.stdout).trace.verify_passed === true, `expected verify_passed true, got ${result.stdout}`);
});

// D1: --signature threads from bee.mjs's CLI flag through recordVerify into
// the trace.attempts ledger — the worker-suppliable override, end to end
// through the dispatcher (not just the direct lib call already covered above).
await check('bee cells verify --signature overrides the mechanical normalizer through the dispatcher, and a --passed false verify without --signature appends a ledger entry', async () => {
  addCell(root2, {
    id: 'ledger-cli-1',
    feature: 'demo2',
    title: 'CLI ledger fixture',
    lane: 'small',
    action: 'Exercise the --signature flag through the dispatcher.',
    verify: 'node -e "process.exit(0)"',
  });
  const failed = await runBee([
    'cells', 'verify', '--id', 'ledger-cli-1', '--command', 'npm test', '--output', 'FAIL from dispatcher', '--passed', 'false', '--signature', 'cli-custom-sig', '--json',
  ]);
  assert(failed.status === 0, `exit ${failed.status}: stdout=${failed.stdout} stderr=${failed.stderr}`);
  const afterFail = JSON.parse(failed.stdout);
  assert(afterFail.trace.attempts.length === 1, `expected 1 ledger entry, got ${JSON.stringify(afterFail.trace.attempts)}`);
  assert(afterFail.trace.attempts[0].failure_signature === 'cli-custom-sig', `expected the CLI --signature to win, got ${afterFail.trace.attempts[0].failure_signature}`);

  const passed = await runBee([
    'cells', 'verify', '--id', 'ledger-cli-1', '--command', 'npm test', '--output', 'ok', '--passed', 'true', '--json',
  ]);
  const afterPass = JSON.parse(passed.stdout);
  assert(afterPass.trace.attempts.length === 2, `expected 2 ledger entries after the passing verify, got ${afterPass.trace.attempts.length}`);
  assert(afterPass.trace.attempts[1].verdict === 'pass' && afterPass.trace.attempts[1].failure_signature === null, 'the passing entry carries no failure_signature');
});

await check('bee cells cap --id demo-2 caps the cell', async () => {
  const result = await runBee(['cells', 'cap', '--id', 'demo-2', '--outcome', 'dispatcher test cap', '--files', 'cell-demo-2.json', '--json']);
  assert(JSON.parse(result.stdout).status === 'capped', `expected capped, got ${result.stdout}`);
});

// D-GHF-C (GH #27.5): `cells cap --override-judge` end to end through the
// real dispatcher — refused without the flag when the latest judge-recorded
// verdict is NEEDS_REVISION, capped with an audited trace.judge_overrides
// entry when the flag is supplied.
await check('bee cells cap refuses a NEEDS_REVISION-judged cell without --override-judge, and --override-judge caps it with an audited trace.judge_overrides entry', async () => {
  addCell(root2, {
    id: 'judge-cli-1',
    feature: 'demo2',
    title: 'CLI judge-override fixture',
    lane: 'small',
    action: 'Exercise the --override-judge flag through the dispatcher.',
    verify: 'node -e "process.exit(0)"',
  });
  const claimed = await runBee(['cells', 'claim', '--id', 'judge-cli-1', '--worker', 'worker-judge-cli', '--json']);
  assert(claimed.status === 0, `cells claim setup failed: ${claimed.status}: stdout=${claimed.stdout} stderr=${claimed.stderr}`);
  const verified = await runBee(['cells', 'verify', '--id', 'judge-cli-1', '--command', 'node -e 0', '--output', 'ok', '--passed', 'true', '--json']);
  assert(verified.status === 0, `cells verify setup failed: ${verified.status}: stdout=${verified.stdout} stderr=${verified.stderr}`);

  const verdictPath = path.join(root2, 'verdict-judge-cli-1.json');
  fs.writeFileSync(
    verdictPath,
    JSON.stringify({
      schema: 'judge-verdict/1',
      verdict: 'NEEDS_REVISION',
      checks: [{ id: 'must_haves', status: 'FAIL', evidence: 'diff missed a CONTEXT truth' }],
      failure_signature: 'missed-truth',
      fixability: 'automatic',
      confidence: 'high',
    }),
    'utf8',
  );
  const recorded = await runBee(['cells', 'judge-record', '--id', 'judge-cli-1', '--file', 'verdict-judge-cli-1.json', '--json']);
  assert(recorded.status === 0, `cells judge-record setup failed: ${recorded.status}: stdout=${recorded.stdout} stderr=${recorded.stderr}`);

  const blocked = await runBee(['cells', 'cap', '--id', 'judge-cli-1', '--outcome', 'done', '--files', 'a.js', '--json']);
  assert(blocked.status !== 0, `cap without --override-judge must be refused, got status ${blocked.status}: stdout=${blocked.stdout}`);
  assert(/JUDGE_REWORK_REQUIRED|NEEDS_REVISION/.test(blocked.stdout), `refusal must name the judge block (emitError writes JSON to stdout under --json), got stdout=${blocked.stdout}`);

  const overridden = await runBee(['cells', 'cap', '--id', 'judge-cli-1', '--outcome', 'done', '--files', 'a.js', '--override-judge', 'accepted risk via CLI', '--json']);
  assert(overridden.status === 0, `cap with --override-judge must succeed, got status ${overridden.status}: stdout=${overridden.stdout} stderr=${overridden.stderr}`);
  const overriddenCell = JSON.parse(overridden.stdout);
  assert(overriddenCell.status === 'capped', `expected capped, got ${overridden.stdout}`);
  const overrides = overriddenCell.trace.judge_overrides;
  assert(Array.isArray(overrides) && overrides.length === 1 && overrides[0].reason === 'accepted risk via CLI', `expected one audited judge_overrides entry, got ${JSON.stringify(overrides)}`);
});

await check('bee cells judge --id demo-2 reports no frozen-judge hits', async () => {
  const result = await runBee(['cells', 'judge', '--id', 'demo-2', '--json']);
  assert(JSON.parse(result.stdout).hits.length === 0, `expected no hits, got ${result.stdout}`);
});

await check('bee cells tier --id demo-2 --tier generation sets the tier', async () => {
  const result = await runBee(['cells', 'tier', '--id', 'demo-2', '--tier', 'generation', '--json']);
  assert(JSON.parse(result.stdout).tier === 'generation', `expected generation, got ${result.stdout}`);
});

// D2 + GH #27.4 (D-GHF-C): `cells reset-budget` end to end through the real
// dispatcher — the audited door that reopens a budget-exhausted or
// repeated-failure cell. resetCellBudget now refuses on a healthy cell, so
// budget-cli-1 is exhausted (3 claim/verify/unclaim cycles, same pattern as
// budget-cli-2 below) before the reset itself is exercised. Full exhaustion/
// refusal coverage lives at the lib level (test_lib.mjs); this proves the
// CLI wiring (registry + handler + dispatch table) threads
// --id/--reason/--operator into resetCellBudget correctly.
await check('bee cells reset-budget --id --reason --operator runs through the dispatcher: appends a budget_resets entry, and the reason/actor round-trip verbatim (D-GHF-C)', async () => {
  addCell(root2, {
    id: 'budget-cli-1',
    feature: 'demo2',
    title: 'CLI budget-reset fixture',
    lane: 'small',
    action: 'Exercise cells reset-budget through the dispatcher.',
    verify: 'node -e "process.exit(0)"',
  });
  for (let i = 0; i < 3; i += 1) {
    const claimed = await runBee(['cells', 'claim', '--id', 'budget-cli-1', '--worker', 'w', '--session-id', `sess-cli-reset-${i}`, '--json']);
    assert(claimed.status === 0, `claim #${i + 1} should succeed: ${claimed.stderr}`);
    await runBee(['cells', 'verify', '--id', 'budget-cli-1', '--command', 'node -e ok', '--output', 'ok', '--passed', 'true', '--session-id', `sess-cli-reset-${i}`, '--json']);
    await runBee(['cells', 'unclaim', '--id', 'budget-cli-1', '--session-id', `sess-cli-reset-${i}`, '--json']);
  }
  const blocked = await runBee(['cells', 'claim', '--id', 'budget-cli-1', '--worker', 'w', '--session-id', 'sess-cli-reset-3']);
  assert(blocked.status !== 0, 'precondition: the door should be exhausted before reset');

  const result = await runBee(['cells', 'reset-budget', '--id', 'budget-cli-1', '--reason', 'dispatcher smoke test', '--operator', 'cli-operator-1', '--json']);
  assert(result.status === 0, `exit ${result.status}: stdout=${result.stdout} stderr=${result.stderr}`);
  const cell = JSON.parse(result.stdout);
  assert(Array.isArray(cell.trace.budget_resets) && cell.trace.budget_resets.length === 1, `expected one budget_resets entry, got ${JSON.stringify(cell.trace.budget_resets)}`);
  assert(cell.trace.budget_resets[0].reason === 'dispatcher smoke test', `reason should round-trip verbatim, got ${JSON.stringify(cell.trace.budget_resets[0])}`);
  assert(cell.trace.budget_resets[0].by_actor === 'cli-operator-1', `--operator should round-trip verbatim as by_actor, got ${JSON.stringify(cell.trace.budget_resets[0])}`);
});

await check('bee cells reset-budget --id X refuses without --reason', async () => {
  const result = await runBee(['cells', 'reset-budget', '--id', 'budget-cli-1']);
  assert(result.status !== 0, 'reset-budget without --reason must refuse');
});

await check('bee cells reset-budget --id X --reason refuses without an actor (no --operator, no BEE_AGENT_NAME)', async () => {
  addCell(root2, {
    id: 'budget-cli-1b',
    feature: 'demo2',
    title: 'CLI budget-reset no-actor fixture',
    lane: 'small',
    action: 'Exercise cells reset-budget through the dispatcher without an actor.',
    verify: 'node -e "process.exit(0)"',
  });
  for (let i = 0; i < 3; i += 1) {
    await runBee(['cells', 'claim', '--id', 'budget-cli-1b', '--worker', 'w', '--session-id', `sess-cli-noactor-${i}`, '--json']);
    await runBee(['cells', 'verify', '--id', 'budget-cli-1b', '--command', 'node -e ok', '--output', 'ok', '--passed', 'true', '--session-id', `sess-cli-noactor-${i}`, '--json']);
    await runBee(['cells', 'unclaim', '--id', 'budget-cli-1b', '--session-id', `sess-cli-noactor-${i}`, '--json']);
  }
  // Explicit env with BEE_AGENT_NAME stripped — this refusal must not
  // depend on whatever happens to be set in the host shell running the
  // suite itself.
  const strippedEnv = { ...process.env };
  delete strippedEnv.BEE_AGENT_NAME;
  const result = await runModuleWorker(BEE_MJS, {
    args: ['cells', 'reset-budget', '--id', 'budget-cli-1b', '--reason', 'no actor supplied'],
    cwd: root2,
    env: strippedEnv,
  });
  assert(result.status !== 0, 'reset-budget without an actor must refuse');
  assert(/operator|BEE_AGENT_NAME/.test(result.stderr), `refusal should name --operator or BEE_AGENT_NAME, got stderr=${result.stderr}`);
});

await check('bee cells claim --id refuses with typed CELL_BUDGET_EXHAUSTED once the default max_claims budget is spent, through the real dispatcher (D2)', async () => {
  addCell(root2, {
    id: 'budget-cli-2',
    feature: 'demo2',
    title: 'CLI budget-exhaustion fixture',
    lane: 'small',
    action: 'Exercise the claim-door budget refusal through the dispatcher.',
    verify: 'node -e "process.exit(0)"',
  });
  for (let i = 0; i < 3; i += 1) {
    const claimed = await runBee(['cells', 'claim', '--id', 'budget-cli-2', '--worker', 'w', '--session-id', `sess-cli-budget-${i}`, '--json']);
    assert(claimed.status === 0, `claim #${i + 1} should succeed: ${claimed.stderr}`);
    await runBee(['cells', 'verify', '--id', 'budget-cli-2', '--command', 'node -e ok', '--output', 'ok', '--passed', 'true', '--session-id', `sess-cli-budget-${i}`, '--json']);
    await runBee(['cells', 'unclaim', '--id', 'budget-cli-2', '--session-id', `sess-cli-budget-${i}`, '--json']);
  }
  // No --json here (matches the CLAIMED-refusal precedent above): the CLI's
  // own error() helper writes plain text to stderr only in the non-JSON
  // branch — with --json the same error object is written to STDOUT instead
  // (bee.mjs line ~3939), so a JSON-flagged refusal must be read from stdout.
  const fourth = await runBee(['cells', 'claim', '--id', 'budget-cli-2', '--worker', 'w', '--session-id', 'sess-cli-budget-3']);
  assert(fourth.status !== 0, 'the 4th claim must refuse');
  assert(/CELL_BUDGET_EXHAUSTED/.test(fourth.stderr), `refusal should name CELL_BUDGET_EXHAUSTED, got ${fourth.stderr}`);

  const reset = await runBee(['cells', 'reset-budget', '--id', 'budget-cli-2', '--reason', 'CLI test: reopening after exhaustion', '--operator', 'cli-operator-2', '--json']);
  assert(reset.status === 0, `reset-budget should succeed: ${reset.stderr}`);
  const reopened = await runBee(['cells', 'claim', '--id', 'budget-cli-2', '--worker', 'w', '--session-id', 'sess-cli-budget-4', '--json']);
  assert(reopened.status === 0, `claim after reset should succeed: ${reopened.stderr}`);
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

// ─── state advisor-ref + Gate 3 precondition (ao-4-1 / AO3 / AO13) ───────────

function readStateFile(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, '.bee', 'state.json'), 'utf8'));
}

// Build an isolated repo with a state record, an active decision, and a plan.md
// so the advisor_ref staleness anchors have something real to bind to.
function makeAdvisorRoot({ mode = 'high-risk', feature = 'advtest', phase = 'swarming', decisionId = 'dec-1', planBody = '# plan\ncontent\n' } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-advisor-ref-'));
  fs.mkdirSync(path.join(dir, '.bee'), { recursive: true });
  writeJsonAtomic(path.join(dir, '.bee', 'onboarding.json'), { schema_version: '1.0', bee_version: '0.1.0' });
  writeState(dir, {
    ...defaultState(),
    phase,
    feature,
    mode,
    approved_gates: { context: true, shape: true, execution: false, review: false },
  });
  if (decisionId) {
    fs.writeFileSync(
      path.join(dir, '.bee', 'decisions.jsonl'),
      `${JSON.stringify({ id: decisionId, type: 'decide', date: '2026-07-17T00:00:00.000Z', decision: 'seed', scope: 'repo' })}\n`,
    );
  }
  if (planBody != null) {
    fs.mkdirSync(path.join(dir, 'docs', 'history', feature), { recursive: true });
    fs.writeFileSync(path.join(dir, 'docs', 'history', feature, 'plan.md'), planBody);
  }
  return dir;
}

function writeDigest(dir, body) {
  const p = path.join(dir, 'consult-digest.txt');
  fs.writeFileSync(p, body);
  return p;
}

// A fresh recorded ref that leaves the record non-stale (records + returns dir).
async function recordFreshRef(dir, { advisor = 'gpt-5.6-sol', body = 'DIGEST-BODY' } = {}) {
  const digest = writeDigest(dir, body);
  const r = await runBee(['state', 'advisor-ref', 'record', '--advisor', advisor, '--digest-file', digest, '--json'], dir);
  assert(r.status === 0, `recording a fresh advisor_ref should succeed: ${r.stderr}`);
  return r;
}

await check('advisor-ref record refuses when no feature is active (idle repo), zero write', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-advisor-noref-'));
  fs.mkdirSync(path.join(dir, '.bee'), { recursive: true });
  writeJsonAtomic(path.join(dir, '.bee', 'onboarding.json'), { schema_version: '1.0', bee_version: '0.1.0' });
  writeState(dir, defaultState()); // phase idle, feature null
  const digest = writeDigest(dir, 'x');
  const r = await runBee(['state', 'advisor-ref', 'record', '--advisor', 'a', '--digest-file', digest], dir);
  assert(r.status !== 0, `expected non-zero exit, got ${r.status}`);
  assert(/no active feature/.test(r.stderr), `expected a no-active-feature refusal, got stderr=${r.stderr}`);
  assert(readStateFile(dir).advisor_ref === undefined, 'a refused record must not write advisor_ref');
});

await check('advisor-ref record stamps consulted_at + verb-computed anchors + digest_head (anchors never caller-supplied)', async () => {
  const dir = makeAdvisorRoot({});
  const digest = writeDigest(dir, 'D'.repeat(600));
  const r = await runBee(['state', 'advisor-ref', 'record', '--advisor', 'gpt-5.6-sol', '--digest-file', digest, '--json'], dir);
  assert(r.status === 0, `record should succeed: ${r.stderr}`);
  const ref = readStateFile(dir).advisor_ref;
  assert(ref && typeof ref === 'object', 'advisor_ref must be written');
  assert(typeof ref.consulted_at === 'string' && ref.consulted_at.length > 0, 'consulted_at stamped');
  assert(ref.feature === 'advtest', `anchor feature should be the record's feature, got ${ref.feature}`);
  assert(ref.newest_decision_id === 'dec-1', `newest_decision_id anchor should be the active decision, got ${ref.newest_decision_id}`);
  assert(/^[0-9a-f]{64}$/.test(ref.plan_sha256), `plan_sha256 should be a real hash, got ${ref.plan_sha256}`);
  assert(ref.advisor === 'gpt-5.6-sol', `advisor identity round-trips, got ${ref.advisor}`);
  assert(ref.digest_head === 'D'.repeat(500), 'digest_head is the first 500 chars of the digest');
  // The record verb exposes no anchor flags — anchors are computed, not passed.
  const entry = COMMAND_REGISTRY.find((e) => e.name === 'state.advisor-ref.record');
  const props = Object.keys(entry.parameters.properties);
  assert(!props.includes('feature') && !props.includes('newest-decision-id') && !props.includes('plan-sha256'), `record must not accept anchor flags, got ${props.join(',')}`);
});

await check('advisor-ref show round-trips a recorded ref and reports it non-stale', async () => {
  const dir = makeAdvisorRoot({});
  await recordFreshRef(dir);
  const r = await runBee(['state', 'advisor-ref', 'show', '--json'], dir);
  assert(r.status === 0, `show should succeed: ${r.stderr}`);
  const out = JSON.parse(r.stdout);
  assert(out.advisor_ref.advisor === 'gpt-5.6-sol', `show returns the recorded advisor, got ${JSON.stringify(out)}`);
  assert(out.stale === false, `a fresh ref must read non-stale, got ${JSON.stringify(out)}`);
});

await check('Gate 3: high-risk execution approval THROWS without an advisor_ref, naming AO3/AO13, zero write', async () => {
  const dir = makeAdvisorRoot({});
  const r = await runBee(['state', 'gate', '--name', 'execution', '--approved', 'true'], dir);
  assert(r.status !== 0, `expected non-zero exit, got ${r.status}`);
  assert(/AO3\/AO13/.test(r.stderr) && /missing or stale/.test(r.stderr), `expected the AO3/AO13 refusal, got stderr=${r.stderr}`);
  assert(/advisor-ref record/.test(r.stderr), `refusal must spell the FIX consult flow, got stderr=${r.stderr}`);
  assert(readStateFile(dir).approved_gates.execution === false, 'a refused execution approval must not flip the gate');
});

await check('Gate 3: high-risk execution approval PASSES with a fresh advisor_ref', async () => {
  const dir = makeAdvisorRoot({});
  await recordFreshRef(dir);
  const r = await runBee(['state', 'gate', '--name', 'execution', '--approved', 'true', '--json'], dir);
  assert(r.status === 0, `fresh ref should let execution approve: ${r.stderr}`);
  assert(JSON.parse(r.stdout).approved_gates.execution === true, 'execution gate approved with a fresh ref');
});

await check('AO13 staleness (1/4): a feature change alone flips the ref stale', async () => {
  const dir = makeAdvisorRoot({});
  await recordFreshRef(dir);
  // Change the record's feature to one whose plan.md has IDENTICAL bytes, so
  // ONLY the feature anchor differs (decision + plan hash unchanged).
  const st = readStateFile(dir);
  fs.mkdirSync(path.join(dir, 'docs', 'history', 'advtest2'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs', 'history', 'advtest2', 'plan.md'), '# plan\ncontent\n');
  st.feature = 'advtest2';
  writeJsonAtomic(path.join(dir, '.bee', 'state.json'), st);
  const show = JSON.parse((await runBee(['state', 'advisor-ref', 'show', '--json'], dir)).stdout);
  assert(show.stale === true, `feature change must flip stale, got ${JSON.stringify(show)}`);
  assert(show.reasons.length === 1 && /feature changed/.test(show.reasons[0]), `only the feature reason should fire, got ${JSON.stringify(show.reasons)}`);
  const gate = await runBee(['state', 'gate', '--name', 'execution', '--approved', 'true'], dir);
  assert(gate.status !== 0 && /feature changed/.test(gate.stderr), `gate must refuse on feature change, got stderr=${gate.stderr}`);
});

await check('AO13 staleness (2/4): a newly logged decision alone flips the ref stale', async () => {
  const dir = makeAdvisorRoot({});
  await recordFreshRef(dir);
  fs.appendFileSync(
    path.join(dir, '.bee', 'decisions.jsonl'),
    `${JSON.stringify({ id: 'dec-2', type: 'decide', date: '2026-07-17T01:00:00.000Z', decision: 'later', scope: 'repo' })}\n`,
  );
  const show = JSON.parse((await runBee(['state', 'advisor-ref', 'show', '--json'], dir)).stdout);
  assert(show.stale === true, `a new decision must flip stale, got ${JSON.stringify(show)}`);
  assert(show.reasons.length === 1 && /new decision was logged/.test(show.reasons[0]), `only the decision reason should fire, got ${JSON.stringify(show.reasons)}`);
});

await check('AO13 staleness (3/4): a plan.md edit alone flips the ref stale', async () => {
  const dir = makeAdvisorRoot({});
  await recordFreshRef(dir);
  fs.writeFileSync(path.join(dir, 'docs', 'history', 'advtest', 'plan.md'), '# plan\nEDITED content\n');
  const show = JSON.parse((await runBee(['state', 'advisor-ref', 'show', '--json'], dir)).stdout);
  assert(show.stale === true, `a plan edit must flip stale, got ${JSON.stringify(show)}`);
  assert(show.reasons.length === 1 && /plan\.md changed/.test(show.reasons[0]), `only the plan reason should fire, got ${JSON.stringify(show.reasons)}`);
});

await check('AO13 staleness (4/4): a ref predating an execution-gate revocation flips stale', async () => {
  const dir = makeAdvisorRoot({});
  await recordFreshRef(dir);
  // Revoke execution (approved=false stamps gate_revoked_at.execution = now,
  // strictly after the consult) — the ref now predates the revocation.
  const revoke = await runBee(['state', 'gate', '--name', 'execution', '--approved', 'false', '--json'], dir);
  assert(revoke.status === 0, `revoking execution should succeed: ${revoke.stderr}`);
  assert(typeof JSON.parse(revoke.stdout).gate_revoked_at.execution === 'string', 'execution revocation must be stamped');
  const show = JSON.parse((await runBee(['state', 'advisor-ref', 'show', '--json'], dir)).stdout);
  assert(show.stale === true, `a ref older than the revocation must be stale, got ${JSON.stringify(show)}`);
  assert(show.reasons.length === 1 && /predates the most recent execution-gate revocation/.test(show.reasons[0]), `only the revocation reason should fire, got ${JSON.stringify(show.reasons)}`);
  const gate = await runBee(['state', 'gate', '--name', 'execution', '--approved', 'true'], dir);
  assert(gate.status !== 0 && /predates the most recent execution-gate revocation/.test(gate.stderr), `gate must refuse a revocation-stale ref, got stderr=${gate.stderr}`);
});

await check('non-high-risk mode: execution approval never requires an advisor_ref', async () => {
  const dir = makeAdvisorRoot({ mode: 'standard' });
  const r = await runBee(['state', 'gate', '--name', 'execution', '--approved', 'true', '--json'], dir);
  assert(r.status === 0, `standard mode must approve execution with no ref: ${r.stderr}`);
  assert(JSON.parse(r.stdout).approved_gates.execution === true, 'standard-mode execution approved');
});

await check('other gates on high-risk are untouched: context approval needs no advisor_ref', async () => {
  const dir = makeAdvisorRoot({});
  const r = await runBee(['state', 'gate', '--name', 'context', '--approved', 'true', '--json'], dir);
  assert(r.status === 0, `context gate must approve with no ref on high-risk: ${r.stderr}`);
  assert(JSON.parse(r.stdout).approved_gates.context === true, 'context gate approved');
  assert(readStateFile(dir).advisor_ref === undefined, 'context approval writes no advisor_ref');
});

await check('malformed advisor_ref reads as missing — the gate verb refuses cleanly, never crashes', async () => {
  const dir = makeAdvisorRoot({});
  const st = readStateFile(dir);
  st.advisor_ref = 'not-an-object'; // hand-corrupted fixture
  writeJsonAtomic(path.join(dir, '.bee', 'state.json'), st);
  const gate = await runBee(['state', 'gate', '--name', 'execution', '--approved', 'true'], dir);
  assert(gate.status !== 0, `a corrupt ref must refuse execution, got ${gate.status}`);
  assert(/missing or stale/.test(gate.stderr), `corrupt ref reads as missing, got stderr=${gate.stderr}`);
  assert(!/TypeError|Cannot read|is not a function/.test(gate.stderr), `must not crash on a corrupt ref, got stderr=${gate.stderr}`);
  const show = await runBee(['state', 'advisor-ref', 'show', '--json'], dir);
  assert(show.status === 0 && JSON.parse(show.stdout) === null, `show reads a corrupt ref as missing, got ${show.stdout}`);
});

// ─── summary ────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed > 0 ? 1 : 0;
