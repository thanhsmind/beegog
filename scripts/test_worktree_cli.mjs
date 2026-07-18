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
import { createFeatureWorktree } from '../.bee/bin/lib/worktree-store.mjs';

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

  // ── worktree new: create + register in one move (wsr-1, GH #21) ──────────
  const newFeature = 'wsr-new-demo';
  const newSibling = path.join(tmp, `${path.basename(main)}--wt--${newFeature}`);
  const newBranch = `wt/${newFeature}`;

  const newResult = bee(main, ['worktree', 'new', '--feature', newFeature, '--json']);
  {
    const ok = newResult.status === 0;
    record('worktree new exits 0', ok, `status=${newResult.status} stdout=${newResult.stdout} stderr=${newResult.stderr}`);
  }
  let newJson = null;
  try {
    newJson = JSON.parse(newResult.stdout);
  } catch {
    /* checked below */
  }
  let newId = null;
  {
    const ok = newJson && typeof newJson.id === 'string' && newJson.worktreeRoot && newJson.branch === newBranch;
    newId = newJson && newJson.id;
    record('worktree new --json reports id, worktreeRoot, and branch "wt/<feature>"', ok, newResult.stdout);
  }
  {
    const ok = fs.existsSync(newSibling);
    record('worktree new created the sibling directory ../<repo-basename>--wt--<feature>', ok, newSibling);
  }
  {
    const newStateFile = path.join(newSibling, '.bee', 'state.json');
    const stateExists = fs.existsSync(newStateFile);
    let state = null;
    if (stateExists) state = JSON.parse(fs.readFileSync(newStateFile, 'utf8'));
    const ok =
      stateExists &&
      state.feature === newFeature &&
      state.phase === 'idle' &&
      state.approved_gates &&
      Object.values(state.approved_gates).every((g) => g === false);
    record("worktree new's created worktree has a bootstrapped idle .bee/state.json", ok, JSON.stringify(state));
  }
  {
    const ok = fs.existsSync(path.join(newSibling, '.bee', 'onboarding.json'));
    record('worktree new bootstrap copied onboarding.json from the main store', ok, path.join(newSibling, '.bee', 'onboarding.json'));
  }

  // ── worktree list shows the grant "worktree new" created ─────────────────
  {
    const listResult2 = bee(main, ['worktree', 'list', '--json']);
    let listJson2 = null;
    try {
      listJson2 = JSON.parse(listResult2.stdout);
    } catch {
      /* checked below */
    }
    const ok = listResult2.status === 0 && listJson2 && newId && listJson2.grants[newId] === true;
    record('worktree list shows the grant "worktree new" created', ok, listResult2.stdout);
  }

  // ── repeated "new" for the SAME feature typed-refuses (target dir already
  // exists), zero mutation. ─────────────────────────────────────────────────
  {
    const grantsSnapshot = fs.readFileSync(grantsFile, 'utf8');
    const repeatResult = bee(main, ['worktree', 'new', '--feature', newFeature, '--json']);
    const ok = repeatResult.status !== 0 && /WORKTREE_TARGET_EXISTS/.test(repeatResult.stdout + repeatResult.stderr);
    record(
      'repeated "worktree new" for the same feature typed-refuses (WORKTREE_TARGET_EXISTS)',
      ok,
      `status=${repeatResult.status} stdout=${repeatResult.stdout} stderr=${repeatResult.stderr}`,
    );
    const grantsAfter = fs.readFileSync(grantsFile, 'utf8');
    record('repeated "worktree new" refusal is zero-mutation (grants file unchanged)', grantsAfter === grantsSnapshot, grantsAfter);
  }

  // ── bad slugs refuse (WORKTREE_INVALID_SLUG), zero mutation ──────────────
  const badSlugs = ['../../etc', '-leading-dash', 'Uppercase', 'has space', 'semi;colon', 'trailing/'];
  for (const badSlug of badSlugs) {
    const before = fs.readFileSync(grantsFile, 'utf8');
    const beforeEntries = fs.readdirSync(tmp).sort();
    const badResult = bee(main, ['worktree', 'new', '--feature', badSlug, '--json']);
    const ok = badResult.status !== 0 && /WORKTREE_INVALID_SLUG/.test(badResult.stdout + badResult.stderr);
    record(
      `worktree new refuses bad slug ${JSON.stringify(badSlug)} (WORKTREE_INVALID_SLUG)`,
      ok,
      `status=${badResult.status} stdout=${badResult.stdout} stderr=${badResult.stderr}`,
    );
    const after = fs.readFileSync(grantsFile, 'utf8');
    const afterEntries = fs.readdirSync(tmp).sort();
    const mutationOk = after === before && JSON.stringify(afterEntries) === JSON.stringify(beforeEntries);
    record(
      `worktree new bad slug ${JSON.stringify(badSlug)} refusal is zero-mutation (no new dir, grants unchanged)`,
      mutationOk,
      `before=${JSON.stringify(beforeEntries)} after=${JSON.stringify(afterEntries)}`,
    );
  }

  // ── running "new" from inside a linked worktree refuses (typed, non-crash),
  // zero mutation. ──────────────────────────────────────────────────────────
  {
    const before = fs.readFileSync(grantsFile, 'utf8');
    const beforeEntries = fs.readdirSync(tmp).sort();
    const fromWtResult = bee(wt, ['worktree', 'new', '--feature', 'wsr-from-linked', '--json']);
    const ok = fromWtResult.status !== 0 && !/at Object|TypeError|ReferenceError/.test(fromWtResult.stderr);
    record(
      'worktree new run from inside a linked worktree refuses (typed, non-crash)',
      ok,
      `status=${fromWtResult.status} stdout=${fromWtResult.stdout} stderr=${fromWtResult.stderr}`,
    );
    const after = fs.readFileSync(grantsFile, 'utf8');
    const afterEntries = fs.readdirSync(tmp).sort();
    const mutationOk = after === before && JSON.stringify(afterEntries) === JSON.stringify(beforeEntries);
    record('worktree new run from inside a linked worktree is zero-mutation', mutationOk, `before=${JSON.stringify(beforeEntries)} after=${JSON.stringify(afterEntries)}`);
  }

  // ── --base-ref is honored (branches off an explicit ref, not just HEAD) ──
  {
    const baseRefFeature = 'wsr-base-ref-demo';
    const baseRefResult = bee(main, ['worktree', 'new', '--feature', baseRefFeature, '--base-ref', 'main', '--json']);
    const ok = baseRefResult.status === 0;
    record('worktree new --base-ref main exits 0', ok, `status=${baseRefResult.status} stdout=${baseRefResult.stdout} stderr=${baseRefResult.stderr}`);
  }
  {
    const badRefResult = bee(main, ['worktree', 'new', '--feature', 'wsr-bad-base-ref', '--base-ref', 'not a ref!!', '--json']);
    const ok = badRefResult.status !== 0 && /WORKTREE_INVALID_BASE_REF/.test(badRefResult.stdout + badRefResult.stderr);
    record('worktree new refuses an invalid --base-ref (WORKTREE_INVALID_BASE_REF)', ok, `status=${badRefResult.status} stdout=${badRefResult.stdout} stderr=${badRefResult.stderr}`);
  }

  // ── injected post-add failure rolls back (dir + grant + branch) and
  // reports typed — exercised directly against createFeatureWorktree (the
  // CLI's argv surface has no fault-injection hook), reusing the SAME real
  // temp repo the rest of this script already proved `bee worktree new`
  // against. ─────────────────────────────────────────────────────────────
  {
    const rollbackFeature = 'wsr-rollback-demo';
    const rollbackSibling = path.join(tmp, `${path.basename(main)}--wt--${rollbackFeature}`);
    const rollbackBranch = `wt/${rollbackFeature}`;
    let caught = null;
    try {
      createFeatureWorktree(main, {
        feature: rollbackFeature,
        _bootstrapWorktreeStore: () => {
          throw new Error('injected-bootstrap-failure');
        },
      });
    } catch (error) {
      caught = error;
    }
    {
      const ok = caught && caught.code === 'WORKTREE_POST_ADD_FAILED' && /injected-bootstrap-failure/.test(caught.message);
      record(
        'injected post-add failure throws a typed WORKTREE_POST_ADD_FAILED error naming the underlying cause',
        ok,
        caught ? `${caught.code}: ${caught.message}` : 'no error thrown',
      );
    }
    {
      const ok = !fs.existsSync(rollbackSibling);
      record('injected post-add failure rolls back: the sibling directory was removed', ok, rollbackSibling);
    }
    {
      const branchList = git(main, ['branch', '--list', rollbackBranch]).trim();
      record('injected post-add failure rolls back: the branch was removed too', branchList.length === 0, `git branch --list ${rollbackBranch} -> "${branchList}"`);
    }
    {
      const grants = JSON.parse(fs.readFileSync(grantsFile, 'utf8'));
      const likelyId = `${path.basename(main)}--wt--${rollbackFeature}`;
      const ok = !(likelyId in grants);
      record('injected post-add failure rolls back: no grant was left behind', ok, JSON.stringify(grants));
    }
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

const failed = results.filter((r) => !r.passed);
console.log(`SUMMARY: ${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 7 : 0);
