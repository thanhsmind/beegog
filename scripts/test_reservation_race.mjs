#!/usr/bin/env node
// test_reservation_race.mjs — proves reservations.mjs's reserve()/release()/
// sweepExpired() (bee.mjs handleReservationsReserve/.../Sweep) are race-safe
// end to end (CONTEXT.md D2+D3, cell msh-3): the read-check-write body (fresh
// read, conflict check, append, write) runs inside withStoreLock('reservations'),
// so two concurrent reserves can no longer both pass the conflict check
// against the same snapshot and have the later write silently drop the
// earlier hold — never a lost update.
//
// Self-contained child-orchestrator (fork racers, assert internally, exit
// 0/1) invoked by ONE blocking row (critical-patterns 20260714 "Async
// assertions under a non-awaiting runner pass vacuously" — fs writes are
// synchronous inside one process, so "concurrent" async calls fired inside a
// single event loop never exercise a genuine race). Every racer is its own OS
// process (this same file, re-invoked with --role=), same shape as
// scripts/test_claim_race.mjs / scripts/test_store_lock.mjs.
//
// Three scenarios:
//   (a) SAFE, distinct paths — N racers through the REAL reserve() on N
//       distinct paths, same cell: every racer's row must survive (N active
//       rows at the end) — no lost update even though every racer read-check-
//       writes the SAME reservations.json.
//   (b) SAFE, same path — N racers through the REAL reserve() on ONE shared
//       path: exactly one ok:true winner, N-1 typed conflict refusals naming
//       the holder agent.
//   (c) DELIBERATE RED (falsifiability, critical-patterns 20260714) — N
//       racers through a test-owned proxy that mimics the PRE-FIX shape
//       (read the store, WIDEN the window with a short sleep, append, write)
//       with NO store lock in front of it, each on a distinct path in the
//       same store. Demonstrates the exact lost-update hazard D2 exists to
//       kill: fewer than N rows survive because a later writer's read
//       predates an earlier writer's write and clobbers it on save. Runs in
//       its own throwaway temp dir — the real (safe) store is never touched
//       by this scenario, so nothing needs "restoring" afterward.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.join(path.dirname(__filename), '..');
const RESERVATIONS_LIB_PATH = path.join(REPO_ROOT, '.bee', 'bin', 'lib', 'reservations.mjs');
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
    if (workerRole === 'distinct-racer' || workerRole === 'same-path-racer') {
      const root = argVal('--root');
      const cellId = argVal('--cell');
      const id = argVal('--id');
      const reservedPath = argVal('--path');
      const { reserve } = await import(RESERVATIONS_LIB_PATH);
      const result = await reserve(root, { agent: `worker-${id}`, cell: cellId, path: reservedPath });
      process.stdout.write(`${JSON.stringify(result)}\n`);
      process.exit(0);
    } else if (workerRole === 'unsafe-racer') {
      const root = argVal('--root');
      const id = argVal('--id');
      const reservedPath = argVal('--path');
      const { readJson, writeJsonAtomic } = await import(FSUTIL_LIB_PATH);
      const storePath = path.join(root, '.bee', 'reservations.json');
      // Pre-fix shape: read, WIDEN the window, then append+write — no store
      // lock in front of it (the exact hazard D2 removes from the real
      // reserve() path).
      const store = readJson(storePath, { reservations: [] });
      await new Promise((resolve) => setTimeout(resolve, UNSAFE_WIDEN_MS));
      store.reservations.push({
        agent: `worker-unsafe-${id}`,
        cell: 'race-c',
        path: reservedPath,
        ttl_seconds: 3600,
        reserved_at: new Date().toISOString(),
        released_at: null,
      });
      writeJsonAtomic(storePath, store);
      process.stdout.write(`${JSON.stringify({ id, path: reservedPath })}\n`);
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

// ─── fixture helpers (mirrors test_claim_race.mjs's makeRoot) ──────────────

function makeRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-reservation-race-'));
  fs.mkdirSync(path.join(dir, '.bee'), { recursive: true });
  return dir;
}

// ─── orchestrator ────────────────────────────────────────────────────────────

async function runOrchestrator() {
  const { readJson } = await import(FSUTIL_LIB_PATH);
  const failures = [];

  // (a) SAFE, distinct paths — N racers through the REAL reserve(), each on
  // its own path, same cell, same store: every row must survive.
  {
    const dir = makeRoot();
    try {
      const results = await spawnRacers(RACERS, (i) => [
        '--role=distinct-racer',
        `--root=${dir}`,
        '--cell=race-a',
        `--id=${i}`,
        `--path=src/lib/file-${i}.ts`,
      ]);
      const crashed = results.filter((r) => r.code !== 0);
      if (crashed.length) {
        failures.push(
          `(a) ${crashed.length}/${RACERS} distinct-path racer(s) crashed:\n` +
            crashed.map((c) => `  exit=${c.code} stderr=${c.stderr.trim()}`).join('\n'),
        );
      }
      const parsed = results.map((r) => lastJsonLine(r.stdout));
      const winners = parsed.filter((p) => p && p.ok === true);
      if (winners.length !== RACERS) {
        failures.push(`(a) expected all ${RACERS} distinct-path reserves to succeed, got ${winners.length}: ${JSON.stringify(parsed)}`);
      }

      const store = readJson(path.join(dir, '.bee', 'reservations.json'), { reservations: [] });
      const active = store.reservations.filter((r) => r.released_at === null && r.cell === 'race-a');
      if (active.length !== RACERS) {
        failures.push(
          `(a) LOST UPDATE: expected ${RACERS} surviving active rows, got ${active.length} — ` +
            `store: ${JSON.stringify(store.reservations)}`,
        );
      }
      const paths = new Set(active.map((r) => r.path));
      if (paths.size !== RACERS) {
        failures.push(`(a) surviving rows must cover all ${RACERS} distinct paths, got ${paths.size}: ${[...paths].join(', ')}`);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  // (b) SAFE, same path — N racers through the REAL reserve() all targeting
  // ONE shared path: exactly one winner, N-1 typed conflict refusals.
  {
    const dir = makeRoot();
    try {
      const results = await spawnRacers(RACERS, (i) => [
        '--role=same-path-racer',
        `--root=${dir}`,
        '--cell=race-b',
        `--id=${i}`,
        '--path=src/api/router.ts',
      ]);
      const crashed = results.filter((r) => r.code !== 0);
      if (crashed.length) {
        failures.push(
          `(b) ${crashed.length}/${RACERS} same-path racer(s) crashed:\n` +
            crashed.map((c) => `  exit=${c.code} stderr=${c.stderr.trim()}`).join('\n'),
        );
      }
      const parsed = results.map((r) => lastJsonLine(r.stdout));
      const winners = parsed.filter((p) => p && p.ok === true);
      const losers = parsed.filter((p) => p && p.ok === false);

      if (winners.length !== 1) {
        failures.push(`(b) expected exactly 1 winner on the shared path, got ${winners.length}: ${JSON.stringify(winners)}`);
      }
      if (losers.length !== RACERS - 1) {
        failures.push(`(b) expected ${RACERS - 1} typed conflicts, got ${losers.length}: ${JSON.stringify(parsed)}`);
      }
      const winnerAgent = winners[0] && winners[0].reservation && winners[0].reservation.agent;
      for (const loser of losers) {
        if (!Array.isArray(loser.conflicts) || loser.conflicts.length === 0) {
          failures.push(`(b) loser must carry a non-empty typed conflicts array, got ${JSON.stringify(loser)}`);
        } else if (!loser.conflicts.some((c) => c.agent === winnerAgent)) {
          failures.push(`(b) loser's conflicts must name the actual winner "${winnerAgent}", got ${JSON.stringify(loser.conflicts)}`);
        }
      }

      const store = readJson(path.join(dir, '.bee', 'reservations.json'), { reservations: [] });
      const active = store.reservations.filter((r) => r.released_at === null && r.cell === 'race-b');
      if (active.length !== 1) {
        failures.push(`(b) exactly one row should survive on the shared path, got ${active.length}: ${JSON.stringify(active)}`);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  // (c) DELIBERATE RED — widened-window read-check-write with NO store lock,
  // proving the pre-fix hazard is real (falsifiability: the safe result above
  // is not simply "nothing ever races here"). Runs in its own throwaway dir.
  {
    const dir = makeRoot();
    try {
      const results = await spawnRacers(RACERS, (i) => [
        '--role=unsafe-racer',
        `--root=${dir}`,
        `--id=${i}`,
        `--path=src/lib/unsafe-${i}.ts`,
      ]);
      const crashed = results.filter((r) => r.code !== 0);
      if (crashed.length) {
        failures.push(
          `(c) ${crashed.length}/${RACERS} unsafe racer(s) crashed:\n` +
            crashed.map((c) => `  exit=${c.code} stderr=${c.stderr.trim()}`).join('\n'),
        );
      }
      const store = readJson(path.join(dir, '.bee', 'reservations.json'), { reservations: [] });
      const survived = store.reservations.length;
      if (survived >= RACERS) {
        failures.push(
          `(c) DETECTOR DID NOT BITE: all ${survived}/${RACERS} unguarded racer rows survived — this negative ` +
            'control must show FEWER than N surviving rows (a lost update), or the (a) green result proves nothing.',
        );
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  if (failures.length) {
    console.error('FAIL test_reservation_race:');
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }

  console.log(
    `PASS test_reservation_race: (a) ${RACERS} real-path racers on ${RACERS} distinct paths -> all ${RACERS} rows survived ` +
      `(no lost update); (b) ${RACERS} real-path racers on one shared path -> exactly 1 winner, ${RACERS - 1} typed conflicts ` +
      "naming the winner; (c) deliberate-red unguarded proxy lost at least one racer's row (detector bites, lock removed).",
  );
}
