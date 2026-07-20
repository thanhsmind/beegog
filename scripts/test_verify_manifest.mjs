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

// The suites that MUST always run as part of commands.verify.
const MANDATORY_SUITES = [
  "test_lib",
  "test_skill_render",
  "test_onboard_bee",
  "test_plugin_distribution",
  "test_portable_paths",
  "test_model_guard",
  "test_write_guard",
  "test_hook_contracts",
  "test_bee_cli",
  "test_state_write_concurrency",
  "test_installers_e2e",
  "test_conformance",
  "test_agents_budget",
  "test_recovery",
];

/**
 * Checks a flat list of suite path strings (e.g.
 * "skills/bee-hive/templates/tests/test_lib.mjs") for every mandatory suite
 * name. Returns { ok, missing } — missing is the list of suite names (in
 * MANDATORY_SUITES order) that do not appear as a substring of any entry.
 */
function checkSuiteList(suitePaths) {
  const haystack = Array.isArray(suitePaths) ? suitePaths.join(" ") : "";
  const missing = MANDATORY_SUITES.filter((suite) => !haystack.includes(suite));
  return { ok: missing.length === 0, missing };
}

// ─── internal self-test: prove the checker actually bites ─────────────────
// Feed the checker a synthetic suite list with test_bee_cli removed (built
// from the mandatory list itself, never from the real runner) and assert it
// is flagged missing. This never mutates the real runner — it only proves
// checkSuiteList() is not a rubber stamp before trusting it below.
{
  const syntheticSuites = MANDATORY_SUITES.filter((s) => s !== "test_bee_cli").map(
    (s) => `skills/bee-hive/templates/tests/${s}.mjs`,
  );

  const selfTestResult = checkSuiteList(syntheticSuites);

  if (selfTestResult.ok || !selfTestResult.missing.includes("test_bee_cli")) {
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

console.log(`PASS test_verify_manifest: run_verify.mjs SUITES contains all ${MANDATORY_SUITES.length} mandatory suites (${MANDATORY_SUITES.join(", ")})`);
