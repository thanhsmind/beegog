#!/usr/bin/env node
// test_guards.mjs — guard-lib contract tests (checkWrite/checkRead + lane
// enforcement/presentation readers + cross-session hold hard block), split
// out of test_lib.mjs (cs-2b) to shrink the monolith. Same PASS/FAIL/exit-1
// contract as every other suite here — see scripts/lib/test-fixture.mjs.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  makeTempRepo,
  makeCell,
  check,
  assert,
  assertThrows,
  assertRejects,
  printSummaryAndExit,
} from '../../../../scripts/lib/test-fixture.mjs';
import { defaultState, readState, writeState } from '../lib/state.mjs';
import { readCell, claimCell } from '../lib/cells.mjs';
import { reserve, reservationsPath } from '../lib/reservations.mjs';
import { createSession } from '../lib/claims.mjs';
// fsh-3 (lane store): namespace imports so a not-yet-implemented export fails
// its own row ("… is not a function") instead of crashing the whole module
// graph at import time — the RED-first evidence stays per-row.
import * as laneStore from '../lib/state.mjs';
import * as laneBinding from '../lib/claims.mjs';
import { checkWrite, checkRead, extractBashTargets, checkAskUserQuestion } from '../lib/guards.mjs';
import { buildPromptReminder, buildSessionPreamble } from '../lib/inject.mjs';
import { readJson, writeJsonAtomic } from '../lib/fsutil.mjs';

const root = makeTempRepo();

// Self-containment fix (cs-2b split): makeStateRepo/makeCellFile are defined
// in test_lib.mjs's "bee.mjs state CLI"/"bee.mjs state start-feature" sections
// (now test_cli_state.mjs, a different file); laneFile/writeLaneFixture are
// defined in the "lanes" section (now test_state.mjs, also a different file).
// All four were only reachable here via function-declaration hoisting across
// the whole monolith. The enforcement/presentation/cross-session-hold rows
// below need them. Verbatim copies, same shape, same behavior, zero check
// weakened.
function makeStateRepo(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(dir, '.bee'), { recursive: true });
  writeJsonAtomic(path.join(dir, '.bee', 'onboarding.json'), {
    schema_version: '1.0',
    bee_version: '0.1.0',
  });
  return dir;
}

function makeCellFile(dir, id, extra = {}) {
  fs.mkdirSync(path.join(dir, '.bee', 'cells'), { recursive: true });
  const cell = {
    id,
    feature: 'old-feature',
    title: `Cell ${id}`,
    lane: 'tiny',
    status: 'open',
    deps: [],
    action: 'do it',
    verify: 'node -e "process.exit(0)"',
    trace: {},
    ...extra,
  };
  writeJsonAtomic(path.join(dir, '.bee', 'cells', `${id}.json`), cell);
  return cell;
}

function laneFile(dir, feature) {
  return path.join(dir, '.bee', 'lanes', `${feature}.json`);
}

function writeLaneFixture(dir, feature, extra = {}) {
  laneStore.writeLane(dir, {
    schema_version: '1.0',
    feature,
    mode: null,
    phase: 'idle',
    approved_gates: { context: false, shape: false, execution: false, review: false },
    summary: '',
    next_action: '',
    created_at: new Date().toISOString(),
    ...extra,
  });
}

// ─── guards ─────────────────────────────────────────────────────────────────

await check('checkWrite blocks source writes while idle (intake gate); config can disable it', async () => {
  const state = defaultState(); // phase: idle
  const denied = checkWrite(root, state, 'src/app.ts');
  assert(denied.allow === false && denied.kind === 'intake', 'intake deny expected while idle');
  assert(denied.reason.includes('bee-hive'), 'intake reason should point at bee-hive routing');
  const docsOk = checkWrite(root, state, 'docs/notes.md');
  assert(docsOk.allow === true, 'docs/ writes stay allowed while idle');
  const configPath = path.join(root, '.bee', 'config.json');
  const before = readJson(configPath, {});
  writeJsonAtomic(configPath, { ...before, guards: { idle_gate: false } });
  const off = checkWrite(root, state, 'src/app.ts');
  assert(off.allow === true, 'idle gate must be disableable via guards.idle_gate=false');
  writeJsonAtomic(configPath, before || {});
});

await check('checkAskUserQuestion turns opaque "Invalid tool parameters" into a clear, specific deny; fail-open on odd shapes', async () => {
  // Valid question is allowed.
  const ok = { questions: [{ question: 'Which approach?', header: 'Approach', multiSelect: false, options: [{ label: 'A', description: 'do A' }, { label: 'B', description: 'do B' }] }] };
  assert(checkAskUserQuestion(ok).allow === true, 'a valid AskUserQuestion must be allowed');
  // header > 12 chars — the #1 cause — denied with the count named.
  const longHeader = checkAskUserQuestion({ questions: [{ question: 'q', header: 'Xử lý external', options: [{ label: 'A', description: 'x' }, { label: 'B', description: 'y' }] }] });
  assert(longHeader.allow === false && longHeader.kind === 'ask-schema' && /14 chars|max 12|header/.test(longHeader.reason), `long header must deny with a clear reason, got ${JSON.stringify(longHeader)}`);
  // >4 options denied; <2 options denied.
  assert(checkAskUserQuestion({ questions: [{ question: 'q', header: 'h', options: [1, 2, 3, 4, 5].map((n) => ({ label: `L${n}`, description: 'd' })) }] }).allow === false, '5 options must deny');
  assert(checkAskUserQuestion({ questions: [{ question: 'q', header: 'h', options: [{ label: 'only', description: 'd' }] }] }).allow === false, '1 option must deny');
  // >4 questions denied.
  assert(checkAskUserQuestion({ questions: [1, 2, 3, 4, 5].map(() => ({ question: 'q', header: 'h', options: [{ label: 'A', description: 'd' }, { label: 'B', description: 'd' }] })) }).allow === false, '5 questions must deny');
  // missing label / description denied.
  assert(checkAskUserQuestion({ questions: [{ question: 'q', header: 'h', options: [{ description: 'no label' }, { label: 'B', description: 'd' }] }] }).allow === false, 'missing label must deny');
  assert(checkAskUserQuestion({ questions: [{ question: 'q', header: 'h', options: [{ label: 'A' }, { label: 'B', description: 'd' }] }] }).allow === false, 'missing description must deny');
  // Fail-open: unrecognized / absent shapes are never blocked.
  assert(checkAskUserQuestion({}).allow === true, 'no questions key -> allow (fail-open)');
  assert(checkAskUserQuestion(null).allow === true, 'null input -> allow (fail-open)');
  assert(checkAskUserQuestion({ questions: 'weird' }).allow === true, 'non-array questions -> allow (fail-open)');
});

await check('checkWrite denies executable/code files under docs/history/ (the .md-only knowledge layer) in every phase (GitHub #17)', async () => {
  // Active work (execution approved) — the intake gate is NOT the reason here.
  const active = { ...defaultState(), phase: 'validating', approved_gates: { context: true, shape: true, execution: true, review: false } };
  const shDeny = checkWrite(root, active, 'docs/history/industry-count-company-registered/verify.sh');
  assert(shDeny.allow === false && shDeny.kind === 'docs-history-code', `a .sh under docs/history/ must be denied, got ${JSON.stringify(shDeny)}`);
  assert(/spikes|project|\.md/.test(shDeny.reason), 'the reason should point at .bee/spikes/ or the project scripts');
  // Other code extensions too.
  for (const p of ['docs/history/f/helper.mjs', 'docs/history/f/tool.py', 'docs/history/f/x.js']) {
    assert(checkWrite(root, active, p).allow === false, `${p} should be denied`);
  }
  // But .md knowledge under docs/history/ stays allowed, and code elsewhere is unaffected by THIS rule.
  assert(checkWrite(root, active, 'docs/history/f/report.md').allow === true, 'a .md under docs/history/ stays allowed');
  assert(checkWrite(root, active, 'docs/history/f/evidence.json').allow === true, 'a .json under docs/history/ stays allowed');
  assert(checkWrite(root, active, 'scripts/verify.sh').allow === true, 'a .sh outside docs/history/ is not this rule\'s concern');
});

await check('checkWrite blocks source writes at compounding-complete — a closed feature is not an open door (c2c46488)', async () => {
  // The killer case: the feature closed, so phase is the terminal alias and the
  // gates are STILL approved from that closed feature. Before the fix, the idle
  // branch missed the phase, the gated branch saw execution:true, and the write
  // fell through to allow — every post-feature edit skipped bee entirely.
  const state = {
    ...defaultState(),
    phase: 'compounding-complete',
    approved_gates: { context: true, shape: true, execution: true, review: true },
  };
  const denied = checkWrite(root, state, 'assets/css/tasks.css');
  assert(
    denied.allow === false && denied.kind === 'intake',
    'intake deny expected at compounding-complete even with every gate still approved',
  );
  assert(
    denied.reason.includes('compounding-complete'),
    'the deny reason must name the actual phase, not hardcode "idle"',
  );
  const docsOk = checkWrite(root, state, 'docs/specs/tasks.md');
  assert(docsOk.allow === true, 'docs/ (scribing, compounding) must stay writable at compounding-complete');
  const beeOk = checkWrite(root, state, '.bee/cells/demo-9.json');
  assert(beeOk.allow === true, '.bee/ bookkeeping must stay writable at compounding-complete');
  const configPath = path.join(root, '.bee', 'config.json');
  const before = readJson(configPath, {});
  writeJsonAtomic(configPath, { ...before, guards: { idle_gate: false } });
  const off = checkWrite(root, state, 'assets/css/tasks.css');
  assert(off.allow === true, 'guards.idle_gate=false must disable the gate for both terminal phases, not just idle');
  writeJsonAtomic(configPath, before || {});
});

await check('checkWrite blocks source writes in a gated phase without execution approval', async () => {
  const state = { ...defaultState(), phase: 'planning' };
  const denied = checkWrite(root, state, 'src/app.ts');
  assert(denied.allow === false && denied.kind === 'gate', 'gate deny expected');
  const allowed = checkWrite(root, state, 'docs/history/demo/plan.md');
  assert(allowed.allow === true, 'docs/history/ writes allowed in gated phases');
});

await check('checkWrite blocks unreserved conflicting writes during swarming', async () => {
  await reserve(root, { agent: 'worker-a', cell: 'demo-2', path: 'src/core/engine.ts' });
  const state = { ...defaultState(), phase: 'swarming', approved_gates: { ...defaultState().approved_gates, execution: true } };
  const denied = checkWrite(root, state, 'src/core/engine.ts', 'worker-b');
  assert(denied.allow === false && denied.kind === 'reservation', 'reservation deny expected');
  const own = checkWrite(root, state, 'src/core/engine.ts', 'worker-a');
  assert(own.allow === true, 'holder may write its reserved path');
});

await check('checkWrite: root .spikes/ is governed (not allowlisted) while .bee/spikes/ stays allowed (D2 8ed35504)', async () => {
  const state = defaultState(); // phase: idle
  const rootSpikesDenied = checkWrite(root, state, '.spikes/demo/notes.md');
  assert(
    rootSpikesDenied.allow === false && rootSpikesDenied.kind === 'intake',
    'root .spikes/ must be blocked at idle now that .spikes/ is removed from GATE_ALLOWED_PREFIXES (D2) — spikes live under .bee/spikes/ now',
  );
  const beeSpikesAllowed = checkWrite(root, state, '.bee/spikes/demo/notes.md');
  assert(beeSpikesAllowed.allow === true, '.bee/spikes/ stays allowed via the existing .bee/ prefix');
});

await check('checkRead denies secrets with a privacy marker, and generated dirs', async () => {
  const secret = checkRead('.env.production');
  assert(secret.allow === false && secret.kind === 'privacy', 'privacy deny expected');
  assert(secret.marker.startsWith('@@BEE_PRIVACY@@'), 'marker present');
  const scout = checkRead('packages/app/node_modules/foo/index.js');
  assert(scout.allow === false && scout.kind === 'scout', 'scout deny expected');
  assert(checkRead('src/index.ts').allow === true, 'normal source reads allowed');
});

await check('extractBashTargets flags sed -i and redirection targets', async () => {
  const sed = extractBashTargets('sed -i "s/a/b/" src/config.ts');
  assert(sed.paths.includes('src/config.ts'), `sed target detected, got ${JSON.stringify(sed.paths)}`);
  const redir = extractBashTargets('echo hi > out/log.txt');
  assert(redir.paths.includes('out/log.txt'), 'redirection target detected');
  const broad = extractBashTargets('rm -rf .');
  assert(broad.broadWrite === true, 'rm -rf . is a broad write');
  // fd-duplication is NOT a file write (guards.mjs bug fix, decision 0014)
  const dup = extractBashTargets('node bee_status.mjs --json 2>&1');
  assert(!dup.paths.includes('&1') && dup.paths.length === 0, `2>&1 is not a write target, got ${JSON.stringify(dup.paths)}`);
  const dup2 = extractBashTargets('cmd 1>&2');
  assert(!dup2.paths.some((p) => p.startsWith('&')), 'fd dup &2 not treated as a file');
  const realRedir = extractBashTargets('cmd 2>err.log');
  assert(realRedir.paths.includes('err.log'), 'a real stderr redirect to a file is still caught');
});

// ─── fsh-5: enforcement readers resolve through the session's lane (D2/D4) ──
// LIB CAPABILITY ONLY — hooks thread these in S3/S4. claimCell's execution
// gate comes from the CELL's own feature lane when one exists (the per-feature
// lane is keyed by cell.feature — the cell field named `lane` is the risk
// tier, a different thing); checkWrite optionally resolves phase/gates from a
// bound session via resolvePipeline. Zero lanes on disk = byte-identical to
// today, pinned by every pre-existing claimCell/checkWrite row above passing
// unmodified.

await check("lanes: claimCell resolves the execution gate from the cell's feature lane — an unapproved lane refuses even when the default gate is true, and an approved lane authorizes even when the default gate is false (D2 authority boundary)", async () => {
  const dir = makeStateRepo('bee-lane-claim-gate-');
  try {
    // default pipeline fully approved — it must NOT authorize a lane cell
    writeJsonAtomic(path.join(dir, '.bee', 'state.json'), {
      schema_version: '1.0',
      phase: 'swarming',
      feature: 'default-feat',
      approved_gates: { context: true, shape: true, execution: true, review: false },
      workers: [],
    });
    makeCellFile(dir, 'lg-1', { feature: 'lane-feat', status: 'open' });
    writeLaneFixture(dir, 'lane-feat', { phase: 'validating' }); // all four gates false
    assertThrows(
      () => claimCell(dir, 'lg-1', 'worker-l'),
      'execution',
      "the lane's unapproved execution gate refuses the claim even though the DEFAULT execution gate is true",
    );
    assert(readCell(dir, 'lg-1').status === 'open', 'refusal leaves the cell open');
    // the lane's own approval authorizes — the default gate is irrelevant to a lane cell
    writeLaneFixture(dir, 'lane-feat', {
      phase: 'swarming',
      approved_gates: { context: true, shape: true, execution: true, review: false },
    });
    writeJsonAtomic(path.join(dir, '.bee', 'state.json'), {
      schema_version: '1.0',
      phase: 'idle',
      feature: null,
      approved_gates: { context: false, shape: false, execution: false, review: false },
      workers: [],
    });
    const claimed = claimCell(dir, 'lg-1', 'worker-l');
    assert(
      claimed.status === 'claimed' && claimed.trace.worker === 'worker-l',
      "the lane's execution approval authorizes the claim even while the default gate is false",
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

await check("lanes: claimCell for a cell whose feature has NO lane record keeps today's default-gate behavior (D4 zero-lane parity); a corrupt lane record refuses loudly, never falls back to the default gate", async () => {
  const dir = makeStateRepo('bee-lane-claim-default-');
  try {
    writeJsonAtomic(path.join(dir, '.bee', 'state.json'), {
      schema_version: '1.0',
      phase: 'idle',
      feature: null,
      approved_gates: { context: false, shape: false, execution: false, review: false },
      workers: [],
    });
    makeCellFile(dir, 'dg-1', { feature: 'plain-feat', status: 'open' });
    assertThrows(
      () => claimCell(dir, 'dg-1', 'worker-d'),
      'execution',
      'no lane record → the default gate governs, refusing while unapproved',
    );
    writeJsonAtomic(path.join(dir, '.bee', 'state.json'), {
      schema_version: '1.0',
      phase: 'swarming',
      feature: 'plain-feat',
      approved_gates: { context: true, shape: true, execution: true, review: false },
      workers: [],
    });
    const claimed = claimCell(dir, 'dg-1', 'worker-d');
    assert(claimed.status === 'claimed', 'default-gate claim proceeds once approved — no lane on disk, no lane logic');
    // a present-but-corrupt lane record must refuse the claim loudly: guessing
    // back to the default gate would let it authorize a lane cell (D2 boundary)
    makeCellFile(dir, 'cg-1', { feature: 'lane-corrupt', status: 'open' });
    fs.mkdirSync(path.join(dir, '.bee', 'lanes'), { recursive: true });
    fs.writeFileSync(laneFile(dir, 'lane-corrupt'), '{ not json', 'utf8');
    assertThrows(
      () => claimCell(dir, 'cg-1', 'worker-d'),
      'lane',
      'a corrupt lane record refuses the claim loudly instead of falling back to the default gate',
    );
    assert(readCell(dir, 'cg-1').status === 'open', 'refusal leaves the cell untouched');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

await check("lanes: checkWrite with a bound sessionId resolves phase/gates from the session's lane; absent or unbound sessionId keeps today's record; a broken binding is a typed deny, never a silent default", async () => {
  const dir = makeStateRepo('bee-lane-checkwrite-');
  try {
    // default record at idle: a plain source write hits the intake gate today
    writeJsonAtomic(path.join(dir, '.bee', 'state.json'), {
      schema_version: '1.0',
      phase: 'idle',
      feature: null,
      approved_gates: { context: false, shape: false, execution: false, review: false },
      workers: [],
    });
    const state = readState(dir);
    const bare = checkWrite(dir, state, 'src/app.ts');
    assert(bare.allow === false && bare.kind === 'intake', "absent sessionId keeps today's exact behavior (intake deny at idle)");
    // bound session whose lane is mid-swarm with execution approved → allowed
    laneBinding.createSession(dir, { id: 'sess-w' });
    writeLaneFixture(dir, 'lane-w', {
      phase: 'swarming',
      approved_gates: { context: true, shape: true, execution: true, review: false },
    });
    laneBinding.bindSessionLane(dir, 'sess-w', 'lane-w');
    const boundOk = checkWrite(dir, state, 'src/app.ts', null, { sessionId: 'sess-w' });
    assert(
      boundOk.allow === true,
      `a bound session is governed by its lane (swarming, execution approved) — the idle default record no longer decides, got ${JSON.stringify(boundOk)}`,
    );
    // the lane in a gated phase without approval → gate deny through the lane
    writeLaneFixture(dir, 'lane-w', { phase: 'planning' });
    const boundDenied = checkWrite(dir, state, 'src/app.ts', null, { sessionId: 'sess-w' });
    assert(
      boundDenied.allow === false && boundDenied.kind === 'gate',
      `the bound lane's unapproved gate denies the write, got ${JSON.stringify(boundDenied)}`,
    );
    // an unbound session resolves to the default record — same deny as bare
    laneBinding.createSession(dir, { id: 'sess-u' });
    const unbound = checkWrite(dir, state, 'src/app.ts', null, { sessionId: 'sess-u' });
    assert(unbound.allow === false && unbound.kind === 'intake', 'an unbound session resolves to the default record');
    // a binding to a missing lane: typed deny naming the lane, never a silent default
    laneBinding.bindSessionLane(dir, 'sess-u', 'lane-ghost');
    const broken = checkWrite(dir, state, 'src/app.ts', null, { sessionId: 'sess-u' });
    assert(
      broken.allow === false && broken.kind === 'lane',
      `a broken binding is a typed lane deny, got ${JSON.stringify(broken)}`,
    );
    assert(
      typeof broken.reason === 'string' && broken.reason.includes('lane-ghost'),
      'the deny reason names the unresolvable lane',
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ─── fsh-7: cross-session hold hard block in the guard lib (D3, RED-first) ──
// PLACEMENT PIN (panel W1): D3 is unconditional on phase, so every deny test
// here deliberately runs the bound lane in phase 'swarming' with execution
// approved — the primary multi-terminal topology, not a tail-reaching phase
// a tail-placed check would happen to pass. checkWrite itself is otherwise
// untouched for the no-sessionId path (pinned above/elsewhere).

await check("checkWrite: a cross-session hold denies another session's write in swarming-with-execution-approved (phase-independence, C8) — names the holder session, agent, and expiry; the acting session's own hold and an expired hold never block; a legacy session-less reservation never blocks anybody", async () => {
  const dir = makeStateRepo('bee-hold-deny-');
  try {
    laneBinding.createSession(dir, { id: 'sess-hw' });
    laneBinding.createSession(dir, { id: 'sess-other' });
    writeLaneFixture(dir, 'lane-hw', {
      phase: 'swarming',
      approved_gates: { context: true, shape: true, execution: true, review: false },
    });
    laneBinding.bindSessionLane(dir, 'sess-hw', 'lane-hw');
    const state = readState(dir); // irrelevant here: the bound lane governs

    await reserve(dir, { agent: 'other-agent', cell: 'hw-1', path: 'src/hold/target.ts', session: 'sess-other' });
    const denied = checkWrite(dir, state, 'src/hold/target.ts', null, { sessionId: 'sess-hw' });
    assert(
      denied.allow === false && denied.kind === 'hold',
      `a cross-session hold must deny the write even in swarming+execution-approved, got ${JSON.stringify(denied)}`,
    );
    assert(
      denied.reason.includes('sess-other') && denied.reason.includes('other-agent'),
      `deny reason must name the holder session and agent, got: ${denied.reason}`,
    );
    assert(/expires|no expiry/.test(denied.reason), `deny reason must carry an expiry, got: ${denied.reason}`);

    // the acting session's own hold on a different path never blocks itself
    await reserve(dir, { agent: 'me-agent', cell: 'hw-1', path: 'src/hold/mine.ts', session: 'sess-hw' });
    const ownOk = checkWrite(dir, state, 'src/hold/mine.ts', null, { sessionId: 'sess-hw' });
    assert(ownOk.allow === true, `the acting session's own hold must never block its own write, got ${JSON.stringify(ownOk)}`);

    // an expired hold never blocks, even from a different session
    await reserve(dir, { agent: 'other-agent', cell: 'hw-1', path: 'src/hold/stale.ts', session: 'sess-other', ttl: 60 });
    const store = readJson(reservationsPath(dir), { reservations: [] });
    const row = store.reservations.find((r) => r.path === 'src/hold/stale.ts');
    row.reserved_at = new Date(Date.now() - 7200 * 1000).toISOString();
    writeJsonAtomic(reservationsPath(dir), store);
    const staleOk = checkWrite(dir, state, 'src/hold/stale.ts', null, { sessionId: 'sess-hw' });
    assert(staleOk.allow === true, `an expired hold must never block, got ${JSON.stringify(staleOk)}`);

    // a legacy session-less reservation (today's exact shape) never blocks a bound session either.
    // D3: clear env for this one reserve() call so "no --session passed" stays
    // genuinely session-less, matching a legacy row made before fsh-7/D3 existed.
    const savedLegacyEnv = process.env.CLAUDE_CODE_SESSION_ID;
    try {
      delete process.env.CLAUDE_CODE_SESSION_ID;
      await reserve(dir, { agent: 'legacy-agent', cell: 'hw-1', path: 'src/hold/legacy.ts' });
    } finally {
      if (savedLegacyEnv === undefined) delete process.env.CLAUDE_CODE_SESSION_ID;
      else process.env.CLAUDE_CODE_SESSION_ID = savedLegacyEnv;
    }
    const legacyOk = checkWrite(dir, state, 'src/hold/legacy.ts', null, { sessionId: 'sess-hw' });
    assert(legacyOk.allow === true, `a session-less reservation row must never block a bound session's write, got ${JSON.stringify(legacyOk)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

await check("checkWrite: with NO sessionId, a session-owned hold on the target path is never even consulted — byte-identical to today's exact reservation-guard behavior (own agent name still governs the swarming branch as before)", async () => {
  const dir = makeStateRepo('bee-hold-no-session-');
  try {
    const state = { ...defaultState(), phase: 'swarming', approved_gates: { ...defaultState().approved_gates, execution: true } };
    await reserve(dir, { agent: 'other-agent', cell: 'hw-2', path: 'src/hold/no-session.ts', session: 'sess-somebody' });
    const noSessionArg = checkWrite(dir, state, 'src/hold/no-session.ts');
    assert(
      noSessionArg.allow === true,
      `no sessionId means the hold check never runs — the write-guard behaves exactly as it did before fsh-7, got ${JSON.stringify(noSessionArg)}`,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

await check('checkWrite: a present-but-corrupt reservation store RETURNS a typed {allow:false, kind:"holds-unreadable"} verdict for a session-aware write — never a throw (C7, panel B1); a missing store stays open exactly as today', async () => {
  const dir = makeStateRepo('bee-hold-corrupt-');
  try {
    laneBinding.createSession(dir, { id: 'sess-corrupt' });
    writeLaneFixture(dir, 'lane-corrupt-hw', {
      phase: 'swarming',
      approved_gates: { context: true, shape: true, execution: true, review: false },
    });
    laneBinding.bindSessionLane(dir, 'sess-corrupt', 'lane-corrupt-hw');
    const state = readState(dir);

    // missing store (nothing has reserved anything yet) stays open
    const openOk = checkWrite(dir, state, 'src/hold/whatever.ts', null, { sessionId: 'sess-corrupt' });
    assert(openOk.allow === true, `a missing reservation store must stay open, got ${JSON.stringify(openOk)}`);

    // a present-but-corrupt store must fail closed, never throw
    fs.mkdirSync(path.join(dir, '.bee'), { recursive: true });
    fs.writeFileSync(reservationsPath(dir), '{ not json', 'utf8');
    let corrupt;
    let threw = false;
    try {
      corrupt = checkWrite(dir, state, 'src/hold/whatever.ts', null, { sessionId: 'sess-corrupt' });
    } catch {
      threw = true;
    }
    assert(!threw, 'checkWrite must never throw on a corrupt reservation store — the hook is fail-open and would swallow a throw into an allow');
    assert(
      corrupt && corrupt.allow === false && corrupt.kind === 'holds-unreadable',
      `a corrupt store must be a typed {allow:false, kind:'holds-unreadable'} deny, got ${JSON.stringify(corrupt)}`,
    );

    // restoring a valid (even empty) store re-opens the write
    writeJsonAtomic(reservationsPath(dir), { reservations: [] });
    const restored = checkWrite(dir, state, 'src/hold/whatever.ts', null, { sessionId: 'sess-corrupt' });
    assert(restored.allow === true, `a valid, empty store must re-open the write, got ${JSON.stringify(restored)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ─── fsh-6: presentation readers show the session's lane (D4) ───────────────
// buildSessionPreamble/buildPromptReminder gain an OPTIONAL sessionId param.
// Omitted (today's exact call shape) resolves to the default pipeline —
// byte-identical to every pinned no-sessionId row above. A bound sessionId
// shows THAT lane's phase/mode/feature/gates plus a one-line summary of any
// OTHER active (non-terminal) lanes. bee.mjs's buildStatus carries a new
// `lanes` block (per-lane phase/gates/bound sessions) alongside every
// pre-existing zero-lane field, unchanged. bee-chain-nudge/bee-session-close
// consult the acting session's pipeline for phase when payload.session_id
// names a bound session, default otherwise — covered in
// hooks/test_hook_contracts.mjs.

await check('buildSessionPreamble: omitting sessionId (or passing {}) renders byte-identical to today; an unbound session also resolves to the exact default preamble', async () => {
  const dir = makeStateRepo('bee-preamble-lane-bare-');
  try {
    writeState(dir, { ...defaultState(), phase: 'idle', mode: null, feature: null });
    const noArg = buildSessionPreamble(dir);
    const emptyOpts = buildSessionPreamble(dir, {});
    const nullSession = buildSessionPreamble(dir, { sessionId: null });
    assert(noArg === emptyOpts && emptyOpts === nullSession, 'omitted/{}/null sessionId all render the identical preamble');

    laneBinding.createSession(dir, { id: 'sess-bare' });
    const unbound = buildSessionPreamble(dir, { sessionId: 'sess-bare' });
    assert(unbound === noArg, 'an unbound session renders exactly the default preamble (D4 zero-lane parity)');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

await check("buildSessionPreamble: a bound sessionId shows that lane's own phase/mode/feature/gates and names other ACTIVE lanes in one line — never the bound lane itself, never a terminal one", async () => {
  const dir = makeStateRepo('bee-preamble-lane-bound-');
  try {
    laneBinding.createSession(dir, { id: 'sess-p' });
    writeLaneFixture(dir, 'lane-p', {
      phase: 'planning',
      mode: 'standard',
      approved_gates: { context: true, shape: false, execution: false, review: false },
    });
    laneBinding.bindSessionLane(dir, 'sess-p', 'lane-p');

    const soloBound = buildSessionPreamble(dir, { sessionId: 'sess-p' });
    assert(
      /Phase: planning \| Mode: standard \| Feature: lane-p/.test(soloBound),
      `preamble shows the bound lane's own phase/mode/feature, got:\n${soloBound}`,
    );
    assert(/context: approved/.test(soloBound) && /shape: pending/.test(soloBound), 'gates line reflects the bound lane, not the default record');
    assert(!/other active lane/.test(soloBound), 'no lanes-summary line when no OTHER lane exists');

    writeLaneFixture(dir, 'lane-other', { phase: 'swarming', mode: 'standard' });
    writeLaneFixture(dir, 'lane-closed', { phase: 'compounding-complete', mode: 'standard' });
    const withOthers = buildSessionPreamble(dir, { sessionId: 'sess-p' });
    assert(
      /1 other active lane\(s\): lane-other/.test(withOthers),
      `preamble names exactly the one OTHER active lane, got:\n${withOthers}`,
    );
    assert(!/lane-closed/.test(withOthers), 'a terminal (compounding-complete) lane is never counted as active');
    assert(!/lane-p,|, lane-p/.test(withOthers.match(/other active lane\(s\): (.*)$/m)?.[1] ?? ''), 'the bound lane never lists itself in the summary');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

await check("buildSessionPreamble: an unresolvable binding (missing lane) falls back to the default record instead of blocking the informational preamble", async () => {
  const dir = makeStateRepo('bee-preamble-lane-broken-');
  try {
    writeState(dir, { ...defaultState(), phase: 'idle' });
    laneBinding.createSession(dir, { id: 'sess-ghost' });
    laneBinding.bindSessionLane(dir, 'sess-ghost', 'lane-ghost');
    const bare = buildSessionPreamble(dir);
    const broken = buildSessionPreamble(dir, { sessionId: 'sess-ghost' });
    assert(broken === bare, 'a broken binding renders the same preamble as the default (never throws, never blocks)');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

await check('buildPromptReminder: omitting sessionId is unchanged; a bound sessionId reflects that lane\'s phase/next_action/gate, an unresolvable binding falls back to the default', async () => {
  const dir = makeStateRepo('bee-reminder-lane-');
  try {
    writeState(dir, { ...defaultState(), phase: 'idle', next_action: 'Invoke bee-hive.' });
    const bare = buildPromptReminder(dir);
    assert(bare.text.includes('phase=idle'), 'omitted sessionId keeps the default pipeline');

    laneBinding.createSession(dir, { id: 'sess-r' });
    writeLaneFixture(dir, 'lane-r', {
      phase: 'planning',
      mode: 'standard',
      next_action: 'Prepare the current slice.',
      approved_gates: { context: true, shape: false, execution: false, review: false },
    });
    laneBinding.bindSessionLane(dir, 'sess-r', 'lane-r');
    const bound = buildPromptReminder(dir, { sessionId: 'sess-r' });
    assert(bound.text.includes('phase=planning'), `bound reminder reflects the lane's phase, got: ${bound.text}`);
    assert(bound.text.includes('mode=standard'), `bound reminder reflects the lane's mode, got: ${bound.text}`);
    assert(/next: Prepare the current slice\./.test(bound.text), `bound reminder reflects the lane's next_action, got: ${bound.text}`);
    assert(/gate pending: shape/.test(bound.text), `bound reminder's first open gate comes from the lane, got: ${bound.text}`);
    assert(bound.hash !== bare.hash, 'a different resolved pipeline hashes differently');

    laneBinding.createSession(dir, { id: 'sess-r2' });
    laneBinding.bindSessionLane(dir, 'sess-r2', 'lane-missing');
    const broken = buildPromptReminder(dir, { sessionId: 'sess-r2' });
    assert(broken.text === bare.text, 'an unresolvable binding falls back to the default pipeline, never throws');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

printSummaryAndExit();
