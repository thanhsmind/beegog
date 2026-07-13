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
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { SCHEMA_VERSION, COMMAND_REGISTRY } from '../lib/command-registry.mjs';
import { validate, isValidParameterSchema } from '../lib/validate-args.mjs';
import { addCell } from '../lib/cells.mjs';
import { writeJsonAtomic } from '../lib/fsutil.mjs';
import { defaultState, writeState } from '../lib/state.mjs';
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

function check(name, fn) {
  try {
    fn();
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

const executedNames = new Set();

/** Run the executable-th (default 0) example of a registry entry inside `root`.
 * P1 fix (review-phase-1.md): examples are now full dispatcher-form commands
 * ("bee cells show --id demo-1 --json"), consistent with each entry's own
 * `invoke` string. Execute them through the real dispatcher (bee.mjs) — the
 * surface the manifest actually advertises — rather than the legacy helper,
 * which the manifest-as-tested-contract claim did not previously cover. */
function runExample(entryName, { exampleIndex = 0, cwd = root } = {}) {
  const entry = entryByName(entryName);
  executedNames.add(entry.name);
  const exampleString = entry.examples[exampleIndex];
  assert(typeof exampleString === 'string' && exampleString.trim(), `${entry.name}: examples[${exampleIndex}] must be a non-empty string`);
  const tokens = tokenize(exampleString);
  assert(tokens[0] === 'bee', `${entry.name}: example must be full dispatcher-form starting with "bee", got "${exampleString}"`);
  const args = tokens.slice(1);
  const result = spawnSync(process.execPath, [BEE_MJS, ...args], {
    cwd,
    encoding: 'utf8',
  });
  return { entry, result };
}

function assertExampleOk(entryName, opts) {
  const { entry, result } = runExample(entryName, opts);
  assert(
    result.status === 0,
    `${entry.name} example "${entry.examples[0]}" exited ${result.status}: stdout=${result.stdout} stderr=${result.stderr}`,
  );
  return result;
}

// ─── registry shape (D3: JSON-Schema parameters, no bespoke format) ────────

check('SCHEMA_VERSION is the top-level manifest field, not per-entry', () => {
  assert(SCHEMA_VERSION === '1.0', `expected "1.0", got ${SCHEMA_VERSION}`);
  assert(
    COMMAND_REGISTRY.every((entry) => entry.schema_version === undefined),
    'schema_version must never appear on a per-entry basis',
  );
});

check('every registry entry has the required manifest fields, no TODO/stub entries', () => {
  assert(Array.isArray(COMMAND_REGISTRY) && COMMAND_REGISTRY.length > 0, 'registry must be a non-empty array');
  for (const entry of COMMAND_REGISTRY) {
    assert(typeof entry.name === 'string' && entry.name.trim(), `entry missing a name: ${JSON.stringify(entry)}`);
    assert(typeof entry.invoke === 'string' && entry.invoke.trim(), `${entry.name}: missing invoke`);
    assert(typeof entry.description === 'string' && entry.description.trim(), `${entry.name}: missing description`);
    assert(Array.isArray(entry.examples) && entry.examples.length > 0, `${entry.name}: examples must be non-empty`);
    assert('deprecated' in entry, `${entry.name}: deprecated field must be present (null when not deprecated)`);
  }
});

check('every registry entry\'s parameters is valid JSON-Schema (D3 shape: type/properties/required)', () => {
  for (const entry of COMMAND_REGISTRY) {
    assert(isValidParameterSchema(entry.parameters), `${entry.name}: parameters is not valid JSON-Schema — ${JSON.stringify(entry.parameters)}`);
    assert(entry.parameters.type === 'object', `${entry.name}: parameters.type must be "object"`);
  }
});

check('registry names are unique and dot-namespaced by group (status, cells.*, reservations.*, decisions.*, state.*, backlog.*, capture.*, reviews.*, feedback.*)', () => {
  const names = COMMAND_REGISTRY.map((e) => e.name);
  assert(new Set(names).size === names.length, `duplicate names in registry: ${names.join(', ')}`);
  const groups = new Set(names.map((n) => (n.includes('.') ? n.split('.')[0] : n)));
  for (const group of groups) {
    assert(['status', 'cells', 'reservations', 'decisions', 'state', 'backlog', 'capture', 'reviews', 'feedback'].includes(group), `unexpected group "${group}"`);
  }
});

check('registry covers every subcommand of the 4 existing helpers', () => {
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

const GROUP_NAMES = ['cells', 'reservations', 'decisions', 'state', 'backlog', 'capture', 'reviews', 'feedback'];

// Parse ONLY the stderr line that starts with "Unknown command" (trap t2:
// bee.mjs's own `cells update` verb separately emits an unrelated
// flag-level "Use: --id ID --file ..." line; anchoring on any "Use:"
// substring, rather than this specific contract line, would risk picking
// that one up under a different argv). Run inside `root`, an already
// bee-onboarded temp repo (created above) — bee.mjs refuses to run outside a
// bee repo root at all, so probing needs a real one, not a mutation of it
// (an unrecognized command never reaches any handler).
function groupRuntimeVerbs(group) {
  const result = spawnSync(process.execPath, [BEE_MJS, group, '__bee_bijection_probe__'], {
    cwd: root,
    encoding: 'utf8',
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

check('DA5 bijection: every runtime verb of bee.mjs cells/reservations/decisions/state/backlog/capture/reviews/feedback has a matching registry entry, and vice versa', () => {
  for (const group of GROUP_NAMES) {
    const runtimeVerbs = new Set(groupRuntimeVerbs(group));
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

check('DA5 bijection: the only dot-free registry entry is "status", and every entry\'s group is one of status|cells|reservations|decisions|state|backlog|capture|reviews|feedback', () => {
  const allowedGroups = new Set(['status', 'cells', 'reservations', 'decisions', 'state', 'backlog', 'capture', 'reviews', 'feedback']);
  for (const entry of COMMAND_REGISTRY) {
    const group = entry.name.includes('.') ? entry.name.split('.')[0] : entry.name;
    assert(allowedGroups.has(group), `${entry.name}: group "${group}" is not one of status|cells|reservations|decisions|state|backlog|capture|reviews|feedback`);
    if (!entry.name.includes('.')) {
      assert(entry.name === 'status', `dot-free registry entry "${entry.name}" is not "status" — only "status" may be dot-free`);
    }
  }
});

// ─── validate-args.mjs: structured rejection, never a throw ────────────────

check('validate() rejects a missing required field with the structured {field,reason,command} shape', () => {
  const showEntry = entryByName('cells.show');
  const result = validate(showEntry, {});
  assert(result.ok === false, 'missing required "id" must not validate ok');
  assert(result.error.field === 'id', `error.field should be "id", got ${JSON.stringify(result.error)}`);
  assert(result.error.reason === 'required, missing', `error.reason should name the miss, got ${result.error.reason}`);
  assert(result.error.command === 'cells.show', `error.command should be "cells.show", got ${result.error.command}`);
});

check('validate() accepts a call with every required field present', () => {
  const claimEntry = entryByName('cells.claim');
  const result = validate(claimEntry, { id: 'demo-1', worker: 'worker-a' });
  assert(result.ok === true, `expected ok:true, got ${JSON.stringify(result)}`);
});

check('validate() flags a wrong-typed value without throwing', () => {
  const tierEntry = entryByName('cells.tier');
  const result = validate(tierEntry, { id: 'demo-1', tier: 42 });
  assert(result.ok === false, 'a number where a string tier is expected must not validate ok');
  assert(result.error.field === 'tier', `error.field should be "tier", got ${JSON.stringify(result.error)}`);
  assert(result.error.command === 'cells.tier', 'error.command should name the command');
});

check('validate() never throws on a malformed commandEntry', () => {
  const result = validate({ name: 'bogus' }, { anything: 'x' });
  assert(result.ok === false, 'a command with no parameters schema must not validate ok');
  assert(result.error.command === 'bogus', 'error.command still names the command');
});

check('isValidParameterSchema() rejects a bespoke (non-JSON-Schema) shape', () => {
  assert(isValidParameterSchema({ id: 'string', worker: 'string' }) === false, 'a flat key->type map is not the D3 shape');
  assert(isValidParameterSchema({ type: 'object', properties: {}, required: ['missing'] }) === false, 'required field absent from properties must fail');
  assert(isValidParameterSchema({ type: 'object', properties: { id: { type: 'string' } }, required: [] }) === true, 'a minimal valid schema passes');
});

// ─── examples[] are tested contracts: every one runs for real, isolated ────
// Order matters here (unlike the registry's own array order): cells.add must
// run before show/claim/verify/cap/judge/tier/block/drop can succeed against
// the same fixture cell, and cells.claim needs the Gate-3 state written above.

check('cells.add example creates the fixture cell used by the rest of the chain', () => {
  const cellFixture = {
    id: 'demo-1',
    feature: 'demo',
    title: 'Demo cell for registry example test',
    lane: 'small',
    action: 'Exercise every cells.* example against a real fixture cell.',
    verify: 'node -e "process.exit(0)"',
  };
  fs.writeFileSync(path.join(root, 'cell-demo-1.json'), JSON.stringify(cellFixture, null, 2), 'utf8');
  assertExampleOk('cells.add');
  assert(fs.existsSync(path.join(root, '.bee', 'cells', 'demo-1.json')), 'demo-1 cell file should now exist');
});

check('cells.list example runs through the real dispatcher', () => {
  const result = assertExampleOk('cells.list');
  assert(result.stdout.includes('demo-1'), `expected demo-1 in list output, got ${result.stdout}`);
});

check('cells.ready example runs through the real dispatcher', () => {
  const result = assertExampleOk('cells.ready');
  assert(result.stdout.includes('demo-1'), `demo-1 should be ready (open, no deps), got ${result.stdout}`);
});

check('cells.show example runs through the real dispatcher', () => {
  const result = assertExampleOk('cells.show');
  assert(JSON.parse(result.stdout).id === 'demo-1', 'show should return the demo-1 cell');
});

check('cells.update example runs through the real dispatcher', () => {
  const patch = { title: 'Demo cell for registry example test (updated)' };
  fs.writeFileSync(path.join(root, 'cell-demo-1-update.json'), JSON.stringify(patch, null, 2), 'utf8');
  const result = assertExampleOk('cells.update');
  const updated = JSON.parse(result.stdout);
  assert(updated.id === 'demo-1', `expected demo-1, got ${result.stdout}`);
  assert(updated.title === patch.title, `expected patched title, got ${result.stdout}`);
});

check('cells.claim example runs through the real dispatcher', () => {
  const result = assertExampleOk('cells.claim');
  assert(JSON.parse(result.stdout).status === 'claimed', 'demo-1 should now be claimed');
});

check('cells.verify example runs through the real dispatcher', () => {
  const result = assertExampleOk('cells.verify');
  assert(JSON.parse(result.stdout).trace.verify_passed === true, 'verify_passed should be true');
});

check('cells.cap example runs through the real dispatcher', () => {
  const result = assertExampleOk('cells.cap');
  assert(JSON.parse(result.stdout).status === 'capped', 'demo-1 should now be capped');
});

check('cells.judge example runs through the real dispatcher', () => {
  const result = assertExampleOk('cells.judge');
  assert(JSON.parse(result.stdout).hits.length === 0, 'a cell.json fixture file is not a frozen-judge pattern hit');
});

check('cells.tier example runs through the real dispatcher', () => {
  const result = assertExampleOk('cells.tier');
  assert(JSON.parse(result.stdout).tier === 'generation', 'demo-1 tier should now be "generation"');
});

check('cells.block example runs through the real dispatcher', () => {
  const result = assertExampleOk('cells.block');
  assert(JSON.parse(result.stdout).status === 'blocked', 'demo-1 should now be blocked');
});

check('cells.drop example runs through the real dispatcher', () => {
  const result = assertExampleOk('cells.drop');
  assert(JSON.parse(result.stdout).status === 'dropped', 'demo-1 should now be dropped');
});

// cells.claim-next (fresh-session-handoff fsh-11, D2/D4) needs its OWN ready
// cell — demo-1 is dropped by this point in the chain — added directly via
// addCell (not through the dispatcher, so it never consumes a registry
// example slot of its own). The fixture repo's default pipeline (feature
// "demo") already has execution approved from the root setup above, and
// "sess-claim-next" has no prior session record, so resolvePipeline resolves
// it straight to that default pipeline (D4 zero-lane parity).
check('cells.claim-next example runs through the real dispatcher (own-lane default-pipeline pick, no prior session/lane state)', () => {
  addCell(root, {
    id: 'demo-2',
    feature: 'demo',
    title: 'Demo cell for claim-next registry example test',
    lane: 'small',
    action: 'Exercise the cells.claim-next example against a real fixture cell.',
    verify: 'node -e "process.exit(0)"',
  });
  const result = assertExampleOk('cells.claim-next');
  const parsed = JSON.parse(result.stdout);
  assert(parsed.ok === true && parsed.cell.id === 'demo-2', `expected demo-2 claimed, got ${result.stdout}`);
  assert(parsed.cell.status === 'claimed', 'demo-2 should now be claimed');
});

check('reservations.reserve example runs through the real dispatcher', () => {
  const result = assertExampleOk('reservations.reserve');
  assert(JSON.parse(result.stdout).ok === true, 'reserve should succeed on a fresh path');
});

check('reservations.reserve --session example (examples[1]) stamps the reservation with the owning session id (D3)', () => {
  const result = assertExampleOk('reservations.reserve', { exampleIndex: 1 });
  const parsed = JSON.parse(result.stdout);
  assert(parsed.ok === true, 'session-owned reserve should succeed on a fresh path');
  assert(parsed.reservation.session === 'sess-fsh7', `expected the reservation to carry session "sess-fsh7", got ${result.stdout}`);
});

check('reservations.list example runs through the real dispatcher', () => {
  const result = assertExampleOk('reservations.list');
  assert(result.stdout.includes('worker-a'), `expected the reservation just made, got ${result.stdout}`);
});

check('reservations.release example runs through the real dispatcher', () => {
  const result = assertExampleOk('reservations.release');
  assert(JSON.parse(result.stdout).released >= 1, 'release should free at least the one reservation just made');
});

check('reservations.sweep example runs through the real dispatcher', () => {
  const result = assertExampleOk('reservations.sweep');
  assert(typeof JSON.parse(result.stdout).released === 'number', 'sweep should report a released count');
});

check('decisions.log example runs through the real dispatcher', () => {
  const result = assertExampleOk('decisions.log');
  assert(typeof JSON.parse(result.stdout).id === 'string', 'log should return the new decision id');
});

check('decisions.active example runs through the real dispatcher', () => {
  const result = assertExampleOk('decisions.active');
  assert(JSON.parse(result.stdout).decisions.length >= 1, 'the decision just logged should be active');
});

check('decisions.search example runs through the real dispatcher', () => {
  const result = assertExampleOk('decisions.search');
  assert(JSON.parse(result.stdout).decisions.length >= 1, 'search for "registry" should match the decision just logged');
});

check('decisions.supersede example runs through the real dispatcher (arbitrary id — event-sourced, no existence check)', () => {
  const result = assertExampleOk('decisions.supersede');
  assert(typeof JSON.parse(result.stdout).id === 'string', 'supersede should return the new event id');
});

check('decisions.redact example runs through the real dispatcher (arbitrary id — event-sourced, no existence check)', () => {
  const result = assertExampleOk('decisions.redact');
  assert(typeof JSON.parse(result.stdout).id === 'string', 'redact should return the new event id');
});

check('status example runs through the real dispatcher', () => {
  const result = assertExampleOk('status');
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

check('state.start-feature example runs through the real dispatcher (clean idle repo)', () => {
  const result = assertExampleOk('state.start-feature', { cwd: rootState });
  assert(JSON.parse(result.stdout).feature === 'newf', `expected feature newf, got ${result.stdout}`);
});

check('state.set example runs through the real dispatcher', () => {
  const result = assertExampleOk('state.set', { cwd: rootState });
  assert(JSON.parse(result.stdout).phase === 'planning', `expected phase planning, got ${result.stdout}`);
});

check('state.gate example runs through the real dispatcher', () => {
  const result = assertExampleOk('state.gate', { cwd: rootState });
  assert(JSON.parse(result.stdout).approved_gates.execution === true, `expected execution approved, got ${result.stdout}`);
});

check('state.worker.add example runs through the real dispatcher', () => {
  const result = assertExampleOk('state.worker.add', { cwd: rootState });
  assert(JSON.parse(result.stdout).workers.some((w) => w.nickname === 'w1'), `expected worker w1, got ${result.stdout}`);
});

check('state.worker.update example runs through the real dispatcher (w1 added above)', () => {
  const result = assertExampleOk('state.worker.update', { cwd: rootState });
  assert(JSON.parse(result.stdout).workers.find((w) => w.nickname === 'w1').status === 'done', `expected w1 status done, got ${result.stdout}`);
});

check('state.worker.remove example runs through the real dispatcher', () => {
  const result = assertExampleOk('state.worker.remove', { cwd: rootState });
  assert(!JSON.parse(result.stdout).workers.some((w) => w.nickname === 'w1'), `expected w1 removed, got ${result.stdout}`);
});

check('state.worker.clear example runs through the real dispatcher', () => {
  const result = assertExampleOk('state.worker.clear', { cwd: rootState });
  assert(JSON.parse(result.stdout).workers.length === 0, `expected empty workers, got ${result.stdout}`);
});

check('state.worker.prune example runs through the real dispatcher (no workers dir -> 0 pruned)', () => {
  const result = assertExampleOk('state.worker.prune', { cwd: rootState });
  assert(JSON.parse(result.stdout).pruned.length === 0, `expected 0 pruned, got ${result.stdout}`);
});

check('state.scribing-run example runs through the real dispatcher', () => {
  const result = assertExampleOk('state.scribing-run', { cwd: rootState });
  assert(JSON.parse(result.stdout).phase === 'compounding', `expected phase compounding, got ${result.stdout}`);
});

// ─── state.lanes / state.set|gate|scribing-run --lane / state.session.* :
// fresh-session-handoff fsh-4 (D2/D4) CLI surface over fsh-3's lane store +
// session→lane binding. Lane records live at .bee/lanes/<feature>.json,
// entirely separate from rootState's default state.json above, so these
// checks can run in any order relative to the default-pipeline checks
// above/below without disturbing either.

check('state.start-feature --as-lane example (examples[1]) starts a lane record beside the untouched default state.json', () => {
  const beforeDefault = fs.readFileSync(path.join(rootState, '.bee', 'state.json'), 'utf8');
  const result = assertExampleOk('state.start-feature', { exampleIndex: 1, cwd: rootState });
  const lane = JSON.parse(result.stdout);
  assert(lane.feature === 'demo-lane', `expected lane feature demo-lane, got ${result.stdout}`);
  assert(lane.approved_gates.execution === false, `expected a fresh lane's gates all reset, got ${result.stdout}`);
  assert(fs.existsSync(path.join(rootState, '.bee', 'lanes', 'demo-lane.json')), 'lane file should now exist');
  const afterDefault = fs.readFileSync(path.join(rootState, '.bee', 'state.json'), 'utf8');
  assert(beforeDefault === afterDefault, 'default state.json must stay byte-untouched by a lane-mode start (D4)');
});

check('state.lanes example lists the demo-lane record just started', () => {
  const result = assertExampleOk('state.lanes', { cwd: rootState });
  const lanes = JSON.parse(result.stdout);
  assert(Array.isArray(lanes) && lanes.some((l) => l.feature === 'demo-lane'), `expected demo-lane in lanes list, got ${result.stdout}`);
});

check('state.set --lane example (examples[1]) routes the mutation to the lane record, not state.json', () => {
  const beforeDefault = fs.readFileSync(path.join(rootState, '.bee', 'state.json'), 'utf8');
  const result = assertExampleOk('state.set', { exampleIndex: 1, cwd: rootState });
  const lane = JSON.parse(result.stdout);
  assert(lane.feature === 'demo-lane' && lane.phase === 'planning', `expected lane phase planning, got ${result.stdout}`);
  const afterDefault = fs.readFileSync(path.join(rootState, '.bee', 'state.json'), 'utf8');
  assert(beforeDefault === afterDefault, 'default state.json must stay byte-untouched by a --lane routed set');
});

check('state.gate --lane example (examples[1]) approves a gate on the lane record only', () => {
  const result = assertExampleOk('state.gate', { exampleIndex: 1, cwd: rootState });
  const lane = JSON.parse(result.stdout);
  assert(lane.feature === 'demo-lane' && lane.approved_gates.execution === true, `expected lane execution gate approved, got ${result.stdout}`);
});

check('state.scribing-run --lane example (examples[1]) stamps the lane record only', () => {
  const result = assertExampleOk('state.scribing-run', { exampleIndex: 1, cwd: rootState });
  const lane = JSON.parse(result.stdout);
  assert(
    lane.feature === 'demo-lane' && lane.phase === 'compounding' && lane.last_scribing_run.feature === 'demo-lane',
    `expected lane scribing stamp, got ${result.stdout}`,
  );
});

check('state.set --lane refuses loudly when the named lane does not exist, no partial write (must-have truth)', () => {
  const result = spawnSync(process.execPath, [BEE_MJS, 'state', 'set', '--lane', 'ghost-lane', '--phase', 'planning'], {
    cwd: rootState,
    encoding: 'utf8',
  });
  assert(result.status !== 0, `expected non-zero exit, got ${result.status}`);
  assert(/ghost-lane/.test(result.stderr) && /does not exist/.test(result.stderr), `expected a named-lane refusal, got stderr=${result.stderr}`);
  assert(!fs.existsSync(path.join(rootState, '.bee', 'lanes', 'ghost-lane.json')), 'no partial lane file should be created on refusal');
});

check('state.gate --lane refuses loudly over a corrupt lane record, file left byte-untouched (must-have truth)', () => {
  const corruptPath = path.join(rootState, '.bee', 'lanes', 'corrupt-lane.json');
  fs.writeFileSync(corruptPath, '{ this is not a valid lane record', 'utf8');
  const before = fs.readFileSync(corruptPath, 'utf8');
  const result = spawnSync(
    process.execPath,
    [BEE_MJS, 'state', 'gate', '--lane', 'corrupt-lane', '--name', 'execution', '--approved', 'true'],
    { cwd: rootState, encoding: 'utf8' },
  );
  assert(result.status !== 0, `expected non-zero exit, got ${result.status}`);
  const after = fs.readFileSync(corruptPath, 'utf8');
  assert(before === after, 'corrupt lane file must be byte-identical after the refused mutation');
});

check('state.set --lane refuses when combined with --feature (a lane\'s identity is not a mutable field)', () => {
  const result = spawnSync(
    process.execPath,
    [BEE_MJS, 'state', 'set', '--lane', 'demo-lane', '--feature', 'renamed-lane', '--phase', 'planning'],
    { cwd: rootState, encoding: 'utf8' },
  );
  assert(result.status !== 0, `expected non-zero exit, got ${result.status}`);
  assert(/--feature/.test(result.stderr) && /--lane/.test(result.stderr), `expected a --feature/--lane conflict refusal, got stderr=${result.stderr}`);
});

check('state.session.list example lists a manually-seeded session record', () => {
  writeJsonAtomic(path.join(rootState, '.bee', 'sessions', 'sess-demo.json'), {
    id: 'sess-demo',
    started_at: new Date().toISOString(),
    last_heartbeat: new Date().toISOString(),
  });
  const result = assertExampleOk('state.session.list', { cwd: rootState });
  assert(result.stdout.includes('sess-demo'), `expected sess-demo in session list, got ${result.stdout}`);
});

check('state.session.bind example binds the seeded session to demo-lane', () => {
  const result = assertExampleOk('state.session.bind', { cwd: rootState });
  const session = JSON.parse(result.stdout);
  assert(session.id === 'sess-demo' && session.lane === 'demo-lane', `expected sess-demo bound to demo-lane, got ${result.stdout}`);
});

check('state.session.unbind example removes the binding (lane key omitted, not null)', () => {
  const result = assertExampleOk('state.session.unbind', { cwd: rootState });
  const session = JSON.parse(result.stdout);
  assert(session.id === 'sess-demo' && !('lane' in session), `expected the lane key omitted after unbind, got ${result.stdout}`);
});

// ─── state.handoff.*: fresh-session-handoff fsh-9 (D1) — the guarded two-kind
// handoff lifecycle CLI surface. Uses its own prev/next cell + claim fixtures
// inside rootState so it never disturbs the demo-lane/session rows above.

check('state.handoff.write --kind pause example (examples[0]) writes a free-form pause handoff', () => {
  const result = assertExampleOk('state.handoff.write', { cwd: rootState });
  const record = JSON.parse(result.stdout);
  assert(record.kind === 'pause', `expected a pause handoff, got ${result.stdout}`);
  assert(fs.existsSync(path.join(rootState, '.bee', 'HANDOFF.json')), 'HANDOFF.json should now exist');
});

check('state.handoff.show example shows the pause handoff just written', () => {
  const result = assertExampleOk('state.handoff.show', { cwd: rootState });
  const record = JSON.parse(result.stdout);
  assert(record.kind === 'pause', `expected pause kind on show, got ${result.stdout}`);
});

check('state.handoff.write --kind planned-next example (examples[1]) succeeds once its cap/claim fixtures are seeded, carries writer_session/previous_cell/next_cell', () => {
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
  const result = assertExampleOk('state.handoff.write', { exampleIndex: 1, cwd: rootState });
  const record = JSON.parse(result.stdout);
  assert(
    record.kind === 'planned-next' &&
      record.writer_session === 'sess-handoff-writer' &&
      record.previous_cell === 'handoff-prev' &&
      record.next_cell === 'handoff-next',
    `expected the carried planned-next identifiers, got ${result.stdout}`,
  );
});

check('state.handoff.write --kind planned-next refuses (typed, non-zero exit) when the previous cell is not capped, no partial file (must-have truth)', () => {
  const result = spawnSync(
    process.execPath,
    [
      BEE_MJS,
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
    { cwd: rootState, encoding: 'utf8' },
  );
  assert(result.status !== 0, `expected non-zero exit, got ${result.status}`);
  assert(/capped/.test(result.stderr), `expected a capped-precondition refusal, got stderr=${result.stderr}`);
});

check('state.handoff.adopt example transfers the carried claim and clears the handoff', () => {
  const result = assertExampleOk('state.handoff.adopt', { cwd: rootState });
  const parsed = JSON.parse(result.stdout);
  assert(parsed.ok === true, `expected adoption to succeed, got ${result.stdout}`);
  assert(!fs.existsSync(path.join(rootState, '.bee', 'HANDOFF.json')), 'handoff should be cleared after adopt');
  const claim = JSON.parse(fs.readFileSync(path.join(rootState, '.bee', 'claims', 'handoff-next.json'), 'utf8'));
  assert(claim.session === 'sess-handoff-adopter', `expected the claim transferred to the adopting session, got ${JSON.stringify(claim)}`);
});

check('state.handoff.show reports no handoff (null result) once cleared; the text form (no --json) prints "No handoff."', () => {
  const result = assertExampleOk('state.handoff.show', { cwd: rootState });
  assert(JSON.parse(result.stdout) === null, `expected a null result once cleared, got ${result.stdout}`);
  const textResult = spawnSync(process.execPath, [BEE_MJS, 'state', 'handoff', 'show'], { cwd: rootState, encoding: 'utf8' });
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

check('backlog.counts example runs through the real dispatcher', () => {
  const result = assertExampleOk('backlog.counts', { cwd: rootBacklogCapture });
  const counts = JSON.parse(result.stdout);
  assert(counts.done === 1 && counts.proposed === 1 && counts.inFlight === 1, `expected 1/1/1, got ${result.stdout}`);
});

check('backlog.rank example runs through the real dispatcher', () => {
  const result = assertExampleOk('backlog.rank', { cwd: rootBacklogCapture });
  assert(Array.isArray(JSON.parse(result.stdout).order), `expected an order array, got ${result.stdout}`);
});

check('backlog.badges example runs through the real dispatcher', () => {
  const result = assertExampleOk('backlog.badges', { cwd: rootBacklogCapture });
  assert(typeof JSON.parse(result.stdout).badges === 'string', `expected a badges string, got ${result.stdout}`);
});

check('backlog.add example runs through the real dispatcher and appends to .bee/backlog.jsonl', () => {
  const result = assertExampleOk('backlog.add', { cwd: rootBacklogCapture });
  const row = JSON.parse(result.stdout);
  assert(row.type === 'friction' && row.severity === 'P2', `expected the example row, got ${result.stdout}`);
  assert(fs.existsSync(path.join(rootBacklogCapture, '.bee', 'backlog.jsonl')), 'backlog.jsonl should now exist');
});

check('capture.add example runs through the real dispatcher and returns a stub id', () => {
  const result = assertExampleOk('capture.add', { cwd: rootBacklogCapture });
  const stub = JSON.parse(result.stdout);
  assert(typeof stub.id === 'string' && stub.id, `expected a stub id, got ${result.stdout}`);
});

check('capture.list example runs through the real dispatcher and includes the stub just added', () => {
  const result = assertExampleOk('capture.list', { cwd: rootBacklogCapture });
  const listed = JSON.parse(result.stdout);
  assert(listed.count >= 1, `expected at least 1 pending stub, got ${result.stdout}`);
});

check('capture.flush example runs through the real dispatcher against a pre-seeded stub id', () => {
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
  const result = assertExampleOk('capture.flush', { cwd: rootBacklogCapture });
  const record = JSON.parse(result.stdout);
  assert(record.id === seededId, `expected the seeded stub id flushed, got ${result.stdout}`);
});

check('capture.count example runs through the real dispatcher', () => {
  const result = assertExampleOk('capture.count', { cwd: rootBacklogCapture });
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

function runBeeReviewsFeedbackFixture(args) {
  return spawnSync(process.execPath, [BEE_MJS, ...args], { cwd: rootReviewsFeedback, encoding: 'utf8' });
}

check('reviews fixture setup: a capped behavior_change cell ("ok-1") with recorded verification_evidence exists in scope', () => {
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
  const added = runBeeReviewsFeedbackFixture(['cells', 'add', '--file', 'cell-ok-1.json', '--json']);
  assert(added.status === 0, `cells add setup failed: ${added.status}: stdout=${added.stdout} stderr=${added.stderr}`);

  const claimed = runBeeReviewsFeedbackFixture(['cells', 'claim', '--id', 'ok-1', '--worker', 'worker-rev', '--json']);
  assert(claimed.status === 0, `cells claim setup failed: ${claimed.status}: stdout=${claimed.stdout} stderr=${claimed.stderr}`);

  const verified = runBeeReviewsFeedbackFixture(['cells', 'verify', '--id', 'ok-1', '--command', 'node -e 0', '--output', 'ok', '--passed', 'true', '--json']);
  assert(verified.status === 0, `cells verify setup failed: ${verified.status}: stdout=${verified.stdout} stderr=${verified.stderr}`);

  const capped = spawnSync(
    process.execPath,
    [BEE_MJS, 'cells', 'cap', '--id', 'ok-1', '--outcome', 'done', '--files', 'a.js', '--behavior-change', '--evidence-stdin', '--json'],
    { cwd: rootReviewsFeedback, encoding: 'utf8', input: JSON.stringify({ red_failure_evidence: 'prior behavior', verification_run: 'node -e 0' }) },
  );
  assert(capped.status === 0, `cells cap setup failed: ${capped.status}: stdout=${capped.stdout} stderr=${capped.stderr}`);
  assert(JSON.parse(capped.stdout).trace.verification_evidence, 'ok-1 should carry recorded verification_evidence for the A10 preflight');
});

check('reviews.create example runs through the real dispatcher (A10 preflight satisfied by the ok-1 fixture cell)', () => {
  const scope = {
    id: 'rev-example',
    requested_by: 'user',
    scope_description: 'review the demo3 feature',
    included: [{ type: 'cell', id: 'ok-1' }],
    baseline: 'sha-base',
    head: 'sha-head',
  };
  fs.writeFileSync(path.join(rootReviewsFeedback, 'scope.json'), JSON.stringify(scope), 'utf8');
  const result = assertExampleOk('reviews.create', { cwd: rootReviewsFeedback });
  assert(JSON.parse(result.stdout).id === 'rev-example', `expected rev-example, got ${result.stdout}`);
});

check('reviews.list example runs through the real dispatcher', () => {
  const result = assertExampleOk('reviews.list', { cwd: rootReviewsFeedback });
  assert(result.stdout.includes('rev-example'), `expected rev-example in list output, got ${result.stdout}`);
});

check('reviews.show example runs through the real dispatcher', () => {
  const result = assertExampleOk('reviews.show', { cwd: rootReviewsFeedback });
  assert(JSON.parse(result.stdout).id === 'rev-example', `expected rev-example, got ${result.stdout}`);
});

check('reviews.record example runs through the real dispatcher', () => {
  fs.writeFileSync(path.join(rootReviewsFeedback, 'finding.json'), JSON.stringify({ severity: 'P2', description: 'nit' }), 'utf8');
  const result = assertExampleOk('reviews.record', { cwd: rootReviewsFeedback });
  assert(JSON.parse(result.stdout).id === 'rev-example', `expected the updated rev-example session, got ${result.stdout}`);
});

check('reviews.candidate.add example runs through the real dispatcher (nested 3-token verb)', () => {
  const result = assertExampleOk('reviews.candidate.add', { cwd: rootReviewsFeedback });
  const entry = JSON.parse(result.stdout);
  assert(entry.feature === 'demo3' && entry.mode === 'standard', `expected the example candidate, got ${result.stdout}`);
});

check('reviews.candidates example runs through the real dispatcher (flat 2-token verb, distinct from candidate add)', () => {
  const result = assertExampleOk('reviews.candidates', { cwd: rootReviewsFeedback });
  const entries = JSON.parse(result.stdout);
  assert(entries.length === 1 && entries[0].feature === 'demo3', `expected the candidate just added, got ${result.stdout}`);
});

check('reviews.status example runs through the real dispatcher', () => {
  const result = assertExampleOk('reviews.status', { cwd: rootReviewsFeedback });
  const summary = JSON.parse(result.stdout);
  assert(summary.counts.verified === 1, `expected 1 verified candidate, got ${result.stdout}`);
});

check('feedback.digest example runs through the real dispatcher', () => {
  const result = assertExampleOk('feedback.digest', { cwd: rootReviewsFeedback });
  assert(typeof JSON.parse(result.stdout).digest === 'object', `expected a digest object, got ${result.stdout}`);
});

check('feedback.count example runs through the real dispatcher', () => {
  const result = assertExampleOk('feedback.count', { cwd: rootReviewsFeedback });
  assert(typeof JSON.parse(result.stdout).entries === 'number', `expected a numeric entries count, got ${result.stdout}`);
});

check('feedback.collect example runs through the real dispatcher', () => {
  const result = assertExampleOk('feedback.collect', { cwd: rootReviewsFeedback });
  assert(typeof JSON.parse(result.stdout).counts === 'object', `expected a counts object, got ${result.stdout}`);
});

check('feedback.rank example runs through the real dispatcher', () => {
  const result = assertExampleOk('feedback.rank', { cwd: rootReviewsFeedback });
  assert(Array.isArray(JSON.parse(result.stdout)), `expected a ranked cluster array, got ${result.stdout}`);
});

check('every registry entry had its example executed at least once (nothing silently skipped)', () => {
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

function runBee(args, cwd = root2) {
  return spawnSync(process.execPath, [BEE_MJS, ...args], { cwd, encoding: 'utf8' });
}

// ─── pure-logic unit tests (direct import, no spawn — no side effects since
// bee.mjs guards main() behind a direct-run check) ──────────────────────────

check('splitCommandTokens separates leading command tokens from the flag section', () => {
  const { leading, rest } = splitCommandTokens(['cells', 'show', '--id', 'demo-1', '--json']);
  assert(leading.length === 2 && leading[0] === 'cells' && leading[1] === 'show', `leading: ${JSON.stringify(leading)}`);
  assert(rest.length === 3 && rest[0] === '--id', `rest: ${JSON.stringify(rest)}`);
});

check('resolveCommand special-cases "status" (no subcommand) and dot-joins other groups', () => {
  assert(resolveCommand([]).commandName === null, 'empty leading -> no command');
  assert(resolveCommand(['status']).commandName === 'status', 'status alone');
  const statusExtra = resolveCommand(['status', 'extra']);
  assert(statusExtra.commandName === 'status' && statusExtra.extra.length === 1, `status extra: ${JSON.stringify(statusExtra)}`);
  const ready = resolveCommand(['cells', 'ready']);
  assert(ready.commandName === 'cells.ready' && ready.extra.length === 0, `cells ready: ${JSON.stringify(ready)}`);
  const bareGroup = resolveCommand(['cells']);
  assert(bareGroup.commandName === 'cells' && bareGroup.extra.length === 0, 'a bare group with no action stays ungrouped (misses the registry -> nearest-match)');
});

check('parseFlags treats json/stdin/behavior-change/evidence-stdin/active-only as flag-alone booleans', () => {
  const { flags, json } = parseFlags(['--stdin', '--json']);
  assert(json === true, 'json should be stripped into the json flag');
  assert(flags.stdin === true, 'stdin should be boolean true with no value consumed');
});

check('parseFlags requires an explicit value for a non-boolean-alone flag, even one the schema types boolean (cells.verify --passed)', () => {
  const { flags, error } = parseFlags(['--id', 'demo-1', '--command', 'manual check', '--passed', 'true']);
  assert(!error, `unexpected parse error: ${JSON.stringify(error)}`);
  assert(flags.id === 'demo-1' && flags.command === 'manual check' && flags.passed === 'true', `flags: ${JSON.stringify(flags)}`);
});

check('parseFlags returns a structured error (never throws) for a flag missing its value', () => {
  const { error } = parseFlags(['--id']);
  assert(error && error.field === 'id' && /requires a value/.test(error.reason), `error: ${JSON.stringify(error)}`);
});

check('parseFlags returns a structured error for a stray non-flag argument', () => {
  const { error } = parseFlags(['not-a-flag']);
  assert(error && /unexpected argument/.test(error.reason), `error: ${JSON.stringify(error)}`);
});

check("parseFlags supports the --name=value form for any flag, taking precedence over the boolean-alone default", () => {
  const { flags } = parseFlags(['--id=demo-1', '--behavior-change=false']);
  assert(flags.id === 'demo-1', 'id should read from the = form');
  assert(flags['behavior-change'] === 'false', '= form overrides flag-alone boolean handling, matching the original CLIs\' own eq-first parsing order');
});

check('nearestCommandName suggests the closest real command for a typo', () => {
  assert(nearestCommandName('cells.lst') === 'cells.list', `got ${nearestCommandName('cells.lst')}`);
  assert(nearestCommandName('staus') === 'status', `got ${nearestCommandName('staus')}`);
});

check('deprecatedRedirect is null for a live (non-deprecated) registry entry', () => {
  assert(deprecatedRedirect(entryByName('status')) === null, 'status.deprecated is null -> no redirect');
});

check('deprecatedRedirect returns a structured redirect naming use_instead for a synthetic deprecated entry, without executing anything', () => {
  const fakeEntry = { name: 'cells.oldAction', deprecated: { since: '2026-01-01', use_instead: 'cells.newAction' } };
  const redirect = deprecatedRedirect(fakeEntry);
  assert(redirect && redirect.result.ok === false && redirect.result.deprecated === true, `redirect: ${JSON.stringify(redirect)}`);
  assert(redirect.result.use_instead === 'cells.newAction', 'use_instead should name the replacement');
  assert(/use "cells.newAction" instead/.test(redirect.text), `text: ${redirect.text}`);
});

check('computeManifestHash is deterministic and sensitive to content', () => {
  const h1 = computeManifestHash();
  const h2 = computeManifestHash();
  assert(h1 === h2, 'the same registry content must hash the same');
  const h3 = computeManifestHash([{ name: 'x' }], '1.0');
  assert(h3 !== h1, 'different registry content must hash differently');
});

// ─── end-to-end: --help / --help --json (D3 tool-schema manifest) ─────────

check('bee --help --json parses as valid JSON and lists every existing subcommand', () => {
  const result = runBee(['--help', '--json']);
  assert(result.status === 0, `exit ${result.status}: ${result.stderr}`);
  const manifest = JSON.parse(result.stdout);
  assert(manifest.schema_version === SCHEMA_VERSION, `schema_version: ${manifest.schema_version}`);
  const names = new Set(manifest.commands.map((c) => c.name));
  for (const entry of COMMAND_REGISTRY) {
    assert(names.has(entry.name), `--help --json is missing "${entry.name}"`);
  }
  assert(manifest.commands.every((c) => !('helper' in c)), 'the public manifest must never leak the internal `helper` dispatch field');
});

check('bee --help renders non-empty prose naming known commands', () => {
  const result = runBee(['--help']);
  assert(result.status === 0, `exit ${result.status}: ${result.stderr}`);
  assert(result.stdout.includes('bee cells ready'), `expected "bee cells ready" invoke text, got: ${result.stdout}`);
});

// ─── demo-2 fixture chain, driven entirely through the bee.mjs dispatcher ──

check('bee cells add creates the demo-2 fixture cell used by the rest of this dispatcher chain', () => {
  const cellFixture = {
    id: 'demo-2',
    feature: 'demo2',
    title: 'Demo cell for bee.mjs dispatcher test',
    lane: 'small',
    action: 'Exercise every cells.* command through the bee.mjs dispatcher.',
    verify: 'node -e "process.exit(0)"',
  };
  fs.writeFileSync(path.join(root2, 'cell-demo-2.json'), JSON.stringify(cellFixture, null, 2), 'utf8');
  const result = runBee(['cells', 'add', '--file', 'cell-demo-2.json', '--json']);
  assert(result.status === 0, `exit ${result.status}: stdout=${result.stdout} stderr=${result.stderr}`);
  assert(fs.existsSync(path.join(root2, '.bee', 'cells', 'demo-2.json')), 'demo-2 cell file should now exist');
});

check('bee cells list --json includes demo-2', () => {
  const result = runBee(['cells', 'list', '--json']);
  assert(result.status === 0, `exit ${result.status}`);
  const cells = JSON.parse(result.stdout);
  assert(cells.some((c) => c.id === 'demo-2'), `expected demo-2 in list, got ${result.stdout}`);
});

check('bee cells ready --json lists demo-2 (open, no deps)', () => {
  const result = runBee(['cells', 'ready', '--json']);
  assert(result.status === 0, `exit ${result.status}: stdout=${result.stdout} stderr=${result.stderr}`);
  assert(JSON.parse(result.stdout).some((c) => c.id === 'demo-2'), 'demo-2 should be ready (open, no deps)');
});

check('bee cells show --id demo-2 --json returns the cell', () => {
  const result = runBee(['cells', 'show', '--id', 'demo-2', '--json']);
  assert(JSON.parse(result.stdout).id === 'demo-2', `expected demo-2, got ${result.stdout}`);
});

check('bee cells update patches an allowed field on the open demo-2 fixture, through the dispatcher', () => {
  const patch = { title: 'Demo cell for bee.mjs dispatcher test (updated)' };
  fs.writeFileSync(path.join(root2, 'cell-demo-2-update.json'), JSON.stringify(patch, null, 2), 'utf8');
  const result = runBee(['cells', 'update', '--id', 'demo-2', '--file', 'cell-demo-2-update.json', '--json']);
  assert(result.status === 0, `exit ${result.status}: stdout=${result.stdout} stderr=${result.stderr}`);
  assert(JSON.parse(result.stdout).title === patch.title, `expected patched title, got ${result.stdout}`);
});

check('bee cells update refuses a frozen key (status)', () => {
  const patch = { status: 'capped' };
  fs.writeFileSync(path.join(root2, 'cell-demo-2-frozen.json'), JSON.stringify(patch, null, 2), 'utf8');
  const result = runBee(['cells', 'update', '--id', 'demo-2', '--file', 'cell-demo-2-frozen.json']);
  assert(result.status === 1, `expected exit 1, got ${result.status}: stdout=${result.stdout} stderr=${result.stderr}`);
  assert(/status/.test(result.stderr), `expected the frozen field named in stderr, got: ${result.stderr}`);
});

check('bee cells claim --id demo-2 --worker claims it', () => {
  const result = runBee(['cells', 'claim', '--id', 'demo-2', '--worker', 'worker-test', '--json']);
  assert(JSON.parse(result.stdout).status === 'claimed', `expected claimed, got ${result.stdout}`);
});

check('bee cells verify --passed true (explicit "true" argument, not a bare flag) records a passing verify', () => {
  const result = runBee([
    'cells', 'verify', '--id', 'demo-2', '--command', 'manual check', '--output', '0 failing', '--passed', 'true', '--json',
  ]);
  assert(result.status === 0, `exit ${result.status}: stdout=${result.stdout} stderr=${result.stderr}`);
  assert(JSON.parse(result.stdout).trace.verify_passed === true, `expected verify_passed true, got ${result.stdout}`);
});

check('bee cells cap --id demo-2 caps the cell', () => {
  const result = runBee(['cells', 'cap', '--id', 'demo-2', '--outcome', 'dispatcher test cap', '--files', 'cell-demo-2.json', '--json']);
  assert(JSON.parse(result.stdout).status === 'capped', `expected capped, got ${result.stdout}`);
});

check('bee cells judge --id demo-2 reports no frozen-judge hits', () => {
  const result = runBee(['cells', 'judge', '--id', 'demo-2', '--json']);
  assert(JSON.parse(result.stdout).hits.length === 0, `expected no hits, got ${result.stdout}`);
});

check('bee cells tier --id demo-2 --tier generation sets the tier', () => {
  const result = runBee(['cells', 'tier', '--id', 'demo-2', '--tier', 'generation', '--json']);
  assert(JSON.parse(result.stdout).tier === 'generation', `expected generation, got ${result.stdout}`);
});

check('bee cells block --id demo-2 --reason blocks the cell', () => {
  const result = runBee(['cells', 'block', '--id', 'demo-2', '--reason', 'dispatcher test block', '--json']);
  assert(JSON.parse(result.stdout).status === 'blocked', `expected blocked, got ${result.stdout}`);
});

check('bee cells drop --id demo-2 --reason drops the cell', () => {
  const result = runBee(['cells', 'drop', '--id', 'demo-2', '--reason', 'dispatcher test drop', '--json']);
  assert(JSON.parse(result.stdout).status === 'dropped', `expected dropped, got ${result.stdout}`);
});

// ─── reservations, through the dispatcher ──────────────────────────────────

check('bee reservations reserve/list/release/sweep round-trip through the dispatcher', () => {
  const reserveResult = runBee(['reservations', 'reserve', '--agent', 'worker-test', '--cell', 'demo-2', '--path', 'src/dispatcher-test.js', '--json']);
  assert(JSON.parse(reserveResult.stdout).ok === true, `reserve failed: ${reserveResult.stdout}`);

  const listResult = runBee(['reservations', 'list', '--active-only', '--json']);
  assert(listResult.stdout.includes('worker-test'), `expected worker-test in list, got ${listResult.stdout}`);

  const releaseResult = runBee(['reservations', 'release', '--agent', 'worker-test', '--json']);
  assert(JSON.parse(releaseResult.stdout).released >= 1, `expected at least 1 released, got ${releaseResult.stdout}`);

  const sweepResult = runBee(['reservations', 'sweep', '--json']);
  assert(typeof JSON.parse(sweepResult.stdout).released === 'number', `expected a released count, got ${sweepResult.stdout}`);
});

check('bee reservations reserve returns a CONFLICT (exit 1) when another agent already holds an overlapping path', () => {
  const first = runBee(['reservations', 'reserve', '--agent', 'agent-a', '--cell', 'demo-2', '--path', 'src/conflict-test.js', '--json']);
  assert(JSON.parse(first.stdout).ok === true, `first reserve should succeed: ${first.stdout}`);
  const second = runBee(['reservations', 'reserve', '--agent', 'agent-b', '--cell', 'demo-2', '--path', 'src/conflict-test.js', '--json']);
  assert(second.status === 1, `expected exit 1 on conflict, got ${second.status}`);
  assert(JSON.parse(second.stdout).ok === false, `expected ok:false on conflict, got ${second.stdout}`);
});

// ─── decisions, through the dispatcher ─────────────────────────────────────

check('bee decisions log/active/search round-trip through the dispatcher', () => {
  const logResult = runBee(['decisions', 'log', '--decision', 'Use the unified bee.mjs dispatcher', '--rationale', 'Single discoverable CLI surface', '--json']);
  assert(typeof JSON.parse(logResult.stdout).id === 'string', `log failed: ${logResult.stdout}`);

  const activeResult = runBee(['decisions', 'active', '--recent', '5', '--json']);
  assert(JSON.parse(activeResult.stdout).decisions.length >= 1, `expected at least 1 active decision, got ${activeResult.stdout}`);

  const searchResult = runBee(['decisions', 'search', '--text', 'dispatcher', '--json']);
  assert(JSON.parse(searchResult.stdout).decisions.length >= 1, `expected the logged decision to match, got ${searchResult.stdout}`);
});

// ─── malformed input / unknown command (never a bare not-found or a stack trace) ─

check('a call missing a required parameter returns a structured {ok:false,error} shape, never a stack trace', () => {
  const result = runBee(['cells', 'show', '--json']);
  assert(result.status === 1, `expected exit 1, got ${result.status}`);
  const parsed = JSON.parse(result.stdout);
  assert(parsed.ok === false && parsed.error && parsed.error.field === 'id', `expected structured id-missing error, got ${result.stdout}`);
  assert(!result.stdout.includes('at Object.'), 'a stack trace must never reach stdout');
});

check('an unrecognized command returns a nearest-match suggestion, not a bare not-found', () => {
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
  const result = runBee(['staus', '--json']);
  assert(result.status === 1, `expected exit 1, got ${result.status}`);
  const parsed = JSON.parse(result.stdout);
  assert(parsed.ok === false && parsed.suggestion === 'status', `expected suggestion "status", got ${result.stdout}`);
});

check('a call shaped like a bee.mjs invocation with an unregistered command is denied with a structured error, never executed', () => {
  const result = runBee(['not', 'a-real-command', '--json']);
  assert(result.status === 1, `expected exit 1, got ${result.status}`);
  assert(JSON.parse(result.stdout).ok === false, `expected ok:false, got ${result.stdout}`);
});

// ─── manifest content-hash drift ───────────────────────────────────────────

check('a registry content change surfaces manifest_changed on stderr, never reshaping stdout (P1 fix, review-phase-1.md)', () => {
  // Baseline call: persists the real hash to .bee/manifest-hash.json.
  const baseline = runBee(['status', '--json']);
  assert(baseline.status === 0, `baseline exit ${baseline.status}`);
  const baselineBody = JSON.parse(baseline.stdout);
  assert(!('manifest_changed' in baselineBody), 'steady state must never carry manifest_changed on stdout (byte-parity requirement)');

  // Simulate drift by corrupting the persisted hash directly — this cell
  // never edits the real command-registry.mjs (out of its file scope).
  const hashFile = path.join(root2, '.bee', 'manifest-hash.json');
  writeJsonAtomic(hashFile, { hash: 'deadbeef', checked_at: new Date().toISOString() });

  const drifted = runBee(['status', '--json']);
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
  const settled = runBee(['status', '--json']);
  assert(!settled.stderr.includes('manifest_changed'), 'the hash should self-heal to steady state after one drift report');
});

// ─── summary ────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed > 0 ? 1 : 0;
