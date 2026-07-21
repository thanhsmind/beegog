#!/usr/bin/env node
// test_render_race.mjs — proves render_plugin_skill_trees.mjs's writeTree
// (cell cs-3) is race-safe: the render+write of both plugin trees runs
// inside withStoreLock(repoRoot, 'plugin-render') and writes via a tmp
// sibling dir + rename-swap, so two concurrent renders can no longer
// interleave rmSync-whole-dir against a live per-file write loop.
//
// Self-contained child-orchestrator (fork racers, assert internally, exit
// 0/1) invoked by ONE blocking row, same shape as scripts/test_claim_race.mjs
// / scripts/test_reservation_race.mjs / scripts/test_store_lock.mjs. Every
// racer is its own OS process — fs writes are synchronous inside one
// process, so "concurrent" async calls fired inside a single event loop
// never exercise a genuine race (critical-patterns 20260714).
//
// Two scenarios:
//   (a) DELIBERATE RED (falsifiability) — two racers through a test-owned
//       proxy that mimics the PRE-FIX writeTree shape (rmSync-whole-dir,
//       then a per-file mkdir+writeFileSync loop, widened with a small
//       per-file delay) with NO store lock in front of it, both racing the
//       SAME throwaway target dir. Demonstrates the exact torn-tree/crash
//       hazard cs-3 exists to kill: either a worker crashes (ENOENT when
//       its write lands after the other's rmSync fires mid-loop) or the
//       final dir is torn (fewer files than either racer alone would have
//       left). Runs in its own temp dir — the real committed plugin trees
//       are never touched by this scenario.
//   (b) SAFE, real production path — two concurrent REAL spawns of
//       `node scripts/render_plugin_skill_trees.mjs` against the actual
//       repo (the only target it knows how to write): both must exit 0,
//       and the resulting .claude-plugin/skills / .codex-plugin/skills
//       trees must byte-match a fresh independent render of canonical
//       skills/ (mirrors test_plugin_distribution.mjs's drift-pin check),
//       with each tree's .bee-render.json sidecar present and valid. Since
//       the render is a pure function of canonical skills/ (unchanged by
//       this test), the real committed trees end up byte-identical to
//       before the test ran — this run is content-neutral on the repo.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.join(path.dirname(__filename), '..');
const RENDER_SCRIPT = path.join(REPO_ROOT, 'scripts', 'render_plugin_skill_trees.mjs');

const RED_FILES_PER_WORKER = 24;
const RED_WIDEN_MS = 8;

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
    if (workerRole === 'unsafe-racer') {
      const targetDir = argVal('--target');
      const id = argVal('--id');
      // PRE-FIX writeTree shape, verbatim structure (no lock, no tmp-swap):
      // rmSync-whole-dir, then a per-file mkdir+writeFileSync loop. The
      // per-file delay stands in for the real per-file render work
      // (renderSkillBytes) that widens this exact window in production.
      fs.rmSync(targetDir, { recursive: true, force: true });
      for (let i = 0; i < RED_FILES_PER_WORKER; i++) {
        const dest = path.join(targetDir, `worker-${id}-file-${i}.txt`);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, `worker ${id} file ${i}\n`);
        // eslint-disable-next-line no-await-in-loop
        await sleep(RED_WIDEN_MS);
      }
      fs.writeFileSync(path.join(targetDir, `.sidecar-${id}.json`), '{}\n');
      process.stdout.write(`${JSON.stringify({ id, ok: true })}\n`);
      process.exit(0);
    } else {
      throw new Error(`unknown role: ${workerRole}`);
    }
  } catch (err) {
    process.stdout.write(`${JSON.stringify({ id: argVal('--id'), ok: false, error: String((err && err.message) || err) })}\n`);
    process.exit(1);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function spawnScript(scriptPath, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath, ...args], { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('exit', (code) => resolve({ code, stdout, stderr }));
    child.on('error', (err) => resolve({ code: null, stdout, stderr: String(err) }));
  });
}

function spawnRacers(count, argsFor) {
  const runs = [];
  for (let i = 0; i < count; i++) runs.push(spawnScript(__filename, argsFor(i)));
  return Promise.all(runs);
}

// ─── orchestrator ────────────────────────────────────────────────────────────

async function runOrchestrator() {
  const failures = [];

  // (a) DELIBERATE RED — widened-window rmSync-whole-dir + per-file writes
  // with NO store lock, proving the pre-fix hazard is real.
  {
    const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-render-race-red-'));
    try {
      const results = await spawnRacers(2, (i) => [`--role=unsafe-racer`, `--target=${targetDir}`, `--id=${i === 0 ? 'A' : 'B'}`]);
      const crashed = results.filter((r) => r.code !== 0);

      let finalFiles = [];
      try {
        finalFiles = fs.readdirSync(targetDir);
      } catch {
        finalFiles = [];
      }
      const aFiles = finalFiles.filter((f) => f.includes('worker-A-file-'));
      const bFiles = finalFiles.filter((f) => f.includes('worker-B-file-'));
      const torn = aFiles.length !== RED_FILES_PER_WORKER || bFiles.length !== RED_FILES_PER_WORKER;

      if (crashed.length === 0 && !torn) {
        failures.push(
          `(a) DETECTOR DID NOT BITE: both unguarded racers exited 0 and the final dir was intact ` +
            `(A=${aFiles.length}/${RED_FILES_PER_WORKER}, B=${bFiles.length}/${RED_FILES_PER_WORKER}) — this negative control ` +
            'must show a crash or a torn tree, or the (b) green result proves nothing.',
        );
      } else {
        console.log(
          `(a) RED confirmed: ${crashed.length} racer(s) crashed (${crashed
            .map((c) => JSON.parse((c.stdout.trim().split('\n').pop()) || '{}').error || `exit ${c.code}`)
            .join('; ')}), final dir torn=${torn} (A=${aFiles.length}/${RED_FILES_PER_WORKER}, B=${bFiles.length}/${RED_FILES_PER_WORKER}).`,
        );
      }
    } finally {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
  }

  // (b) SAFE, real production path — two concurrent REAL spawns of the
  // actual render script against the actual repo.
  {
    const runs = [spawnScript(RENDER_SCRIPT, [], { cwd: REPO_ROOT }), spawnScript(RENDER_SCRIPT, [], { cwd: REPO_ROOT })];
    const [r1, r2] = await Promise.all(runs);
    const crashed = [r1, r2].filter((r) => r.code !== 0);
    if (crashed.length) {
      failures.push(
        `(b) ${crashed.length}/2 concurrent real render spawn(s) failed:\n` +
          crashed.map((c) => `  exit=${c.code}\n  stdout: ${c.stdout.trim()}\n  stderr: ${c.stderr.trim()}`).join('\n'),
      );
    }

    // Independently recompute the expected render straight from canonical
    // skills/ (mirrors skills/bee-hive/scripts/test_plugin_distribution.mjs's
    // drift-pin check) and byte-compare against what actually landed on disk.
    const mod = await import(pathToFileURL(RENDER_SCRIPT).href);
    const files = mod.canonicalFiles();
    const errors = mod.validateWholeTree(files);
    if (errors.length) {
      failures.push(`(b) canonical skills/ failed marker validation (unexpected): ${errors.join('; ')}`);
    } else {
      for (const runtime of ['claude', 'codex']) {
        const targetRoot = mod.TARGET_ROOTS[runtime];
        const rendered = mod.renderTree(runtime, files);
        for (const [rel, expectedBytes] of rendered) {
          const destAbs = path.join(targetRoot, ...rel.split('/'));
          let actual;
          try {
            actual = fs.readFileSync(destAbs);
          } catch (err) {
            failures.push(`(b) ${runtime}: missing rendered file after concurrent runs: ${rel} (${err && err.message})`);
            continue;
          }
          if (!actual.equals(expectedBytes)) {
            failures.push(`(b) ${runtime}: ${rel} is not byte-identical to render(canonical) after concurrent runs`);
          }
        }
        const sidecarPath = path.join(targetRoot, '.bee-render.json');
        if (!fs.existsSync(sidecarPath)) {
          failures.push(`(b) ${runtime}: sidecar .bee-render.json missing after concurrent runs`);
        } else {
          try {
            const sidecar = JSON.parse(fs.readFileSync(sidecarPath, 'utf8'));
            const expectedSidecar = mod.sidecarObject(runtime, rendered);
            if (JSON.stringify(sidecar) !== JSON.stringify(expectedSidecar)) {
              failures.push(`(b) ${runtime}: sidecar content does not match expected render`);
            }
          } catch (err) {
            failures.push(`(b) ${runtime}: sidecar is not valid JSON: ${err && err.message}`);
          }
        }
        // No stray '.tmp-*' or '.old-*' siblings left behind by a clean run.
        const parent = path.dirname(targetRoot);
        const base = path.basename(targetRoot);
        const stray = fs.readdirSync(parent).filter((name) => name.startsWith(`${base}.tmp-`) || name.startsWith(`${base}.old-`));
        if (stray.length) {
          failures.push(`(b) ${runtime}: stray swap artifact(s) left behind: ${stray.join(', ')}`);
        }
      }
    }
  }

  // (c) live-pid discipline (tree-hygiene D3, th-5): cleanStaleTmpDirs must
  // sweep crash-leaked '<base>.old-*' siblings the same way it already sweeps
  // '<base>.tmp-*' ones — but only once the pid embedded in the dir's OWN
  // name is PROVEN dead (isPidAlive). A live pid's dir survives regardless of
  // age; a dead pid's dir is swept even if it is brand new. Exercised against
  // a throwaway scratch parent/base — the real committed plugin trees are
  // never touched by this scenario.
  {
    const mod = await import(pathToFileURL(RENDER_SCRIPT).href);
    if (typeof mod.cleanStaleTmpDirs !== 'function') {
      failures.push(
        '(c) render_plugin_skill_trees.mjs does not export cleanStaleTmpDirs — cannot exercise the live-pid sweep directly',
      );
    } else {
      const scratchParent = fs.mkdtempSync(path.join(os.tmpdir(), 'test-render-race-sweep-'));
      const targetRoot = path.join(scratchParent, 'skills');
      try {
        // A genuinely dead pid: spawn a child that exits immediately and
        // reuse its now-terminated pid — isPidAlive(deadPid) must read false.
        const dead = spawnSync(process.execPath, ['-e', 'process.exit(0)']);
        const deadPid = dead.pid;

        const liveOldDir = path.join(scratchParent, `skills.old-${process.pid}-deadbeef`);
        const deadOldDir = path.join(scratchParent, `skills.old-${deadPid}-deadbeef`);
        const liveTmpDir = path.join(scratchParent, `skills.tmp-${process.pid}-deadbeef`);
        const deadTmpDir = path.join(scratchParent, `skills.tmp-${deadPid}-deadbeef`);
        for (const d of [liveOldDir, deadOldDir, liveTmpDir, deadTmpDir]) {
          fs.mkdirSync(d, { recursive: true });
          fs.writeFileSync(path.join(d, 'marker.txt'), 'x');
        }

        mod.cleanStaleTmpDirs(targetRoot);

        if (!fs.existsSync(liveOldDir)) {
          failures.push('(c) a live-pid .old-* dir was swept — never remove a dir owned by a live pid');
        }
        if (!fs.existsSync(liveTmpDir)) {
          failures.push('(c) a live-pid .tmp-* dir was swept — never remove a dir owned by a live pid');
        }
        if (fs.existsSync(deadOldDir)) {
          failures.push(
            '(c) a dead-pid .old-* dir survived the sweep — crash-leaked .old-* siblings must be swept the same way .tmp-* already is',
          );
        }
        if (fs.existsSync(deadTmpDir)) {
          failures.push('(c) a dead-pid .tmp-* dir survived the sweep');
        }
      } finally {
        fs.rmSync(scratchParent, { recursive: true, force: true });
      }
    }
  }

  if (failures.length) {
    console.error('FAIL test_render_race:');
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }

  console.log(
    'PASS test_render_race: (a) deliberate-red unguarded proxy crashed/tore at least one racer\'s tree (detector bites, lock ' +
      'removed); (b) 2 concurrent real render_plugin_skill_trees.mjs spawns -> both exit 0, both plugin trees byte-match a ' +
      'fresh render(canonical), both sidecars present and valid, no stray tmp/old swap artifacts; (c) cleanStaleTmpDirs sweeps ' +
      'a dead-pid .tmp-*/.old-* dir while a live-pid one survives (live-pid discipline).',
  );
}
