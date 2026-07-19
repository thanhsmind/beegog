#!/usr/bin/env node
// test_claim_race.mjs — proves `cells claim --id` (bee.mjs handleCellsClaim ->
// cells.mjs claimCellCrossSession) is race-safe end to end (CONTEXT.md D1,
// cell msh-2): the O_EXCL claim file (claims.mjs claimCellFile) is acquired
// BEFORE the cell JSON flips, so concurrent claimants on the SAME cell
// produce exactly one winner and N-1 typed CLAIMED refusals naming the
// owner's session + expiry — never a silent double-claim.
//
// Self-contained child-orchestrator (fork racers, assert internally, exit
// 0/1) invoked by ONE blocking row (critical-patterns 20260714 "Async
// assertions under a non-awaiting runner pass vacuously" — fs writes are
// synchronous inside one process, so "concurrent" async calls fired inside a
// single event loop never exercise a genuine race). Every racer is its own
// OS process (this same file, re-invoked with --role=), same shape as
// scripts/test_store_lock.mjs / scripts/test_state_write_concurrency.mjs.
//
// Three scenarios:
//   (a) SAFE — N racers through the REAL claimCellCrossSession on one open
//       cell: exactly one ok:true winner, N-1 typed CLAIMED refusals naming
//       the winner's session + expiry. The O_EXCL claim file makes this a
//       STRUCTURAL exclusion (only the file's one winner ever calls the
//       cell-JSON mutator at all — the other N-1 never get past
//       claimCellFile), so it is deterministic with no artificial delay.
//   (b) DELIBERATE RED (falsifiability, critical-patterns 20260714) — N
//       racers through a test-owned read-check-write proxy that mimics the
//       PRE-FIX shape (read the cell, check status open, WIDEN the window
//       with a short sleep, then write claimed) with NO claim-file gate in
//       front of it. Demonstrates more than one racer can see "open" before
//       any writes land — the exact double-claim class D1 exists to kill.
//       (Widened window, same discipline as test_store_lock.mjs's own
//       unguarded control: real synchronous fs calls are too fast apart to
//       race reliably without deliberately holding the window open — this is
//       a test-owned proxy of the hazard, not a claim that production code
//       has an artificial delay.)
//   (c) SAME-SESSION ROUND TRIP — claim -> block -> reopen -> claim (same
//       session) succeeds cleanly with no self-refusing CLAIMED, proving
//       block and reopen both release the claim file (D1 Δ2-amendment: else
//       the claim file created by the first claim would still exist and the
//       second claim would lose to itself for the full TTL).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.join(path.dirname(__filename), '..');
const CELLS_LIB_PATH = path.join(REPO_ROOT, '.bee', 'bin', 'lib', 'cells.mjs');
const CLAIMS_LIB_PATH = path.join(REPO_ROOT, '.bee', 'bin', 'lib', 'claims.mjs');
const FSUTIL_LIB_PATH = path.join(REPO_ROOT, '.bee', 'bin', 'lib', 'fsutil.mjs');

const RACERS = 8;
const UNSAFE_WIDEN_MS = 30;

function argVal(flag) {
  const found = process.argv.find((a) => a.startsWith(`${flag}=`));
  return found ? found.slice(flag.length + 1) : undefined;
}

const role = argVal('--role');

if (role) {
  await runWorker(role);
} else {
  await runOrchestrator();
}

// ─── worker roles (each its own OS process) ─────────────────────────────────

async function runWorker(workerRole) {
  try {
    if (workerRole === 'safe-racer') {
      const root = argVal('--root');
      const cellId = argVal('--cell');
      const id = argVal('--id');
      const { claimCellCrossSession } = await import(CELLS_LIB_PATH);
      const result = claimCellCrossSession(root, {
        sessionId: `sess-safe-${id}`,
        worker: `worker-safe-${id}`,
        cellId,
      });
      process.stdout.write(`${JSON.stringify(result)}\n`);
      process.exit(0);
    } else if (workerRole === 'unsafe-racer') {
      const root = argVal('--root');
      const cellId = argVal('--cell');
      const id = argVal('--id');
      const { readJson, writeJsonAtomic } = await import(FSUTIL_LIB_PATH);
      const cellPath = path.join(root, '.bee', 'cells', `${cellId}.json`);
      // Pre-fix shape: read, check open, WIDEN the window, then write — no
      // claim-file gate in front of it (the exact hazard D1 removes from the
      // real `cells claim --id` path).
      const seen = readJson(cellPath, null);
      const sawOpen = !!seen && seen.status === 'open';
      await new Promise((resolve) => setTimeout(resolve, UNSAFE_WIDEN_MS));
      if (sawOpen) {
        const fresh = readJson(cellPath, seen);
        fresh.status = 'claimed';
        fresh.trace = { ...(fresh.trace || {}), worker: `worker-unsafe-${id}` };
        writeJsonAtomic(cellPath, fresh);
      }
      process.stdout.write(`${JSON.stringify({ sawOpen, id })}\n`);
      process.exit(0);
    } else {
      throw new Error(`unknown role: ${workerRole}`);
    }
  } catch (err) {
    console.error(`WORKER-CRASH role=${workerRole}: ${(err && err.stack) || err}`);
    process.exit(1);
  }
}

function spawnRacer(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [__filename, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('exit', (code) => resolve({ code, stdout, stderr }));
    child.on('error', (err) => resolve({ code: null, stdout, stderr: String(err) }));
  });
}

function spawnRacers(count, argsFor) {
  const runs = [];
  for (let i = 0; i < count; i++) runs.push(spawnRacer(argsFor(i)));
  return Promise.all(runs);
}

function lastJsonLine(stdout) {
  const lines = stdout.split('\n').filter((line) => line.trim());
  if (lines.length === 0) return null;
  try {
    return JSON.parse(lines[lines.length - 1]);
  } catch {
    return null;
  }
}

// ─── fixture helpers (mirrors test_lib.mjs's makeStateRepo/makeCellFile) ───

function makeRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-claim-race-'));
  fs.mkdirSync(path.join(dir, '.bee'), { recursive: true });
  return dir;
}

async function writeApprovedState(dir) {
  const { writeJsonAtomic } = await import(FSUTIL_LIB_PATH);
  writeJsonAtomic(path.join(dir, '.bee', 'state.json'), {
    schema_version: '1.0',
    phase: 'swarming',
    feature: 'race-feat',
    mode: 'high-risk',
    approved_gates: { context: true, shape: true, execution: true, review: false },
    workers: [],
  });
}

async function makeCell(dir, id) {
  const { writeJsonAtomic } = await import(FSUTIL_LIB_PATH);
  fs.mkdirSync(path.join(dir, '.bee', 'cells'), { recursive: true });
  const cell = {
    id,
    feature: 'race-feat',
    title: `Cell ${id}`,
    lane: 'tiny',
    status: 'open',
    deps: [],
    action: 'race target',
    verify: 'node -e "process.exit(0)"',
    trace: {},
  };
  writeJsonAtomic(path.join(dir, '.bee', 'cells', `${id}.json`), cell);
  return cell;
}

// ─── orchestrator ────────────────────────────────────────────────────────────

async function runOrchestrator() {
  const { readJson } = await import(FSUTIL_LIB_PATH);
  const { readClaim, claimGatePath } = await import(CLAIMS_LIB_PATH);
  const failures = [];

  // (a) SAFE — real claimCellCrossSession, N racers on one open cell.
  {
    const dir = makeRoot();
    try {
      await writeApprovedState(dir);
      await makeCell(dir, 'race-a');

      const results = await spawnRacers(RACERS, (i) => [
        '--role=safe-racer',
        `--root=${dir}`,
        '--cell=race-a',
        `--id=${i}`,
      ]);
      const crashed = results.filter((r) => r.code !== 0);
      if (crashed.length) {
        failures.push(
          `(a) ${crashed.length}/${RACERS} safe racer(s) crashed:\n` +
            crashed.map((c) => `  exit=${c.code} stderr=${c.stderr.trim()}`).join('\n'),
        );
      }
      const parsed = results.map((r) => lastJsonLine(r.stdout));
      const winners = parsed.filter((p) => p && p.ok === true);
      const losers = parsed.filter((p) => p && p.ok === false);

      if (winners.length !== 1) {
        failures.push(`(a) expected exactly 1 winner, got ${winners.length}: ${JSON.stringify(winners)}`);
      }
      if (losers.length !== RACERS - 1) {
        failures.push(`(a) expected ${RACERS - 1} losers, got ${losers.length}: ${JSON.stringify(parsed)}`);
      }
      for (const loser of losers) {
        if (loser.code !== 'CLAIMED') {
          failures.push(`(a) loser code should be typed CLAIMED, got ${JSON.stringify(loser)}`);
        }
        if (typeof loser.reason !== 'string' || !/expir/i.test(loser.reason)) {
          failures.push(`(a) loser reason must name the expiry, got ${JSON.stringify(loser)}`);
        }
      }
      const winnerSession = winners[0] && winners[0].claim && winners[0].claim.session;
      if (!winnerSession || !losers.every((l) => typeof l.reason === 'string' && l.reason.includes(winnerSession))) {
        failures.push(`(a) every loser's reason must name the actual winner's session "${winnerSession}", got ${JSON.stringify(losers)}`);
      }

      const finalCell = readJson(path.join(dir, '.bee', 'cells', 'race-a.json'), null);
      if (!finalCell || finalCell.status !== 'claimed') {
        failures.push(`(a) final cell status should be "claimed", got ${JSON.stringify(finalCell)}`);
      }
      const finalClaim = readClaim(dir, 'race-a');
      if (!finalClaim || finalClaim.session !== winnerSession) {
        failures.push(`(a) claims-store claim should belong to the winner "${winnerSession}", got ${JSON.stringify(finalClaim)}`);
      }
      if (fs.existsSync(claimGatePath(dir, 'race-a'))) {
        failures.push('(a) no gate file should leak after the race settles');
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  // (b) DELIBERATE RED — widened-window read-check-write with NO claim-file
  // gate, proving the pre-fix hazard is real (falsifiability: the safe result
  // above is not simply "nothing ever races here").
  {
    const dir = makeRoot();
    try {
      await writeApprovedState(dir);
      await makeCell(dir, 'race-b');

      const results = await spawnRacers(RACERS, (i) => [
        '--role=unsafe-racer',
        `--root=${dir}`,
        '--cell=race-b',
        `--id=${i}`,
      ]);
      const crashed = results.filter((r) => r.code !== 0);
      if (crashed.length) {
        failures.push(
          `(b) ${crashed.length}/${RACERS} unsafe racer(s) crashed:\n` +
            crashed.map((c) => `  exit=${c.code} stderr=${c.stderr.trim()}`).join('\n'),
        );
      }
      const parsed = results.map((r) => lastJsonLine(r.stdout));
      const sawOpenCount = parsed.filter((p) => p && p.sawOpen === true).length;
      if (sawOpenCount <= 1) {
        failures.push(
          `(b) DETECTOR DID NOT BITE: only ${sawOpenCount}/${RACERS} unguarded racer(s) saw the cell "open" — this ` +
            'negative control must show MORE than one racer believing it won, or the (a) green result proves nothing.',
        );
      }
      const finalCell = readJson(path.join(dir, '.bee', 'cells', 'race-b.json'), null);
      if (!finalCell || finalCell.status !== 'claimed') {
        failures.push(`(b) final unguarded cell status should still land on "claimed" (last writer wins), got ${JSON.stringify(finalCell)}`);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  // (c) SAME-SESSION ROUND TRIP — claim -> block -> reopen -> claim (same
  // session) must succeed, proving block/reopen both release the claim file.
  {
    const dir = makeRoot();
    try {
      await writeApprovedState(dir);
      await makeCell(dir, 'race-c');
      const { claimCellCrossSession, blockCell, reopenCell } = await import(CELLS_LIB_PATH);

      const firstClaim = claimCellCrossSession(dir, { sessionId: 'sess-roundtrip', worker: 'worker-rt', cellId: 'race-c' });
      if (!firstClaim.ok) failures.push(`(c) first claim should succeed, got ${JSON.stringify(firstClaim)}`);

      blockCell(dir, 'race-c', 'round-trip test block', { sessionId: 'sess-roundtrip' });
      if (readClaim(dir, 'race-c') !== null) {
        failures.push('(c) block must release the claim file (D1 Δ2)');
      }

      reopenCell(dir, 'race-c', 'round-trip test reopen', { sessionId: 'sess-roundtrip' });
      if (readClaim(dir, 'race-c') !== null) {
        failures.push('(c) reopen must release the claim file (D1 Δ2)');
      }

      const secondClaim = claimCellCrossSession(dir, { sessionId: 'sess-roundtrip', worker: 'worker-rt', cellId: 'race-c' });
      if (!secondClaim.ok) {
        failures.push(
          `(c) same-session round-trip re-claim must succeed (no self-refusal), got ${JSON.stringify(secondClaim)} — ` +
            'a stale claim file from the first claim was never released.',
        );
      }
      if (secondClaim.ok && secondClaim.cell.status !== 'claimed') {
        failures.push(`(c) re-claimed cell should be "claimed", got ${JSON.stringify(secondClaim.cell)}`);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  if (failures.length) {
    console.error('FAIL test_claim_race:');
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }

  console.log(
    `PASS test_claim_race: (a) ${RACERS} real-path racers on one cell -> exactly 1 winner, ${RACERS - 1} typed CLAIMED ` +
      "refusals naming the winner's session + expiry; (b) deliberate-red unguarded proxy showed multiple racers " +
      'believing they won (detector bites); (c) claim -> block -> reopen -> claim same-session round trip succeeded ' +
      'with no self-refusal.',
  );
}
