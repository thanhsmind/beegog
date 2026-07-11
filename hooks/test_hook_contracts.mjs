#!/usr/bin/env node
// test_hook_contracts.mjs - RED-checkpoint harness (cell codex-parity-1,
// docs/history/codex-runtime-parity/plan.md test matrix row 2 "input
// extremes"; decision D2 in CONTEXT.md: "Codex receives full hook parity on
// every compatible event and tool path ... unsupported paths fail open with
// visible limits and runtime-specific tests").
//
// Spawns EACH of the seven production wrapper hooks
// (bee-session-init, bee-prompt-context, bee-state-sync, bee-chain-nudge,
// bee-session-close, bee-model-guard, bee-write-guard) as a REAL child
// process - same spawnSync-a-child pattern as hooks/test_write_guard.mjs and
// hooks/test_model_guard.mjs - and feeds it a table of adversarial stdin
// rows: empty input, junk bytes, top-level null, JSON array, object cwd,
// missing cwd, a ~2MB payload, plus Codex event-output parse rows
// (PreCompact/SubagentStop/Stop advisory shape, PreToolUse apply_patch deny
// shape). Every row's `expect` function encodes the TARGET/desired contract
// (fail-open on malformed input; parseable JSON systemMessage advisories,
// never `decision:"block"`; apply_patch targets run the same gate/direct-
// edit/reservation decisions as Edit/Write/Bash).
//
// This cell fixes NOTHING (per D2 and learning 20260711-model-tier-guard:
// adversarial rows from the start, checkpointed before repair) - it only
// observes the CURRENT unmodified wrappers against that target contract.
//
// Two modes:
//   --baseline : run every row against the current wrappers and record every
//                failure verbatim into
//                docs/history/codex-runtime-parity/reports/red-baseline.md.
//                Exits 0 regardless of failures - the failures ARE the
//                expected RED evidence being captured, not a harness bug.
//   (default)  : run every row and exit non-zero if any row violates its
//                target contract. This is the contract a future repair cell
//                must turn green; right now (unfixed wrappers) it is
//                expected to fail.
//
// Never edits hooks/*.mjs. Builds isolated tmp fixtures so no run ever
// touches this project's real .bee/state.json or .bee/logs/*.jsonl.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const HOOKS_DIR = path.dirname(SCRIPT_PATH);
const REPO_ROOT = path.dirname(HOOKS_DIR);
const REAL_LIB_DIR = path.join(REPO_ROOT, ".bee", "bin", "lib");
const REPORT_PATH = path.join(
  REPO_ROOT,
  "docs",
  "history",
  "codex-runtime-parity",
  "reports",
  "red-baseline.md",
);

const WRAPPERS = [
  "bee-session-init.mjs",
  "bee-prompt-context.mjs",
  "bee-state-sync.mjs",
  "bee-chain-nudge.mjs",
  "bee-session-close.mjs",
  "bee-model-guard.mjs",
  "bee-write-guard.mjs",
];

const HUGE_BLOB_LEN = 2 * 1024 * 1024; // ~2MB
const SPAWN_TIMEOUT_MS = 20000;
const SPAWN_MAX_BUFFER = 20 * 1024 * 1024;

// --- fixture builder ------------------------------------------------------

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

// One shared fixture shape for every wrapper: phase "swarming" with every
// gate approved (the most permissive gated phase, matching
// hooks/test_write_guard.mjs's buildFixture default) and NO .bee/HANDOFF.json.
// This is deliberate, not incidental: it is the one state that lets every
// row exercise real wrapper behavior instead of an early no-op --
// bee-session-close's "hive door open" warning and bee-chain-nudge's
// SubagentStop nudge both only fire outside phase "idle" with no HANDOFF, and
// bee-write-guard's unconditional `.bee/state.json` direct-edit deny needs a
// phase where writes are otherwise allowed to prove the deny is truly
// unconditional (not merely a side effect of a gate that would deny anyway).
function buildFixture(prefix) {
  const root = mkFixture(prefix);
  fs.mkdirSync(path.join(root, ".bee"), { recursive: true });
  fs.writeFileSync(path.join(root, ".bee", "onboarding.json"), "{}\n");
  copyLib(root);
  fs.writeFileSync(
    path.join(root, ".bee", "state.json"),
    `${JSON.stringify(
      {
        phase: "swarming",
        mode: "standard",
        feature: "demo",
        approved_gates: { context: true, shape: true, execution: true, review: false },
      },
      null,
      2,
    )}\n`,
  );
  return root;
}

// --- wrapper invocation ----------------------------------------------------

function runWrapper(wrapperBase, input, cwd) {
  const hookPath = path.join(HOOKS_DIR, wrapperBase);
  return spawnSync(process.execPath, [hookPath], {
    input,
    encoding: "utf8",
    cwd,
    timeout: SPAWN_TIMEOUT_MS,
    maxBuffer: SPAWN_MAX_BUFFER,
  });
}

// --- expectation helpers (the TARGET/desired contract) ---------------------

function truncate(text, len) {
  const s = text == null ? "" : String(text);
  if (s.length <= len) return s;
  return `${s.slice(0, len)}...[TRUNCATED, ${s.length} total chars]`;
}

// Malformed/adversarial input must never crash the wrapper (D2: fail open
// with visible limits). None of these rows are a legitimate deny case, so
// the only acceptable exit is 0. A Node uncaught exception exits non-zero
// (usually 1) with a stack trace on stderr - that is exactly the failure
// mode this row set is built to catch.
function expectNoCrash(result) {
  if (result.error) {
    return { pass: false, note: `spawn error: ${result.error.message}` };
  }
  if (result.status === 0) {
    return { pass: true, note: "exit 0 (fail-open) as required" };
  }
  return {
    pass: false,
    note:
      `expected exit 0 (fail-open) on malformed/adversarial input; got status=${result.status}` +
      `${result.signal ? ` signal=${result.signal}` : ""}`,
  };
}

function parseAdvisoryStdout(stdout) {
  const trimmed = (stdout || "").trim();
  if (!trimmed) return { empty: true, json: null };
  try {
    return { empty: false, json: JSON.parse(trimmed) };
  } catch {
    return { empty: false, json: null };
  }
}

// approach.md section 2: "Encode Codex PreCompact, SubagentStop, and Stop
// advisories as parseable JSON systemMessage. Do not use decision: "block",
// so close/nudge behavior remains advisory and cannot accidentally continue
// a child or loop a turn." Silence is fine (many hooks are conditionally
// silent); any non-empty stdout must be a JSON object with a string
// `systemMessage` and never `decision:"block"`.
function expectAdvisoryJsonOrSilent(result) {
  if (result.error) {
    return { pass: false, note: `spawn error: ${result.error.message}` };
  }
  if (result.status !== 0) {
    return { pass: false, note: `expected exit 0 (advisory-only, never blocking); got status=${result.status}` };
  }
  const parsed = parseAdvisoryStdout(result.stdout);
  if (parsed.empty) {
    return { pass: true, note: "silent (no advisory text emitted) - acceptable" };
  }
  if (!parsed.json || typeof parsed.json !== "object" || Array.isArray(parsed.json)) {
    return {
      pass: false,
      note:
        "stdout is non-empty but is not a parseable JSON object - Codex advisory output must be a JSON " +
        `systemMessage, not plain prose. Actual stdout: ${truncate(result.stdout, 500)}`,
    };
  }
  if (typeof parsed.json.systemMessage !== "string") {
    return {
      pass: false,
      note: `parsed JSON lacks a string "systemMessage" field. Actual stdout: ${truncate(result.stdout, 500)}`,
    };
  }
  if (parsed.json.decision === "block") {
    return {
      pass: false,
      note: `advisory used decision:"block" (must stay advisory-only, never blocking). Actual stdout: ${truncate(result.stdout, 500)}`,
    };
  }
  return { pass: true, note: "parseable JSON systemMessage, non-blocking" };
}

// approach.md section 2: "Adapt Codex write guarding to canonical apply_patch
// input ... run the existing gate/direct-edit/reservation decisions on every
// target." `.bee/state.json` is direct-edit-denied in EVERY phase regardless
// of tool shape (guards.mjs DIRECT_EDIT_DENY, proven unconditional by
// hooks/test_write_guard.mjs row1/row6) - so an apply_patch write targeting
// it must be denied (exit 2) exactly like an Edit/Write/Bash write is today.
function expectApplyPatchDenied(result) {
  if (result.error) {
    return { pass: false, note: `spawn error: ${result.error.message}` };
  }
  if (result.status === 2 && typeof result.stderr === "string" && result.stderr.trim()) {
    return { pass: true, note: "apply_patch target denied (exit 2) with a reason" };
  }
  return {
    pass: false,
    note:
      "expected exit 2 with a deny reason for an apply_patch write targeting .bee/state.json " +
      "(D2: apply_patch must run the same gate/direct-edit/reservation decisions as Edit/Write/Bash); " +
      `got status=${result.status} stderr=${truncate(result.stderr, 500)}`,
  };
}

// A Codex PreToolUse/apply_patch event is simply not a dispatch tool
// (Agent|Task) for bee-model-guard - approach.md section 2 explicitly keeps
// model-tier guard Claude-only ("Codex does not expose collaboration spawn
// through PreToolUse"). The only requirement here is that the unfamiliar
// shape doesn't crash the wrapper.
const expectApplyPatchIgnoredByModelGuard = expectNoCrash;

// --- row table ---------------------------------------------------------

function universalRows(fixtureRoot) {
  return [
    {
      id: "empty-stdin",
      input: "",
      expect: expectNoCrash,
    },
    {
      id: "junk-bytes",
      input: "not json at all {{{",
      expect: expectNoCrash,
    },
    {
      id: "top-level-null",
      input: "null",
      expect: expectNoCrash,
    },
    {
      id: "json-array",
      input: "[]",
      expect: expectNoCrash,
    },
    {
      id: "object-cwd",
      input: JSON.stringify({ cwd: { not: "a string" } }),
      expect: expectNoCrash,
    },
    {
      id: "missing-cwd",
      input: JSON.stringify({ tool_name: "Read" }),
      expect: expectNoCrash,
    },
    {
      id: "huge-payload-2mb",
      input: JSON.stringify({ cwd: fixtureRoot, blob: "a".repeat(HUGE_BLOB_LEN) }),
      expect: expectNoCrash,
    },
  ];
}

const APPLY_PATCH_PAYLOAD = (fixtureRoot) =>
  JSON.stringify({
    hook_event_name: "PreToolUse",
    tool_name: "apply_patch",
    tool_input: {
      input:
        "*** Begin Patch\n*** Update File: .bee/state.json\n@@\n-old\n+new\n*** End Patch",
    },
    cwd: fixtureRoot,
  });

// Event-output parse rows, wired to match the ACTUAL event -> wrapper
// matchers in hooks/hooks.json (not every event is meaningful for every
// wrapper): PreCompact only fires bee-session-close; SubagentStop fires
// bee-state-sync + bee-chain-nudge; Stop fires bee-state-sync +
// bee-session-close; PreToolUse (apply_patch) fires bee-write-guard +
// bee-model-guard.
function eventRows(wrapperBase, fixtureRoot) {
  const rows = [];
  if (wrapperBase === "bee-session-close.mjs") {
    rows.push({
      id: "codex-precompact-advisory",
      input: JSON.stringify({ hook_event_name: "PreCompact", cwd: fixtureRoot }),
      expect: expectAdvisoryJsonOrSilent,
    });
  }
  if (wrapperBase === "bee-state-sync.mjs" || wrapperBase === "bee-chain-nudge.mjs") {
    rows.push({
      id: "codex-subagentstop-advisory",
      input: JSON.stringify({
        hook_event_name: "SubagentStop",
        agent_name: "kevin",
        cwd: fixtureRoot,
      }),
      expect: expectAdvisoryJsonOrSilent,
    });
  }
  if (wrapperBase === "bee-state-sync.mjs" || wrapperBase === "bee-session-close.mjs") {
    rows.push({
      id: "codex-stop-advisory",
      input: JSON.stringify({ hook_event_name: "Stop", cwd: fixtureRoot }),
      expect: expectAdvisoryJsonOrSilent,
    });
  }
  if (wrapperBase === "bee-write-guard.mjs") {
    rows.push({
      id: "codex-pretooluse-applypatch-deny",
      input: APPLY_PATCH_PAYLOAD(fixtureRoot),
      expect: expectApplyPatchDenied,
    });
  }
  if (wrapperBase === "bee-model-guard.mjs") {
    rows.push({
      id: "codex-pretooluse-applypatch-ignored",
      input: APPLY_PATCH_PAYLOAD(fixtureRoot),
      expect: expectApplyPatchIgnoredByModelGuard,
    });
  }
  return rows;
}

function buildRowsForWrapper(wrapperBase, fixtureRoot) {
  return [...universalRows(fixtureRoot), ...eventRows(wrapperBase, fixtureRoot)];
}

// --- report writer -----------------------------------------------------

function previewInput(input) {
  return truncate(input, 300);
}

function writeBaselineReport(results, failures) {
  const total = results.length;
  const byWrapper = new Map();
  for (const r of results) {
    if (!byWrapper.has(r.wrapper)) byWrapper.set(r.wrapper, []);
    byWrapper.get(r.wrapper).push(r);
  }

  const lines = [];
  lines.push("# RED Baseline — Codex Runtime Parity (cell codex-parity-1)");
  lines.push("");
  lines.push(
    "Generated by `node hooks/test_hook_contracts.mjs --baseline` against the " +
      "CURRENT unmodified wrappers in `hooks/`. This cell fixes nothing — decision " +
      "D2 (CONTEXT.md) and learning `20260711-model-tier-guard` require adversarial " +
      "rows checkpointed BEFORE any repair. Every failure below is RED evidence for " +
      "the repair cells in the Safety foundation slice (plan.md epic E1).",
  );
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- ${WRAPPERS.length} wrappers, ${total} total probe rows.`);
  lines.push(
    `- **${failures.length} of ${total}** probes fail the target/desired contract encoded in ` +
      "`hooks/test_hook_contracts.mjs` (run the harness without `--baseline` to see this as a " +
      "non-zero exit code).",
  );
  lines.push("");
  lines.push("| Wrapper | Rows | Failing |");
  lines.push("|---|---|---|");
  for (const wrapperBase of WRAPPERS) {
    const rows = byWrapper.get(wrapperBase) || [];
    const fail = rows.filter((r) => !r.pass).length;
    lines.push(`| ${wrapperBase} | ${rows.length} | ${fail} |`);
  }
  lines.push("");
  lines.push("## Findings by wrapper");

  for (const wrapperBase of WRAPPERS) {
    const rows = byWrapper.get(wrapperBase) || [];
    lines.push("");
    lines.push(`### ${wrapperBase}`);
    lines.push("");
    lines.push("| Row | Verdict | Note |");
    lines.push("|---|---|---|");
    for (const r of rows) {
      const verdict = r.pass ? "ok" : "**RED**";
      lines.push(`| ${r.id} | ${verdict} | ${r.note.replace(/\|/g, "\\|")} |`);
    }

    const rowFailures = rows.filter((r) => !r.pass);
    if (rowFailures.length > 0) {
      lines.push("");
      lines.push("#### RED failures (verbatim)");
      for (const r of rowFailures) {
        lines.push("");
        lines.push(`**${r.id}**`);
        lines.push("");
        lines.push(`- input sent: \`${previewInput(r.inputRaw)}\``);
        lines.push(`- exit status: ${r.status === null ? "null" : r.status}`);
        lines.push(`- signal: ${r.signal || "null"}`);
        lines.push("- stderr:");
        lines.push("```");
        lines.push(r.stderr && r.stderr.length ? r.stderr : "<empty>");
        lines.push("```");
        lines.push("- stdout:");
        lines.push("```");
        lines.push(r.stdout && r.stdout.length ? truncate(r.stdout, 2000) : "<empty>");
        lines.push("```");
      }
    }
  }

  lines.push("");
  lines.push("## Decision D2");
  lines.push("");
  lines.push(
    "> D2 | Codex receives full hook parity on every compatible event and tool path: " +
      "session bootstrap, prompt reminder, write/privacy/reservation guard, state sync, " +
      "subagent-chain nudge, and session-close hygiene. Shared helpers remain the final " +
      "enforcement belt; unsupported paths fail open with visible limits and runtime-specific " +
      "tests. | The goal is Claude-like understanding and enforcement without pretending hooks " +
      "are a complete security boundary. Durable decision: `b7af1bf9`.",
  );
  lines.push("");
  lines.push(
    "This baseline is the \"before\" state proving the current wrappers do not yet meet that " +
      "bar. In this run:",
  );
  lines.push("");
  const crashers = WRAPPERS.filter((w) => {
    const rows = byWrapper.get(w) || [];
    return rows.some((r) => !r.pass && (r.id === "top-level-null" || r.id === "object-cwd"));
  });
  lines.push(
    `- ${crashers.length} of ${WRAPPERS.length} wrapper(s) crash (uncaught exception, non-zero exit) ` +
      "on a top-level JSON `null` payload and/or a non-string (object) `cwd`, instead of failing open: " +
      `${crashers.length ? crashers.join(", ") : "none"}.`,
  );
  const applyPatchDenyRow = (byWrapper.get("bee-write-guard.mjs") || []).find(
    (r) => r.id === "codex-pretooluse-applypatch-deny",
  );
  lines.push(
    `- bee-write-guard.mjs ${applyPatchDenyRow && !applyPatchDenyRow.pass ? "silently ALLOWS" : "correctly denies"} ` +
      "an `apply_patch` write whose target (`.bee/state.json`) is unconditionally direct-edit-denied for " +
      "every other recognized tool shape.",
  );
  const advisoryRowIds = [
    "codex-precompact-advisory",
    "codex-subagentstop-advisory",
    "codex-stop-advisory",
  ];
  const advisoryFailers = WRAPPERS.filter((w) => {
    const rows = byWrapper.get(w) || [];
    return rows.some((r) => !r.pass && advisoryRowIds.includes(r.id));
  });
  lines.push(
    `- ${advisoryFailers.length ? advisoryFailers.join(", ") : "none"} emit plain-text prose for a Codex ` +
      "PreCompact/SubagentStop/Stop advisory instead of the parseable JSON `systemMessage` D2 and " +
      "approach.md section 2 call for.",
  );
  lines.push("");

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${lines.join("\n")}\n`);
}

// --- main ----------------------------------------------------------------

async function main() {
  const baselineMode = process.argv.includes("--baseline");
  const results = [];

  for (const wrapperBase of WRAPPERS) {
    const fixtureRoot = buildFixture(`hook-contracts-${wrapperBase.replace(/\.mjs$/, "")}-`);
    const rows = buildRowsForWrapper(wrapperBase, fixtureRoot);
    for (const row of rows) {
      const spawnResult = runWrapper(wrapperBase, row.input, fixtureRoot);
      const verdict = row.expect(spawnResult);
      results.push({
        wrapper: wrapperBase,
        id: row.id,
        inputRaw: row.input,
        status: spawnResult.status,
        signal: spawnResult.signal,
        stdout: spawnResult.stdout,
        stderr: spawnResult.stderr,
        pass: verdict.pass,
        note: verdict.note,
      });
    }
  }

  const failures = results.filter((r) => !r.pass);

  for (const r of results) {
    const mark = r.pass ? "ok  " : "FAIL";
    process.stdout.write(`${mark} - ${r.wrapper} :: ${r.id} :: ${r.note}\n`);
  }
  process.stdout.write(
    `\n${results.length} rows across ${WRAPPERS.length} wrappers, ${failures.length} failing target contract\n`,
  );

  if (baselineMode) {
    writeBaselineReport(results, failures);
    process.stdout.write(
      `\nred-baseline.md written (${REPORT_PATH}) with ${failures.length} RED finding(s).\n`,
    );
    process.stdout.write("BASELINE CAPTURE COMPLETE\n");
    process.exitCode = 0;
    return;
  }

  process.stdout.write(`\n${failures.length === 0 ? "ALL PASS" : `${failures.length} FAILURE(S)`}\n`);
  process.exitCode = failures.length === 0 ? 0 : 1;
}

await main();
