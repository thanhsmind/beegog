#!/usr/bin/env node
// test_conformance.mjs — cnr2-14 (CONTEXT.md D12): black-box conformance
// suite over the AUTOMATABLE subset of docs/REFs/be-codex.md's P2 12-scenario
// list. Every scenario below subprocess-drives a real PUBLIC ENTRYPOINT
// (.bee/bin/bee.mjs, .bee/bin/hooks/*.mjs — the exact binaries wired into
// .codex/hooks.json / .claude/settings.json) against an isolated fixture
// store built fresh per scenario. NEVER touches this repo's own .bee/ state,
// NEVER fabricates a result, and asserts the NEGATIVE state too — that the
// refused action changed nothing — not merely that a deny code came back.
//
// Interactive / agent-behavior scenarios (1 tiny-no-ceremony, 2 standard
// Gates 1-3, 4 worker-single-cell-selection, 5-part-b the worker's own
// [BLOCKED] response, 7 package-install checkpoint, 8 subagent timeout /no
// duplicate dispatch, 9 compaction handoff, 10 feature-finish no auto-review,
// 11 review fan-out) are judgment calls a human or a live agent session
// makes, not something a fixture harness can force deterministically — they
// live in the manual checklist (docs/history/codex-native-runtime-v2/
// conformance-checklist.md) with the metric each feeds, never faked here.
//
// The matcher/spawn-guard checks below are labeled ADAPTER REGRESSIONS on
// purpose: they pin D4 (state-sync matcher superset) and D1/D4 (codex
// spawn_agent guard) capability decisions already implemented by earlier
// cnr2 cells — they are not one of the 12 numbered P2 scenarios.
//
// Helper policy (advisor finding 4, cell action text): existing test files
// (hooks/test_write_guard.mjs, hooks/test_model_guard.mjs,
// skills/bee-hive/templates/tests/test_bee_cli.mjs) export nothing, so
// fixture builders below are narrow, deliberate duplication of theirs (mkFixture,
// copyLib, buildDoctorFixture) — never an import of those top-level runners,
// which would execute them as a side effect.
//
// Exits 1 on any FAIL.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runModuleWorker } from "./lib/run-module-worker.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");
const BEE_MJS = path.join(REPO_ROOT, ".bee", "bin", "bee.mjs");
const WRITE_GUARD = path.join(REPO_ROOT, ".bee", "bin", "hooks", "bee-write-guard.mjs");
const MODEL_GUARD = path.join(REPO_ROOT, ".bee", "bin", "hooks", "bee-model-guard.mjs");
const REAL_LIB_DIR = path.join(REPO_ROOT, ".bee", "bin", "lib");

let failures = 0;

function record(id, description, passed, detail = "") {
  const label = passed ? "PASS" : "FAIL";
  if (!passed) failures += 1;
  console.log(`${label}  [${id}] ${description}${passed ? "" : ` :: ${detail}`}`);
}

// ─── shared fixture builders ────────────────────────────────────────────────
// Narrow duplication of hooks/test_write_guard.mjs / hooks/test_model_guard.mjs's
// own mkFixture/copyLib (both files independently carry the identical
// helper already — this is a third, equally narrow copy, not a new pattern).

function mkFixture(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function copyLib(fixtureRoot) {
  const libDir = path.join(fixtureRoot, ".bee", "bin", "lib");
  fs.mkdirSync(libDir, { recursive: true });
  for (const name of fs.readdirSync(REAL_LIB_DIR)) {
    if (!name.endsWith(".mjs")) continue;
    fs.copyFileSync(path.join(REAL_LIB_DIR, name), path.join(libDir, name));
  }
}

function writeStateFile(root, state) {
  fs.writeFileSync(path.join(root, ".bee", "state.json"), `${JSON.stringify(state, null, 2)}\n`);
}

// A store fixture usable by both bee.mjs (subprocess dispatcher) and the hook
// binaries (which dynamically import THIS root's own .bee/bin/lib copy).
function buildStoreFixture(prefix, { phase = "swarming", executionApproved = true, feature = "conform-demo" } = {}) {
  const root = mkFixture(prefix);
  fs.mkdirSync(path.join(root, ".bee"), { recursive: true });
  fs.writeFileSync(path.join(root, ".bee", "onboarding.json"), "{}\n");
  copyLib(root);
  writeStateFile(root, {
    phase,
    mode: "standard",
    feature,
    approved_gates: { context: true, shape: true, execution: executionApproved, review: false },
  });
  return root;
}

async function runBee(cwd, args, input) {
  return runModuleWorker(BEE_MJS, { args, cwd, input });
}

async function runHook(hookPath, payload, cwd) {
  return runModuleWorker(hookPath, { input: JSON.stringify(payload), cwd });
}

function rm(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

// ═════════════════════════════════════════════════════════════════════════
// Scenario 3 — source write before Gate 3 -> write-guard binary denies
// (fixture payload; no live-repo mutation; negative-state: nothing written)
// ═════════════════════════════════════════════════════════════════════════

async function scenario3() {
  const root = buildStoreFixture("bee-conformance-s3-", { phase: "validating", executionApproved: false });
  const target = "src/new-feature.js";
  const res = await runHook(WRITE_GUARD, { tool_name: "Edit", tool_input: { file_path: target } }, root);
  const denied = res.status === 2 && /bee gate/.test(res.stderr);
  const nothingWritten = !fs.existsSync(path.join(root, target));
  // Control row: the same gated phase still allows a docs/ target — proves
  // the deny is gate policy, not a broad write block (negative control).
  const control = await runHook(WRITE_GUARD, { tool_name: "Edit", tool_input: { file_path: "docs/notes.md" } }, root);
  record(
    "scenario-3",
    "a source write before Gate 3 is denied by the write-guard binary (public entrypoint) and nothing was written; a docs/ write in the same gated phase still passes (control)",
    denied && nothingWritten && control.status === 0,
    `deny: status=${res.status} stderr=${res.stderr}; nothingWritten=${nothingWritten}; control status=${control.status} stderr=${control.stderr}`,
  );
  rm(root);
}

// ═════════════════════════════════════════════════════════════════════════
// Scenario 6 — verify-red never caps -> cells cap refusal on a failed verify
// record, in a fixture store (public entrypoint: bee.mjs cells verify / cap)
// ═════════════════════════════════════════════════════════════════════════

async function scenario6() {
  const root = buildStoreFixture("bee-conformance-s6-");
  fs.writeFileSync(
    path.join(root, "cell.json"),
    JSON.stringify({
      id: "s6-1",
      feature: "conform-demo",
      title: "fixture cell for scenario 6 (verify-red never caps)",
      lane: "small",
      action: "Fixture only — never actually run outside this suite.",
      verify: 'node -e "process.exit(1)"',
    }),
  );
  const added = await runBee(root, ["cells", "add", "--file", "cell.json", "--json"]);
  const claimed = await runBee(root, ["cells", "claim", "--id", "s6-1", "--worker", "kevinb", "--json"]);
  const verified = await runBee(root, [
    "cells", "verify", "--id", "s6-1",
    "--command", 'node -e "process.exit(1)"',
    "--output", "exit 1 (red)", "--passed", "false", "--json",
  ]);
  const capAttempt = await runBee(root, [
    "cells", "cap", "--id", "s6-1", "--outcome", "must never cap", "--files", "a.js", "--json",
  ]);
  const refused = capAttempt.status === 1 && /no passing verify result/.test(capAttempt.stdout);
  const shown = await runBee(root, ["cells", "show", "--id", "s6-1", "--json"]);
  const shownParsed = JSON.parse(shown.stdout);
  const nothingCapped = shownParsed.trace.capped_at === null && shownParsed.status !== "capped";
  record(
    "scenario-6",
    "cells cap refuses on a recorded failed (red) verify via the public entrypoint, and the cell stays uncapped",
    added.status === 0 && claimed.status === 0 && verified.status === 0 && refused && nothingCapped,
    `add=${added.status} claim=${claimed.status} verify=${verified.status} cap: status=${capAttempt.status} stdout=${capAttempt.stdout} trace=${JSON.stringify(shownParsed.trace)}`,
  );
  rm(root);
}

// ═════════════════════════════════════════════════════════════════════════
// Scenario 5-part-a — reservation conflict: reserve refusal names the holder
// (mechanical half; the worker-side [BLOCKED] response is agent behavior ->
// manual checklist item, advisor finding 3)
// ═════════════════════════════════════════════════════════════════════════

async function scenario5a() {
  const root = buildStoreFixture("bee-conformance-s5a-");
  const first = await runBee(root, ["reservations", "reserve", "--agent", "otto", "--cell", "demo-1", "--path", "src/shared.js", "--json"]);
  const second = await runBee(root, ["reservations", "reserve", "--agent", "mel", "--cell", "demo-2", "--path", "src/shared.js", "--json"]);
  const secondParsed = second.status === 0 ? null : JSON.parse(second.stdout);
  const namesHolder =
    second.status === 1 &&
    secondParsed &&
    secondParsed.ok === false &&
    Array.isArray(secondParsed.conflicts) &&
    secondParsed.conflicts.some((c) => c.agent === "otto" && c.path === "src/shared.js");
  const listResult = await runBee(root, ["reservations", "list", "--active-only", "--json"]);
  const reservations = JSON.parse(listResult.stdout).reservations || [];
  const otto = reservations.filter((r) => r.agent === "otto" && r.path === "src/shared.js");
  const mel = reservations.filter((r) => r.agent === "mel" && r.path === "src/shared.js");
  const nothingGrantedToLoser = otto.length === 1 && mel.length === 0;
  record(
    "scenario-5-part-a",
    "a reservation conflict on the public entrypoint returns ok:false naming the holder, and no second reservation is granted for the loser",
    first.status === 0 && namesHolder && nothingGrantedToLoser,
    `first=${first.status} second: status=${second.status} stdout=${second.stdout} active=${JSON.stringify(reservations)}`,
  );
  rm(root);
}

// ═════════════════════════════════════════════════════════════════════════
// Scenario 12 — doctor fail-closed: a drifted fixture never reaches "ready"
// (cnr2-13 doctor fixtures; D11 — file presence is never capability)
// ═════════════════════════════════════════════════════════════════════════

const DOCTOR_HOOKS_JSON = {
  hooks: {
    PreToolUse: [
      {
        matcher: "spawn_agent",
        hooks: [{ type: "command", command: 'exec node "$r"/hooks/bee-model-guard.mjs --source=repo' }],
      },
    ],
    Stop: [{ hooks: [{ type: "command", command: 'exec node "$r"/hooks/bee-state-sync.mjs --source=repo' }] }],
  },
};

async function scenario12() {
  const dir = mkFixture("bee-conformance-s12-");
  try {
    fs.mkdirSync(path.join(dir, ".bee"), { recursive: true });
    fs.mkdirSync(path.join(dir, ".codex"), { recursive: true });
    fs.mkdirSync(path.join(dir, "hooks"), { recursive: true });
    const hooksJsonPath = path.join(dir, ".codex", "hooks.json");
    fs.writeFileSync(hooksJsonPath, `${JSON.stringify(DOCTOR_HOOKS_JSON, null, 2)}\n`, "utf8");
    fs.writeFileSync(path.join(dir, "hooks", "bee-model-guard.mjs"), "// stub\n", "utf8");
    fs.writeFileSync(path.join(dir, "hooks", "bee-state-sync.mjs"), "// stub\n", "utf8");
    fs.writeFileSync(path.join(dir, ".codex", "config.toml"), 'approval_policy = "never"\n', "utf8");

    const crypto = await import("node:crypto");
    const baselineHash = crypto.createHash("sha256").update(fs.readFileSync(hooksJsonPath)).digest("hex");
    fs.writeFileSync(
      path.join(dir, ".bee", "onboarding.json"),
      `${JSON.stringify(
        {
          schema_version: "1.0",
          bee_version: "0.1.0",
          managed: { repo_hooks: { ".codex/hooks.json": baselineHash } },
          agents_sync: { files: [] },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    // Baseline (clean, unmutated) fixture: even here, structurally-unknown
    // trust/discovery rows must keep overall_status not_ready (D11 — never
    // "ready" from file presence alone).
    const clean = await runBee(dir, ["doctor", "--runtime", "codex", "--json"]);
    const cleanParsed = clean.status === 0 ? JSON.parse(clean.stdout) : null;
    const cleanNotReady = clean.status === 0 && cleanParsed.overall_status === "not_ready";

    // Now drift the file AFTER the baseline hash was recorded — a real
    // post-onboarding drift, not a missing-baseline case.
    fs.writeFileSync(hooksJsonPath, `${JSON.stringify({ hooks: { Stop: [] } }, null, 2)}\n`, "utf8");
    const drifted = await runBee(dir, ["doctor", "--runtime", "codex", "--json"]);
    const driftedParsed = drifted.status === 0 ? JSON.parse(drifted.stdout) : null;
    const driftedNotReady = drifted.status === 0 && driftedParsed && driftedParsed.overall_status === "not_ready";
    const driftRow = driftedParsed && driftedParsed.rows.find((r) => r.row === "capability_baseline_match");
    const driftWarned = driftRow && driftRow.status === "warn" && typeof driftRow.fix === "string" && driftRow.fix.length > 0;

    record(
      "scenario-12",
      "doctor --runtime codex fail-closes on a drifted fixture: overall_status never reaches ready, even on the clean baseline, and the drifted row carries a FIX line",
      cleanNotReady && driftedNotReady && driftWarned,
      `clean: status=${clean.status} overall=${cleanParsed && cleanParsed.overall_status}; drifted: status=${drifted.status} overall=${driftedParsed && driftedParsed.overall_status} row=${JSON.stringify(driftRow)}`,
    );
  } finally {
    rm(dir);
  }
}

// ═════════════════════════════════════════════════════════════════════════
// ADAPTER REGRESSION — update_plan present in every rendered state-sync
// matcher (D4: superset, never a swap). Checked against THIS repo's own
// rendered targets, not a fixture — these are read-only inspections of
// tracked files, never a mutation.
// ═════════════════════════════════════════════════════════════════════════

function findStateSyncMatcher(hooksBlock) {
  const postToolUse = (hooksBlock && hooksBlock.PostToolUse) || [];
  for (const entry of postToolUse) {
    const names = (entry.hooks || []).map((h) => String(h.command || ""));
    if (names.some((c) => c.includes("bee-state-sync.mjs")) && typeof entry.matcher === "string") {
      return entry.matcher;
    }
  }
  return null;
}

function adapterRegressionMatcherSuperset() {
  const targets = [
    path.join(REPO_ROOT, "hooks", "hooks.json"),
    path.join(REPO_ROOT, "hooks", "claude-hooks.json"),
    path.join(REPO_ROOT, ".codex", "hooks.json"),
  ];
  const detail = [];
  let allOk = true;
  for (const file of targets) {
    let matcher = null;
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      matcher = findStateSyncMatcher(parsed.hooks || parsed);
    } catch (error) {
      matcher = null;
      detail.push(`${file}: unreadable (${error.message})`);
      allOk = false;
      continue;
    }
    const ok = typeof matcher === "string" && matcher.includes("update_plan");
    if (!ok) allOk = false;
    detail.push(`${path.relative(REPO_ROOT, file)}: matcher=${matcher}`);
  }
  // .claude/settings.json embeds the same hooks block under a top-level
  // "hooks" key rather than the plugin-manifest shape — read separately.
  const claudeSettings = path.join(REPO_ROOT, ".claude", "settings.json");
  try {
    const parsed = JSON.parse(fs.readFileSync(claudeSettings, "utf8"));
    const matcher = findStateSyncMatcher(parsed.hooks || {});
    const ok = typeof matcher === "string" && matcher.includes("update_plan");
    if (!ok) allOk = false;
    detail.push(`${path.relative(REPO_ROOT, claudeSettings)}: matcher=${matcher}`);
  } catch (error) {
    allOk = false;
    detail.push(`${claudeSettings}: unreadable (${error.message})`);
  }
  record(
    "adapter-regression-matcher-superset",
    "update_plan is present in the state-sync PostToolUse matcher of every rendered hook target (hooks/hooks.json, hooks/claude-hooks.json, .codex/hooks.json, .claude/settings.json)",
    allOk,
    detail.join(" | "),
  );
}

// ═════════════════════════════════════════════════════════════════════════
// ADAPTER REGRESSION — codex spawn guard: bare-denied / anchored-allowed /
// unobserved-fail-open (D1/D4 capability-matrix row D1; codex-cli 0.144.4
// spike). Subprocess-drives the real hooks/bee-model-guard.mjs binary.
// ═════════════════════════════════════════════════════════════════════════

async function adapterRegressionSpawnGuard() {
  const root = mkFixture("bee-conformance-spawnguard-");
  fs.mkdirSync(path.join(root, ".bee"), { recursive: true });
  fs.writeFileSync(path.join(root, ".bee", "onboarding.json"), "{}\n");
  copyLib(root);

  const bareDenied = await runHook(
    MODEL_GUARD,
    { tool_name: "spawn_agent", tool_input: { agent_type: "worker", message: "no marker here at all" } },
    root,
  );
  const bareDeniedOk = bareDenied.status === 2 && /spawn_agent/.test(bareDenied.stderr);

  const anchoredAllowed = await runHook(
    MODEL_GUARD,
    { tool_name: "spawn_agent", tool_input: { agent_type: "worker", message: "[bee-tier: generation] gather the callers" } },
    root,
  );
  const anchoredAllowedOk = anchoredAllowed.status === 0;

  const unobservedFailOpen = await runHook(
    MODEL_GUARD,
    { tool_name: "spawn_agent", tool_input: { agent_type: "default", message: "no marker here at all" } },
    root,
  );
  const unobservedFailOpenOk = unobservedFailOpen.status === 0;

  record(
    "adapter-regression-spawn-guard",
    "codex spawn_agent guard: unmarked worker spawn denies (bare-denied), an anchored [bee-tier:] marker allows (anchored-allowed), and an unobserved agent_type shape fails open (unobserved-fail-open)",
    bareDeniedOk && anchoredAllowedOk && unobservedFailOpenOk,
    `bare: status=${bareDenied.status} stderr=${bareDenied.stderr}; anchored: status=${anchoredAllowed.status} stderr=${anchoredAllowed.stderr}; unobserved: status=${unobservedFailOpen.status} stderr=${unobservedFailOpen.stderr}`,
  );
  rm(root);
}

// ═════════════════════════════════════════════════════════════════════════

async function main() {
  await scenario3();
  await scenario6();
  await scenario5a();
  await scenario12();
  adapterRegressionMatcherSuperset();
  await adapterRegressionSpawnGuard();

  const checklist = path.join(
    REPO_ROOT,
    "docs",
    "history",
    "codex-native-runtime-v2",
    "conformance-checklist.md",
  );
  const checklistExists = fs.existsSync(checklist) && fs.statSync(checklist).size > 0;
  record(
    "manual-checklist-present",
    "the manual checklist for the interactive/judgment scenarios exists and is non-empty",
    checklistExists,
    checklist,
  );

  console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
  process.exitCode = failures === 0 ? 0 : 1;
}

await main();
