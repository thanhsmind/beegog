#!/usr/bin/env node
// Proves the `bee worktree` CLI group (worktree-feature-parallelism Slice A)
// end-to-end against a REAL temp git repo + real `git worktree add`: register
// grants the current linked worktree its own store and bootstraps it, list
// reflects the registry, unregister removes the grant and resolveRoots falls
// back to main again. Runs the real dispatcher via spawnSync (no mocking),
// mirroring scripts/test_worktree_grant_resolve.mjs's fixture pattern.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveRoots } from '../.bee/bin/lib/state.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');
const BEE_MJS = path.join(REPO_ROOT, '.bee', 'bin', 'bee.mjs');

const results = [];
function record(desc, passed, detail) {
  results.push({ desc, passed });
  console.log((passed ? 'PASS ' : 'FAIL ') + desc + (passed ? '' : ` -- ${detail}`));
}

function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} (cwd=${cwd}) failed: ${r.stderr}`);
  return r.stdout;
}

function bee(cwd, args) {
  return spawnSync('node', [BEE_MJS, ...args], { cwd, encoding: 'utf8' });
}

function verifiedId(wtPath) {
  const gitFile = fs.readFileSync(path.join(wtPath, '.git'), 'utf8').trim();
  const m = gitFile.match(/^gitdir:\s*(.+)$/);
  const gitdir = path.resolve(wtPath, m[1].trim());
  return path.basename(gitdir);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-worktree-cli-'));
try {
  const main = path.join(tmp, 'main');
  fs.mkdirSync(main);
  git(main, ['init', '-q', '-b', 'main']);
  git(main, ['config', 'user.email', 's@e']);
  git(main, ['config', 'user.name', 's']);
  fs.writeFileSync(path.join(main, 'f'), 'x');
  git(main, ['add', '.']);
  git(main, ['commit', '-q', '-m', 'init']);

  const mainBeeDir = path.join(main, '.bee');
  fs.mkdirSync(mainBeeDir, { recursive: true });
  fs.writeFileSync(path.join(mainBeeDir, 'onboarding.json'), JSON.stringify({ schema_version: '1.0', bee_version: '0.0.0' }));
  fs.writeFileSync(path.join(mainBeeDir, 'config.json'), JSON.stringify({ commands: {} }));

  const wt = path.join(tmp, 'wt');
  git(main, ['worktree', 'add', '-q', '-b', 'feat', wt]);
  const id = verifiedId(wt);
  const grantsFile = path.join(mainBeeDir, 'runtime', 'worktree-grants.json');
  const fileInWt = path.join(wt, 'src.txt');

  // ── before register: resolveRoots reports linked-valid but falls back to
  // main (P40 default) — the grant does not exist yet. ─────────────────────
  {
    const r = resolveRoots(fileInWt);
    const ok = r.worktreeResolution === 'linked-valid' && fs.realpathSync(r.storeRoot) === fs.realpathSync(main);
    record('before register: resolveRoots falls back to the main store (not yet granted)', ok, JSON.stringify(r));
  }

  // ── register ────────────────────────────────────────────────────────────
  const registerResult = bee(wt, ['worktree', 'register', '--feature', 'demo-feature', '--json']);
  {
    const ok = registerResult.status === 0;
    record('worktree register exits 0', ok, `status=${registerResult.status} stdout=${registerResult.stdout} stderr=${registerResult.stderr}`);
  }
  let registerJson = null;
  try {
    registerJson = JSON.parse(registerResult.stdout);
  } catch {
    /* checked below */
  }
  {
    const ok = registerJson && registerJson.ok === true && registerJson.id === id && registerJson.bootstrap && registerJson.bootstrap.created === true;
    record('worktree register --json reports ok:true, the git-verified id, and bootstrap.created:true', ok, registerResult.stdout);
  }

  // ── the grant landed in the MAIN store's registry ─────────────────────────
  {
    const ok = fs.existsSync(grantsFile) && JSON.parse(fs.readFileSync(grantsFile, 'utf8'))[id] === true;
    record('grant appears in <main>/.bee/runtime/worktree-grants.json', ok, fs.existsSync(grantsFile) ? fs.readFileSync(grantsFile, 'utf8') : 'grants file missing');
  }

  // ── the worktree's own .bee/state.json was bootstrapped ──────────────────
  const worktreeStateFile = path.join(wt, '.bee', 'state.json');
  {
    const ok = fs.existsSync(worktreeStateFile);
    record("worktree's .bee/state.json was bootstrapped", ok, worktreeStateFile);
  }
  let worktreeState = null;
  if (fs.existsSync(worktreeStateFile)) worktreeState = JSON.parse(fs.readFileSync(worktreeStateFile, 'utf8'));
  {
    const ok =
      worktreeState &&
      worktreeState.feature === 'demo-feature' &&
      worktreeState.phase === 'idle' &&
      worktreeState.approved_gates &&
      Object.values(worktreeState.approved_gates).every((g) => g === false);
    record(
      'bootstrapped state.json has feature=demo-feature, phase=idle, every gate false',
      ok,
      JSON.stringify(worktreeState),
    );
  }
  {
    const ok = fs.existsSync(path.join(wt, '.bee', 'onboarding.json'));
    record("bootstrap copied onboarding.json from the main store", ok, path.join(wt, '.bee', 'onboarding.json'));
  }

  // ── resolveRoots(<file in worktree>) now resolves to the worktree's OWN
  // store, not main. ─────────────────────────────────────────────────────
  {
    const r = resolveRoots(fileInWt);
    const ok =
      r.worktreeResolution === 'linked-valid' &&
      r.storeRoot &&
      fs.realpathSync(r.storeRoot) === fs.realpathSync(wt) &&
      fs.realpathSync(r.storeRoot) !== fs.realpathSync(main) &&
      r.id === id;
    record('after register: resolveRoots resolves the worktree file to its OWN local store', ok, JSON.stringify(r));
  }

  // ── register is idempotent: re-running does not clobber the existing
  // worktree state.json. ────────────────────────────────────────────────────
  fs.writeFileSync(worktreeStateFile, `${JSON.stringify({ ...worktreeState, phase: 'swarming', sentinel: 'do-not-clobber' }, null, 2)}\n`);
  const reregisterResult = bee(wt, ['worktree', 'register', '--feature', 'demo-feature', '--json']);
  {
    const ok = reregisterResult.status === 0;
    record('re-running worktree register exits 0 (idempotent, not an error)', ok, `status=${reregisterResult.status} stderr=${reregisterResult.stderr}`);
  }
  {
    let reregisterJson = null;
    try {
      reregisterJson = JSON.parse(reregisterResult.stdout);
    } catch {
      /* checked below */
    }
    const ok = reregisterJson && reregisterJson.bootstrap && reregisterJson.bootstrap.created === false;
    record('re-running worktree register reports bootstrap.created:false (skipped)', ok, reregisterResult.stdout);
  }
  {
    const afterState = JSON.parse(fs.readFileSync(worktreeStateFile, 'utf8'));
    const ok = afterState.sentinel === 'do-not-clobber' && afterState.phase === 'swarming';
    record('re-running worktree register never overwrote the existing worktree state.json', ok, JSON.stringify(afterState));
  }
  // restore a clean state.json for the rest of the run (undo the sentinel mutation)
  fs.writeFileSync(worktreeStateFile, `${JSON.stringify(worktreeState, null, 2)}\n`);

  // ── list reflects the grant ───────────────────────────────────────────────
  const listResult = bee(wt, ['worktree', 'list', '--json']);
  {
    const ok = listResult.status === 0;
    record('worktree list exits 0', ok, `status=${listResult.status} stderr=${listResult.stderr}`);
  }
  {
    let listJson = null;
    try {
      listJson = JSON.parse(listResult.stdout);
    } catch {
      /* checked below */
    }
    const ok = listJson && listJson.grants && listJson.grants[id] === true;
    record('worktree list --json includes the registered id', ok, listResult.stdout);
  }

  // ── unregister (no --id: defaults to the current worktree's own id) ──────
  const unregisterResult = bee(wt, ['worktree', 'unregister', '--json']);
  {
    const ok = unregisterResult.status === 0;
    record('worktree unregister (no --id) exits 0', ok, `status=${unregisterResult.status} stdout=${unregisterResult.stdout} stderr=${unregisterResult.stderr}`);
  }
  {
    let unregisterJson = null;
    try {
      unregisterJson = JSON.parse(unregisterResult.stdout);
    } catch {
      /* checked below */
    }
    const ok = unregisterJson && unregisterJson.ok === true && unregisterJson.id === id;
    record('worktree unregister --json reports ok:true and the removed id', ok, unregisterResult.stdout);
  }
  {
    const grants = JSON.parse(fs.readFileSync(grantsFile, 'utf8'));
    const ok = !(id in grants);
    record('grant is gone from <main>/.bee/runtime/worktree-grants.json after unregister', ok, JSON.stringify(grants));
  }

  // ── list reflects the removal ─────────────────────────────────────────────
  const listAfterResult = bee(wt, ['worktree', 'list', '--json']);
  {
    const listAfterJson = JSON.parse(listAfterResult.stdout);
    const ok = listAfterJson.grants[id] !== true;
    record('worktree list --json no longer shows the id as granted', ok, listAfterResult.stdout);
  }

  // ── after unregister: resolveRoots falls back to main again ──────────────
  {
    const r = resolveRoots(fileInWt);
    const ok = r.storeRoot && fs.realpathSync(r.storeRoot) === fs.realpathSync(main);
    record('after unregister: resolveRoots falls back to the main store again', ok, JSON.stringify(r));
  }

  // ── register from an ordinary (non-worktree) checkout fails with a typed
  // error, never crashes uncaught. ──────────────────────────────────────────
  const ordinaryRegisterResult = bee(main, ['worktree', 'register', '--feature', 'x', '--json']);
  {
    const ok = ordinaryRegisterResult.status !== 0 && !/at Object|TypeError|ReferenceError/.test(ordinaryRegisterResult.stderr);
    record(
      'worktree register from an ordinary checkout fails with a typed (non-crash) error',
      ok,
      `status=${ordinaryRegisterResult.status} stdout=${ordinaryRegisterResult.stdout} stderr=${ordinaryRegisterResult.stderr}`,
    );
  }

  // ── unregister --id <explicit> works from anywhere (e.g. from main) ──────
  bee(wt, ['worktree', 'register', '--feature', 'demo-feature-2', '--json']);
  const explicitUnregisterResult = bee(main, ['worktree', 'unregister', '--id', id, '--json']);
  {
    const ok = explicitUnregisterResult.status === 0;
    record('worktree unregister --id <explicit> from the main checkout exits 0', ok, `status=${explicitUnregisterResult.status} stderr=${explicitUnregisterResult.stderr}`);
  }
  {
    const grants = JSON.parse(fs.readFileSync(grantsFile, 'utf8'));
    const ok = !(id in grants);
    record('explicit --id unregister removed the grant', ok, JSON.stringify(grants));
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

const failed = results.filter((r) => !r.passed);
console.log(`SUMMARY: ${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 7 : 0);
