#!/usr/bin/env node
// test_run_verify_impacted.mjs — proves run_verify.mjs's impacted-file
// selection (cov-2, ci-owned-verify CONTEXT.md D4): `--impacted <files>`
// (repeatable/comma) and `--impacted-from-git` map changed files through
// the impact registry (scripts/impact_registry.mjs) to an EXACT suite
// selection, reusing the shared execution tail the `--only` scoped run
// already uses. Loud `IMPACTED RUN` banner, unmapped-file listing, a loud
// zero-impacted pass naming CI, and a typed `--impacted` vs `--only`
// mutual-exclusion refusal are all exercised. CRITICAL (P1-4):
// --impacted-from-git must count a staged-but-uncommitted change (the
// exact state `bee worktree merge` gates in) — proven against a disposable
// real git fixture repo, never the live project tree.
//
// Every spawned real run against THIS repo is scoped to exactly one fast
// suite (scripts/test_release_tuple.mjs) — the whole file must finish well
// under a minute. NEVER spawn an unfiltered full run here.

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const RUN_VERIFY = path.join(REPO_ROOT, "scripts", "run_verify.mjs");
const IMPACT_REGISTRY_SRC = path.join(REPO_ROOT, "scripts", "impact_registry.mjs");

const { filterSuitesByLabels, SUITES } = await import(pathToFileURL(RUN_VERIFY).href);

let passed = 0;
let failed = 0;
async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}: ${error.stack ?? error.message}`);
  }
}

function runVerify(args, env = {}, opts = {}) {
  return spawnSync(process.execPath, [RUN_VERIFY, ...args], {
    cwd: opts.cwd ?? REPO_ROOT,
    encoding: "utf8",
    env: { ...process.env, ...env },
    timeout: 30000,
  });
}

// ── unit-level: filterSuitesByLabels is exact, not substring ──────────────
await check("filterSuitesByLabels selects only an exact suiteLabel match", () => {
  const target = SUITES.find((entry) => entry[0] === "scripts/test_release_tuple.mjs");
  assert.ok(target, "fixture assumption: scripts/test_release_tuple.mjs must be a discovered suite");
  const result = filterSuitesByLabels(SUITES, new Set(["scripts/test_release_tuple.mjs"]));
  assert.equal(result.length, 1, `expected exactly 1 exact match, got ${result.length}`);
  assert.equal(result[0][0], "scripts/test_release_tuple.mjs");
});

await check("filterSuitesByLabels returns empty for an empty label set (no accidental full-pool fallback)", () => {
  const result = filterSuitesByLabels(SUITES, new Set());
  assert.equal(result.length, 0);
});

// ── (a) mapped-file / self-selecting-suite: --impacted <own file> selects exactly itself ──
await check("--impacted scripts/test_release_tuple.mjs self-selects exactly that suite (registry closure includes its own entry), with a correct IMPACTED banner", () => {
  const r = runVerify(["--impacted", "scripts/test_release_tuple.mjs"]);
  assert.equal(r.status, 0, `expected exit 0, got ${r.status}; stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.match(r.stdout, /PASS\s+\d+ms\s+scripts\/test_release_tuple\.mjs/, `expected the single suite's own PASS line:\n${r.stdout}`);
  assert.match(r.stdout, /run_verify: 1 suite\(s\)/, `expected exactly 1 suite to have run, not the full pool:\n${r.stdout}`);
  const expectedBanner = "IMPACTED RUN: 1 suite(s) from 1 changed file(s)";
  const occurrences = r.stdout.split(expectedBanner).length - 1;
  assert.equal(occurrences, 2, `expected the IMPACTED banner exactly twice (once before results, once in the summary):\n${r.stdout}`);
});

// ── comma-separated / repeatable --impacted, plus unmapped listing ─────────
await check("comma-separated --impacted mixes a mapped and an unmapped file: mapped one runs, unmapped one is listed loudly on stderr, never silently dropped", () => {
  const r = runVerify(["--impacted", "scripts/test_release_tuple.mjs,docs/does-not-exist-nor-map-to-anything.md"]);
  assert.equal(r.status, 0, `expected exit 0, got ${r.status}; stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.match(r.stdout, /IMPACTED RUN: 1 suite\(s\) from 2 changed file\(s\)/, `expected 1 suite from 2 changed files:\n${r.stdout}`);
  assert.match(
    r.stderr,
    /UNMAPPED: docs\/does-not-exist-nor-map-to-anything\.md \(no known suite relates to this file — full verify still covers it\)/,
    `expected a loud UNMAPPED note on stderr:\n${r.stderr}`,
  );
});

await check("repeatable --impacted (two separate flags) unions into one changed-file set", () => {
  const r = runVerify(["--impacted", "scripts/test_release_tuple.mjs", "--impacted", "docs/does-not-exist-nor-map-to-anything.md"]);
  assert.equal(r.status, 0, `expected exit 0, got ${r.status}; stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.match(r.stdout, /IMPACTED RUN: 1 suite\(s\) from 2 changed file\(s\)/, `expected repeatable --impacted flags to union:\n${r.stdout}`);
});

// ── (d) zero-impacted: loud pass naming CI, exit 0, no suites run ──────────
await check("--impacted with only an unmapped file is a loud zero-impacted pass naming CI, exit 0, zero suites run", () => {
  const r = runVerify(["--impacted", "docs/does-not-exist-nor-map-to-anything.md"]);
  assert.equal(r.status, 0, `expected exit 0 (zero impacted is a PASS, not a refusal), got ${r.status}; stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.match(
    r.stdout,
    /IMPACTED RUN: 0 suite\(s\) from 1 changed file\(s\) — full verify delegated to CI/,
    `expected the loud zero-impacted CI message:\n${r.stdout}`,
  );
  assert.doesNotMatch(r.stdout, /PASS\s+\d+ms/, `zero impacted must run no suites at all:\n${r.stdout}`);
  assert.match(r.stderr, /UNMAPPED: docs\/does-not-exist-nor-map-to-anything\.md/, `expected the unmapped file still listed loudly:\n${r.stderr}`);
});

// ── (e) mutual exclusion: --impacted + --only is a typed refusal ───────────
await check("--impacted combined with --only is a typed refusal, exit 1, before any suite runs", () => {
  const r = runVerify(["--impacted", "scripts/test_release_tuple.mjs", "--only", "test_release_tuple"]);
  assert.equal(r.status, 1, `expected exit 1, got ${r.status}; stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.match(
    r.stderr,
    /--impacted\/--impacted-from-git and --only\/BEE_VERIFY_ONLY are mutually exclusive selection modes/,
    `expected the typed mutual-exclusion refusal on stderr:\n${r.stderr}`,
  );
  assert.equal(r.stdout, "", "a mutual-exclusion refusal must exit before any suite runs or banner prints");
});

await check("--impacted-from-git combined with BEE_VERIFY_ONLY env is also a typed refusal", () => {
  const r = runVerify(["--impacted-from-git"], { BEE_VERIFY_ONLY: "test_release_tuple" });
  assert.equal(r.status, 1, `expected exit 1, got ${r.status}; stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.match(r.stderr, /mutually exclusive selection modes/, `expected the refusal even via the env var form:\n${r.stderr}`);
});

// ── (f) CRITICAL P1-4: --impacted-from-git counts a STAGED, uncommitted change ──
// Built against a disposable real git fixture repo (never the live project
// tree): one commit on `main`, then a mapped suite file is edited and
// `git add`ed (staged, NOT committed) — the exact state `bee worktree
// merge` gates its semantic-conflict check in. run_verify.mjs +
// impact_registry.mjs are copied in live (not the committed project
// version) so this proves today's implementation, not a stale checkout.
await check("--impacted-from-git counts a staged-but-uncommitted change in a fixture repo (P1-4)", () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "cov2-git-fixture-"));
  try {
    const scriptsDir = path.join(fixture, "scripts");
    fs.mkdirSync(scriptsDir, { recursive: true });
    fs.copyFileSync(RUN_VERIFY, path.join(scriptsDir, "run_verify.mjs"));
    fs.copyFileSync(IMPACT_REGISTRY_SRC, path.join(scriptsDir, "impact_registry.mjs"));
    const suitePath = path.join(scriptsDir, "test_fixture_suite.mjs");
    fs.writeFileSync(suitePath, "process.exit(0);\n");

    const git = (args) =>
      spawnSync("git", args, {
        cwd: fixture,
        encoding: "utf8",
        env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1" },
      });

    assert.equal(git(["init", "-q"]).status, 0, "git init failed");
    assert.equal(git(["config", "user.email", "cov2-fixture@example.com"]).status, 0);
    assert.equal(git(["config", "user.name", "cov2 fixture"]).status, 0);
    assert.equal(git(["config", "commit.gpgsign", "false"]).status, 0);
    assert.equal(git(["add", "-A"]).status, 0);
    const commit = git(["commit", "-q", "-m", "init"]);
    assert.equal(commit.status, 0, `initial commit failed: ${commit.stderr}`);
    assert.equal(git(["branch", "-m", "main"]).status, 0, "renaming default branch to main failed");

    // Edit the mapped suite file and stage it — NO commit. This is the
    // staged-but-uncommitted state the union's status-porcelain half must
    // catch even when the committed-diff-vs-merge-base half sees nothing
    // (merge-base HEAD main === HEAD here, so that half contributes zero).
    fs.writeFileSync(suitePath, "// staged edit\nprocess.exit(0);\n");
    assert.equal(git(["add", "scripts/test_fixture_suite.mjs"]).status, 0);

    const statusCheck = git(["status", "--porcelain"]);
    assert.match(statusCheck.stdout, /^M {2}scripts\/test_fixture_suite\.mjs$/m, `fixture setup sanity: expected a staged-only M line:\n${statusCheck.stdout}`);

    const r = spawnSync(process.execPath, [path.join(scriptsDir, "run_verify.mjs"), "--impacted-from-git"], {
      cwd: fixture,
      encoding: "utf8",
      timeout: 30000,
    });
    assert.equal(r.status, 0, `expected exit 0, got ${r.status}; stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
    assert.match(
      r.stdout,
      /IMPACTED RUN: 1 suite\(s\) from 1 changed file\(s\)/,
      `expected the staged-only change to be picked up as exactly 1 impacted file/suite:\n${r.stdout}`,
    );
    assert.match(r.stdout, /PASS\s+\d+ms\s+scripts\/test_fixture_suite\.mjs/, `expected the fixture suite's own PASS line:\n${r.stdout}`);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

// ── SUITES export/discovery untouched (must-have) ──────────────────────────
await check("SUITES export is still a plain array of discovered/extra suite entries (byte-shape untouched)", () => {
  assert.ok(Array.isArray(SUITES) && SUITES.length > 1, `expected the full discovered SUITES array, got length ${SUITES.length}`);
  assert.ok(
    SUITES.every((entry) => Array.isArray(entry) && typeof entry[0] === "string"),
    "every SUITES entry must still be an array whose first element is a string path",
  );
});

console.log(`\ntest_run_verify_impacted: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
