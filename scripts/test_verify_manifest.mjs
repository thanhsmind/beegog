#!/usr/bin/env node
// Guard: commands.verify in .bee/config.json must always run every mandatory
// suite. TEST-11/D-14 (SPEC §11.2, decision ed0b2920): the CLI registry
// contract test (test_bee_cli.mjs) is a public-command contract and must
// never silently fall out of the release verify chain again — this script
// is the mechanical guard that catches that regression at verify time.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");
const CONFIG_PATH = path.join(REPO_ROOT, ".bee", "config.json");

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
 * Checks a verify command string for every mandatory suite name.
 * Returns { ok, missing } — missing is the list of suite names (in
 * MANDATORY_SUITES order) that do not appear anywhere in verifyString.
 */
function checkVerifyString(verifyString) {
  const haystack = typeof verifyString === "string" ? verifyString : "";
  const missing = MANDATORY_SUITES.filter((suite) => !haystack.includes(suite));
  return { ok: missing.length === 0, missing };
}

// ─── internal self-test: prove the checker actually bites ─────────────────
// Feed the checker a synthetic verify-string with test_bee_cli removed (built
// from the mandatory list itself, never from the real config) and assert it
// is flagged missing. This never mutates the real .bee/config.json — it only
// proves checkVerifyString() is not a rubber stamp before trusting it below.
{
  const syntheticSuites = MANDATORY_SUITES.filter((s) => s !== "test_bee_cli");
  const syntheticVerify = syntheticSuites
    .map((s) => `node skills/bee-hive/templates/tests/${s}.mjs`)
    .join(" && ");

  const selfTestResult = checkVerifyString(syntheticVerify);

  if (selfTestResult.ok || !selfTestResult.missing.includes("test_bee_cli")) {
    console.error(
      "FAIL test_verify_manifest: internal self-test did not catch a synthetic verify-string with test_bee_cli removed",
    );
    console.error(`      synthetic verify-string: ${syntheticVerify}`);
    console.error(`      checker result: ${JSON.stringify(selfTestResult)}`);
    process.exit(1);
  }

  console.log("PASS test_verify_manifest: internal self-test — checker correctly flags a synthetic verify-string missing test_bee_cli");
}

// ─── real check: THIS repo's real .bee/config.json ─────────────────────────

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

const result = checkVerifyString(verifyString);
if (!result.ok) {
  console.error(`FAIL test_verify_manifest: commands.verify is missing ${result.missing.length} mandatory suite(s): ${result.missing.join(", ")}`);
  console.error(`      commands.verify: ${verifyString}`);
  process.exit(1);
}

console.log(`PASS test_verify_manifest: commands.verify contains all ${MANDATORY_SUITES.length} mandatory suites (${MANDATORY_SUITES.join(", ")})`);
