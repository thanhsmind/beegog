#!/usr/bin/env node
// test_model_guard.mjs - self-contained payload-table test for
// hooks/bee-model-guard.mjs (cell model-tier-guard-1, plan.md test matrix).
// Spawns the hook as a child process, feeds it a JSON payload on stdin, and
// asserts exit code + stderr for each row of the table. Builds two isolated
// fixture repos (an enabled one, a disabled one) plus a bare no-repo dir so
// no test run ever touches this project's real .bee/logs/hooks.jsonl.
// Exits 1 on any failure.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { runModuleWorker } from "../scripts/lib/run-module-worker.mjs";

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

// Copy the WHOLE lib directory (readdirSync, name-agnostic — matches
// hooks/test_write_guard.mjs:42-57's own copyLib) rather than a hardcoded
// name list: a hardcoded list silently goes stale every time a new
// transitive dependency ships (exactly what happened here — state.mjs's
// claims.mjs/reservations.mjs imports shipped after this list was last
// updated, so the fixture's state.mjs threw ERR_MODULE_NOT_FOUND at import,
// bee-model-guard.mjs's fail-open catch turned that into exit 0, and every
// expect-deny row read as "allowed").
function copyLib(fixtureRoot) {
  const libDir = path.join(fixtureRoot, ".bee", "bin", "lib");
  fs.mkdirSync(libDir, { recursive: true });
  for (const name of fs.readdirSync(REAL_LIB_DIR)) {
    if (!name.endsWith(".mjs")) continue;
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

// A fixture whose vendored state.mjs throws on import (module-level throw),
// exercising the P1-2 catch path that a working fixture can never reach.
function buildThrowingStateFixture() {
  const root = mkFixture("bee-model-guard-throwstate-");
  fs.mkdirSync(path.join(root, ".bee"), { recursive: true });
  fs.writeFileSync(path.join(root, ".bee", "onboarding.json"), "{}\n");
  copyLib(root);
  if (fs.existsSync(REAL_CONFIG_PATH)) {
    fs.copyFileSync(REAL_CONFIG_PATH, path.join(root, ".bee", "config.json"));
  }
  fs.writeFileSync(
    path.join(root, ".bee", "bin", "lib", "state.mjs"),
    "throw new Error('boom: fixture state.mjs deliberately throws on import');\n",
  );
  return root;
}

// A fixture staging an EXPLICIT models block (never the repo's real config), so
// the row that reads it does not depend on whatever this project happens to
// configure. `models` is written verbatim under models.claude. Same shape as
// buildDisabledFixture: mkdir .bee, onboarding.json, copyLib, write config.json.
function buildModelsFixture(prefix, models) {
  const root = mkFixture(prefix);
  fs.mkdirSync(path.join(root, ".bee"), { recursive: true });
  fs.writeFileSync(path.join(root, ".bee", "onboarding.json"), "{}\n");
  copyLib(root);
  fs.writeFileSync(
    path.join(root, ".bee", "config.json"),
    `${JSON.stringify({ models: { claude: models } }, null, 2)}\n`,
  );
  return root;
}

// A generation slot shaped as a cli executor: [bee-tier: generation] must then
// route to the external-executor path, never a spawned in-family subagent.
function buildCliSlotFixture() {
  return buildModelsFixture("bee-model-guard-clislot-", {
    extraction: "haiku",
    generation: { kind: "cli", command: "codex exec -m gpt-5.5 -s read-only -" },
    review: "opus",
  });
}

// A claude runtime that configures NO model names — every slot is null (the
// review slot then falls back to a null generation → budget). modelForTier
// returns null for every slot, so the membership set is empty. This is the
// "unconfigured repo" of plan part 2: an empty member set → fail-open allow,
// exactly today's behavior (config is the authority; it names no model to
// check a bare param against).
function buildEmptyModelSetFixture() {
  return buildModelsFixture("bee-model-guard-emptyset-", {
    extraction: null,
    generation: null,
    review: null,
  });
}

// A malformed models block: junk slot shapes (no `kind:'cli'`, no string
// `model`). normalizeModels ignores each invalid value and keeps the seeded
// default, so resolution falls back gracefully to the defaults and NEVER throws
// on the hook hot path — the fail-open contract for malformed config.
function buildMalformedModelsFixture() {
  return buildModelsFixture("bee-model-guard-malformed-", {
    extraction: { nonsense: true },
    generation: { foo: "bar" },
    review: 42,
  });
}

// --- hook invocation -----------------------------------------------------

async function runHookPayload(payload, cwd) {
  const body = { ...payload, cwd };
  const input = JSON.stringify(body);
  return await runModuleWorker(HOOK_PATH, { input });
}

// spawnCwd pins the child's process.cwd() so cwd-fallback paths inside the
// hook always resolve to a fixture, never to the real repo the suite runs
// from (row17 previously appended a real .bee/logs/dispatch.jsonl line).
async function runHookRaw(rawInput, spawnCwd) {
  return await runModuleWorker(HOOK_PATH, {
    input: rawInput,
    cwd: spawnCwd,
  });
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
  const throwStateRoot = buildThrowingStateFixture();
  const cliSlotRoot = buildCliSlotFixture();
  const emptySetRoot = buildEmptyModelSetFixture();
  const malformedRoot = buildMalformedModelsFixture();
  process.stdout.write(`enabled fixture:      ${enabledRoot}\n`);
  process.stdout.write(`disabled fixture:     ${disabledRoot}\n`);
  process.stdout.write(`no-repo fixture:      ${noRepoRoot}\n`);
  process.stdout.write(`throw-state fixture:  ${throwStateRoot}\n`);
  process.stdout.write(`cli-slot fixture:     ${cliSlotRoot}\n`);
  process.stdout.write(`empty-set fixture:    ${emptySetRoot}\n`);
  process.stdout.write(`malformed fixture:    ${malformedRoot}\n`);

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
  const r1 = await runHookPayload(barePayload, enabledRoot);
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
  const r2 = await runHookPayload({ tool_name: "Agent", tool_input: { model: "sonnet" } }, enabledRoot);
  check(r2.status === 0, "row2: model param set is allowed", `status=${r2.status} stderr=${r2.stderr}`);

  // --- 3. prompt marker -> exit 0 ------------------------------------------
  const r3 = await runHookPayload(
    { tool_name: "Agent", tool_input: { prompt: "[bee-tier: ceiling] do the thing" } },
    enabledRoot,
  );
  check(r3.status === 0, "row3: ceiling marker in prompt is allowed", `status=${r3.status} stderr=${r3.stderr}`);

  // --- 4. description marker only -> exit 0 --------------------------------
  const r4 = await runHookPayload(
    {
      tool_name: "Agent",
      tool_input: { description: "[bee-tier: generation] short task", prompt: "no marker here at all" },
    },
    enabledRoot,
  );
  check(r4.status === 0, "row4: marker in description alone is allowed", `status=${r4.status} stderr=${r4.stderr}`);

  // --- 5. case-insensitive marker -> exit 0 --------------------------------
  const r5 = await runHookPayload(
    { tool_name: "Agent", tool_input: { description: "[BEE-TIER: Generation] mixed case" } },
    enabledRoot,
  );
  check(r5.status === 0, "row5: case-insensitive marker is allowed", `status=${r5.status} stderr=${r5.stderr}`);

  // --- 6. marker at head of prompt with leading whitespace -> exit 0 -------
  // (P1-1: leading whitespace is allowed before the anchored marker)
  const marker = "[bee-tier: ceiling]";
  const r6 = await runHookPayload(
    { tool_name: "Agent", tool_input: { prompt: `   ${marker} do the thing, with lots of trailing detail after it too` } },
    enabledRoot,
  );
  check(r6.status === 0, "row6: head-of-prompt marker with leading whitespace is allowed",
    `status=${r6.status} stderr=${r6.stderr}`);

  // --- 7. marker embedded after other prompt text (e.g. char 100) -> exit 2
  // (P1-1 CONFIRMED red: this was previously ALLOWED via the unanchored
  // 500-char scan window; the marker must anchor to the head of the prompt)
  const pad100 = "x".repeat(100);
  const promptEmbedded = `${pad100} ${marker} rest of prompt`;
  const r7 = await runHookPayload({ tool_name: "Agent", tool_input: { prompt: promptEmbedded } }, enabledRoot);
  check(r7.status === 2, "row7: marker embedded after other prompt text (char ~100) is denied",
    `status=${r7.status} stderr=${r7.stderr}`);

  // --- 7b. marker embedded mid-description (not at the start) -> exit 2 ---
  // (P1-1 CONFIRMED red: this was previously ALLOWED)
  const r7b = await runHookPayload(
    { tool_name: "Agent", tool_input: { description: `some description text before ${marker} marker` } },
    enabledRoot,
  );
  check(r7b.status === 2, "row7b: marker mid-description (not at the start) is denied",
    `status=${r7b.status} stderr=${r7b.stderr}`);

  // --- 7c. marker at start of a very long prompt (no window cutoff) -> exit 0
  // (P1-1: proves the window logic is truly gone — a head-anchored marker
  // stays valid no matter how long the rest of the prompt is)
  const longTail = "y".repeat(2000);
  const r7c = await runHookPayload(
    { tool_name: "Agent", tool_input: { prompt: `${marker} ${longTail}` } },
    enabledRoot,
  );
  check(r7c.status === 0, "row7c: head-of-prompt marker followed by a long tail is allowed",
    `status=${r7c.status} stderr=${r7c.stderr}`);

  // --- 8. tool_input absent -> exit 0, empty stderr ------------------------
  const r8 = await runHookPayload({ tool_name: "Agent" }, enabledRoot);
  check(r8.status === 0, "row8: absent tool_input is allowed", `status=${r8.status} stderr=${r8.stderr}`);
  check(r8.stderr === "", "row8: absent tool_input produces empty stderr", JSON.stringify(r8.stderr));

  // --- 9. tool_input non-object (string) -> exit 0 -------------------------
  const r9 = await runHookPayload({ tool_name: "Agent", tool_input: "oops" }, enabledRoot);
  check(r9.status === 0, "row9: non-object tool_input is allowed", `status=${r9.status} stderr=${r9.stderr}`);
  check(r9.stderr === "", "row9: non-object tool_input produces empty stderr", JSON.stringify(r9.stderr));

  // --- 10. tool_name 'Edit' -> exit 0 ---------------------------------------
  const r10 = await runHookPayload({ tool_name: "Edit", tool_input: {} }, enabledRoot);
  check(r10.status === 0, "row10: non-dispatch tool_name is allowed", `status=${r10.status} stderr=${r10.stderr}`);

  // --- 11. junk stdin -> exit 0 ---------------------------------------------
  const r11 = await runHookRaw("not json at all {{{", noRepoRoot);
  check(r11.status === 0, "row11: junk stdin is allowed", `status=${r11.status} stderr=${r11.stderr}`);

  // --- 12. cwd with no .bee anywhere -> exit 0 ------------------------------
  const r12 = await runHookPayload(
    { tool_name: "Agent", tool_input: { prompt: "no marker, no model" } },
    noRepoRoot,
  );
  check(r12.status === 0, "row12: no repo root found is allowed", `status=${r12.status} stderr=${r12.stderr}`);

  // --- 13. hooks.model-guard: false -> exit 0 (toggle respected) ----------
  const r13 = await runHookPayload(
    { tool_name: "Agent", tool_input: { prompt: "no marker, no model" } },
    disabledRoot,
  );
  check(r13.status === 0, "row13: model-guard disabled via config toggle is allowed",
    `status=${r13.status} stderr=${r13.stderr}`);

  // --- 15. null top-level payload -> exit 0, empty stderr ------------------
  // (P1-2 CONFIRMED red: `echo null | node hooks/bee-model-guard.mjs` crashed
  // with an uncaught TypeError on `payload.cwd`, exit 1)
  const r15 = await runHookRaw("null", noRepoRoot);
  check(r15.status === 0, "row15: null top-level payload is allowed (fail-open)",
    `status=${r15.status} stderr=${r15.stderr}`);
  check(r15.stderr === "", "row15: null top-level payload produces empty stderr", JSON.stringify(r15.stderr));

  // --- 16. array top-level payload -> exit 0, empty stderr ------------------
  const r16 = await runHookRaw("[]", noRepoRoot);
  check(r16.status === 0, "row16: array top-level payload is allowed (fail-open)",
    `status=${r16.status} stderr=${r16.stderr}`);
  check(r16.stderr === "", "row16: array top-level payload produces empty stderr", JSON.stringify(r16.stderr));

  // --- 17. cwd as a non-string (object) -> exit 0, dispatch still evaluated
  // via the process.cwd() fallback (P1-2: normalize cwd before ANY use, never
  // let a non-string reach findRepoRoot/path.resolve) -----------------------
  const r17 = await runHookRaw(
    JSON.stringify({ tool_name: "Agent", cwd: { not: "a string" }, tool_input: { model: "sonnet" } }),
    enabledRoot,
  );
  check(
    r17.status === 0,
    "row17: cwd as an object falls back to process.cwd() and the dispatch is still evaluated",
    `status=${r17.status} stderr=${r17.stderr}`,
  );
  // The fallback evaluation must log into the fixture (the child's cwd), never
  // into the directory the suite happens to run from.
  const d17 = readLastJsonl(path.join(enabledRoot, ".bee", "logs", "dispatch.jsonl"));
  check(
    d17 && d17.transport === "model-param" && d17.model === "sonnet",
    "row17: fallback-evaluated dispatch logged in the fixture's dispatch.jsonl",
    JSON.stringify(d17),
  );

  // --- 18. vendored state.mjs throws on import -> exit 0, empty stderr, one
  // parseable model-guard crash line in that fixture's hooks.jsonl (P1-2) ---
  const r18 = await runHookPayload(
    { tool_name: "Agent", tool_input: { prompt: "no marker, no model" } },
    throwStateRoot,
  );
  check(r18.status === 0, "row18: throwing state.mjs fail-opens (exit 0)", `status=${r18.status} stderr=${r18.stderr}`);
  check(r18.stderr === "", "row18: throwing state.mjs produces empty stderr", JSON.stringify(r18.stderr));
  const throwLog = path.join(throwStateRoot, ".bee", "logs", "hooks.jsonl");
  const throwEvent = readLastJsonl(throwLog);
  check(!!throwEvent, "row18: a crash line was appended to that fixture's hooks.jsonl", String(throwEvent));
  check(throwEvent && throwEvent.hook === "model-guard", "row18: crash line's hook is model-guard",
    JSON.stringify(throwEvent));
  check(
    throwEvent && typeof throwEvent.error === "string" && throwEvent.error.includes("boom"),
    "row18: crash line carries the underlying error",
    JSON.stringify(throwEvent),
  );

  // --- 19+. table-drive the tool-name dimension (P1-3): DISPATCH_TOOLS covers
  // both "Agent" and "Task", but every row above only ever exercised "Agent" —
  // a refactor dropping Task would stay green. Run bare-deny + model-allow +
  // anchored-marker-allow for BOTH names. ------------------------------------
  for (const toolName of ["Agent", "Task"]) {
    const bare = await runHookPayload(
      { tool_name: toolName, tool_input: { prompt: "implement the widget with no tier given" } },
      enabledRoot,
    );
    check(bare.status === 2, `row-table[${toolName}]: bare dispatch is denied (exit 2)`,
      `status=${bare.status} stderr=${bare.stderr}`);
    check(
      bare.stderr.includes("bee-tier") && bare.stderr.includes("FIX"),
      `row-table[${toolName}]: deny stderr has bee-tier + FIX`,
      bare.stderr,
    );

    const withModel = await runHookPayload({ tool_name: toolName, tool_input: { model: "sonnet" } }, enabledRoot);
    check(withModel.status === 0, `row-table[${toolName}]: model param set is allowed`,
      `status=${withModel.status} stderr=${withModel.stderr}`);

    const withMarker = await runHookPayload(
      { tool_name: toolName, tool_input: { prompt: "[bee-tier: generation] do the thing" } },
      enabledRoot,
    );
    check(withMarker.status === 0, `row-table[${toolName}]: anchored marker is allowed`,
      `status=${withMarker.status} stderr=${withMarker.stderr}`);
  }

  // --- 20. dispatch audit log (P22, feature dispatch-log): every evaluated
  // dispatch appends one line to .bee/logs/dispatch.jsonl recording its
  // transport; logging is fail-open and never changes the guard's decision ---
  const dispatchLog = path.join(enabledRoot, ".bee", "logs", "dispatch.jsonl");

  const r20a = await runHookPayload(
    {
      tool_name: "Agent",
      tool_input: { model: "haiku", description: "pattern extractor", subagent_type: "general-purpose" },
    },
    enabledRoot,
  );
  check(r20a.status === 0, "row20a: model-param dispatch still allowed", `status=${r20a.status} stderr=${r20a.stderr}`);
  const d20a = readLastJsonl(dispatchLog);
  check(
    d20a &&
      d20a.transport === "model-param" &&
      d20a.model === "haiku" &&
      d20a.tool === "Agent" &&
      d20a.description === "pattern extractor" &&
      d20a.subagent_type === "general-purpose",
    "row20a: dispatch line records model-param transport with the model name",
    JSON.stringify(d20a),
  );

  const r20b = await runHookPayload(
    { tool_name: "Task", tool_input: { prompt: "[bee-tier: review] check the diff" } },
    enabledRoot,
  );
  check(r20b.status === 0, "row20b: marker dispatch still allowed", `status=${r20b.status} stderr=${r20b.stderr}`);
  const d20b = readLastJsonl(dispatchLog);
  check(
    d20b && d20b.transport === "marker" && d20b.tier === "review" && d20b.tool === "Task",
    "row20b: dispatch line records marker transport with the extracted tier",
    JSON.stringify(d20b),
  );

  const r20c = await runHookPayload(
    { tool_name: "Agent", tool_input: { prompt: "bare dispatch with nothing declared" } },
    enabledRoot,
  );
  const d20c = readLastJsonl(dispatchLog);
  check(
    r20c.status === 2 && d20c && d20c.transport === "bare-denied",
    "row20c: denied bare dispatch is logged as bare-denied (deny semantics unchanged)",
    `status=${r20c.status} line=${JSON.stringify(d20c)}`,
  );

  const r20d = await runHookPayload(
    { tool_name: "Agent", tool_input: { model: "sonnet", description: "z".repeat(300) } },
    enabledRoot,
  );
  check(r20d.status === 0, "row20d: long-description dispatch still allowed", `status=${r20d.status}`);
  const d20d = readLastJsonl(dispatchLog);
  check(
    d20d && typeof d20d.description === "string" && d20d.description.length <= 120,
    "row20d: logged description is truncated to <=120 chars",
    JSON.stringify(d20d && d20d.description ? d20d.description.length : d20d),
  );

  const disabledDispatchLog = path.join(disabledRoot, ".bee", "logs", "dispatch.jsonl");
  await runHookPayload({ tool_name: "Agent", tool_input: { model: "sonnet" } }, disabledRoot);
  check(
    !fs.existsSync(disabledDispatchLog),
    "row20e: disabled guard writes no dispatch log",
    disabledDispatchLog,
  );

  // === 2A-iii rows: tier-first decision order (B4/B5/AO5) ==================
  // The enabled fixture carries the real config: extraction=haiku,
  // generation=sonnet, review=opus → member set {haiku, opus, sonnet}.

  // --- 21. bare param NOT in the configured set (banana) -> deny -----------
  const r21 = await runHookPayload({ tool_name: "Agent", tool_input: { model: "banana" } }, enabledRoot);
  check(r21.status === 2, "row21: model:'banana' (non-member) is denied",
    `status=${r21.status} stderr=${r21.stderr}`);
  check(
    r21.stderr.includes("sonnet") && r21.stderr.includes("haiku") && r21.stderr.includes("opus"),
    "row21: banana FIX lists the configured models",
    r21.stderr,
  );
  check(r21.stderr.includes("[bee-tier: ceiling]"), "row21: banana FIX teaches the ceiling marker route", r21.stderr);
  // The denied bare-param dispatch is no longer logged as a legitimate transport.
  const d21 = readLastJsonl(path.join(enabledRoot, ".bee", "logs", "dispatch.jsonl"));
  check(
    d21 && d21.transport === "param-not-configured" && d21.model === "banana",
    "row21: banana dispatch logged as param-not-configured, not model-param",
    JSON.stringify(d21),
  );

  // --- 22. bare param model:'fable' with no configured fable slot -> deny --
  // (panel BLOCKER-1, accepted by design: the ceiling marker is the route.)
  const r22 = await runHookPayload({ tool_name: "Agent", tool_input: { model: "fable" } }, enabledRoot);
  check(r22.status === 2, "row22: model:'fable' with no fable slot is denied (BLOCKER-1)",
    `status=${r22.status} stderr=${r22.stderr}`);
  check(
    r22.stderr.includes("[bee-tier: ceiling]"),
    "row22: fable FIX teaches [bee-tier: ceiling] as the session-model route",
    r22.stderr,
  );

  // --- 23. bare param IS a configured member (haiku) -> allow -------------
  const r23 = await runHookPayload({ tool_name: "Agent", tool_input: { model: "haiku" } }, enabledRoot);
  check(r23.status === 0, "row23: model:'haiku' (member) is allowed", `status=${r23.status} stderr=${r23.stderr}`);

  // --- 24. marker + param AGREE (generation + sonnet) -> allow -------------
  const r24 = await runHookPayload(
    { tool_name: "Agent", tool_input: { prompt: "[bee-tier: generation] do the thing", model: "sonnet" } },
    enabledRoot,
  );
  check(r24.status === 0, "row24: marker+param equality match (generation+sonnet) is allowed",
    `status=${r24.status} stderr=${r24.stderr}`);

  // --- 25. marker + param DISAGREE (generation + opus) -> deny, FIX names sonnet
  const r25 = await runHookPayload(
    { tool_name: "Agent", tool_input: { prompt: "[bee-tier: generation] do the thing", model: "opus" } },
    enabledRoot,
  );
  check(r25.status === 2, "row25: marker+param mismatch (generation+opus) is denied",
    `status=${r25.status} stderr=${r25.stderr}`);
  check(r25.stderr.includes("sonnet"), "row25: mismatch FIX names the tier's configured model (sonnet)", r25.stderr);

  // --- 26. ceiling marker + param -> deny (ceiling carries no model name) --
  const r26 = await runHookPayload(
    { tool_name: "Agent", tool_input: { prompt: "[bee-tier: ceiling] do the thing", model: "sonnet" } },
    enabledRoot,
  );
  check(r26.status === 2, "row26: [bee-tier: ceiling] + model param is denied",
    `status=${r26.status} stderr=${r26.stderr}`);
  check(r26.stderr.includes("drop the model param"), "row26: ceiling+param FIX says drop the param", r26.stderr);

  // --- 27. WARNING-2 pin: review marker + param opus (review is model-shaped) -> allow
  const r27 = await runHookPayload(
    { tool_name: "Agent", tool_input: { prompt: "[bee-tier: review] check the diff", model: "opus" } },
    enabledRoot,
  );
  check(r27.status === 0, "row27: [bee-tier: review] + opus stays allowed while review is model-shaped (WARNING-2)",
    `status=${r27.status} stderr=${r27.stderr}`);

  // --- 28. marker-only on a model tier (generation) -> allow --------------
  const r28 = await runHookPayload(
    { tool_name: "Agent", tool_input: { prompt: "[bee-tier: generation] do the thing" } },
    enabledRoot,
  );
  check(r28.status === 0, "row28: generation marker with no param is allowed",
    `status=${r28.status} stderr=${r28.stderr}`);

  // --- 29. cli-shaped declared tier -> deny with external-executor FIX -----
  // (the cli-slot fixture makes generation a {kind:'cli'} slot.)
  const r29 = await runHookPayload(
    { tool_name: "Agent", tool_input: { prompt: "[bee-tier: generation] gather the callers" } },
    cliSlotRoot,
  );
  check(r29.status === 2, "row29: cli-shaped declared tier denies the Agent dispatch",
    `status=${r29.status} stderr=${r29.stderr}`);
  check(
    r29.stderr.includes("{for:'gather'}") && r29.stderr.includes("stdin"),
    "row29: cli-tier FIX points at the external-executor gather path",
    r29.stderr,
  );
  check(
    !r29.stderr.includes('model: "') && !r29.stderr.includes("gpt-5.5"),
    "row29: cli-tier FIX names no phantom model",
    r29.stderr,
  );

  // --- 30. bare deny under a cli-shaped generation slot names no model -----
  const r30 = await runHookPayload(
    { tool_name: "Agent", tool_input: { prompt: "implement the widget with no tier given" } },
    cliSlotRoot,
  );
  check(r30.status === 2, "row30: bare dispatch under cli-shaped generation is denied",
    `status=${r30.status} stderr=${r30.stderr}`);
  check(r30.stderr.includes("bee-tier") && r30.stderr.includes("FIX"), "row30: bare-cli deny has bee-tier + FIX", r30.stderr);
  check(
    !r30.stderr.includes('model: "'),
    "row30: bare-cli-generation FIX names no nonexistent model",
    r30.stderr,
  );

  // --- 31. empty member set (no model tiers configured) + bare param -> allow
  // (plan part 2: an unconfigured repo fail-opens, exactly today's behavior.)
  const r31 = await runHookPayload(
    { tool_name: "Agent", tool_input: { model: "anything-at-all" } },
    emptySetRoot,
  );
  check(r31.status === 0, "row31: empty member set fail-opens on a bare param (unconfigured repo)",
    `status=${r31.status} stderr=${r31.stderr}`);
  check(r31.stderr === "", "row31: empty-member-set allow produces empty stderr", JSON.stringify(r31.stderr));

  // --- 32. malformed models config never throws on the hot path -----------
  // Junk slot shapes fall back to seeded defaults; a marker dispatch resolves
  // against those defaults and is allowed — exit is sane (0/2), never a crash.
  const r32 = await runHookPayload(
    { tool_name: "Agent", tool_input: { prompt: "[bee-tier: generation] do the thing" } },
    malformedRoot,
  );
  check(r32.status === 0, "row32: malformed models config resolves via seeded defaults (no throw)",
    `status=${r32.status} stderr=${r32.stderr}`);
  const malformedCrash = readLastJsonl(path.join(malformedRoot, ".bee", "logs", "hooks.jsonl"));
  check(
    !malformedCrash || malformedCrash.event !== "crash",
    "row32: malformed config left no crash line on the hot path",
    JSON.stringify(malformedCrash),
  );

  // === Slice 3B rows: pinned-type deny (generic-type-denied, W3/AO5/AO10) ===
  // The enabled fixture's rendered agent types: generation->bee-gather,
  // extraction->bee-extract, review->bee-review; "ceiling" has none.

  // --- 33. per-tier bare marker + general-purpose -> deny, FIX names the
  // pinned type, for each of generation/extraction/review. -----------------
  const pinnedTypeByTier = { generation: "bee-gather", extraction: "bee-extract", review: "bee-review" };
  for (const [pinTier, pinnedType] of Object.entries(pinnedTypeByTier)) {
    const bareDeny = await runHookPayload(
      {
        tool_name: "Agent",
        tool_input: { prompt: `[bee-tier: ${pinTier}] do the thing`, subagent_type: "general-purpose" },
      },
      enabledRoot,
    );
    check(
      bareDeny.status === 2,
      `row33[${pinTier}]: bare marker + general-purpose is denied (exit 2)`,
      `status=${bareDeny.status} stderr=${bareDeny.stderr}`,
    );
    check(
      bareDeny.stderr.includes(pinnedType),
      `row33[${pinTier}]: FIX names the pinned type "${pinnedType}"`,
      bareDeny.stderr,
    );
    const d33 = readLastJsonl(path.join(enabledRoot, ".bee", "logs", "dispatch.jsonl"));
    check(
      d33 && d33.transport === "generic-type-denied" && d33.tier === pinTier,
      `row33[${pinTier}]: dispatch logged as generic-type-denied`,
      JSON.stringify(d33),
    );
  }

  // --- 34. marker + MATCHING model param + general-purpose -> still denied
  // (the pinned-type rule fires before branch (1)'s marker+param equality
  // allow — bare and matching-param alike must deny). --------------------
  const r34 = await runHookPayload(
    {
      tool_name: "Agent",
      tool_input: {
        prompt: "[bee-tier: generation] do the thing",
        model: expectedGenerationModel,
        subagent_type: "general-purpose",
      },
    },
    enabledRoot,
  );
  check(
    r34.status === 2,
    "row34: marker + matching model param + general-purpose is still denied",
    `status=${r34.status} stderr=${r34.stderr}`,
  );
  check(r34.stderr.includes("bee-gather"), "row34: FIX names bee-gather even with a matching param", r34.stderr);

  // --- 35. [bee-tier: ceiling] + general-purpose -> allowed (no pinned agent)
  const r35 = await runHookPayload(
    { tool_name: "Agent", tool_input: { prompt: "[bee-tier: ceiling] do the thing", subagent_type: "general-purpose" } },
    enabledRoot,
  );
  check(r35.status === 0, "row35: ceiling marker + general-purpose is allowed (no pinned agent)",
    `status=${r35.status} stderr=${r35.stderr}`);

  // --- 36. marker + subagent_type "Explore" -> allowed ----------------------
  const r36 = await runHookPayload(
    { tool_name: "Agent", tool_input: { prompt: "[bee-tier: generation] do the thing", subagent_type: "Explore" } },
    enabledRoot,
  );
  check(r36.status === 0, "row36: generation marker + subagent_type Explore is allowed",
    `status=${r36.status} stderr=${r36.stderr}`);

  // --- 37. marker + subagent_type absent -> allowed (untouched today) ------
  const r37 = await runHookPayload(
    { tool_name: "Agent", tool_input: { prompt: "[bee-tier: review] check the diff" } },
    enabledRoot,
  );
  check(r37.status === 0, "row37: review marker with no subagent_type is allowed",
    `status=${r37.status} stderr=${r37.stderr}`);

  // --- 38. marker + subagent_type "bee-gather" (its own pinned type) -> allowed
  const r38 = await runHookPayload(
    { tool_name: "Agent", tool_input: { prompt: "[bee-tier: generation] do the thing", subagent_type: "bee-gather" } },
    enabledRoot,
  );
  check(r38.status === 0, "row38: generation marker + its own pinned subagent_type is allowed",
    `status=${r38.status} stderr=${r38.stderr}`);

  // --- 39. no marker (bare param, general-purpose) -> untouched, still allowed
  // (regresses row20a: model-param dispatches with general-purpose stay allowed
  // — the new rule only fires when a tier marker is present).
  const r39 = await runHookPayload(
    { tool_name: "Agent", tool_input: { model: "haiku", subagent_type: "general-purpose" } },
    enabledRoot,
  );
  check(r39.status === 0, "row39: bare param (no marker) + general-purpose stays allowed",
    `status=${r39.status} stderr=${r39.stderr}`);

  process.stdout.write(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}\n`);
  process.exitCode = failures === 0 ? 0 : 1;
}

await main();
