#!/usr/bin/env node
// test_bee_write_guard_hook.mjs — end-to-end integration tests for
// hooks/bee-write-guard.mjs itself (harness-integration-3, D4). Spawns the
// real hook script as a subprocess with crafted PreToolUse stdin payloads —
// test_lib.mjs's unit tests exercise lib/guards.mjs's exported functions
// directly, but cannot reach this file's own dispatch logic (payload
// parsing, the shared `denial` variable, the outer try/catch). Every fixture
// repo is an isolated temp dir under os.tmpdir(): the real checkout's own
// .bee/ state is never touched.
//
// Covers the cell's three must_haves:
//   (a) a malformed bee.mjs-shaped Bash call is denied, structured correction
//       on stderr, before it would execute
//   (b) the existing gate guard, reservation guard, and privacy/scout guard
//       behave exactly as before this cell — zero regression
//   (c) the new check's logic never overwrites or discards a denial already
//       computed by an existing check, even when forced to throw

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { writeJsonAtomic } from '../lib/fsutil.mjs';

const TESTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.dirname(TESTS_DIR);
const TEMPLATES_LIB_DIR = path.join(TEMPLATES_DIR, 'lib');
const REPO_ROOT = path.resolve(TESTS_DIR, '..', '..', '..', '..');
const HOOK_PATH = path.join(REPO_ROOT, 'hooks', 'bee-write-guard.mjs');

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

// ─── fixture repo builder ──────────────────────────────────────────────────
// Mirrors onboard_bee.mjs's own vendoring: the hook dynamically imports
// modules from `<root>/.bee/bin/lib/*.mjs` (never from the template tree
// directly), so a realistic fixture must vendor real copies there — the
// exact prerequisite this cell's own action names (validating iteration 1,
// Blocker 4).
// Must track command-registry.mjs's transitive lib imports: it imports
// reviews.mjs (REVIEW_MODES), which in turn imports cells.mjs (readCell),
// which in turn imports backlog.mjs (featureBacklogRank). state.mjs also
// imports claims.mjs (fresh-session-handoff fsh-3, session/lane primitives).
// Missing any of these here throws at import time in the fixture root, which
// makes the hook's own resolver fail open (denial tests regress to exit 0) —
// a pre-existing baseline gap (state.mjs's claims.mjs import and cells.mjs's
// backlog.mjs import both shipped after this list was last updated) fixed in
// passing here since this file is in scope for this cell.
const VENDORED_LIB_MODULES = [
  'fsutil.mjs',
  'state.mjs',
  'reservations.mjs',
  'guards.mjs',
  'validate-args.mjs',
  'command-registry.mjs',
  'reviews.mjs',
  'cells.mjs',
  'claims.mjs',
  'backlog.mjs',
];

// A valid-shaped registry whose one entry throws when its `parameters`
// getter is read — forces check (d)'s own parsing logic to throw (must_have
// c) without any import-time syntax error, so the failure is squarely inside
// checkCliShape()'s body, not a broken module load.
const THROWING_REGISTRY_SOURCE = `
export const SCHEMA_VERSION = '1.0';
export const COMMAND_REGISTRY = [
  {
    name: 'cells.show',
    helper: 'bee_cells.mjs',
    invoke: 'bee cells show',
    description: 'Forced-failure registry entry (test fixture only).',
    get parameters() {
      throw new Error('forced parsing failure for test');
    },
    examples: ['show --id x'],
    deprecated: null,
  },
];
`;

function makeFixtureRoot({
  phase = 'swarming',
  approvedGates = { context: true, shape: true, execution: true, review: false },
  reservations = [],
  throwingRegistry = false,
} = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-write-guard-hook-test-'));
  fs.mkdirSync(path.join(root, '.bee', 'bin', 'lib'), { recursive: true });
  fs.mkdirSync(path.join(root, '.bee', 'logs'), { recursive: true });

  for (const name of VENDORED_LIB_MODULES) {
    if (throwingRegistry && name === 'command-registry.mjs') continue;
    fs.copyFileSync(path.join(TEMPLATES_LIB_DIR, name), path.join(root, '.bee', 'bin', 'lib', name));
  }
  if (throwingRegistry) {
    fs.writeFileSync(path.join(root, '.bee', 'bin', 'lib', 'command-registry.mjs'), THROWING_REGISTRY_SOURCE, 'utf8');
  }

  writeJsonAtomic(path.join(root, '.bee', 'onboarding.json'), {
    schema_version: '1.0',
    bee_version: '0.1.0',
  });
  writeJsonAtomic(path.join(root, '.bee', 'state.json'), {
    schema_version: '1.0',
    phase,
    feature: 'demo',
    mode: null,
    approved_gates: approvedGates,
    workers: [],
    summary: '',
    next_action: '',
  });
  writeJsonAtomic(path.join(root, '.bee', 'reservations.json'), { reservations });
  return root;
}

/** Spawn the real hook script with a crafted PreToolUse-shaped stdin payload. */
function runHook(root, payload) {
  return spawnSync(process.execPath, [HOOK_PATH], {
    cwd: root,
    input: JSON.stringify({ cwd: root, ...payload }),
    encoding: 'utf8',
  });
}

function activeReservation({ agent, path: reservedPath }) {
  return {
    agent,
    cell: 'demo-1',
    path: reservedPath,
    ttl_seconds: 3600,
    reserved_at: new Date().toISOString(),
    released_at: null,
  };
}

// ─── (a) CLI-shape validation: malformed calls denied, well-formed allowed ─

check('a malformed bee.mjs-shaped Bash call (missing required --id) is denied before execution', () => {
  const root = makeFixtureRoot();
  const result = runHook(root, {
    tool_name: 'Bash',
    tool_input: { command: 'node .bee/bin/bee_cells.mjs show' },
  });
  assert(result.status === 2, `expected exit 2, got ${result.status} (stderr: ${result.stderr})`);
  assert(result.stderr.includes('bee CLI-shape guard'), `expected CLI-shape guard reason, got: ${result.stderr}`);
  assert(result.stderr.includes('cells.show'), `expected the resolved command name, got: ${result.stderr}`);
  assert(result.stderr.includes('field: id'), `expected the missing field named, got: ${result.stderr}`);
});

check('a well-formed bee.mjs-shaped Bash call is allowed (check (d) does not false-positive)', () => {
  const root = makeFixtureRoot();
  const result = runHook(root, {
    tool_name: 'Bash',
    tool_input: { command: 'node .bee/bin/bee_cells.mjs show --id demo-1' },
  });
  assert(result.status === 0, `expected exit 0, got ${result.status} (stderr: ${result.stderr})`);
});

check('a flag value that legitimately begins with "--" is consumed as the value, not misread as a new flag (P1 fix, review-phase-1.md)', () => {
  const root = makeFixtureRoot();
  const result = runHook(root, {
    tool_name: 'Bash',
    tool_input: {
      command: 'node .bee/bin/bee_decisions.mjs log --decision "--foo" --rationale bar',
    },
  });
  // Before the fix: parseCliFlags treated "--foo" as a new bare flag instead
  // of --decision's value, so --decision resolved to boolean true, failed
  // the string-type schema check, and the call was denied. bee.mjs's own
  // parseFlags always consumes the next token unconditionally — the two
  // parsers must agree, and both must ALLOW this well-formed call.
  assert(result.status === 0, `expected exit 0 (dispatcher accepts this call), got ${result.status} (stderr: ${result.stderr})`);
});

check('a legacy bee_reservations.mjs boolean flag does not over-consume a trailing positional token', () => {
  const root = makeFixtureRoot();
  const result = runHook(root, {
    tool_name: 'Bash',
    tool_input: { command: 'node .bee/bin/bee_reservations.mjs sweep --json notaboolean' },
  });
  // "notaboolean" is a non-flag token following a boolean flag, so it is
  // never consumed as its value (schema-driven parse) — sweep --json alone
  // is well-formed, so this call is expected to be ALLOWED, proving the
  // parser does not over-consume trailing positional noise.
  assert(result.status === 0, `expected exit 0 (json is a no-value boolean flag), got ${result.status} (stderr: ${result.stderr})`);
});

check('a valid 3-token helper call (state worker add, longest-prefix resolution) passes schema validation (du-6)', () => {
  const root = makeFixtureRoot();
  const result = runHook(root, {
    tool_name: 'Bash',
    tool_input: { command: 'node .bee/bin/bee_state.mjs worker add --nickname w1 --cell c1 --json' },
  });
  assert(result.status === 0, `expected exit 0, got ${result.status} (stderr: ${result.stderr})`);
});

check('an invalid 3-token helper call is BLOCKED with the schema-guard message, not silently fail-open (du-6)', () => {
  const root = makeFixtureRoot();
  const result = runHook(root, {
    tool_name: 'Bash',
    tool_input: {
      // Before the fix, resolveCliCommandName's hardcoded 2-token shape
      // resolved this to the bogus name "state.worker" (no such registry
      // entry), so check (d) broke out and fail-opened at exit 0 — losing
      // schema validation entirely for every 3-token command. --json is
      // boolean-typed; giving it a non-boolean value is what the extended
      // registry's own validate() catches once resolution correctly lands
      // on "state.worker.add".
      command: 'node .bee/bin/bee_state.mjs worker add --nickname w1 --cell c1 --json=notaboolean',
    },
  });
  assert(result.status === 2, `expected exit 2, got ${result.status} (stderr: ${result.stderr})`);
  assert(result.stderr.includes('bee CLI-shape guard'), `expected CLI-shape guard reason, got: ${result.stderr}`);
  assert(result.stderr.includes('state.worker.add'), `expected the resolved 3-token command name, got: ${result.stderr}`);
  assert(result.stderr.includes('field: json'), `expected the offending field named, got: ${result.stderr}`);
});

check('a valid 3-token dispatcher-shaped call (bee.mjs state worker add) passes schema validation (du-6)', () => {
  const root = makeFixtureRoot();
  const result = runHook(root, {
    tool_name: 'Bash',
    tool_input: { command: 'node .bee/bin/bee.mjs state worker add --nickname w1 --cell c1 --json' },
  });
  assert(result.status === 0, `expected exit 0, got ${result.status} (stderr: ${result.stderr})`);
});

check('an unrecognized (non-bee-shaped) Bash call is left alone by check (d)', () => {
  const root = makeFixtureRoot();
  const result = runHook(root, {
    tool_name: 'Bash',
    tool_input: { command: 'ls -la' },
  });
  assert(result.status === 0, `expected exit 0, got ${result.status} (stderr: ${result.stderr})`);
});

// ─── (b) existing checks unaffected — zero regression, via the real hook ──

check('gate guard (idle intake gate): a write outside the allowed prefixes is still denied', () => {
  const root = makeFixtureRoot({ phase: 'idle' });
  const result = runHook(root, {
    tool_name: 'Write',
    tool_input: { file_path: 'src/foo.js' },
  });
  assert(result.status === 2, `expected exit 2, got ${result.status} (stderr: ${result.stderr})`);
  assert(result.stderr.includes('bee intake gate'), `expected intake gate reason, got: ${result.stderr}`);
});

check('gate guard (idle intake gate): a write inside an allowed prefix is still allowed', () => {
  const root = makeFixtureRoot({ phase: 'idle' });
  const result = runHook(root, {
    tool_name: 'Write',
    tool_input: { file_path: 'docs/history/x.md' },
  });
  assert(result.status === 0, `expected exit 0, got ${result.status} (stderr: ${result.stderr})`);
});

check('gate guard (terminal intake gate): a source write after a feature closes is denied, gates still approved (c2c46488)', () => {
  const root = makeFixtureRoot({
    phase: 'compounding-complete',
    approvedGates: { context: true, shape: true, execution: true, review: true },
  });
  const result = runHook(root, {
    tool_name: 'Edit',
    tool_input: { file_path: 'assets/css/tasks.css' },
  });
  assert(result.status === 2, `expected exit 2, got ${result.status} (stderr: ${result.stderr})`);
  assert(result.stderr.includes('bee intake gate'), `expected intake gate reason, got: ${result.stderr}`);
  assert(
    result.stderr.includes('compounding-complete'),
    `the block must name the terminal phase it fired on, got: ${result.stderr}`,
  );
});

check('gate guard (terminal intake gate): docs/ stays writable after a feature closes (scribing/compounding)', () => {
  const root = makeFixtureRoot({
    phase: 'compounding-complete',
    approvedGates: { context: true, shape: true, execution: true, review: true },
  });
  const result = runHook(root, {
    tool_name: 'Write',
    tool_input: { file_path: 'docs/specs/tasks.md' },
  });
  assert(result.status === 0, `expected exit 0, got ${result.status} (stderr: ${result.stderr})`);
});

check('gate guard (gated phase): a write before execution approval is still denied', () => {
  const root = makeFixtureRoot({
    phase: 'exploring',
    approvedGates: { context: true, shape: false, execution: false, review: false },
  });
  const result = runHook(root, {
    tool_name: 'Write',
    tool_input: { file_path: 'src/foo.js' },
  });
  assert(result.status === 2, `expected exit 2, got ${result.status} (stderr: ${result.stderr})`);
  assert(result.stderr.includes('bee gate'), `expected gate reason, got: ${result.stderr}`);
});

check('gate guard (gated phase): a write after execution approval is still allowed', () => {
  const root = makeFixtureRoot({
    phase: 'exploring',
    approvedGates: { context: true, shape: true, execution: true, review: false },
  });
  const result = runHook(root, {
    tool_name: 'Write',
    tool_input: { file_path: 'src/foo.js' },
  });
  assert(result.status === 0, `expected exit 0, got ${result.status} (stderr: ${result.stderr})`);
});

check('reservation guard: a write conflicting with another agent\'s reservation is still denied', () => {
  const root = makeFixtureRoot({
    phase: 'swarming',
    reservations: [activeReservation({ agent: 'other-agent', path: 'src/reserved.js' })],
  });
  const result = runHook(root, {
    tool_name: 'Bash',
    tool_input: { command: 'rm src/reserved.js' },
    agent_name: 'me',
  });
  assert(result.status === 2, `expected exit 2, got ${result.status} (stderr: ${result.stderr})`);
  assert(result.stderr.includes('bee reservation conflict'), `expected reservation conflict reason, got: ${result.stderr}`);
});

check('reservation guard: a write by the reservation\'s own holder is still allowed', () => {
  const root = makeFixtureRoot({
    phase: 'swarming',
    reservations: [activeReservation({ agent: 'me', path: 'src/reserved.js' })],
  });
  const result = runHook(root, {
    tool_name: 'Bash',
    tool_input: { command: 'rm src/reserved.js' },
    agent_name: 'me',
  });
  assert(result.status === 0, `expected exit 0, got ${result.status} (stderr: ${result.stderr})`);
});

check('privacy guard: reading a secret-shaped file is still denied with the @@BEE_PRIVACY@@ marker', () => {
  const root = makeFixtureRoot();
  const result = runHook(root, {
    tool_name: 'Read',
    tool_input: { file_path: '.env' },
  });
  assert(result.status === 2, `expected exit 2, got ${result.status} (stderr: ${result.stderr})`);
  assert(result.stderr.includes('@@BEE_PRIVACY@@'), `expected the privacy marker, got: ${result.stderr}`);
});

check('scout guard: reading inside node_modules/ is still denied', () => {
  const root = makeFixtureRoot();
  const result = runHook(root, {
    tool_name: 'Read',
    tool_input: { file_path: 'node_modules/foo/index.js' },
  });
  assert(result.status === 2, `expected exit 2, got ${result.status} (stderr: ${result.stderr})`);
  assert(result.stderr.includes('bee scout guard'), `expected scout guard reason, got: ${result.stderr}`);
});

check('a plain source read is still allowed', () => {
  const root = makeFixtureRoot();
  const result = runHook(root, {
    tool_name: 'Read',
    tool_input: { file_path: 'src/index.js' },
  });
  assert(result.status === 0, `expected exit 0, got ${result.status} (stderr: ${result.stderr})`);
});

// ─── (c) a forced throw in check (d) never erases an existing denial ──────

check('a denial already computed by the reservation guard survives check (d) being forced to throw', () => {
  const root = makeFixtureRoot({
    phase: 'swarming',
    reservations: [activeReservation({ agent: 'other-agent', path: 'src/reserved.js' })],
    throwingRegistry: true,
  });
  // First segment (`rm src/reserved.js`) trips the reservation guard (check
  // b) BEFORE check (d) ever runs; the second segment is bee-cli-shaped and
  // resolves to the fixture's throwing registry entry, forcing check (d)'s
  // own parsing logic (the `entry.parameters` read inside checkCliShape) to
  // throw on the very same Bash call.
  const result = runHook(root, {
    tool_name: 'Bash',
    tool_input: { command: 'rm src/reserved.js && node .bee/bin/bee_cells.mjs show --id demo-1' },
    agent_name: 'me',
  });
  assert(result.status === 2, `expected exit 2 (original deny must survive), got ${result.status} (stderr: ${result.stderr})`);
  assert(
    result.stderr.includes('bee reservation conflict'),
    `expected the ORIGINAL reservation-conflict reason to still be reported, got: ${result.stderr}`,
  );
  assert(
    !result.stderr.includes('CLI-shape guard'),
    `check (d) must never have been allowed to assign its own denial once check (b) already denied, got: ${result.stderr}`,
  );
  // The forced throw is still visible in the crash log — fail-open for this
  // check alone is silent to the tool call, never silent in the audit trail.
  const crashLog = fs.readFileSync(path.join(root, '.bee', 'logs', 'hooks.jsonl'), 'utf8');
  assert(
    crashLog.includes('forced parsing failure for test'),
    `expected the forced throw to be logged to hooks.jsonl, got: ${crashLog}`,
  );
});

check('with no prior denial, a forced throw in check (d) fails open (allow) rather than crashing', () => {
  const root = makeFixtureRoot({ phase: 'swarming', throwingRegistry: true });
  const result = runHook(root, {
    tool_name: 'Bash',
    tool_input: { command: 'node .bee/bin/bee_cells.mjs show --id demo-1' },
  });
  assert(result.status === 0, `expected exit 0 (fail-open on the new check's own crash), got ${result.status} (stderr: ${result.stderr})`);
});

// ─── summary ────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed > 0 ? 1 : 0;
