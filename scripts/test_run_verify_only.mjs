#!/usr/bin/env node
// test_run_verify_only.mjs — proves run_verify.mjs's scoped include filter
// (vs-1): a repeatable/comma-separated `--only <token>` CLI flag plus a
// BEE_VERIFY_ONLY env var (CLI wins when both are set), matching a runnable
// by case-insensitive substring against its repo-relative path OR its
// display label, applied BEFORE BEE_VERIFY_EXCLUDE so exclude can still
// narrow (never widen) the included set. Zero matches is a typed refusal,
// exit 1 (same idiom as the pre-existing BEE_VERIFY_ROOT_FILTER refusal).
// Every scoped run prints the loud "SCOPED RUN (--only): N of M runnables
// selected" banner before results and again in the summary; an unscoped run
// prints neither.
//
// Every spawned real run below is scoped to exactly one fast suite
// (scripts/test_release_tuple.mjs) — the whole file must finish well under
// a minute. NEVER spawn an unfiltered full run here.

import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const RUN_VERIFY = path.join(REPO_ROOT, "scripts", "run_verify.mjs");

const { filterSuitesByOnly, SUITES } = await import(pathToFileURL(RUN_VERIFY).href);

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

function runVerify(args, env = {}) {
  return spawnSync(process.execPath, [RUN_VERIFY, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: { ...process.env, ...env },
    timeout: 30000,
  });
}

// ── (d) unit-level: no-flag no-op is a true no-op ───────────────────────────
await check("filterSuitesByOnly(suites, []) returns the SAME array reference (byte-identical no-op)", () => {
  const result = filterSuitesByOnly(SUITES, []);
  assert.equal(result, SUITES, "must be reference-equal, not just element-equal — a copy would not prove the no-op contract");
});

await check("SUITES has more than one runnable (sanity: the M in N of M banners must be > 1)", () => {
  assert.ok(SUITES.length > 1, `expected multiple suites, got ${SUITES.length}`);
});

// ── (a) --only test_release_tuple runs exactly that subset, banner has correct N/M ──
await check("--only test_release_tuple selects exactly that suite and passes, with a correct banner", () => {
  const r = runVerify(["--only", "test_release_tuple"]);
  assert.equal(r.status, 0, `expected exit 0, got ${r.status}; stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.match(r.stdout, /PASS\s+\d+ms\s+scripts\/test_release_tuple\.mjs/, `expected the single suite's own PASS line:\n${r.stdout}`);
  assert.match(
    r.stdout,
    /run_verify: 1 suite\(s\)/,
    `expected exactly 1 suite to have run, not the full pool:\n${r.stdout}`,
  );
  const expectedBanner = `SCOPED RUN (--only): 1 of ${SUITES.length} runnables selected — full verify still required before close`;
  const occurrences = r.stdout.split(expectedBanner).length - 1;
  assert.equal(
    occurrences,
    2,
    `expected the banner to appear exactly twice (once before results, once in the summary) with N=1, M=${SUITES.length}:\n${r.stdout}`,
  );
});

// ── (b) zero-match token → typed refusal, exit 1 ────────────────────────────
await check("--only with a token matching zero suites is a typed refusal, exit 1", () => {
  const r = runVerify(["--only", "zzz-no-such-suite-token"]);
  assert.equal(r.status, 1, `expected exit 1, got ${r.status}; stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.match(
    r.stderr,
    /matched zero suites — refusing a silent trivial-green run/,
    `expected the typed refusal message on stderr:\n${r.stderr}`,
  );
  assert.equal(r.stdout, "", "a zero-match refusal must exit before any suite runs — no PASS/FAIL lines, no banner");
});

// ── (c) include-before-exclude: BEE_VERIFY_EXCLUDE can narrow the included set ──
await check("BEE_VERIFY_EXCLUDE narrows an --only selection down to zero, and still refuses", () => {
  const r = runVerify(["--only", "test_release_tuple"], {
    BEE_VERIFY_EXCLUDE: "scripts/test_release_tuple.mjs",
  });
  assert.equal(r.status, 1, `expected exit 1 once exclude drops the only included suite, got ${r.status}; stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.match(
    r.stderr,
    /BEE_VERIFY_EXCLUDE="scripts\/test_release_tuple\.mjs" excluded every remaining suite/,
    `expected the exclude-specific refusal, not the --only refusal:\n${r.stderr}`,
  );
});

// ── (e) BEE_VERIFY_ONLY env alone works; CLI --only overrides env when both set ──
await check("BEE_VERIFY_ONLY env var alone selects the scoped subset", () => {
  const r = runVerify([], { BEE_VERIFY_ONLY: "test_release_tuple" });
  assert.equal(r.status, 0, `expected exit 0, got ${r.status}; stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.match(r.stdout, /run_verify: 1 suite\(s\)/, `expected exactly 1 suite via env var alone:\n${r.stdout}`);
  assert.match(r.stdout, /SCOPED RUN \(--only\)/, `expected the scoped banner even when only the env var is set:\n${r.stdout}`);
});

await check("CLI --only overrides BEE_VERIFY_ONLY when both are set (env token would refuse, CLI token passes)", () => {
  const r = runVerify(["--only", "test_release_tuple"], { BEE_VERIFY_ONLY: "zzz-no-such-suite-token" });
  assert.equal(
    r.status,
    0,
    `expected exit 0 — CLI must win over env, so the env's zero-match token must be ignored entirely; got ${r.status}; stdout:\n${r.stdout}\nstderr:\n${r.stderr}`,
  );
  assert.match(r.stdout, /run_verify: 1 suite\(s\)/, `expected exactly 1 suite (the CLI token's match):\n${r.stdout}`);
});

// ── no flag / no env: byte-identical current behavior, no banner ───────────
await check("with no --only and no BEE_VERIFY_ONLY, filterSuitesByOnly is never given a chance to fire — no banner text appears even on a scoped-looking exclude run", () => {
  // Full-pool spawn is out of scope for this fast-only suite; instead prove
  // the absent-banner contract at the unit level (matches (d) above) plus a
  // real spawn that is ALSO scoped (via BEE_VERIFY_ROOT_FILTER, not --only)
  // so this stays well under a minute while still exercising a real process
  // that took the "isScopedRun === false" branch.
  const r = runVerify([], { BEE_VERIFY_ROOT_FILTER: "scripts", BEE_VERIFY_EXCLUDE: SUITES.filter((s) => s[0] !== "scripts/test_release_tuple.mjs").map((s) => s[0]).join(",") });
  assert.equal(r.status, 0, `expected exit 0, got ${r.status}; stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.doesNotMatch(r.stdout, /SCOPED RUN \(--only\)/, `no --only/BEE_VERIFY_ONLY was set — the scoped banner must never appear:\n${r.stdout}`);
});

console.log(`\ntest_run_verify_only: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
