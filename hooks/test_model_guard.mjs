#!/usr/bin/env node
// test_model_guard.mjs - self-contained payload-table test for
// hooks/bee-model-guard.mjs (cell model-tier-guard-1, plan.md test matrix).
// Spawns the hook as a child process, feeds it a JSON payload on stdin, and
// asserts exit code + stderr for each row of the table. Builds two isolated
// fixture repos (an enabled one, a disabled one) plus a bare no-repo dir so
// no test run ever touches this project's real .bee/logs/hooks.jsonl.
// Exits 1 on any failure.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const HOOKS_DIR = path.dirname(SCRIPT_PATH);
const REPO_ROOT = path.dirname(HOOKS_DIR);
const HOOK_PATH = path.join(HOOKS_DIR, "bee-model-guard.mjs");
const REAL_LIB_DIR = path.join(REPO_ROOT, ".bee", "bin", "lib");
const REAL_CONFIG_PATH = path.join(REPO_ROOT, ".bee", "config.json");

let failures = 0;

function check(condition, label, extra = "") {
  if (condition) {
    process.stdout.write(`ok    - ${label}\n`);
  } else {
    failures += 1;
    process.stdout.write(`FAIL  - ${label}${extra ? ` :: ${extra}` : ""}\n`);
  }
}

// --- fixture builders --------------------------------------------------

function mkFixture(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function copyLib(fixtureRoot) {
  const libDir = path.join(fixtureRoot, ".bee", "bin", "lib");
  fs.mkdirSync(libDir, { recursive: true });
  for (const name of ["state.mjs", "fsutil.mjs"]) {
    fs.copyFileSync(path.join(REAL_LIB_DIR, name), path.join(libDir, name));
  }
}

function buildEnabledFixture() {
  const root = mkFixture("bee-model-guard-enabled-");
  fs.mkdirSync(path.join(root, ".bee"), { recursive: true });
  fs.writeFileSync(path.join(root, ".bee", "onboarding.json"), "{}\n");
  copyLib(root);
  // Mirror the real repo's config so the hook's resolved generation model
  // matches what this test independently computes below.
  if (fs.existsSync(REAL_CONFIG_PATH)) {
    fs.copyFileSync(REAL_CONFIG_PATH, path.join(root, ".bee", "config.json"));
  }
  return root;
}

function buildDisabledFixture() {
  const root = mkFixture("bee-model-guard-disabled-");
  fs.mkdirSync(path.join(root, ".bee"), { recursive: true });
  fs.writeFileSync(path.join(root, ".bee", "onboarding.json"), "{}\n");
  copyLib(root);
  fs.writeFileSync(
    path.join(root, ".bee", "config.json"),
    `${JSON.stringify({ hooks: { "model-guard": false } }, null, 2)}\n`,
  );
  return root;
}

function buildNoRepoFixture() {
  return mkFixture("bee-model-guard-norepo-");
}

// --- hook invocation -----------------------------------------------------

function runHookPayload(payload, cwd) {
  const body = { ...payload, cwd };
  const input = JSON.stringify(body);
  const result = spawnSync(process.execPath, [HOOK_PATH], { input, encoding: "utf8" });
  return result;
}

function runHookRaw(rawInput) {
  return spawnSync(process.execPath, [HOOK_PATH], { input: rawInput, encoding: "utf8" });
}

// --- expectation: read the SAME state.mjs module the hook will import,
// pointed at the enabled fixture (which carries a copy of the real config),
// so the expected generation model always matches the hook's own resolution.

async function computeExpectedGenerationModel(enabledRoot) {
  const stateLib = await import(pathToFileURL(path.join(REAL_LIB_DIR, "state.mjs")).href);
  return stateLib.modelForTier(enabledRoot, "generation", "claude") || "generation";
}

function readLastJsonl(file) {
  if (!fs.existsSync(file)) return null;
  const lines = fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim());
  if (lines.length === 0) return null;
  try {
    return JSON.parse(lines[lines.length - 1]);
  } catch {
    return null;
  }
}

async function main() {
  const enabledRoot = buildEnabledFixture();
  const disabledRoot = buildDisabledFixture();
  const noRepoRoot = buildNoRepoFixture();
  process.stdout.write(`enabled fixture:  ${enabledRoot}\n`);
  process.stdout.write(`disabled fixture: ${disabledRoot}\n`);
  process.stdout.write(`no-repo fixture:  ${noRepoRoot}\n`);

  const expectedGenerationModel = await computeExpectedGenerationModel(enabledRoot);
  process.stdout.write(`expected generation model: ${expectedGenerationModel}\n`);

  // --- 1. bare Agent payload -> exit 2, stderr has bee-tier + FIX + model --
  const barePayload = {
    tool_name: "Agent",
    tool_input: {
      prompt: "implement the widget across the module without further detail",
      description: "some description",
    },
  };
  const r1 = runHookPayload(barePayload, enabledRoot);
  check(r1.status === 2, "row1: bare Agent dispatch denied (exit 2)", `status=${r1.status} stderr=${r1.stderr}`);
  check(r1.stderr.includes("bee-tier"), "row1: stderr mentions bee-tier", r1.stderr);
  check(r1.stderr.includes("FIX"), "row1: stderr has a FIX line", r1.stderr);
  check(
    r1.stderr.includes(expectedGenerationModel),
    "row1: stderr names the configured generation model",
    `expected "${expectedGenerationModel}" in: ${r1.stderr}`,
  );

  // --- row14: the deny was logged with matching tool_input_keys -----------
  const logFile = path.join(enabledRoot, ".bee", "logs", "hooks.jsonl");
  const lastEvent = readLastJsonl(logFile);
  check(!!lastEvent, "row14: hooks.jsonl has a parseable last line", String(lastEvent));
  check(lastEvent && lastEvent.hook === "model-guard", "row14: last event hook is model-guard",
    JSON.stringify(lastEvent));
  check(lastEvent && lastEvent.event === "deny", "row14: last event is a deny", JSON.stringify(lastEvent));
  check(lastEvent && lastEvent.tool_name === "Agent", "row14: last event tool_name is Agent",
    JSON.stringify(lastEvent));
  check(
    lastEvent &&
      Array.isArray(lastEvent.tool_input_keys) &&
      JSON.stringify(lastEvent.tool_input_keys.slice().sort()) ===
        JSON.stringify(Object.keys(barePayload.tool_input).sort()),
    "row14: tool_input_keys matches the sent payload's keys",
    JSON.stringify(lastEvent),
  );

  // --- 2. model:'sonnet' -> exit 0 -----------------------------------------
  const r2 = runHookPayload({ tool_name: "Agent", tool_input: { model: "sonnet" } }, enabledRoot);
  check(r2.status === 0, "row2: model param set is allowed", `status=${r2.status} stderr=${r2.stderr}`);

  // --- 3. prompt marker -> exit 0 ------------------------------------------
  const r3 = runHookPayload(
    { tool_name: "Agent", tool_input: { prompt: "[bee-tier: ceiling] do the thing" } },
    enabledRoot,
  );
  check(r3.status === 0, "row3: ceiling marker in prompt is allowed", `status=${r3.status} stderr=${r3.stderr}`);

  // --- 4. description marker only -> exit 0 --------------------------------
  const r4 = runHookPayload(
    {
      tool_name: "Agent",
      tool_input: { description: "[bee-tier: generation] short task", prompt: "no marker here at all" },
    },
    enabledRoot,
  );
  check(r4.status === 0, "row4: marker in description alone is allowed", `status=${r4.status} stderr=${r4.stderr}`);

  // --- 5. case-insensitive marker -> exit 0 --------------------------------
  const r5 = runHookPayload(
    { tool_name: "Agent", tool_input: { description: "[BEE-TIER: Generation] mixed case" } },
    enabledRoot,
  );
  check(r5.status === 0, "row5: case-insensitive marker is allowed", `status=${r5.status} stderr=${r5.stderr}`);

  // --- 6. marker ending exactly at prompt char 500 -> exit 0 --------------
  const marker = "[bee-tier: ceiling]";
  const pad500 = "a".repeat(500 - marker.length);
  const promptAt500 = pad500 + marker;
  check(promptAt500.length === 500, "row6 setup: prompt is exactly 500 chars");
  const r6 = runHookPayload({ tool_name: "Agent", tool_input: { prompt: promptAt500 } }, enabledRoot);
  check(r6.status === 0, "row6: marker ending at char 500 is allowed", `status=${r6.status} stderr=${r6.stderr}`);

  // --- 7. marker starting after char 500 -> exit 2 -------------------------
  const pad600 = "a".repeat(600);
  const promptAfter500 = pad600 + marker;
  const r7 = runHookPayload({ tool_name: "Agent", tool_input: { prompt: promptAfter500 } }, enabledRoot);
  check(r7.status === 2, "row7: marker starting after char 500 is denied", `status=${r7.status} stderr=${r7.stderr}`);

  // --- 8. tool_input absent -> exit 0, empty stderr ------------------------
  const r8 = runHookPayload({ tool_name: "Agent" }, enabledRoot);
  check(r8.status === 0, "row8: absent tool_input is allowed", `status=${r8.status} stderr=${r8.stderr}`);
  check(r8.stderr === "", "row8: absent tool_input produces empty stderr", JSON.stringify(r8.stderr));

  // --- 9. tool_input non-object (string) -> exit 0 -------------------------
  const r9 = runHookPayload({ tool_name: "Agent", tool_input: "oops" }, enabledRoot);
  check(r9.status === 0, "row9: non-object tool_input is allowed", `status=${r9.status} stderr=${r9.stderr}`);
  check(r9.stderr === "", "row9: non-object tool_input produces empty stderr", JSON.stringify(r9.stderr));

  // --- 10. tool_name 'Edit' -> exit 0 ---------------------------------------
  const r10 = runHookPayload({ tool_name: "Edit", tool_input: {} }, enabledRoot);
  check(r10.status === 0, "row10: non-dispatch tool_name is allowed", `status=${r10.status} stderr=${r10.stderr}`);

  // --- 11. junk stdin -> exit 0 ---------------------------------------------
  const r11 = runHookRaw("not json at all {{{");
  check(r11.status === 0, "row11: junk stdin is allowed", `status=${r11.status} stderr=${r11.stderr}`);

  // --- 12. cwd with no .bee anywhere -> exit 0 ------------------------------
  const r12 = runHookPayload(
    { tool_name: "Agent", tool_input: { prompt: "no marker, no model" } },
    noRepoRoot,
  );
  check(r12.status === 0, "row12: no repo root found is allowed", `status=${r12.status} stderr=${r12.stderr}`);

  // --- 13. hooks.model-guard: false -> exit 0 (toggle respected) ----------
  const r13 = runHookPayload(
    { tool_name: "Agent", tool_input: { prompt: "no marker, no model" } },
    disabledRoot,
  );
  check(r13.status === 0, "row13: model-guard disabled via config toggle is allowed",
    `status=${r13.status} stderr=${r13.stderr}`);

  process.stdout.write(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}\n`);
  process.exitCode = failures === 0 ? 0 : 1;
}

await main();
