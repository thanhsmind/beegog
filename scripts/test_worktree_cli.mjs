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
import { createFeatureWorktree, mergeFeatureWorktree } from '../.bee/bin/lib/worktree-store.mjs';

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

// ─── "bee worktree merge --id <id>" (GH #21, decision D8; reworked into a
// STAGED transaction by decision D2-REVISED, user review P1-2): merge-back
// with the semantic-conflict alarm (wsr-2) ─────────────────────────────────
// Every fixture below is set up so its own assertions are self-contained —
// none of them depend on state a PRIOR test happened to leave behind
// (advisor R6 fixture-chain warning). This matters concretely for mainA: the
// old contract's "merge commit is never rolled back" meant a red-verify test
// that flipped flag.txt to "on" left it flipped for every later test on the
// same fixture; under the new abort-on-red contract that flip is undone the
// moment bee runs "git merge --abort", so any later test that wants a red
// verify creates its OWN worktree that flips flag.txt itself, rather than
// reusing residue from an earlier case.
//
// A production-shaped .gitignore (byte-copy of this repo's own top-level
// .bee/* ignore rules) is committed into the fixture main repo so a freshly
// bootstrapped worktree store's cache/runtime-tier files (state.json,
// runtime/) are genuinely invisible to "git status --porcelain" — the same
// way they are in the real repo — while onboarding.json/config.json are
// TRACKED (inherited by every worktree via the normal git checkout), proving
// decision D8a for real rather than special-casing the test.
const BEE_GITIGNORE = [
  '.bee/state.json',
  '.bee/reservations.json',
  '.bee/workers/',
  '.bee/logs/',
  '.bee/capture-queue.jsonl',
  '.bee/feedback-digest.json',
  '.bee/.inject-cache.json',
  '.bee/HANDOFF.json',
  '.bee/spikes/',
  '.bee/manifest-hash.json',
  '.bee/sessions/',
  '.bee/claims/',
  '.bee/runtime/',
  '.bee/cache/',
  '',
].join('\n');

function initMergeFixtureMain(main, { verifyScript } = {}) {
  fs.mkdirSync(main, { recursive: true });
  git(main, ['init', '-q', '-b', 'main']);
  git(main, ['config', 'user.email', 's@e']);
  git(main, ['config', 'user.name', 's']);
  fs.writeFileSync(path.join(main, '.gitignore'), BEE_GITIGNORE);
  fs.mkdirSync(path.join(main, '.bee'), { recursive: true });
  fs.writeFileSync(path.join(main, '.bee', 'onboarding.json'), JSON.stringify({ schema_version: '1.0', bee_version: '0.0.0' }));
  const config = verifyScript ? { commands: { verify: `node ${verifyScript}` } } : { commands: {} };
  fs.writeFileSync(path.join(main, '.bee', 'config.json'), JSON.stringify(config));
  fs.writeFileSync(path.join(main, 'f'), 'x');
  if (verifyScript) {
    fs.writeFileSync(
      path.join(main, verifyScript),
      "import fs from 'node:fs';\nconst v = fs.readFileSync('flag.txt', 'utf8').trim();\nprocess.exit(v === 'off' ? 0 : 1);\n",
    );
    fs.writeFileSync(path.join(main, 'flag.txt'), 'off');
  }
  git(main, ['add', '.']);
  git(main, ['commit', '-q', '-m', 'init']);
}

function mergeNewWorktree(main, feature) {
  const r = bee(main, ['worktree', 'new', '--feature', feature, '--json']);
  if (r.status !== 0) throw new Error(`worktree new --feature ${feature} failed: status=${r.status} stdout=${r.stdout} stderr=${r.stderr}`);
  return JSON.parse(r.stdout);
}

// The three-part "main was left byte-untouched" proof (decision D2-REVISED)
// bee itself runs after every "git merge --abort" — asserted independently
// here rather than trusted, exactly like the library code does it: HEAD
// unchanged, no live MERGE_HEAD/MERGE_MSG, and a clean tracked status.
function threePartProof(main, preHead) {
  const headNow = git(main, ['rev-parse', 'HEAD']).trim();
  const mergeHeadGone = !fs.existsSync(path.join(main, '.git', 'MERGE_HEAD'));
  const mergeMsgGone = !fs.existsSync(path.join(main, '.git', 'MERGE_MSG'));
  const statusClean = git(main, ['status', '--porcelain', '--untracked-files=no']).trim() === '';
  return {
    ok: headNow === preHead && mergeHeadGone && mergeMsgGone && statusClean,
    headNow,
    mergeHeadGone,
    mergeMsgGone,
    statusClean,
  };
}

const mergeTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bee-worktree-merge-'));
try {
  // ── fixture A: verify checks flag.txt === "off" — proves the green path,
  // the semantic-conflict alarm (MERGE_VERIFY_RED), and D8a (bootstrapped
  // store + committed work merges cleanly) all in one repo. ────────────────
  const mainA = path.join(mergeTmp, 'mainA');
  initMergeFixtureMain(mainA, { verifyScript: 'verify.mjs' });

  // ── green path: committed work in the worktree, verify still passes
  // (flag.txt untouched) — also the D8a proof (a bootstrapped .bee store,
  // gitignored, does not make the worktree "dirty"). ────────────────────────
  const greenCreated = mergeNewWorktree(mainA, 'wsr-merge-green');
  fs.writeFileSync(path.join(greenCreated.worktreeRoot, 'feature.txt'), 'hello from the worktree\n');
  git(greenCreated.worktreeRoot, ['add', 'feature.txt']);
  git(greenCreated.worktreeRoot, ['commit', '-q', '-m', 'feature work']);
  {
    const ok =
      fs.existsSync(path.join(greenCreated.worktreeRoot, '.bee', 'state.json')) &&
      !fs.existsSync(path.join(greenCreated.worktreeRoot, '.git')) === false; // sanity: worktree is real
    record('green-path fixture has a bootstrapped .bee/state.json (D8a setup sanity)', ok, greenCreated.worktreeRoot);
  }
  const greenResult = bee(mainA, ['worktree', 'merge', '--id', greenCreated.id, '--json']);
  {
    const ok = greenResult.status === 0;
    record('worktree merge (green path) exits 0', ok, `status=${greenResult.status} stdout=${greenResult.stdout} stderr=${greenResult.stderr}`);
  }
  let greenJson = null;
  try {
    greenJson = JSON.parse(greenResult.stdout);
  } catch {
    /* checked below */
  }
  {
    const ok = greenJson && greenJson.ok === true && greenJson.merged === true && greenJson.verify === 'green' && greenJson.branch === `wt/wsr-merge-green`;
    record(
      'worktree merge --json reports ok:true, merged:true, verify:"green" (D8a: bootstrapped-store-only worktree merges — not dirty)',
      ok,
      greenResult.stdout,
    );
  }
  {
    const log = git(mainA, ['log', '--oneline', '-1']).trim();
    const ok = /Merge worktree/.test(git(mainA, ['log', '-1', '--pretty=%B']));
    record('green-path merge landed a real merge commit on main naming the id', ok, log);
  }
  {
    const ok = fs.existsSync(path.join(mainA, 'feature.txt'));
    record('green-path merge brought the worktree\'s committed file into main', ok, mainA);
  }
  {
    // greenCreated's branch never diverged from main's own history (main
    // gained no commits of its own between "worktree new" and this merge),
    // so this IS the fast-forward-eligible case: "git merge --no-ff
    // --no-commit" must still stage (and, once committed, still yield) a
    // TRUE two-parent merge commit rather than silently fast-forwarding the
    // ref — the explicit --no-ff/--no-commit interaction the rework depends
    // on (main is never left mid-merge, but it also never loses the "always
    // a real merge commit" guarantee `--no-ff` alone used to provide).
    const parents = git(mainA, ['log', '-1', '--pretty=%P']).trim().split(/\s+/).filter(Boolean);
    record('green-path (fast-forward-eligible) merge still produced a TRUE 2-parent merge commit, not a fast-forward', parents.length === 2, `parents=${JSON.stringify(parents)}`);
  }

  // ── semantic-conflict alarm: a SECOND worktree changes flag.txt (no file
  // main also touches, so the merge is textually clean) to "on" — verify
  // runs against the merged-but-UNCOMMITTED tree and goes red BEFORE any
  // commit ever exists, so the merge is aborted and main is proven
  // byte-untouched (decision D2-REVISED — supersedes the old "merge commit
  // is never rolled back" contract: under the new invariant there is no
  // merge commit to roll back in the first place). ──────────────────────────
  const alarmPreHead = git(mainA, ['log', '-1', '--pretty=%H']).trim();
  const alarmCreated = mergeNewWorktree(mainA, 'wsr-merge-alarm');
  fs.writeFileSync(path.join(alarmCreated.worktreeRoot, 'flag.txt'), 'on');
  git(alarmCreated.worktreeRoot, ['commit', '-am', 'flip the flag']);
  const alarmResult = bee(mainA, ['worktree', 'merge', '--id', alarmCreated.id, '--json']);
  {
    const ok = alarmResult.status === 1;
    record('semantic-conflict alarm: worktree merge exits 1 on a red post-merge verify', ok, `status=${alarmResult.status} stdout=${alarmResult.stdout}`);
  }
  let alarmJson = null;
  try {
    alarmJson = JSON.parse(alarmResult.stdout);
  } catch {
    /* checked below */
  }
  {
    const ok = alarmJson && alarmJson.ok === false && alarmJson.code === 'MERGE_VERIFY_RED' && alarmJson.merged === false && alarmJson.verify === 'red' && typeof alarmJson.output_tail === 'string';
    record('semantic-conflict alarm: --json reports ok:false, code:"MERGE_VERIFY_RED", merged:false (never committed), verify:"red", and an output_tail', ok, alarmResult.stdout);
  }
  {
    const ok = /semantic-conflict alarm/.test(JSON.stringify(alarmJson));
    record('semantic-conflict alarm result names it a semantic-conflict alarm in prose', ok, JSON.stringify(alarmJson));
  }
  {
    const ok = /byte-untouched/.test(JSON.stringify(alarmJson)) && /no merge commit exists/.test(JSON.stringify(alarmJson));
    record('semantic-conflict alarm result states in prose that main was left byte-untouched and no merge commit exists', ok, JSON.stringify(alarmJson));
  }
  {
    const proof = threePartProof(mainA, alarmPreHead);
    record('semantic-conflict alarm: the staged merge was aborted and main passes the three-part untouched proof (HEAD unchanged, no MERGE_HEAD/MERGE_MSG, clean status)', proof.ok, JSON.stringify(proof));
  }
  {
    // Do NOT assert "no /Merge worktree/ in the log" here — mainA's HEAD
    // already carries the EARLIER green-path merge commit (also named
    // "Merge worktree ..."), so that phrase legitimately appears regardless
    // of this attempt. HEAD-equality to the pre-attempt value is already
    // proven above by threePartProof; this just re-confirms the visible
    // symptom: flag.txt is back to "off" (the abort undid the staged flip),
    // and this attempt's OWN branch name is nowhere in the log (it was
    // never committed).
    const log = git(mainA, ['log', '-1', '--pretty=%B']);
    const flagContent = fs.readFileSync(path.join(mainA, 'flag.txt'), 'utf8').trim();
    const ok = !/wsr-merge-alarm/.test(log) && flagContent === 'off';
    record('semantic-conflict alarm: no merge commit for THIS attempt landed, and flag.txt reverted to "off" on main (the abort undid the staged flip)', ok, `log=${log} flag=${flagContent}`);
  }

  // ── unknown/ungranted id: typed, zero-mutation. ───────────────────────────
  {
    const before = git(mainA, ['log', '-1', '--pretty=%H']);
    const r = bee(mainA, ['worktree', 'merge', '--id', 'not-a-real-id', '--json']);
    const ok = r.status !== 0 && /WORKTREE_MERGE_UNKNOWN_ID/.test(r.stdout + r.stderr);
    record('worktree merge refuses an unknown/ungranted id (WORKTREE_MERGE_UNKNOWN_ID)', ok, `status=${r.status} stdout=${r.stdout} stderr=${r.stderr}`);
    const after = git(mainA, ['log', '-1', '--pretty=%H']);
    record('unknown-id refusal is zero-mutation (main HEAD unchanged)', before === after, `${before} vs ${after}`);
  }

  // ── fixture B: no commands.verify recorded — used for the conflict case,
  // the remaining pre-flight refusals, and cleanup (verify:'skipped'). ──────
  const mainB = path.join(mergeTmp, 'mainB');
  initMergeFixtureMain(mainB);
  const grantsFileB = path.join(mainB, '.bee', 'runtime', 'worktree-grants.json');

  // ── MERGE_CONFLICT: main and the worktree both edit the SAME line of a
  // tracked file after branching -> a real textual conflict. Under the
  // staged-transaction rework bee itself runs "git merge --abort" and
  // proves main untouched — there is no conflict state left for a human to
  // resolve on main anymore (it never gets that far); a human resolves the
  // conflict in the WORKTREE and retries the merge instead. ────────────────
  const conflictCreated = mergeNewWorktree(mainB, 'wsr-merge-conflict');
  fs.writeFileSync(path.join(conflictCreated.worktreeRoot, 'f'), 'from the worktree\n');
  git(conflictCreated.worktreeRoot, ['commit', '-am', 'worktree edits f']);
  fs.writeFileSync(path.join(mainB, 'f'), 'from main\n');
  git(mainB, ['commit', '-am', 'main edits f too']);
  const conflictPreHead = git(mainB, ['log', '-1', '--pretty=%H']).trim(); // AFTER "main edits f too" landed — the real pre-merge-attempt HEAD
  const conflictResult = bee(mainB, ['worktree', 'merge', '--id', conflictCreated.id, '--json']);
  {
    const ok = conflictResult.status !== 0;
    record('worktree merge exits non-zero on a real textual conflict', ok, `status=${conflictResult.status} stdout=${conflictResult.stdout}`);
  }
  let conflictJson = null;
  try {
    conflictJson = JSON.parse(conflictResult.stdout);
  } catch {
    /* checked below */
  }
  {
    const ok = conflictJson && conflictJson.ok === false && conflictJson.code === 'MERGE_CONFLICT';
    record('worktree merge --json reports ok:false, code:"MERGE_CONFLICT"', ok, conflictResult.stdout);
  }
  {
    const ok = /byte-untouched/.test(JSON.stringify(conflictJson));
    record('MERGE_CONFLICT result states in prose that main was left byte-untouched', ok, JSON.stringify(conflictJson));
  }
  {
    // conflictPreHead was captured AFTER "main edits f too" landed, i.e. the
    // real pre-merge-attempt HEAD — bee already ran "git merge --abort"
    // internally by the time this returns, so main must already be back to
    // that exact state (no manual cleanup abort needed or possible: there is
    // nothing left to abort).
    const proof = threePartProof(mainB, conflictPreHead);
    record('MERGE_CONFLICT: bee already aborted the staged merge and main passes the three-part untouched proof (HEAD unchanged, no MERGE_HEAD/MERGE_MSG, clean status)', proof.ok, JSON.stringify(proof));
  }

  // ── dirty MAIN refuses, zero-mutation. ────────────────────────────────────
  const dirtyMainCreated = mergeNewWorktree(mainB, 'wsr-merge-dirty-main');
  fs.writeFileSync(path.join(mainB, 'f'), 'uncommitted main edit\n');
  {
    const before = git(mainB, ['log', '-1', '--pretty=%H']);
    const r = bee(mainB, ['worktree', 'merge', '--id', dirtyMainCreated.id, '--json']);
    const ok = r.status !== 0 && /WORKTREE_MERGE_MAIN_DIRTY/.test(r.stdout + r.stderr);
    record('worktree merge refuses a dirty MAIN tree (WORKTREE_MERGE_MAIN_DIRTY)', ok, `status=${r.status} stdout=${r.stdout} stderr=${r.stderr}`);
    const after = git(mainB, ['log', '-1', '--pretty=%H']);
    record('dirty-main refusal is zero-mutation (main HEAD unchanged)', before === after, `${before} vs ${after}`);
  }
  git(mainB, ['checkout', '--', 'f']);

  // ── dirty WORKTREE (a real tracked-file edit, not the bootstrapped store)
  // refuses, zero-mutation. ──────────────────────────────────────────────────
  const dirtyWtCreated = mergeNewWorktree(mainB, 'wsr-merge-dirty-wt');
  fs.writeFileSync(path.join(dirtyWtCreated.worktreeRoot, 'f'), 'uncommitted worktree edit\n');
  {
    const before = git(mainB, ['log', '-1', '--pretty=%H']);
    const r = bee(mainB, ['worktree', 'merge', '--id', dirtyWtCreated.id, '--json']);
    const ok = r.status !== 0 && /WORKTREE_MERGE_WORKTREE_DIRTY/.test(r.stdout + r.stderr);
    record('worktree merge refuses a dirty WORKTREE tree (WORKTREE_MERGE_WORKTREE_DIRTY)', ok, `status=${r.status} stdout=${r.stdout} stderr=${r.stderr}`);
    const after = git(mainB, ['log', '-1', '--pretty=%H']);
    record('dirty-worktree refusal is zero-mutation (main HEAD unchanged)', before === after, `${before} vs ${after}`);
  }

  // ── detached HEAD in the worktree refuses, zero-mutation. ─────────────────
  const detachedCreated = mergeNewWorktree(mainB, 'wsr-merge-detached');
  git(detachedCreated.worktreeRoot, ['checkout', '--detach', '-q']);
  {
    const before = git(mainB, ['log', '-1', '--pretty=%H']);
    const r = bee(mainB, ['worktree', 'merge', '--id', detachedCreated.id, '--json']);
    const ok = r.status !== 0 && /WORKTREE_MERGE_DETACHED_HEAD/.test(r.stdout + r.stderr);
    record('worktree merge refuses a detached-HEAD worktree (WORKTREE_MERGE_DETACHED_HEAD)', ok, `status=${r.status} stdout=${r.stdout} stderr=${r.stderr}`);
    const after = git(mainB, ['log', '-1', '--pretty=%H']);
    record('detached-HEAD refusal is zero-mutation (main HEAD unchanged)', before === after, `${before} vs ${after}`);
  }

  // ── worktree checked out to a branch other than its expected wt/<slug>
  // refuses, zero-mutation. ──────────────────────────────────────────────────
  const wrongBranchCreated = mergeNewWorktree(mainB, 'wsr-merge-wrong-branch');
  git(wrongBranchCreated.worktreeRoot, ['checkout', '-q', '-b', 'not-the-expected-branch']);
  {
    const before = git(mainB, ['log', '-1', '--pretty=%H']);
    const r = bee(mainB, ['worktree', 'merge', '--id', wrongBranchCreated.id, '--json']);
    const ok = r.status !== 0 && /WORKTREE_MERGE_BRANCH_MISMATCH/.test(r.stdout + r.stderr);
    record('worktree merge refuses a worktree checked out to an unexpected branch (WORKTREE_MERGE_BRANCH_MISMATCH)', ok, `status=${r.status} stdout=${r.stdout} stderr=${r.stderr}`);
    const after = git(mainB, ['log', '-1', '--pretty=%H']);
    record('wrong-branch refusal is zero-mutation (main HEAD unchanged)', before === after, `${before} vs ${after}`);
  }

  // ── own-worktree merge collapses into the not-ordinary refusal (advisor
  // R5 / decision D8: there is no separate "own worktree" code — running
  // merge from inside ANY linked worktree, including the one named by --id,
  // already fails isOrdinaryCheckout(mainRoot)). CLI path first (already
  // refuses because process.cwd() is not ordinary), then the direct-lib path
  // (mainRoot = the worktree's own root, id = its own id) to prove the SAME
  // guard is what protects a worktree from merging itself, not a phantom
  // second code. ────────────────────────────────────────────────────────────
  const ownCreated = mergeNewWorktree(mainB, 'wsr-merge-own');
  {
    const r = bee(ownCreated.worktreeRoot, ['worktree', 'merge', '--id', ownCreated.id, '--json']);
    const ok = r.status !== 0 && !/at Object|TypeError|ReferenceError/.test(r.stderr);
    record('worktree merge run from inside a linked worktree refuses (typed, non-crash) — CLI path', ok, `status=${r.status} stdout=${r.stdout} stderr=${r.stderr}`);
  }
  {
    let caught = null;
    try {
      mergeFeatureWorktree(ownCreated.worktreeRoot, { id: ownCreated.id });
    } catch (error) {
      caught = error;
    }
    const ok = caught && caught.code === 'WORKTREE_MERGE_CALLER_NOT_ORDINARY';
    record(
      'direct-lib own-id path: mergeFeatureWorktree(worktreeRoot, {id: its own id}) refuses WORKTREE_MERGE_CALLER_NOT_ORDINARY (own-worktree merge collapses into not-ordinary)',
      ok,
      caught ? `${caught.code}: ${caught.message}` : 'no error thrown',
    );
  }

  // ── cleanup: green (verify:'skipped', no commands.verify in fixture B) +
  // --cleanup removes the worktree, deletes the branch, and drops the grant.
  // ───────────────────────────────────────────────────────────────────────
  const cleanupCreated = mergeNewWorktree(mainB, 'wsr-merge-cleanup');
  fs.writeFileSync(path.join(cleanupCreated.worktreeRoot, 'cleanup-work.txt'), 'work to merge\n');
  git(cleanupCreated.worktreeRoot, ['add', 'cleanup-work.txt']);
  git(cleanupCreated.worktreeRoot, ['commit', '-q', '-m', 'cleanup fixture work']);
  const cleanupResult = bee(mainB, ['worktree', 'merge', '--id', cleanupCreated.id, '--cleanup', '--json']);
  {
    const ok = cleanupResult.status === 0;
    record('worktree merge --cleanup (green/skipped path) exits 0', ok, `status=${cleanupResult.status} stdout=${cleanupResult.stdout} stderr=${cleanupResult.stderr}`);
  }
  let cleanupJson = null;
  try {
    cleanupJson = JSON.parse(cleanupResult.stdout);
  } catch {
    /* checked below */
  }
  {
    const ok = cleanupJson && cleanupJson.ok === true && cleanupJson.verify === 'skipped' && cleanupJson.cleanup && cleanupJson.cleanup.ok === true && cleanupJson.cleanup.removed === true && cleanupJson.cleanup.branch_deleted === true;
    record('worktree merge --cleanup reports verify:"skipped" and cleanup:{ok:true, removed:true, branch_deleted:true}', ok, cleanupResult.stdout);
  }
  {
    // Extending --cleanup eligibility to verify:'skipped' is a D8-gap
    // resolution (advisor-confirmed), conditioned on never being silent: a
    // cleanup that ran with no semantic gate must say so loudly.
    const ok = cleanupJson && cleanupJson.cleanup && /verify skipped.*no semantic gate|verify skipped — no commands\.verify recorded; cleaned up unchecked\./.test(cleanupJson.cleanup.warning || '');
    record('worktree merge --cleanup on a skipped verify carries a loud "cleaned up unchecked" warning', ok, JSON.stringify(cleanupJson.cleanup));
  }
  {
    const ok = !fs.existsSync(cleanupCreated.worktreeRoot);
    record('worktree merge --cleanup actually removed the worktree directory', ok, cleanupCreated.worktreeRoot);
  }
  {
    const branchList = git(mainB, ['branch', '--list', `wt/wsr-merge-cleanup`]).trim();
    record('worktree merge --cleanup deleted the branch (git branch -d, not -D)', branchList.length === 0, `git branch --list -> "${branchList}"`);
  }
  {
    const grants = JSON.parse(fs.readFileSync(grantsFileB, 'utf8'));
    const ok = !(cleanupCreated.id in grants);
    record('worktree merge --cleanup dropped the id from the MAIN store\'s grant registry', ok, JSON.stringify(grants));
  }

  // ── cleanup refusal: untracked file at a tracked path blocks cleanup, but
  // the merge result itself is still reported ok (D8b). The worktree MUST be
  // clean to pass merge's own pre-flight dirty check in the first place, so
  // the only honest way to exercise cleanup's SEPARATE freshness re-check is
  // a file dropped as a SIDE EFFECT of the (green) verify step itself —
  // exactly the race the re-check exists to catch (verify can run for a
  // while; the worktree is not re-frozen while it runs). A dedicated fixture
  // (mainC) records a verify command that always exits 0 but plants a file
  // at the path named by $BEE_TEST_LEFTOVER_PATH, if set. ──────────────────
  const mainC = path.join(mergeTmp, 'mainC');
  fs.mkdirSync(mainC, { recursive: true });
  git(mainC, ['init', '-q', '-b', 'main']);
  git(mainC, ['config', 'user.email', 's@e']);
  git(mainC, ['config', 'user.name', 's']);
  fs.writeFileSync(path.join(mainC, '.gitignore'), BEE_GITIGNORE);
  fs.mkdirSync(path.join(mainC, '.bee'), { recursive: true });
  fs.writeFileSync(path.join(mainC, '.bee', 'onboarding.json'), JSON.stringify({ schema_version: '1.0', bee_version: '0.0.0' }));
  fs.writeFileSync(path.join(mainC, '.bee', 'config.json'), JSON.stringify({ commands: { verify: 'node verify-leftover.mjs' } }));
  fs.writeFileSync(path.join(mainC, 'f'), 'x');
  fs.writeFileSync(
    path.join(mainC, 'verify-leftover.mjs'),
    "import fs from 'node:fs';\nconst target = process.env.BEE_TEST_LEFTOVER_PATH;\nif (target) fs.writeFileSync(target, 'oops, forgot to commit this\\n');\nprocess.exit(0);\n",
  );
  git(mainC, ['add', '.']);
  git(mainC, ['commit', '-q', '-m', 'init']);

  const cleanupDirtyCreated = mergeNewWorktree(mainC, 'wsr-merge-cleanup-dirty');
  fs.writeFileSync(path.join(cleanupDirtyCreated.worktreeRoot, 'merge-work.txt'), 'more work\n');
  git(cleanupDirtyCreated.worktreeRoot, ['add', 'merge-work.txt']);
  git(cleanupDirtyCreated.worktreeRoot, ['commit', '-q', '-m', 'more cleanup fixture work']);
  const leftoverPath = path.join(cleanupDirtyCreated.worktreeRoot, 'leftover.txt');
  process.env.BEE_TEST_LEFTOVER_PATH = leftoverPath;
  let cleanupDirtyResult;
  try {
    cleanupDirtyResult = bee(mainC, ['worktree', 'merge', '--id', cleanupDirtyCreated.id, '--cleanup', '--json']);
  } finally {
    delete process.env.BEE_TEST_LEFTOVER_PATH;
  }
  {
    const ok = cleanupDirtyResult.status === 0;
    record('worktree merge --cleanup: the underlying merge itself still exits 0 even when cleanup is refused', ok, `status=${cleanupDirtyResult.status} stdout=${cleanupDirtyResult.stdout}`);
  }
  let cleanupDirtyJson = null;
  try {
    cleanupDirtyJson = JSON.parse(cleanupDirtyResult.stdout);
  } catch {
    /* checked below */
  }
  {
    const ok = cleanupDirtyJson && cleanupDirtyJson.ok === true && cleanupDirtyJson.verify === 'green' && cleanupDirtyJson.cleanup && cleanupDirtyJson.cleanup.ok === false && cleanupDirtyJson.cleanup.code === 'WORKTREE_MERGE_CLEANUP_DIRTY';
    record('worktree merge --cleanup refuses (typed WORKTREE_MERGE_CLEANUP_DIRTY) when untracked files remain at tracked paths, merge result still ok:true', ok, cleanupDirtyResult.stdout);
  }
  {
    const ok = fs.existsSync(cleanupDirtyCreated.worktreeRoot);
    record('cleanup refusal left the worktree directory in place (no partial removal)', ok, cleanupDirtyCreated.worktreeRoot);
  }
  {
    const ok = fs.existsSync(leftoverPath);
    record('the untracked leftover file (planted by verify, simulating a race) is still there — cleanup did not silently delete it', ok, leftoverPath);
  }

  // ── post-commit guard: a verify command that mutates a TRACKED file
  // (without bee's knowledge) still lets the green merge commit land — but
  // the result carries a typed "verify_mutated_tracked_files" warning
  // instead of silently treating the working tree as equivalent to the
  // commit (D2-REVISED step 6). A dedicated fixture (mainD) records a verify
  // command that unconditionally overwrites tracked file "f" and exits 0.
  const mainD = path.join(mergeTmp, 'mainD');
  fs.mkdirSync(mainD, { recursive: true });
  git(mainD, ['init', '-q', '-b', 'main']);
  git(mainD, ['config', 'user.email', 's@e']);
  git(mainD, ['config', 'user.name', 's']);
  fs.writeFileSync(path.join(mainD, '.gitignore'), BEE_GITIGNORE);
  fs.mkdirSync(path.join(mainD, '.bee'), { recursive: true });
  fs.writeFileSync(path.join(mainD, '.bee', 'onboarding.json'), JSON.stringify({ schema_version: '1.0', bee_version: '0.0.0' }));
  fs.writeFileSync(path.join(mainD, '.bee', 'config.json'), JSON.stringify({ commands: { verify: 'node verify-mutate.mjs' } }));
  fs.writeFileSync(path.join(mainD, 'f'), 'x');
  fs.writeFileSync(
    path.join(mainD, 'verify-mutate.mjs'),
    "import fs from 'node:fs';\nfs.writeFileSync('f', 'mutated-by-verify\\n');\nprocess.exit(0);\n",
  );
  git(mainD, ['add', '.']);
  git(mainD, ['commit', '-q', '-m', 'init']);

  const mutateCreated = mergeNewWorktree(mainD, 'wsr-merge-mutate');
  fs.writeFileSync(path.join(mutateCreated.worktreeRoot, 'other.txt'), 'unrelated file\n');
  git(mutateCreated.worktreeRoot, ['add', 'other.txt']);
  git(mutateCreated.worktreeRoot, ['commit', '-q', '-m', 'mutate fixture work']);
  const mutateResult = bee(mainD, ['worktree', 'merge', '--id', mutateCreated.id, '--json']);
  {
    const ok = mutateResult.status === 0;
    record('worktree merge (verify mutates a tracked file, but still exits green) still exits 0', ok, `status=${mutateResult.status} stdout=${mutateResult.stdout} stderr=${mutateResult.stderr}`);
  }
  let mutateJson = null;
  try {
    mutateJson = JSON.parse(mutateResult.stdout);
  } catch {
    /* checked below */
  }
  {
    const ok = mutateJson && mutateJson.ok === true && mutateJson.merged === true && mutateJson.verify === 'green' && mutateJson.warning && mutateJson.warning.code === 'verify_mutated_tracked_files';
    record('verify mutating a tracked file on a green merge attaches a typed warning.code:"verify_mutated_tracked_files" instead of silently claiming tree === commit', ok, mutateResult.stdout);
  }
  {
    const ok = /Merge worktree/.test(git(mainD, ['log', '-1', '--pretty=%B']));
    record('the merge commit itself still landed despite the post-commit tracked-file-mutation warning', ok, git(mainD, ['log', '--oneline', '-1']));
  }
  {
    const content = fs.readFileSync(path.join(mainD, 'f'), 'utf8');
    const status = git(mainD, ['status', '--porcelain', '--untracked-files=no']);
    const ok = content === 'mutated-by-verify\n' && /^ M f/m.test(status);
    record('the tracked-file mutation from verify is really sitting dirty on top of the merge commit (not silently absorbed)', ok, `content=${JSON.stringify(content)} status=${JSON.stringify(status)}`);
  }
  git(mainD, ['checkout', '--', 'f']); // test cleanup only (restores mainD's tree), not bee behavior

  // ── no cleanup on MERGE_CONFLICT, MERGE_VERIFY_RED, or ALREADY_UP_TO_DATE,
  // even with --cleanup passed (D2-REVISED step 7: strictly post-commit). ───
  {
    const noCleanupConflictCreated = mergeNewWorktree(mainB, 'wsr-merge-no-cleanup-conflict');
    fs.writeFileSync(path.join(noCleanupConflictCreated.worktreeRoot, 'f'), 'worktree edit again\n');
    git(noCleanupConflictCreated.worktreeRoot, ['commit', '-am', 'worktree edits f again']);
    fs.writeFileSync(path.join(mainB, 'f'), 'main edit again\n');
    git(mainB, ['commit', '-am', 'main edits f again too']);
    const attemptPreHead = git(mainB, ['log', '-1', '--pretty=%H']).trim(); // after "main edits f again too" landed
    const r = bee(mainB, ['worktree', 'merge', '--id', noCleanupConflictCreated.id, '--cleanup', '--json']);
    const parsed = JSON.parse(r.stdout);
    const ok = parsed.ok === false && parsed.code === 'MERGE_CONFLICT' && !('cleanup' in parsed);
    record('MERGE_CONFLICT + --cleanup never attempts cleanup (no .cleanup field on the result)', ok, r.stdout);
    const stillThere = fs.existsSync(noCleanupConflictCreated.worktreeRoot);
    record('MERGE_CONFLICT + --cleanup left the worktree in place', stillThere, noCleanupConflictCreated.worktreeRoot);
    // bee already ran "git merge --abort" internally (proven above by the
    // dedicated MERGE_CONFLICT case) — nothing is left for the test to
    // clean up by hand here.
    const proof = threePartProof(mainB, attemptPreHead);
    record('MERGE_CONFLICT + --cleanup: main still passes the three-part untouched proof after the aborted attempt', proof.ok, JSON.stringify(proof));
  }
  {
    // Self-contained (advisor R6): this worktree flips flag.txt to "on"
    // itself rather than relying on a previous test's red-verify leftover —
    // under the new abort-on-red contract, mainA's flag.txt reverts to
    // "off" the moment ANY red-verify merge attempt is aborted, so no such
    // leftover exists to depend on anymore.
    const noCleanupRedCreated = mergeNewWorktree(mainA, 'wsr-merge-no-cleanup-red');
    fs.writeFileSync(path.join(noCleanupRedCreated.worktreeRoot, 'flag.txt'), 'on');
    git(noCleanupRedCreated.worktreeRoot, ['commit', '-am', 'flip the flag again']);
    const r = bee(mainA, ['worktree', 'merge', '--id', noCleanupRedCreated.id, '--cleanup', '--json']);
    const parsed = JSON.parse(r.stdout);
    const ok = parsed.ok === false && parsed.code === 'MERGE_VERIFY_RED' && !('cleanup' in parsed);
    record('MERGE_VERIFY_RED + --cleanup never attempts cleanup (no .cleanup field on the result)', ok, r.stdout);
    const stillThere = fs.existsSync(noCleanupRedCreated.worktreeRoot);
    record('MERGE_VERIFY_RED + --cleanup left the worktree in place', stillThere, noCleanupRedCreated.worktreeRoot);
    const flagContent = fs.readFileSync(path.join(mainA, 'flag.txt'), 'utf8').trim();
    record('MERGE_VERIFY_RED + --cleanup: the abort still reverted flag.txt to "off" on main (cleanup skip did not skip the abort)', flagContent === 'off', flagContent);
  }
  // ── ALREADY_UP_TO_DATE: a worktree with no new commits vs main is a typed
  // no-op — never a commit attempt, and --cleanup is never attempted either
  // (strictly post-commit). ───────────────────────────────────────────────
  {
    const noopCreated = mergeNewWorktree(mainB, 'wsr-merge-noop');
    const before = git(mainB, ['log', '-1', '--pretty=%H']).trim();
    const r = bee(mainB, ['worktree', 'merge', '--id', noopCreated.id, '--cleanup', '--json']);
    {
      const ok = r.status === 0;
      record('worktree merge on an already-up-to-date branch exits 0', ok, `status=${r.status} stdout=${r.stdout} stderr=${r.stderr}`);
    }
    let parsed = null;
    try {
      parsed = JSON.parse(r.stdout);
    } catch {
      /* checked below */
    }
    {
      const ok = parsed && parsed.ok === true && parsed.merged === false && parsed.code === 'ALREADY_UP_TO_DATE' && parsed.verify === 'skipped' && !('cleanup' in parsed);
      record('worktree merge --json reports ok:true, merged:false, code:"ALREADY_UP_TO_DATE", verify:"skipped", and --cleanup was never attempted (no .cleanup field)', ok, r.stdout);
    }
    const after = git(mainB, ['log', '-1', '--pretty=%H']).trim();
    record('already-up-to-date merge never committed anything (main HEAD unchanged)', before === after, `${before} vs ${after}`);
    const stillThere = fs.existsSync(noopCreated.worktreeRoot);
    record('already-up-to-date merge left the worktree in place (--cleanup never runs on a no-op)', stillThere, noopCreated.worktreeRoot);
  }

  // ── without --cleanup, a green/skipped result only SUGGESTS the cleanup
  // command — nothing is removed. ────────────────────────────────────────────
  {
    const suggestCreated = mergeNewWorktree(mainB, 'wsr-merge-suggest');
    fs.writeFileSync(path.join(suggestCreated.worktreeRoot, 'suggest-work.txt'), 'x\n');
    git(suggestCreated.worktreeRoot, ['add', 'suggest-work.txt']);
    git(suggestCreated.worktreeRoot, ['commit', '-q', '-m', 'suggest fixture work']);
    const r = bee(mainB, ['worktree', 'merge', '--id', suggestCreated.id, '--json']);
    const parsed = JSON.parse(r.stdout);
    const ok = parsed.ok === true && !('cleanup' in parsed) && typeof parsed.cleanup_suggested_command === 'string' && parsed.cleanup_suggested_command.includes(suggestCreated.id);
    record('worktree merge without --cleanup only suggests the cleanup command (no .cleanup field, cleanup_suggested_command present)', ok, r.stdout);
    const stillThere = fs.existsSync(suggestCreated.worktreeRoot);
    record('without --cleanup, the worktree was left in place', stillThere, suggestCreated.worktreeRoot);
  }
} finally {
  fs.rmSync(mergeTmp, { recursive: true, force: true });
}

const failed = results.filter((r) => !r.passed);
console.log(`SUMMARY: ${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 7 : 0);
