#!/usr/bin/env node
// test_worktree_holds_race.mjs — proves worktree-holds.mjs's mirrorHold()
// (skills/bee-hive/templates/lib/worktree-holds.mjs, cell xwh-1) is
// race-safe end to end, the exact same shape scripts/test_reservation_race.mjs
// already proves for reservations.mjs's reserve(): the read-check-write body
// (fresh read, append, write) runs inside withStoreLock(mainRoot,
// 'cross-worktree-holds'), so two concurrent mirrorHold() calls — from two
// separate OS processes, e.g. two different worktree checkouts racing to
// mirror a hold into the SAME shared ledger — can never both read the same
// pre-mutation snapshot and have the later write silently drop the earlier
// one.
//
// Self-contained child-orchestrator (fork racers, assert internally, exit
// 0/1), same pattern as scripts/test_reservation_race.mjs / test_claim_race.mjs
// / test_store_lock.mjs: every racer is its own OS process (this same file,
// re-invoked with --role=), because fs writes are synchronous inside one
// process — "concurrent" async calls fired inside a single event loop never
// exercise a genuine cross-process race (critical-patterns 20260714).
//
// Two scenarios:
//   (a) SAFE, distinct paths/holders — N racers through the REAL mirrorHold()
//       on N distinct paths, each its own holder, into the SAME ledger: every
//       racer's entry must survive (N entries at the end) — no lost update
//       even though every racer read-check-writes the SAME
//       cross-worktree-holds.json.
//   (b) DELIBERATE RED (falsifiability, critical-patterns 20260714) — N
//       racers through a test-owned proxy that mimics the PRE-FIX shape
//       (read the store, WIDEN the window with a short sleep, append, write)
//       with NO store lock in front of it, each on a distinct path in the
//       same store. Demonstrates the exact lost-update hazard withStoreLock
//       exists to kill: fewer than N rows survive because a later writer's
//       read predates an earlier writer's write and clobbers it on save.
//       Runs in its own throwaway temp dir — the real (safe) store is never
//       touched by this scenario, so nothing needs "restoring" afterward.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.join(path.dirname(__filename), '..');
const WORKTREE_HOLDS_LIB_PATH = path.join(REPO_ROOT, '.bee', 'bin', 'lib', 'worktree-holds.mjs');
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
    if (workerRole === 'distinct-racer') {
      const root = argVal('--root');
      const id = argVal('--id');
      const holdPath = argVal('--path');
      const { mirrorHold } = await import(WORKTREE_HOLDS_LIB_PATH);
      const result = await mirrorHold(root, { path: holdPath, holder: `wt-${id}`, cell: 'race-a' });
      process.stdout.write(`${JSON.stringify(result)}\n`);
      process.exit(0);
    } else if (workerRole === 'unsafe-racer') {
      const root = argVal('--root');
      const id = argVal('--id');
      const holdPath = argVal('--path');
      const { readJson, writeJsonAtomic } = await import(FSUTIL_LIB_PATH);
      const storePath = path.join(root, '.bee', 'runtime', 'cross-worktree-holds.json');
      // Pre-fix shape: read, WIDEN the window, then append+write — no store
      // lock in front of it (the exact hazard withStoreLock removes from the
      // real mirrorHold() path).
      const store = readJson(storePath, { holds: [] });
      await new Promise((resolve) => setTimeout(resolve, UNSAFE_WIDEN_MS));
      store.holds.push({
        path: holdPath,
        holder: `wt-unsafe-${id}`,
        feature: null,
        session: null,
        cell: 'race-c',
        ttl_seconds: 3600,
        mirrored_at: new Date().toISOString(),
        released_at: null,
      });
      writeJsonAtomic(storePath, store);
      process.stdout.write(`${JSON.stringify({ id, path: holdPath })}\n`);
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

// ─── fixture helpers (mirrors test_reservation_race.mjs's makeRoot) ───────

function makeRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-worktree-holds-race-'));
  fs.mkdirSync(path.join(dir, '.bee'), { recursive: true });
  return dir;
}

// ─── orchestrator ────────────────────────────────────────────────────────────

async function runOrchestrator() {
  const { readJson } = await import(FSUTIL_LIB_PATH);
  const failures = [];

  // (a) SAFE, distinct paths/holders — N racers through the REAL
  // mirrorHold(), each on its own path and holder, same ledger: every entry
  // must survive.
  {
    const dir = makeRoot();
    try {
      const results = await spawnRacers(RACERS, (i) => [
        '--role=distinct-racer',
        `--root=${dir}`,
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
        failures.push(`(a) expected all ${RACERS} distinct-path mirrorHold() calls to succeed, got ${winners.length}: ${JSON.stringify(parsed)}`);
      }

      const store = readJson(path.join(dir, '.bee', 'runtime', 'cross-worktree-holds.json'), { holds: [] });
      const active = store.holds.filter((h) => h.released_at === null && h.cell === 'race-a');
      if (active.length !== RACERS) {
        failures.push(
          `(a) LOST UPDATE: expected ${RACERS} surviving active hold(s), got ${active.length} — ` +
            `store: ${JSON.stringify(store.holds)}`,
        );
      }
      const paths = new Set(active.map((h) => h.path));
      if (paths.size !== RACERS) {
        failures.push(`(a) surviving holds must cover all ${RACERS} distinct paths, got ${paths.size}: ${[...paths].join(', ')}`);
      }
      const holders = new Set(active.map((h) => h.holder));
      if (holders.size !== RACERS) {
        failures.push(`(a) surviving holds must cover all ${RACERS} distinct holders, got ${holders.size}: ${[...holders].join(', ')}`);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  // (b) DELIBERATE RED — widened-window read-check-write with NO store lock,
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
          `(b) ${crashed.length}/${RACERS} unsafe racer(s) crashed:\n` +
            crashed.map((c) => `  exit=${c.code} stderr=${c.stderr.trim()}`).join('\n'),
        );
      }
      const store = readJson(path.join(dir, '.bee', 'runtime', 'cross-worktree-holds.json'), { holds: [] });
      const survived = store.holds.length;
      if (survived >= RACERS) {
        failures.push(
          `(b) DETECTOR DID NOT BITE: all ${survived}/${RACERS} unguarded racer holds survived — this negative ` +
            'control must show FEWER than N surviving holds (a lost update), or the (a) green result proves nothing.',
        );
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  if (failures.length) {
    console.error('FAIL test_worktree_holds_race:');
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }

  console.log(
    `PASS test_worktree_holds_race: (a) ${RACERS} real mirrorHold() racers on ${RACERS} distinct paths/holders -> all ${RACERS} entries survived ` +
      "(no lost update); (b) deliberate-red unguarded proxy lost at least one racer's entry (detector bites, lock removed).",
  );
}
