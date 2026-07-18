#!/usr/bin/env node
// test_dispatch_prepare.mjs — contract tests for `bee dispatch prepare`
// (g22-1, GH #22 P0-3): the payload/economics builder in
// skills/bee-hive/templates/lib/dispatch-prepare.mjs, run both through the
// real dispatcher (bee.mjs) and, for the headline round-trip, directly
// against the REAL dispatch-guard.mjs evaluateDispatch() the PreToolUse hook
// enforces — proving prepare and the guard share one vocabulary rather than
// two copies of the same judgment call (advisor A2).
//
// Self-contained, no framework, mirrors hooks/test_model_guard.mjs's
// check()/assert() style. Exits 1 on any failure.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { runModuleWorker } from "./lib/run-module-worker.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.dirname(path.dirname(SCRIPT_PATH));
const TEMPLATES_LIB = path.join(REPO_ROOT, "skills", "bee-hive", "templates", "lib");
const BEE_MJS = path.join(REPO_ROOT, "skills", "bee-hive", "templates", "bee.mjs");

let passed = 0;
let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS  ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`FAIL  ${name}`);
    console.log(`      ${error instanceof Error ? error.stack || error.message : error}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ─── fixture builders ───────────────────────────────────────────────────────

function mkFixture(prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(root, ".bee"), { recursive: true });
  fs.writeFileSync(path.join(root, ".bee", "onboarding.json"), '{"schema_version":"1.0","bee_version":"0.1.0"}\n');
  return root;
}

function writeConfig(root, models) {
  fs.writeFileSync(
    path.join(root, ".bee", "config.json"),
    `${JSON.stringify({ models }, null, 2)}\n`,
  );
}

function writeCellFixture(root, cell) {
  const cellsDir = path.join(root, ".bee", "cells");
  fs.mkdirSync(cellsDir, { recursive: true });
  fs.writeFileSync(
    path.join(cellsDir, `${cell.id}.json`),
    `${JSON.stringify(
      {
        status: "open",
        lane: "small",
        trace: {},
        ...cell,
      },
      null,
      2,
    )}\n`,
  );
}

function readLastJsonl(file) {
  if (!fs.existsSync(file)) return null;
  const lines = fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim());
  if (lines.length === 0) return null;
  return JSON.parse(lines[lines.length - 1]);
}

async function runBee(args, cwd) {
  return runModuleWorker(BEE_MJS, { args, cwd });
}

async function prepareOk(args, cwd) {
  const result = await runBee(["dispatch", "prepare", ...args, "--json"], cwd);
  assert(result.status === 0, `dispatch prepare ${args.join(" ")} exited ${result.status}: stdout=${result.stdout} stderr=${result.stderr}`);
  return JSON.parse(result.stdout);
}

// ─── THE HEADLINE (advisor A2): prepare's codex output through the REAL
// evaluateDispatch — proving prepare and the guard share one vocabulary. ────

await check("codex gather payload round-trips ALLOW through the real evaluateDispatch; a stripped marker DENIES", async () => {
  const root = mkFixture("dispatch-prepare-codex-headline-");
  writeConfig(root, { codex: { extraction: "gpt-5.5", generation: "gpt-5.5", review: null } });

  const out = await prepareOk(["--runtime", "codex", "--kind", "gather"], root);
  assert(out.tool === "spawn_agent", `expected tool spawn_agent, got ${JSON.stringify(out)}`);
  assert(out.payload.agent_type === "worker", `expected agent_type worker, got ${JSON.stringify(out.payload)}`);
  assert(
    /^\[bee-tier: generation\]/.test(out.payload.message),
    `expected message to open with the generation marker, got ${JSON.stringify(out.payload.message)}`,
  );

  const dispatchGuard = await import(pathToFileURL(path.join(TEMPLATES_LIB, "dispatch-guard.mjs")).href);

  const allowed = dispatchGuard.evaluateDispatch("spawn_agent", out.payload, root);
  assert(allowed.decision === "allow", `expected ALLOW for prepare's own codex payload, got ${JSON.stringify(allowed)}`);

  const stripped = { ...out.payload, message: out.payload.message.replace(/^\[bee-tier: generation\]\n/, "") };
  const denied = dispatchGuard.evaluateDispatch("spawn_agent", stripped, root);
  assert(denied.decision === "deny", `expected DENY once the marker is stripped, got ${JSON.stringify(denied)}`);
  assert(denied.transport === "codex-spawn-unmarked", `expected codex-spawn-unmarked, got ${JSON.stringify(denied)}`);
});

// ─── Claude payload through evaluateDispatch's claude branch ───────────────

await check("claude gather payload round-trips ALLOW through evaluateDispatch; general-purpose + the same marker DENIES", async () => {
  const root = mkFixture("dispatch-prepare-claude-headline-");
  writeConfig(root, { claude: { extraction: "haiku", generation: "sonnet", review: "opus" } });

  const out = await prepareOk(["--runtime", "claude", "--kind", "gather"], root);
  assert(out.tool === "Agent", `expected tool Agent, got ${JSON.stringify(out)}`);
  assert(out.payload.subagent_type === "bee-gather", `expected pinned type bee-gather, got ${JSON.stringify(out.payload)}`);
  assert(out.payload.model === "sonnet", `expected model sonnet, got ${JSON.stringify(out.payload)}`);
  assert(
    /^\[bee-tier: generation\]/.test(out.payload.prompt),
    `expected prompt to open with the generation marker, got ${JSON.stringify(out.payload.prompt)}`,
  );
  assert(out.payload.description === "gather (sonnet)", `expected description "gather (sonnet)", got ${JSON.stringify(out.payload.description)}`);

  const dispatchGuard = await import(pathToFileURL(path.join(TEMPLATES_LIB, "dispatch-guard.mjs")).href);

  const allowed = dispatchGuard.evaluateDispatch("Agent", out.payload, root);
  assert(allowed.decision === "allow", `expected ALLOW for prepare's own claude payload, got ${JSON.stringify(allowed)}`);
  assert(allowed.transport === "model-param", `expected model-param transport, got ${JSON.stringify(allowed)}`);

  const generalPurpose = { ...out.payload, subagent_type: "general-purpose" };
  const denied = dispatchGuard.evaluateDispatch("Agent", generalPurpose, root);
  assert(denied.decision === "deny", `expected DENY once subagent_type flips to general-purpose, got ${JSON.stringify(denied)}`);
  assert(denied.transport === "generic-type-denied", `expected generic-type-denied, got ${JSON.stringify(denied)}`);
});

// ─── cli-cell refusal: prepare NEVER routes around a refusal ───────────────

await check("kind cell against a cli-shaped generation slot returns the typed cli_tier_gather_only refusal, never a payload", async () => {
  const root = mkFixture("dispatch-prepare-cli-cell-");
  writeConfig(root, {
    claude: {
      extraction: "haiku",
      generation: { kind: "cli", command: "codex exec -m gpt-5.5 -s read-only -" },
      review: "opus",
    },
  });
  writeCellFixture(root, {
    id: "demo-1",
    feature: "demo",
    title: "Demo cell",
    action: "Do the demo thing.",
    verify: 'node -e "process.exit(0)"',
  });

  const result = await runBee(["dispatch", "prepare", "--runtime", "claude", "--kind", "cell", "--cell", "demo-1", "--json"], root);
  assert(result.status === 0, `expected exit 0 (a typed refusal is not a crash), got ${result.status}: ${result.stderr}`);
  const out = JSON.parse(result.stdout);
  assert(out.ok === false, `expected ok:false, got ${JSON.stringify(out)}`);
  assert(out.type === "refused" && out.reason === "cli_tier_gather_only", `expected the typed cli_tier_gather_only refusal, got ${JSON.stringify(out)}`);
  assert(out.slot === "generation", `expected slot generation, got ${JSON.stringify(out)}`);
  assert(typeof out.fix === "string" && out.fix, `expected a fix string, got ${JSON.stringify(out)}`);
  assert(!("tool" in out) && !("payload" in out), `a refusal must never carry a payload, got ${JSON.stringify(out)}`);
});

// ─── kind cell on a normal (non-cli) generation slot builds a real payload
// from the loaded cell's own id/feature ──────────────────────────────────

await check("kind cell on a model-shaped generation slot loads the cell and embeds its id/feature in the prompt", async () => {
  const root = mkFixture("dispatch-prepare-cell-ok-");
  writeConfig(root, { claude: { extraction: "haiku", generation: "sonnet", review: "opus" } });
  writeCellFixture(root, {
    id: "demo-7",
    feature: "widget-feature",
    title: "Implement the widget",
    action: "Implement the widget end to end.",
    verify: 'node -e "process.exit(0)"',
  });

  const out = await prepareOk(["--runtime", "claude", "--kind", "cell", "--cell", "demo-7"], root);
  assert(out.tool === "Agent", `expected tool Agent, got ${JSON.stringify(out)}`);
  assert(out.payload.prompt.includes("demo-7"), `expected the cell id in the prompt, got ${out.payload.prompt}`);
  assert(out.payload.prompt.includes("widget-feature"), `expected the feature in the prompt, got ${out.payload.prompt}`);
  assert(out.economics.logical_tier === "generation", `expected logical_tier generation, got ${JSON.stringify(out.economics)}`);
});

await check("kind cell without --cell throws (non-zero exit, no payload)", async () => {
  const root = mkFixture("dispatch-prepare-cell-missing-flag-");
  writeConfig(root, { claude: { extraction: "haiku", generation: "sonnet", review: "opus" } });
  const result = await runBee(["dispatch", "prepare", "--runtime", "claude", "--kind", "cell", "--json"], root);
  assert(result.status !== 0, `expected non-zero exit, got ${result.status}`);
});

await check("kind cell against an unknown cell id throws (non-zero exit)", async () => {
  const root = mkFixture("dispatch-prepare-cell-unknown-");
  writeConfig(root, { claude: { extraction: "haiku", generation: "sonnet", review: "opus" } });
  const result = await runBee(["dispatch", "prepare", "--runtime", "claude", "--kind", "cell", "--cell", "ghost-1", "--json"], root);
  assert(result.status !== 0, `expected non-zero exit, got ${result.status}`);
});

// ─── advisor kind resolves the ADVISOR model, never generation's ──────────

await check("kind advisor resolves the configured advisor model, not the generation model", async () => {
  const root = mkFixture("dispatch-prepare-advisor-");
  writeConfig(root, { claude: { extraction: "haiku", generation: "sonnet", review: "opus", advisor: "fable" } });

  const out = await prepareOk(["--runtime", "claude", "--kind", "advisor"], root);
  assert(out.economics.requested_model === "fable", `expected advisor model fable, got ${JSON.stringify(out.economics)}`);
  assert(out.economics.requested_model !== "sonnet", `advisor must never resolve the generation model, got ${JSON.stringify(out.economics)}`);
  assert(out.payload.model === "fable", `expected payload.model fable, got ${JSON.stringify(out.payload)}`);
  assert(out.economics.logical_tier === "advisor", `expected logical_tier advisor, got ${JSON.stringify(out.economics)}`);
});

await check("kind advisor with no advisor slot configured returns a typed refusal, never a payload", async () => {
  const root = mkFixture("dispatch-prepare-advisor-unconfigured-");
  writeConfig(root, { claude: { extraction: "haiku", generation: "sonnet", review: "opus" } });

  const result = await runBee(["dispatch", "prepare", "--runtime", "claude", "--kind", "advisor", "--json"], root);
  assert(result.status === 0, `expected exit 0 (a typed refusal is not a crash), got ${result.status}: ${result.stderr}`);
  const out = JSON.parse(result.stdout);
  assert(out.ok === false && out.reason === "advisor_not_configured", `expected the advisor_not_configured refusal, got ${JSON.stringify(out)}`);
  assert(!("tool" in out) && !("payload" in out), `a refusal must never carry a payload, got ${JSON.stringify(out)}`);
});

// ─── reviewer kind resolves the review slot, and a cli-shaped review slot
// builds an external-executor payload instead of an Agent/spawn_agent one ──

await check("kind reviewer resolves the review slot (not generation)", async () => {
  const root = mkFixture("dispatch-prepare-reviewer-");
  writeConfig(root, { claude: { extraction: "haiku", generation: "sonnet", review: "opus" } });

  const out = await prepareOk(["--runtime", "claude", "--kind", "reviewer"], root);
  assert(out.payload.model === "opus", `expected review model opus, got ${JSON.stringify(out.payload)}`);
  assert(out.payload.subagent_type === "bee-review", `expected pinned type bee-review, got ${JSON.stringify(out.payload)}`);
  assert(out.economics.logical_tier === "review", `expected logical_tier review, got ${JSON.stringify(out.economics)}`);
});

await check("a cli-shaped review slot builds a Bash-shaped external-executor payload for kind reviewer, not Agent/spawn_agent", async () => {
  const root = mkFixture("dispatch-prepare-cli-reviewer-");
  writeConfig(root, {
    claude: {
      extraction: "haiku",
      generation: "sonnet",
      review: { kind: "cli", command: "codex exec -m gpt-5.5 -s read-only -" },
    },
  });

  const out = await prepareOk(["--runtime", "claude", "--kind", "reviewer"], root);
  assert(out.tool === "Bash", `expected tool Bash for a cli-shaped review slot, got ${JSON.stringify(out)}`);
  assert(out.payload.command === "codex exec -m gpt-5.5 -s read-only -", `expected the configured command verbatim, got ${JSON.stringify(out.payload)}`);
  assert(typeof out.payload.stdin === "string" && out.payload.stdin, `expected a prompt on stdin, got ${JSON.stringify(out.payload)}`);
  assert(out.economics.channel === "cli-exec" && out.economics.enforcement === "cli-command", `expected cli-exec/cli-command economics, got ${JSON.stringify(out.economics)}`);
  assert(out.economics.effective_model_status === "unverified", `expected unverified effective_model_status, got ${JSON.stringify(out.economics)}`);
  assert(out.economics.requested_model === null, `a cli command names its own model — requested_model must be null, got ${JSON.stringify(out.economics)}`);
});

// ─── codex channel/enforcement economics: prompt-budget + inherited-or-unknown,
// never a structural model field on the spawn_agent payload ────────────────

await check("codex channel economics: prompt-budget enforcement, inherited-or-unknown status, no model field on the payload", async () => {
  const root = mkFixture("dispatch-prepare-codex-economics-");
  writeConfig(root, { codex: { extraction: "gpt-5.5", generation: "gpt-5.5", review: null } });

  const out = await prepareOk(["--runtime", "codex", "--kind", "gather"], root);
  assert(!("model" in out.payload), `codex spawn_agent has no per-agent model field, got ${JSON.stringify(out.payload)}`);
  assert(out.economics.channel === "codex-native", `expected channel codex-native, got ${JSON.stringify(out.economics)}`);
  assert(out.economics.enforcement === "prompt-budget", `expected enforcement prompt-budget, got ${JSON.stringify(out.economics)}`);
  assert(out.economics.effective_model_status === "inherited-or-unknown", `expected inherited-or-unknown, got ${JSON.stringify(out.economics)}`);
  assert(out.economics.requested_model === "gpt-5.5", `expected requested_model gpt-5.5 (informational even though unenforced), got ${JSON.stringify(out.economics)}`);
  assert(out.economics.effective_model === null, `effective_model must always be null at prepare time, got ${JSON.stringify(out.economics)}`);
});

// ─── prepare-time dispatch record: written with economics + dispatch_id ───

await check("prepare-time dispatch record is appended to .bee/logs/dispatch.jsonl with economics + dispatch_id", async () => {
  const root = mkFixture("dispatch-prepare-record-");
  writeConfig(root, { claude: { extraction: "haiku", generation: "sonnet", review: "opus" } });

  const out = await prepareOk(["--runtime", "claude", "--kind", "gather"], root);
  const line = readLastJsonl(path.join(root, ".bee", "logs", "dispatch.jsonl"));
  assert(line, "expected a line in .bee/logs/dispatch.jsonl");
  assert(line.source === "prepare", `expected source:prepare, got ${JSON.stringify(line)}`);
  assert(line.dispatch_id === out.dispatch_id, `expected the record's dispatch_id to match the returned one, got ${JSON.stringify(line)}`);
  assert(line.kind === "gather" && line.runtime === "claude", `expected kind/runtime recorded, got ${JSON.stringify(line)}`);
  assert(line.logical_tier === out.economics.logical_tier, `expected logical_tier to match economics, got ${JSON.stringify(line)}`);
  assert(line.requested_model === out.economics.requested_model, `expected requested_model to match economics, got ${JSON.stringify(line)}`);
  assert(line.channel === out.economics.channel && line.enforcement === out.economics.enforcement, `expected channel/enforcement to match economics, got ${JSON.stringify(line)}`);
  assert(line.cell === null, `a gather dispatch carries no cell id, got ${JSON.stringify(line)}`);
});

await check("prepare-time dispatch record for kind cell carries the cell id", async () => {
  const root = mkFixture("dispatch-prepare-record-cell-");
  writeConfig(root, { claude: { extraction: "haiku", generation: "sonnet", review: "opus" } });
  writeCellFixture(root, {
    id: "demo-9",
    feature: "demo",
    title: "Demo cell",
    action: "Do the demo thing.",
    verify: 'node -e "process.exit(0)"',
  });

  await prepareOk(["--runtime", "claude", "--kind", "cell", "--cell", "demo-9"], root);
  const line = readLastJsonl(path.join(root, ".bee", "logs", "dispatch.jsonl"));
  assert(line && line.cell === "demo-9", `expected cell demo-9 recorded, got ${JSON.stringify(line)}`);
});

// ─── bad --runtime / --kind refuse loudly ──────────────────────────────────

await check("an unknown --runtime is refused (non-zero exit)", async () => {
  const root = mkFixture("dispatch-prepare-bad-runtime-");
  const result = await runBee(["dispatch", "prepare", "--runtime", "banana", "--kind", "gather", "--json"], root);
  assert(result.status !== 0, `expected non-zero exit, got ${result.status}`);
});

await check("an unknown --kind is refused (non-zero exit)", async () => {
  const root = mkFixture("dispatch-prepare-bad-kind-");
  const result = await runBee(["dispatch", "prepare", "--runtime", "claude", "--kind", "banana", "--json"], root);
  assert(result.status !== 0, `expected non-zero exit, got ${result.status}`);
});

process.stdout.write(`\n${failed === 0 ? "ALL PASS" : `${failed} FAILURE(S)`} (${passed} passed, ${failed} failed)\n`);
process.exitCode = failed === 0 ? 0 : 1;
