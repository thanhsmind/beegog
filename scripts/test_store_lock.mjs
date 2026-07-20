#!/usr/bin/env node
// test_store_lock.mjs — proves withStoreLock (.bee/bin/lib/lock.mjs, mirrored
// from skills/bee-hive/templates/lib/lock.mjs) actually serializes a critical
// section across real OS processes (CONTEXT.md D2, cell msh-1).
//
// Self-contained child orchestrator (fork racers, assert internally, exit
// 0/1) invoked by ONE blocking row (`node scripts/test_store_lock.mjs`) —
// critical-patterns 20260714 "Async assertions under a non-awaiting runner
// pass vacuously": fs writes are synchronous inside one process, so a
// "concurrent" test that only fires async calls in one event loop never
// exercises a genuine race. Every racer here is its own child process (this
// same file, re-invoked with --role=), same shape as
// test_state_write_concurrency.mjs.
//
// Mutual-exclusion detector: every critical section, guarded or not, marks a
// shared active.json {active,holder} on entry, holds briefly (HOLD_MS,
// widening the race window), re-checks it was not clobbered, then increments
// a shared counter.json. Two workers ever being "active" at once — at entry
// or discovered on the re-check after the hold — is logged to
// violations.jsonl. This is strictly stronger than only checking the final
// counter total: a corrupted total proves loss, but a clean total does not
// prove exclusion (two racers could each net +1 by luck); the active-flag
// check catches the overlap directly, the same class the spike's negative
// control caught as "7-8 winners" for the naive unlink-based takeover.
//
// Four scenarios:
//   (a) N racers under the real lock, fresh lock file  -> zero violations,
//       counter == workers*iters exactly (no lost update).
//   (b) N racers with NO lock at all (same critical section body)          ->
//       deliberately demonstrates loss/overlap, proving the detector above
//       actually bites (falsifiability of the harness itself, not lock.mjs).
//   (c) N racers under the real lock, but the lock file is PRE-SEEDED stale
//       (backdated mtime, fake crashed holder) -> same zero-violation,
//       exact-count invariants as (a): the stale takeover never lets two
//       racers in at once and never wedges progress.
//   (d) One process against a FRESH (non-stale) held lock -> typed
//       LockBusyError after the real ~5s retry budget, holder fields match
//       the seeded holder.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.join(path.dirname(__filename), '..');
const LOCK_LIB_PATH = path.join(REPO_ROOT, '.bee', 'bin', 'lib', 'lock.mjs');

const WORKERS = 6;
const ITERS = 12;
const HOLD_MS = 5;

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

// ─── shared fixture helpers (deliberately NOT atomic — scenario (b) needs a
// naive read-then-write to be raceable at all; scenario (a)/(c) exclusivity
// comes entirely from the lock around the caller, never from these helpers) ──

function readJsonRaw(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJsonRaw(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resetFixtures(dir) {
  writeJsonRaw(path.join(dir, 'counter.json'), { total: 0 });
  writeJsonRaw(path.join(dir, 'active.json'), { active: false, holder: null });
  fs.rmSync(path.join(dir, 'violations.jsonl'), { force: true });
}

async function criticalSection(dir, workerId) {
  const activePath = path.join(dir, 'active.json');
  const counterPath = path.join(dir, 'counter.json');
  const violationsPath = path.join(dir, 'violations.jsonl');

  const seenOnEntry = readJsonRaw(activePath, { active: false, holder: null });
  if (seenOnEntry.active) {
    fs.appendFileSync(
      violationsPath,
      `${JSON.stringify({ type: 'double-entry', enteredBy: workerId, alreadyHeldBy: seenOnEntry.holder, at: Date.now() })}\n`,
    );
  }
  writeJsonRaw(activePath, { active: true, holder: workerId });

  await sleep(HOLD_MS);

  const seenOnExit = readJsonRaw(activePath, { active: false, holder: null });
  if (!seenOnExit.active || seenOnExit.holder !== workerId) {
    fs.appendFileSync(
      violationsPath,
      `${JSON.stringify({ type: 'clobbered-active', expectedHolder: workerId, foundHolder: seenOnExit.holder, at: Date.now() })}\n`,
    );
  }

  const counter = readJsonRaw(counterPath, { total: 0 });
  counter.total += 1;
  writeJsonRaw(counterPath, counter);
  writeJsonRaw(activePath, { active: false, holder: null });
}

// ─── worker roles ────────────────────────────────────────────────────────────

async function runWorker(workerRole) {
  try {
    if (workerRole === 'locked' || workerRole === 'unguarded') {
      const dir = argVal('--dir');
      const lockRoot = argVal('--lock-root');
      const lockName = argVal('--lock-name');
      const iters = Number(argVal('--iters'));
      const id = argVal('--id');
      const { withStoreLock } = workerRole === 'locked' ? await import(LOCK_LIB_PATH) : { withStoreLock: null };
      for (let i = 0; i < iters; i++) {
        const workerId = `${id}-${i}`;
        if (workerRole === 'locked') {
          await withStoreLock(lockRoot, lockName, () => criticalSection(dir, workerId));
        } else {
          await criticalSection(dir, workerId);
        }
      }
      process.exit(0);
    } else if (workerRole === 'busy') {
      const lockRoot = argVal('--lock-root');
      const lockName = argVal('--lock-name');
      const { withStoreLock, LockBusyError } = await import(LOCK_LIB_PATH);
      try {
        await withStoreLock(lockRoot, lockName, async () => {
          throw new Error('critical section ran — lock was NOT actually busy');
        });
        console.log(JSON.stringify({ ok: false, unexpectedSuccess: true }));
        process.exit(1);
      } catch (error) {
        if (error instanceof LockBusyError) {
          console.log(
            JSON.stringify({ ok: true, name: error.name, type: error.type, reason: error.reason, holder: error.holder }),
          );
          process.exit(0);
        }
        console.log(JSON.stringify({ ok: false, error: String((error && error.stack) || error) }));
        process.exit(1);
      }
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

function violationCount(dir) {
  const file = path.join(dir, 'violations.jsonl');
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return 0;
  }
  return text.split('\n').filter((line) => line.trim()).length;
}

function readCounterTotal(dir) {
  return readJsonRaw(path.join(dir, 'counter.json'), { total: null }).total;
}

// ─── orchestrator ────────────────────────────────────────────────────────────

async function runOrchestrator() {
  const { lockFilePath, withStoreLock } = await import(LOCK_LIB_PATH);
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'test-store-lock-'));
  fs.mkdirSync(path.join(tmpRoot, '.bee', 'locks'), { recursive: true });

  const failures = [];
  const expectedTotal = WORKERS * ITERS;

  // (0) lockFilePath sanitizes logical names for Windows filesystem safety.
  // Runtime lock names include "cells:<id>" (cells.mjs's `cells:${id}`, 4
  // call sites) — ':' is invalid in a Windows filename, so an unsanitized
  // lockFilePath made every cap/verify/block/reset under that lock throw on
  // Windows (fs.writeFileSync with flag 'wx' rejects the path outright).
  {
    const WINDOWS_INVALID_CHARS = /[<>:"/\\|?*\x00-\x1f]/;

    const cellsDemoPath = lockFilePath(tmpRoot, 'cells:demo-1');
    const cellsDemoBasename = path.basename(cellsDemoPath);
    if (WINDOWS_INVALID_CHARS.test(cellsDemoBasename)) {
      failures.push(
        `(0a) lockFilePath(root, 'cells:demo-1') basename "${cellsDemoBasename}" still contains a Windows-invalid character`,
      );
    }

    // Distinct logical names must map to distinct files even after
    // sanitization could otherwise collide them (":" and "/" both -> "_").
    const pathColonA = lockFilePath(tmpRoot, 'cells:a');
    const pathColonB = lockFilePath(tmpRoot, 'cells:b');
    const pathSlashA = lockFilePath(tmpRoot, 'cells/a');
    if (pathColonA === pathColonB) {
      failures.push(`(0b) distinct logical names 'cells:a' and 'cells:b' collided to the same lock file: ${pathColonA}`);
    }
    if (pathColonA === pathSlashA) {
      failures.push(
        `(0b) distinct logical names 'cells:a' and 'cells/a' collided to the same lock file after sanitization: ${pathColonA}`,
      );
    }

    // The SAME logical name must map to the SAME file every time (pure
    // function, safe across processes) — determinism, not per-call entropy.
    const pathColonAAgain = lockFilePath(tmpRoot, 'cells:a');
    if (pathColonA !== pathColonAAgain) {
      failures.push(
        `(0c) lockFilePath(root, 'cells:a') is not deterministic: ${pathColonA} vs ${pathColonAAgain} on a second call`,
      );
    }

    // A real withStoreLock round-trip using a colon-bearing logical name
    // still acquires and releases cleanly (mutual exclusion still works,
    // and the lock file it creates on disk is the sanitized path above).
    try {
      let ran = false;
      await withStoreLock(tmpRoot, 'cells:round-trip', async () => {
        ran = true;
      });
      if (!ran) {
        failures.push('(0d) withStoreLock(root, "cells:round-trip", fn) did not run fn');
      }
      const roundTripLockPath = lockFilePath(tmpRoot, 'cells:round-trip');
      if (fs.existsSync(roundTripLockPath)) {
        failures.push(`(0d) withStoreLock left the lock file behind after release: ${roundTripLockPath}`);
      }
    } catch (err) {
      failures.push(`(0d) withStoreLock(root, "cells:round-trip", fn) threw: ${(err && err.stack) || err}`);
    }
  }

  try {
    // (a) N racers under the real lock, fresh lock file — no lost update, no overlap.
    resetFixtures(tmpRoot);
    const lockedResults = await spawnRacers(WORKERS, (i) => [
      '--role=locked',
      `--dir=${tmpRoot}`,
      `--lock-root=${tmpRoot}`,
      '--lock-name=lock-a',
      `--iters=${ITERS}`,
      `--id=locked-${i}`,
    ]);
    const crashedLocked = lockedResults.filter((r) => r.code !== 0);
    if (crashedLocked.length) {
      failures.push(
        `(a) ${crashedLocked.length}/${WORKERS} locked racer(s) crashed:\n` +
          crashedLocked.map((c) => `  ${c.stderr.trim()}`).join('\n'),
      );
    }
    const aViolations = violationCount(tmpRoot);
    const aTotal = readCounterTotal(tmpRoot);
    if (aViolations !== 0) {
      failures.push(`(a) locked run recorded ${aViolations} mutual-exclusion violation(s) — the lock did not exclude`);
    }
    if (aTotal !== expectedTotal) {
      failures.push(`(a) locked run counter total is ${aTotal}, expected exactly ${expectedTotal} (lost update)`);
    }

    // (b) N racers with NO lock — deliberately demonstrates loss/overlap
    // (proves the violation/loss detector itself can actually bite).
    resetFixtures(tmpRoot);
    const unguardedResults = await spawnRacers(WORKERS, (i) => [
      '--role=unguarded',
      `--dir=${tmpRoot}`,
      `--iters=${ITERS}`,
      `--id=unguarded-${i}`,
    ]);
    const crashedUnguarded = unguardedResults.filter((r) => r.code !== 0);
    if (crashedUnguarded.length) {
      failures.push(
        `(b) ${crashedUnguarded.length}/${WORKERS} unguarded racer(s) crashed:\n` +
          crashedUnguarded.map((c) => `  ${c.stderr.trim()}`).join('\n'),
      );
    }
    const bViolations = violationCount(tmpRoot);
    const bTotal = readCounterTotal(tmpRoot);
    if (bViolations === 0 && bTotal === expectedTotal) {
      failures.push(
        '(b) unguarded control run showed ZERO overlap and a perfectly exact counter — the detector proved nothing ' +
          '(it must demonstrate loss/overlap to prove the (a)/(c) green results are meaningful, not luck)',
      );
    }

    // (c) N racers under the real lock, but the lock file starts artificially
    // stale (backdated mtime, fake crashed holder) — same invariants as (a).
    resetFixtures(tmpRoot);
    const staleLockPath = lockFilePath(tmpRoot, 'lock-c');
    fs.writeFileSync(
      staleLockPath,
      `${JSON.stringify({ pid: 999999999, session: 'stale-simulated-holder', ts: new Date(Date.now() - 45_000).toISOString(), token: 'stale-token-c' })}\n`,
    );
    const staleMs = (Date.now() - 45_000) / 1000;
    fs.utimesSync(staleLockPath, staleMs, staleMs);
    const staleResults = await spawnRacers(WORKERS, (i) => [
      '--role=locked',
      `--dir=${tmpRoot}`,
      `--lock-root=${tmpRoot}`,
      '--lock-name=lock-c',
      `--iters=${ITERS}`,
      `--id=stale-${i}`,
    ]);
    const crashedStale = staleResults.filter((r) => r.code !== 0);
    if (crashedStale.length) {
      failures.push(
        `(c) ${crashedStale.length}/${WORKERS} stale-takeover racer(s) crashed:\n` +
          crashedStale.map((c) => `  ${c.stderr.trim()}`).join('\n'),
      );
    }
    const cViolations = violationCount(tmpRoot);
    const cTotal = readCounterTotal(tmpRoot);
    if (cViolations !== 0) {
      failures.push(
        `(c) stale-takeover run recorded ${cViolations} mutual-exclusion violation(s) — a naive unconditional-unlink ` +
          'takeover would show this (spike negative control: 7-8 winners); atomic-rename takeover must not.',
      );
    }
    if (cTotal !== expectedTotal) {
      failures.push(`(c) stale-takeover run counter total is ${cTotal}, expected exactly ${expectedTotal} (progress wedged or lost update)`);
    }
    if (fs.existsSync(staleLockPath)) {
      failures.push('(c) the pre-seeded stale lock file was never taken over/cleared — progress may be permanently wedged');
    }

    // (d) One process against a FRESH (non-stale) held lock — typed
    // LockBusyError naming the real holder, after the real retry budget.
    const busyLockName = 'lock-d';
    const busyLockPath = lockFilePath(tmpRoot, busyLockName);
    const seededHolder = { pid: 424242, session: 'busy-holder-session', ts: new Date().toISOString(), token: 'busy-token-d' };
    fs.writeFileSync(busyLockPath, `${JSON.stringify(seededHolder)}\n`);
    const startedAt = Date.now();
    const busyResult = await spawnRacer(['--role=busy', `--lock-root=${tmpRoot}`, `--lock-name=${busyLockName}`]);
    const elapsedMs = Date.now() - startedAt;
    fs.rmSync(busyLockPath, { force: true });

    if (busyResult.code !== 0) {
      failures.push(`(d) busy-attempt child exited ${busyResult.code}, expected 0:\n  stdout=${busyResult.stdout.trim()}\n  stderr=${busyResult.stderr.trim()}`);
    } else {
      let parsed = null;
      try {
        parsed = JSON.parse(busyResult.stdout.trim().split('\n').pop());
      } catch (err) {
        failures.push(`(d) could not parse busy-attempt stdout as JSON: ${err.message} :: raw=${busyResult.stdout}`);
      }
      if (parsed) {
        if (parsed.type !== 'refused' || parsed.reason !== 'LOCK_BUSY') {
          failures.push(`(d) expected {type:'refused',reason:'LOCK_BUSY'}, got ${JSON.stringify({ type: parsed.type, reason: parsed.reason })}`);
        }
        if (!parsed.holder || parsed.holder.pid !== seededHolder.pid || parsed.holder.session !== seededHolder.session) {
          failures.push(`(d) LockBusyError.holder did not name the seeded holder: got ${JSON.stringify(parsed.holder)}, seeded ${JSON.stringify(seededHolder)}`);
        }
      }
    }
    if (elapsedMs < 2500) {
      failures.push(`(d) busy-attempt returned after only ${elapsedMs}ms — too fast to have exercised the real retry budget`);
    }
    if (elapsedMs > 12_000) {
      failures.push(`(d) busy-attempt took ${elapsedMs}ms — far beyond the ~5s retry budget, may be hanging instead of refusing`);
    }
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }

  if (failures.length) {
    console.error('FAIL test_store_lock:');
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }

  console.log(
    `PASS test_store_lock: (a) ${WORKERS}x${ITERS} locked racers zero violations/exact count; ` +
      `(b) unguarded control demonstrated loss/overlap; (c) ${WORKERS}x${ITERS} racers survived a pre-seeded stale ` +
      `lock with zero violations/exact count; (d) LOCK_BUSY refusal named the real holder after the real retry budget.`,
  );
}
