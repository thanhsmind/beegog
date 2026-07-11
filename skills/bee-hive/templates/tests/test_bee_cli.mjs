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
import { writeJsonAtomic } from '../lib/fsutil.mjs';
import { defaultState, writeState } from '../lib/state.mjs';

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.dirname(TESTS_DIR);

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

/** Run the executable-th (default 0) example of a registry entry inside `root`. */
function runExample(entryName, { exampleIndex = 0 } = {}) {
  const entry = entryByName(entryName);
  executedNames.add(entry.name);
  const scriptPath = path.join(TEMPLATES_DIR, entry.helper);
  assert(fs.existsSync(scriptPath), `${entry.name}: helper script missing at ${scriptPath}`);
  const exampleString = entry.examples[exampleIndex];
  assert(typeof exampleString === 'string' && exampleString.trim(), `${entry.name}: examples[${exampleIndex}] must be a non-empty string`);
  const args = tokenize(exampleString);
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: root,
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
    assert(typeof entry.helper === 'string' && entry.helper.trim(), `${entry.name}: missing helper`);
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

check('registry names are unique and dot-namespaced by group (status, cells.*, reservations.*, decisions.*)', () => {
  const names = COMMAND_REGISTRY.map((e) => e.name);
  assert(new Set(names).size === names.length, `duplicate names in registry: ${names.join(', ')}`);
  const groups = new Set(names.map((n) => (n.includes('.') ? n.split('.')[0] : n)));
  for (const group of groups) {
    assert(['status', 'cells', 'reservations', 'decisions'].includes(group), `unexpected group "${group}"`);
  }
});

check('registry covers every subcommand of the 4 existing helpers', () => {
  const names = new Set(COMMAND_REGISTRY.map((e) => e.name));
  const expected = [
    'status',
    'cells.list', 'cells.ready', 'cells.show', 'cells.add', 'cells.claim',
    'cells.verify', 'cells.cap', 'cells.block', 'cells.drop', 'cells.tier', 'cells.judge',
    'reservations.reserve', 'reservations.release', 'reservations.list', 'reservations.sweep',
    'decisions.log', 'decisions.supersede', 'decisions.redact', 'decisions.active', 'decisions.search',
  ];
  for (const name of expected) {
    assert(names.has(name), `registry is missing subcommand "${name}"`);
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

check('cells.list example runs against the real helper', () => {
  const result = assertExampleOk('cells.list');
  assert(result.stdout.includes('demo-1'), `expected demo-1 in list output, got ${result.stdout}`);
});

check('cells.ready example runs against the real helper', () => {
  const result = assertExampleOk('cells.ready');
  assert(result.stdout.includes('demo-1'), `demo-1 should be ready (open, no deps), got ${result.stdout}`);
});

check('cells.show example runs against the real helper', () => {
  const result = assertExampleOk('cells.show');
  assert(JSON.parse(result.stdout).id === 'demo-1', 'show should return the demo-1 cell');
});

check('cells.claim example runs against the real helper', () => {
  const result = assertExampleOk('cells.claim');
  assert(JSON.parse(result.stdout).status === 'claimed', 'demo-1 should now be claimed');
});

check('cells.verify example runs against the real helper', () => {
  const result = assertExampleOk('cells.verify');
  assert(JSON.parse(result.stdout).trace.verify_passed === true, 'verify_passed should be true');
});

check('cells.cap example runs against the real helper', () => {
  const result = assertExampleOk('cells.cap');
  assert(JSON.parse(result.stdout).status === 'capped', 'demo-1 should now be capped');
});

check('cells.judge example runs against the real helper', () => {
  const result = assertExampleOk('cells.judge');
  assert(JSON.parse(result.stdout).hits.length === 0, 'a cell.json fixture file is not a frozen-judge pattern hit');
});

check('cells.tier example runs against the real helper', () => {
  const result = assertExampleOk('cells.tier');
  assert(JSON.parse(result.stdout).tier === 'generation', 'demo-1 tier should now be "generation"');
});

check('cells.block example runs against the real helper', () => {
  const result = assertExampleOk('cells.block');
  assert(JSON.parse(result.stdout).status === 'blocked', 'demo-1 should now be blocked');
});

check('cells.drop example runs against the real helper', () => {
  const result = assertExampleOk('cells.drop');
  assert(JSON.parse(result.stdout).status === 'dropped', 'demo-1 should now be dropped');
});

check('reservations.reserve example runs against the real helper', () => {
  const result = assertExampleOk('reservations.reserve');
  assert(JSON.parse(result.stdout).ok === true, 'reserve should succeed on a fresh path');
});

check('reservations.list example runs against the real helper', () => {
  const result = assertExampleOk('reservations.list');
  assert(result.stdout.includes('worker-a'), `expected the reservation just made, got ${result.stdout}`);
});

check('reservations.release example runs against the real helper', () => {
  const result = assertExampleOk('reservations.release');
  assert(JSON.parse(result.stdout).released >= 1, 'release should free at least the one reservation just made');
});

check('reservations.sweep example runs against the real helper', () => {
  const result = assertExampleOk('reservations.sweep');
  assert(typeof JSON.parse(result.stdout).released === 'number', 'sweep should report a released count');
});

check('decisions.log example runs against the real helper', () => {
  const result = assertExampleOk('decisions.log');
  assert(typeof JSON.parse(result.stdout).id === 'string', 'log should return the new decision id');
});

check('decisions.active example runs against the real helper', () => {
  const result = assertExampleOk('decisions.active');
  assert(JSON.parse(result.stdout).decisions.length >= 1, 'the decision just logged should be active');
});

check('decisions.search example runs against the real helper', () => {
  const result = assertExampleOk('decisions.search');
  assert(JSON.parse(result.stdout).decisions.length >= 1, 'search for "registry" should match the decision just logged');
});

check('decisions.supersede example runs against the real helper (arbitrary id — event-sourced, no existence check)', () => {
  const result = assertExampleOk('decisions.supersede');
  assert(typeof JSON.parse(result.stdout).id === 'string', 'supersede should return the new event id');
});

check('decisions.redact example runs against the real helper (arbitrary id — event-sourced, no existence check)', () => {
  const result = assertExampleOk('decisions.redact');
  assert(typeof JSON.parse(result.stdout).id === 'string', 'redact should return the new event id');
});

check('status example runs against the real helper', () => {
  const result = assertExampleOk('status');
  assert(JSON.parse(result.stdout).phase === 'swarming', 'status should reflect the fixture repo\'s phase');
});

check('every registry entry had its example executed at least once (nothing silently skipped)', () => {
  const allNames = new Set(COMMAND_REGISTRY.map((e) => e.name));
  const missing = [...allNames].filter((name) => !executedNames.has(name));
  assert(missing.length === 0, `these registry entries were never exercised: ${missing.join(', ')}`);
  assert(executedNames.size === allNames.size, 'executed-name count should match registry size exactly');
});

// ─── summary ────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed > 0 ? 1 : 0;
