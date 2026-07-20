#!/usr/bin/env node
// Guard: commands.verify in .bee/config.json must always run every mandatory
// suite. TEST-11/D-14 (SPEC §11.2, decision ed0b2920): the CLI registry
// contract test (test_bee_cli.mjs) is a public-command contract and must
// never silently fall out of the release verify chain again — this script
// is the mechanical guard that catches that regression at verify time.
//
// commands.verify now points at scripts/run_verify.mjs (a parallel runner)
// instead of an inline `&&`-chain string, so the check below loads that
// runner's exported SUITES list and asserts every mandatory suite name
// appears in it — same guarantee, new source of truth.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");
const CONFIG_PATH = path.join(REPO_ROOT, ".bee", "config.json");
const RUNNER_PATH = path.join(REPO_ROOT, "scripts", "run_verify.mjs");

// The suites that MUST always run as part of commands.verify — full,
// explicit repo-relative paths (cs-2b: the old test_lib.mjs monolith is gone,
// split across six files; substring matching on bare basenames like "test_lib"
// is retired in favor of exact membership so a rename or a near-miss path
// can never silently satisfy an entry it was not meant to).
const MANDATORY_SUITES = [
  "skills/bee-hive/templates/tests/test_cli_state.mjs",
  "skills/bee-hive/templates/tests/test_cli_cells.mjs",
  "skills/bee-hive/templates/tests/test_state.mjs",
  "skills/bee-hive/templates/tests/test_guards.mjs",
  "skills/bee-hive/templates/tests/test_backlog_capture.mjs",
  "skills/bee-hive/templates/tests/test_misc.mjs",
  "skills/bee-hive/templates/tests/test_cells.mjs",
  "skills/bee-hive/templates/tests/test_reservations.mjs",
  "skills/bee-hive/templates/tests/test_claims.mjs",
  "skills/bee-hive/templates/tests/test_feedback.mjs",
  "skills/bee-hive/templates/tests/test_reviews.mjs",
  "scripts/test_skill_render.mjs",
  "skills/bee-hive/scripts/test_onboard_bee.mjs",
  "skills/bee-hive/scripts/test_plugin_distribution.mjs",
  "scripts/test_portable_paths.mjs",
  "hooks/test_model_guard.mjs",
  "hooks/test_write_guard.mjs",
  "hooks/test_hook_contracts.mjs",
  "skills/bee-hive/templates/tests/test_bee_cli.mjs",
  "scripts/test_state_write_concurrency.mjs",
  "scripts/test_installers_e2e.mjs",
  "scripts/test_conformance.mjs",
  "scripts/test_agents_budget.mjs",
  "skills/bee-hive/templates/tests/test_recovery.mjs",
];

/**
 * Checks a flat list of suite path strings (e.g.
 * "skills/bee-hive/templates/tests/test_cells.mjs") for every mandatory
 * suite. Returns { ok, missing } — missing is the list of full suite paths
 * (in MANDATORY_SUITES order) that are not EXACTLY present in suitePaths
 * (no substring matching — a mandatory path must appear verbatim).
 */
function checkSuiteList(suitePaths) {
  const present = new Set(Array.isArray(suitePaths) ? suitePaths : []);
  const missing = MANDATORY_SUITES.filter((suite) => !present.has(suite));
  return { ok: missing.length === 0, missing };
}

// ─── internal self-test: prove the checker actually bites ─────────────────
// Feed the checker a synthetic suite list with test_bee_cli's exact path
// removed (built from the mandatory list itself, never from the real runner)
// and assert it is flagged missing. This never mutates the real runner — it
// only proves checkSuiteList() is not a rubber stamp before trusting it below.
{
  const bitten = "skills/bee-hive/templates/tests/test_bee_cli.mjs";
  const syntheticSuites = MANDATORY_SUITES.filter((s) => s !== bitten);

  const selfTestResult = checkSuiteList(syntheticSuites);

  if (selfTestResult.ok || !selfTestResult.missing.includes(bitten)) {
    console.error(
      "FAIL test_verify_manifest: internal self-test did not catch a synthetic suite list with test_bee_cli removed",
    );
    console.error(`      synthetic suite list: ${JSON.stringify(syntheticSuites)}`);
    console.error(`      checker result: ${JSON.stringify(selfTestResult)}`);
    process.exit(1);
  }

  console.log("PASS test_verify_manifest: internal self-test — checker correctly flags a synthetic suite list missing test_bee_cli");
}

// ─── real check: THIS repo's real .bee/config.json + run_verify.mjs ───────

if (!fs.existsSync(CONFIG_PATH)) {
  console.error(`FAIL test_verify_manifest: ${CONFIG_PATH} does not exist`);
  process.exit(1);
}

let config;
try {
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
} catch (error) {
  console.error(`FAIL test_verify_manifest: could not parse ${CONFIG_PATH}: ${error.message}`);
  process.exit(1);
}

const verifyString = config?.commands?.verify;
if (typeof verifyString !== "string" || !verifyString.trim()) {
  console.error("FAIL test_verify_manifest: .bee/config.json commands.verify is missing or empty");
  process.exit(1);
}

if (!verifyString.includes("run_verify.mjs")) {
  console.error(`FAIL test_verify_manifest: .bee/config.json commands.verify does not invoke scripts/run_verify.mjs`);
  console.error(`      commands.verify: ${verifyString}`);
  process.exit(1);
}

if (!fs.existsSync(RUNNER_PATH)) {
  console.error(`FAIL test_verify_manifest: ${RUNNER_PATH} does not exist`);
  process.exit(1);
}

let runnerModule;
try {
  runnerModule = await import(pathToFileURL(RUNNER_PATH).href);
} catch (error) {
  console.error(`FAIL test_verify_manifest: could not import ${RUNNER_PATH}: ${error.message}`);
  process.exit(1);
}

const suites = runnerModule.SUITES;
if (!Array.isArray(suites) || suites.length === 0) {
  console.error("FAIL test_verify_manifest: scripts/run_verify.mjs does not export a non-empty SUITES array");
  process.exit(1);
}

const suitePaths = suites.map((entry) => (Array.isArray(entry) ? entry[0] : entry));

const result = checkSuiteList(suitePaths);
if (!result.ok) {
  console.error(`FAIL test_verify_manifest: run_verify.mjs SUITES is missing ${result.missing.length} mandatory suite(s): ${result.missing.join(", ")}`);
  console.error(`      SUITES: ${JSON.stringify(suitePaths)}`);
  process.exit(1);
}

console.log(`PASS test_verify_manifest: run_verify.mjs SUITES contains all ${MANDATORY_SUITES.length} mandatory suites, exact-path matched (${MANDATORY_SUITES.join(", ")})`);
