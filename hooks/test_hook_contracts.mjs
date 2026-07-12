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
// Three modes:
//   --baseline     : run every wrapper row against the current wrappers and
//                    record every failure verbatim into
//                    docs/history/codex-runtime-parity/reports/red-baseline.md.
//                    Exits 0 regardless of failures - the failures ARE the
//                    expected RED evidence being captured, not a harness bug.
//   --catalog-only : (cell codex-parity-2) run ONLY the catalog drift-check,
//                    allowed-differences, and isolated-CODEX_HOME
//                    codex-acceptance rows; exit non-zero if any fails. Never
//                    touches the seven-wrapper table.
//   (default)      : run every row (wrapper table + catalog + acceptance) and
//                    exit non-zero if any row violates its target contract.
//                    The wrapper table's green state is the contract cell
//                    codex-parity-3 must reach; until then default mode is
//                    expected to fail.
//
// Never edits hooks/*.mjs. Builds isolated tmp fixtures so no run ever
// touches this project's real .bee/state.json or .bee/logs/*.jsonl.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  RUNTIMES,
  TARGETS,
  renderProjection,
  renderProjectionText,
  ALLOWED_DIFFERENCES,
  REPO_TRANSPORT_UNAVAILABLE_DIAGNOSTIC,
} from "./catalog.mjs";

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

// cell codex-parity-2 (docs/history/codex-runtime-parity/plan.md, approach.md
// section 1): hooks/hooks.json is the CODEX default projection,
// hooks/claude-hooks.json is the explicit CLAUDE projection. Both are
// rendered from the single logical catalog in hooks/catalog.mjs.
const CODEX_DEFAULT_HOOKS_PATH = path.join(HOOKS_DIR, "hooks.json");
const CLAUDE_HOOKS_PATH = path.join(HOOKS_DIR, "claude-hooks.json");
const CODEX_PLUGIN_MANIFEST_PATH = path.join(REPO_ROOT, ".codex-plugin", "plugin.json");

// cell codex-parity-6a: the ACTIVE source-repository Codex fallback. Unlike
// the two plugin projections above it is rendered with target "repo".
const CODEX_REPO_HOOKS_PATH = path.join(REPO_ROOT, ".codex", "hooks.json");

// REQUIRED-ROW MANIFEST (cell codex-parity-6a).
//
// `failures = results.filter(r => !r.pass)` counts only rows that RAN and
// failed, while a skip row is constructed with `pass: true` — so a row that is
// ABSENT (never registered) or SKIPPED ("codex CLI unavailable") prints
// ALL PASS and exits 0. That is a hole big enough to cap a cell through
// having done nothing. These row ids MUST be present AND MUST NOT be skipped
// in the group they belong to, or the run exits non-zero.
const REQUIRED_CATALOG_ROW_IDS = Object.freeze(["codex-repo-target-drift"]);

// Turn "required row is absent or skipped" into a real, visible FAILING row,
// so it flows through the ordinary failures filter and the ordinary output.
// `group` only labels the synthesized row; the enforcement is identical for
// every caller (cell codex-parity-6b reuses it for the installed-route rows,
// whose required ids are DERIVED FROM .codex/hooks.json itself — so dropping a
// configured command from the harness cannot go unnoticed either).
function enforceRequiredRows(results, requiredIds, group = "catalog-drift") {
  const extra = [];
  for (const id of requiredIds) {
    const row = results.find((r) => r.id === id);
    if (!row) {
      extra.push(
        genericRow(
          group,
          `required-row-present:${id}`,
          false,
          `REQUIRED ROW ABSENT: "${id}" was never registered in this run — a required row ` +
            "cannot be silently dropped (cell codex-parity-6a required-row manifest)",
        ),
      );
    } else if (row.skip) {
      extra.push(
        genericRow(
          group,
          `required-row-present:${id}`,
          false,
          `REQUIRED ROW SKIPPED: "${id}" reported skip — a required row may never be skipped ` +
            "(cell codex-parity-6a required-row manifest)",
        ),
      );
    }
  }
  return extra;
}

function genericRow(group, id, pass, note, extra = {}) {
  return {
    wrapper: group,
    id,
    status: extra.status ?? 0,
    signal: extra.signal ?? null,
    stdout: extra.stdout ?? "",
    stderr: extra.stderr ?? "",
    pass,
    note,
  };
}

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

function runWrapper(wrapperBase, input, cwd, extraArgs = []) {
  const hookPath = path.join(HOOKS_DIR, wrapperBase);
  return spawnSync(process.execPath, [hookPath, ...extraArgs], {
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

// --- catalog drift-check + allowed-differences (cell codex-parity-2) ------
//
// Proves hooks/catalog.mjs is the single source of truth for both checked-in
// projections: rendering "claude" must reproduce hooks/claude-hooks.json
// byte-for-byte, rendering "codex" must reproduce hooks/hooks.json (the
// Codex default projection) byte-for-byte, and the only structural
// difference between the two rendered projections is the declared
// ALLOWED_DIFFERENCES set (presently: bee-model-guard.mjs stays Claude-only,
// approach.md section 2). Any other drift — added, removed, or reordered
// rules that are not declared — fails this row.

function catalogDriftRow(id, pass, note) {
  return { wrapper: "catalog-drift", id, status: 0, signal: null, stdout: "", stderr: "", pass, note };
}

function runCatalogDriftChecks() {
  const rows = [];

  const claudeText = renderProjectionText(RUNTIMES.CLAUDE);
  const codexText = renderProjectionText(RUNTIMES.CODEX);
  const onDiskClaude = fs.readFileSync(CLAUDE_HOOKS_PATH, "utf8");
  const onDiskCodex = fs.readFileSync(CODEX_DEFAULT_HOOKS_PATH, "utf8");

  rows.push(
    catalogDriftRow(
      "claude-projection-byte-identical",
      claudeText === onDiskClaude,
      claudeText === onDiskClaude
        ? "rendering the logical catalog for \"claude\" reproduces hooks/claude-hooks.json byte-for-byte"
        : "DRIFT: rendering the logical catalog for \"claude\" does NOT reproduce hooks/claude-hooks.json byte-for-byte",
    ),
  );
  rows.push(
    catalogDriftRow(
      "codex-projection-byte-identical",
      codexText === onDiskCodex,
      codexText === onDiskCodex
        ? "rendering the logical catalog for \"codex\" reproduces hooks/hooks.json (Codex default projection) byte-for-byte"
        : "DRIFT: rendering the logical catalog for \"codex\" does NOT reproduce hooks/hooks.json byte-for-byte",
    ),
  );

  const claudeProjection = renderProjection(RUNTIMES.CLAUDE);
  const codexProjection = renderProjection(RUNTIMES.CODEX);

  // Every declared difference must actually be present in claude and absent
  // from codex (otherwise the declaration is stale/wrong).
  const declaredAccurate = ALLOWED_DIFFERENCES.every((d) => {
    const claudeGroups = claudeProjection.hooks[d.event] || [];
    const codexGroups = codexProjection.hooks[d.event] || [];
    const inClaude = claudeGroups.some((g) => g.matcher === d.matcher);
    const inCodex = codexGroups.some((g) => g.matcher === d.matcher);
    return inClaude && !inCodex;
  });

  // Remove exactly the declared differences from the claude projection; the
  // remainder must equal the codex projection exactly. That proves no
  // OTHER (undeclared) drift exists between the two projections.
  const claudeWithAllowedRemoved = JSON.parse(JSON.stringify(claudeProjection));
  for (const d of ALLOWED_DIFFERENCES) {
    const groups = claudeWithAllowedRemoved.hooks[d.event];
    if (!groups) continue;
    const filtered = groups.filter((g) => g.matcher !== d.matcher);
    if (filtered.length > 0) claudeWithAllowedRemoved.hooks[d.event] = filtered;
    else delete claudeWithAllowedRemoved.hooks[d.event];
  }
  const noUndeclaredDrift =
    JSON.stringify(claudeWithAllowedRemoved) === JSON.stringify(codexProjection);

  const allowedDifferencesOk = declaredAccurate && noUndeclaredDrift;
  rows.push(
    catalogDriftRow(
      "allowed-differences-only",
      allowedDifferencesOk,
      allowedDifferencesOk
        ? `only the declared difference(s) separate the two projections: ${ALLOWED_DIFFERENCES.map((d) => d.id).join(", ")}`
        : "DRIFT: claude/codex projections differ beyond the declared ALLOWED_DIFFERENCES " +
            `(declaredAccurate=${declaredAccurate}, noUndeclaredDrift=${noUndeclaredDrift})`,
    ),
  );

  // --- repo-target rows (cell codex-parity-6a) ----------------------------
  //
  // The ACTIVE source-repository fallback .codex/hooks.json must be generated
  // ONLY by renderProjectionText("codex", { target: "repo" }) — so hand-drift
  // in that live file turns this suite red. `codex-repo-target-drift` is a
  // REQUIRED row (see REQUIRED_CATALOG_ROW_IDS): it may never be absent or
  // skipped.
  const repoText = renderProjectionText(RUNTIMES.CODEX, { target: TARGETS.REPO });
  const onDiskRepo = fs.readFileSync(CODEX_REPO_HOOKS_PATH, "utf8");
  const repoMatches = repoText === onDiskRepo;
  rows.push(
    catalogDriftRow(
      "codex-repo-target-drift",
      repoMatches,
      repoMatches
        ? "rendering the logical catalog for \"codex\" at target \"repo\" reproduces .codex/hooks.json byte-for-byte"
        : "DRIFT: rendering the logical catalog for \"codex\" at target \"repo\" does NOT reproduce " +
            ".codex/hooks.json byte-for-byte — the active Codex project fallback is hand-drifted " +
            "or stale (regenerate it from the catalog; never hand-author event groups)",
    ),
  );

  // D2 / the incident itself: the repo transport must carry NO Claude-only
  // root variable (Codex sets neither; $CLAUDE_PROJECT_DIR unset is exactly
  // what collapsed the old commands to `node /.bee/bin/hooks/...` and killed
  // every hook with MODULE_NOT_FOUND), must launch the CURRENT source
  // wrappers under hooks/, must declare source identity repo, and must carry
  // the pinned VISIBLE fail-open diagnostic on stderr.
  const repoProjection = renderProjection(RUNTIMES.CODEX, { target: TARGETS.REPO });
  const repoCommands = Object.values(repoProjection.hooks)
    .flat()
    .flatMap((g) => g.hooks)
    .map((h) => h.command);
  const noClaudeVars = repoCommands.every(
    (c) => !/CLAUDE_PROJECT_DIR|CLAUDE_PLUGIN_ROOT/.test(c),
  );
  const launchesSourceWrappers = repoCommands.every((c) =>
    /exec node "\$r"\/hooks\/bee-[a-z-]+\.mjs --source=repo$/m.test(c),
  );
  const visibleFailOpen = repoCommands.every(
    (c) =>
      c.includes(`echo "${REPO_TRANSPORT_UNAVAILABLE_DIAGNOSTIC}" >&2`) &&
      c.includes("exit 0"),
  );
  const transportOk =
    repoCommands.length === 9 && noClaudeVars && launchesSourceWrappers && visibleFailOpen;
  rows.push(
    catalogDriftRow(
      "codex-repo-target-transport",
      transportOk,
      transportOk
        ? `all ${repoCommands.length} repo commands carry no Claude root variable, launch hooks/bee-*.mjs ` +
            "with --source=repo, and fail open VISIBLY on stderr when the git root cannot be resolved"
        : `repo transport contract violated: commands=${repoCommands.length} (expected 9) ` +
            `noClaudeVars=${noClaudeVars} launchesSourceWrappers=${launchesSourceWrappers} ` +
            `visibleFailOpen=${visibleFailOpen}`,
    ),
  );

  return rows;
}

// --- isolated-CODEX_HOME codex-acceptance row (cell codex-parity-2) -------
//
// plan.md Safety-foundation exit / validation-safety-foundation.md B4: in an
// isolated CODEX_HOME fixture (no auth needed for marketplace/list verbs),
// `codex plugin marketplace add <repo-root>` and
// `codex plugin list --available --json` must accept this repo's manifest
// and list plugin bee@bee cleanly, with the default hooks/hooks.json route
// present (.codex-plugin/plugin.json carries no "hooks" override, or one
// that already points at hooks/hooks.json — approach.md section 1: "Make
// hooks/hooks.json the Codex default projection so the Codex manifest can
// omit a redundant hooks field."). If the codex CLI is absent, this row
// SKIPS loudly by name — it never silently disappears from the output.

function detectCodexCli() {
  const result = spawnSync("codex", ["--version"], { encoding: "utf8", timeout: 10000 });
  if (result.error) return { present: false, reason: result.error.message };
  if (result.status !== 0) {
    return { present: false, reason: `exit status=${result.status} stderr=${truncate(result.stderr, 300)}` };
  }
  return { present: true, version: (result.stdout || "").trim() };
}

function codexAcceptanceRow(id, pass, note, extra = {}) {
  return {
    wrapper: "codex-acceptance",
    id,
    status: extra.status ?? null,
    signal: extra.signal ?? null,
    stdout: extra.stdout ?? "",
    stderr: extra.stderr ?? "",
    pass,
    skip: Boolean(extra.skip),
    note,
  };
}

function runCodexAcceptanceRows() {
  const detect = detectCodexCli();
  if (!detect.present) {
    return [
      codexAcceptanceRow(
        "codex-plugin-marketplace-accept",
        true,
        `SKIP: codex CLI not found on PATH (${detect.reason}) — isolated CODEX_HOME ` +
          "marketplace-add / plugin-list acceptance row cannot run in this environment",
        { skip: true },
      ),
    ];
  }

  const codexHome = fs.mkdtempSync(path.join(os.tmpdir(), "codex-home-acceptance-"));
  const env = { ...process.env, CODEX_HOME: codexHome };
  const rows = [];
  try {
    const addResult = spawnSync(
      "codex",
      ["plugin", "marketplace", "add", REPO_ROOT, "--json"],
      { encoding: "utf8", env, timeout: 30000 },
    );
    let addJson = null;
    try {
      addJson = JSON.parse((addResult.stdout || "").trim());
    } catch {
      addJson = null;
    }
    const addAccepted = Boolean(
      !addResult.error && addResult.status === 0 && addJson && addJson.installedRoot === REPO_ROOT,
    );
    rows.push(
      codexAcceptanceRow(
        "codex-plugin-marketplace-add",
        addAccepted,
        addAccepted
          ? `manifest accepted (marketplace "${addJson.marketplaceName}", root ${addJson.installedRoot})`
          : "codex plugin marketplace add did not accept this repo's manifest: " +
              `status=${addResult.status} stdout=${truncate(addResult.stdout, 500)} stderr=${truncate(addResult.stderr, 500)}`,
        { status: addResult.status, signal: addResult.signal, stdout: addResult.stdout, stderr: addResult.stderr },
      ),
    );
    if (!addAccepted) return rows;

    const listResult = spawnSync(
      "codex",
      ["plugin", "list", "--available", "--json"],
      { encoding: "utf8", env, timeout: 30000 },
    );
    let listJson = null;
    try {
      listJson = JSON.parse((listResult.stdout || "").trim());
    } catch {
      listJson = null;
    }
    const available = listJson && Array.isArray(listJson.available) ? listJson.available : [];
    const beePlugin = available.find((p) => p && (p.pluginId === "bee@bee" || p.name === "bee"));
    const listedCleanly = Boolean(!listResult.error && listResult.status === 0 && beePlugin);
    rows.push(
      codexAcceptanceRow(
        "codex-plugin-list-available",
        listedCleanly,
        listedCleanly
          ? `plugin "${beePlugin.pluginId || beePlugin.name}" listed cleanly from marketplace "${beePlugin.marketplaceName}"`
          : "bee plugin not found in \"codex plugin list --available --json\" output: " +
              `status=${listResult.status} stdout=${truncate(listResult.stdout, 500)} stderr=${truncate(listResult.stderr, 500)}`,
        { status: listResult.status, signal: listResult.signal, stdout: listResult.stdout, stderr: listResult.stderr },
      ),
    );

    const codexManifest = JSON.parse(fs.readFileSync(CODEX_PLUGIN_MANIFEST_PATH, "utf8"));
    const hooksOverride = codexManifest.hooks;
    const usesDefaultRoute = hooksOverride === undefined || hooksOverride === "./hooks/hooks.json";
    const defaultHooksExists = fs.existsSync(CODEX_DEFAULT_HOOKS_PATH);
    const routeProven = usesDefaultRoute && defaultHooksExists;
    rows.push(
      codexAcceptanceRow(
        "codex-default-hooks-route",
        routeProven,
        routeProven
          ? ".codex-plugin/plugin.json carries no hooks override (or the explicit default) and hooks/hooks.json exists at plugin root"
          : `default hooks/hooks.json route not proven: hooksOverride=${JSON.stringify(hooksOverride)} defaultHooksExists=${defaultHooksExists}`,
      ),
    );

    return rows;
  } finally {
    fs.rmSync(codexHome, { recursive: true, force: true });
  }
}

// --- adapter contract rows (cell codex-parity-3) ---------------------------
//
// ADDED row groups only — the cell-1 seven-wrapper fixture table above is
// untouched and these groups run in DEFAULT mode only, so --baseline keeps
// characterizing exactly the original table (cell codex-parity-1's contract)
// and --catalog-only keeps cell codex-parity-2's contract.
//
// Group "chain-nudge-nickname": a worker registered by the state CLI
// (bee_state.mjs worker add --nickname N — discovery.md Proved Gaps: the CLI
// stores `nickname` while chain-nudge previously read name|agent|worker) must
// be matched by bee-chain-nudge, the generic fallback keys must keep working,
// and an unregistered agent must stay silent.
//
// Group "coverage-gap": D2's "unsupported paths fail open with visible
// limits" — each adapter coverage-gap class lands a visible line in
// .bee/logs/hooks.jsonl (never silently), and a log-write failure NEVER flips
// the computed allow/deny result in either direction.

function adapterRow(group, id, pass, note, extra = {}) {
  return {
    wrapper: group,
    id,
    status: extra.status ?? null,
    signal: extra.signal ?? null,
    stdout: extra.stdout ?? "",
    stderr: extra.stderr ?? "",
    pass,
    note,
  };
}

function readHooksJsonl(fixtureRoot) {
  const file = path.join(fixtureRoot, ".bee", "logs", "hooks.jsonl");
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function findGapLine(fixtureRoot, hook, gap) {
  return readHooksJsonl(fixtureRoot).find(
    (line) => line && line.hook === hook && line.event === "coverage-gap" && line.gap === gap,
  );
}

function runNicknameRows() {
  const rows = [];
  // Dedicated fixture: a NON-swarming, non-reviewing phase (validating), so
  // the nudge can only fire through registered-worker matching — never
  // through the phase==="swarming" shortcut the shared fixture uses.
  const root = buildFixture("hook-contracts-nickname-");
  fs.writeFileSync(
    path.join(root, ".bee", "state.json"),
    `${JSON.stringify(
      {
        phase: "validating",
        mode: "standard",
        feature: "demo",
        approved_gates: { context: true, shape: true, execution: false, review: false },
        workers: [
          // exactly what `bee_state.mjs worker add --nickname kevin --cell demo-1` stores
          { nickname: "kevin", cell: "demo-1", tier: "generation", status: "working" },
          // a foreign/legacy entry shape: the generic fallback must still match
          { name: "legacy-worker" },
        ],
      },
      null,
      2,
    )}\n`,
  );

  const subagentStop = (agent) =>
    JSON.stringify({ hook_event_name: "SubagentStop", agent_name: agent, cwd: root });

  const r1 = runWrapper("bee-chain-nudge.mjs", subagentStop("kevin"), root);
  const p1 = parseAdvisoryStdout(r1.stdout);
  const r1pass = Boolean(
    r1.status === 0 &&
      p1.json &&
      typeof p1.json.systemMessage === "string" &&
      p1.json.systemMessage.includes('Worker "kevin"') &&
      p1.json.decision !== "block",
  );
  rows.push(
    adapterRow(
      "chain-nudge-nickname",
      "registered-nickname-matched",
      r1pass,
      r1pass
        ? 'worker registered under `nickname` ("kevin") is matched and nudged via JSON systemMessage'
        : `expected a JSON systemMessage naming Worker "kevin"; got status=${r1.status} stdout=${truncate(r1.stdout, 300)}`,
      r1,
    ),
  );

  const r2 = runWrapper("bee-chain-nudge.mjs", subagentStop("legacy-worker"), root);
  const p2 = parseAdvisoryStdout(r2.stdout);
  const r2pass = Boolean(
    r2.status === 0 &&
      p2.json &&
      typeof p2.json.systemMessage === "string" &&
      p2.json.systemMessage.includes('Worker "legacy-worker"'),
  );
  rows.push(
    adapterRow(
      "chain-nudge-nickname",
      "generic-fallback-still-works",
      r2pass,
      r2pass
        ? "legacy entry registered under `name` still matches through the generic fallback"
        : `expected a JSON systemMessage naming Worker "legacy-worker"; got status=${r2.status} stdout=${truncate(r2.stdout, 300)}`,
      r2,
    ),
  );

  const r3 = runWrapper("bee-chain-nudge.mjs", subagentStop("stranger"), root);
  const r3pass = r3.status === 0 && !(r3.stdout || "").trim();
  rows.push(
    adapterRow(
      "chain-nudge-nickname",
      "unregistered-agent-stays-silent",
      r3pass,
      r3pass
        ? "an agent not registered under any key stays silent (control: the match is real)"
        : `expected silence for an unregistered agent; got status=${r3.status} stdout=${truncate(r3.stdout, 300)}`,
      r3,
    ),
  );

  return rows;
}

function runCoverageGapRows() {
  const rows = [];

  // -- gap class: malformed-payload (top-level null) + source threading -----
  const f1 = buildFixture("hook-contracts-gap-malformed-");
  const g1 = runWrapper("bee-session-init.mjs", "null", f1, ["--source=plugin"]);
  const line1 = findGapLine(f1, "session-init", "malformed-payload");
  const g1pass = Boolean(g1.status === 0 && line1 && line1.source === "plugin");
  rows.push(
    adapterRow(
      "coverage-gap",
      "malformed-payload-logged",
      g1pass,
      g1pass
        ? 'top-level null fails open AND lands a visible coverage-gap line (gap "malformed-payload") carrying the explicit --source identity'
        : `expected exit 0 plus a hooks.jsonl coverage-gap line with gap="malformed-payload" and source="plugin"; got status=${g1.status} line=${JSON.stringify(line1)}`,
      g1,
    ),
  );

  // -- gap class: invalid-cwd ------------------------------------------------
  const f2 = buildFixture("hook-contracts-gap-cwd-");
  const g2 = runWrapper("bee-session-init.mjs", JSON.stringify({ cwd: { not: "a string" } }), f2);
  const line2 = findGapLine(f2, "session-init", "invalid-cwd");
  const g2pass = Boolean(g2.status === 0 && line2);
  rows.push(
    adapterRow(
      "coverage-gap",
      "invalid-cwd-logged",
      g2pass,
      g2pass
        ? 'non-string cwd fails open AND lands a visible coverage-gap line (gap "invalid-cwd")'
        : `expected exit 0 plus a hooks.jsonl coverage-gap line with gap="invalid-cwd"; got status=${g2.status} line=${JSON.stringify(line2)}`,
      g2,
    ),
  );

  // -- gap class: invalid-source ----------------------------------------------
  const f3 = buildFixture("hook-contracts-gap-source-");
  const g3 = runWrapper("bee-session-init.mjs", JSON.stringify({ cwd: f3 }), f3, [
    "--source=weird",
  ]);
  const line3 = findGapLine(f3, "session-init", "invalid-source");
  const g3pass = Boolean(g3.status === 0 && line3);
  rows.push(
    adapterRow(
      "coverage-gap",
      "invalid-source-logged",
      g3pass,
      g3pass
        ? 'an unknown --source identity is recorded as a visible coverage-gap line (gap "invalid-source"), never a behavior change'
        : `expected exit 0 plus a hooks.jsonl coverage-gap line with gap="invalid-source"; got status=${g3.status} line=${JSON.stringify(line3)}`,
      g3,
    ),
  );

  // -- gap class: applypatch-unparsed -> DENY (P1 repair, cell codex-parity-4,
  // plan-review third bullet) --------------------------------------------------
  // codex-parity-3/-4 boundary, RETARGETED (the ONE sanctioned expectation
  // change in this suite, per codex-parity-4's cell): an intercepted
  // apply_patch (a canonical "*** Begin Patch" envelope was found) whose
  // targets cannot be proved — here, zero Add/Update/Delete/Move/"Move to"
  // lines parsed at all — now DENIES (exit 2) instead of failing open. The
  // visible coverage-gap line is still logged either way (D2: "visible
  // limits"); only the allow/deny outcome strengthens. This is honestly a
  // behavior change, not a weakening: it was fail-open under cell
  // codex-parity-3, and codex-parity-4's plan-reviewed P1 repair explicitly
  // retargets it to deny.
  const f4 = buildFixture("hook-contracts-gap-applypatch-");
  const g4 = runWrapper(
    "bee-write-guard.mjs",
    JSON.stringify({
      hook_event_name: "PreToolUse",
      tool_name: "apply_patch",
      tool_input: { input: "*** Begin Patch\njunk hunk with no file verbs\n*** End Patch" },
      cwd: f4,
    }),
    f4,
  );
  const line4 = findGapLine(f4, "write-guard", "applypatch-unparsed");
  const g4pass = Boolean(
    g4.status === 2 && typeof g4.stderr === "string" && g4.stderr.trim() && line4,
  );
  rows.push(
    adapterRow(
      "coverage-gap",
      "applypatch-unparsed-logged",
      g4pass,
      g4pass
        ? 'an intercepted apply_patch with no provable target is DENIED (exit 2, corrective stderr) and still logs a visible coverage-gap line (gap "applypatch-unparsed") — P1 repair, cell codex-parity-4'
        : `expected exit 2 with a deny reason plus a hooks.jsonl coverage-gap line with gap="applypatch-unparsed"; got status=${g4.status} stderr=${truncate(g4.stderr, 300)} line=${JSON.stringify(line4)}`,
      g4,
    ),
  );

  // -- invariant: a log-write failure never flips a DENY into an allow --------
  // .bee/logs is created as a regular FILE so every mkdir/append inside the
  // logging path fails. The patch has one unprovable target (gap log attempt
  // fails) AND one provable direct-edit-denied target — the deny must survive.
  const f5 = buildFixture("hook-contracts-logfail-deny-");
  fs.writeFileSync(path.join(f5, ".bee", "logs"), "not a directory\n");
  const g5 = runWrapper(
    "bee-write-guard.mjs",
    JSON.stringify({
      hook_event_name: "PreToolUse",
      tool_name: "apply_patch",
      tool_input: {
        input:
          "*** Begin Patch\n*** Update File: /etc/outside-the-repo\n@@\n-a\n+b\n*** Update File: .bee/state.json\n@@\n-old\n+new\n*** End Patch",
      },
      cwd: f5,
    }),
    f5,
  );
  const g5pass = Boolean(
    g5.status === 2 && typeof g5.stderr === "string" && g5.stderr.includes("bee_state.mjs"),
  );
  rows.push(
    adapterRow(
      "coverage-gap",
      "log-write-failure-never-flips-deny",
      g5pass,
      g5pass
        ? "with .bee/logs unwritable, the computed deny (exit 2, direct-edit reason) still stands"
        : `expected exit 2 naming bee_state.mjs despite the unwritable log path; got status=${g5.status} stderr=${truncate(g5.stderr, 300)}`,
      g5,
    ),
  );

  // -- invariant: a log-write failure never flips an ALLOW into a deny --------
  const f6 = buildFixture("hook-contracts-logfail-allow-");
  fs.writeFileSync(path.join(f6, ".bee", "logs"), "not a directory\n");
  const g6 = runWrapper("bee-session-init.mjs", "null", f6);
  const g6pass = g6.status === 0;
  rows.push(
    adapterRow(
      "coverage-gap",
      "log-write-failure-never-flips-allow",
      g6pass,
      g6pass
        ? "with .bee/logs unwritable, malformed input still fails open (exit 0) — the gap-log failure is swallowed"
        : `expected exit 0 despite the unwritable log path; got status=${g6.status} stderr=${truncate(g6.stderr, 300)}`,
      g6,
    ),
  );

  return rows;
}

// --- installed-route rows (cell codex-parity-6b) ---------------------------
//
// Every row above spawns a wrapper DIRECTLY (`node hooks/bee-*.mjs`). That is
// not how Codex runs a hook, and a direct-wrapper test is exactly what let the
// original incident ship: the wrappers were fine, the INSTALLED COMMAND STRING
// was broken (`node "$CLAUDE_PROJECT_DIR"/.bee/bin/hooks/...` with
// $CLAUDE_PROJECT_DIR unset on Codex collapsed to `node /.bee/bin/hooks/...`
// -> MODULE_NOT_FOUND, every hook dead).
//
// So these rows take the OTHER route: they read the ACTIVE .codex/hooks.json,
// take each configured command string VERBATIM, and execute it the way Codex
// does — `bash -lc <command>` with the session cwd and the event payload on
// stdin (validation-codex-repo-fallback-split.md A1: the shipped Codex binary
// spawns `$SHELL -lc`; A2: commands run with the session cwd). `bash` is
// pinned rather than the developer's real $SHELL: a fish/nu $SHELL cannot run
// this POSIX transport, and that gap is declared, not silently "passed".
//
// Isolation (all of it load-bearing):
//   - a throwaway git fixture whose ROOT PATH CONTAINS SPACES AND UNICODE, so
//     an unquoted `$r` in any command string is caught here rather than in a
//     user's checkout;
//   - a NESTED cwd inside it, so git-root resolution is genuinely exercised;
//   - CLAUDE_PROJECT_DIR / CLAUDE_PLUGIN_ROOT UNSET — the incident's condition;
//   - HOME and CODEX_HOME pointed at the fixture, so a login shell cannot read
//     an rc file that `cd`s the process back into the live repo and lets
//     git-root resolution escape the fixture;
//   - the live repo's own .bee/state.json, .bee/.inject-cache.json and
//     .bee/logs/hooks.jsonl are hashed before and after: these rows drive REAL
//     state-mutating hooks, and they must not touch the running project.
//
// RED sensitivity is mechanical, not asserted: `--config-ref=<git-ref>` feeds
// the SAME rows the .codex/hooks.json of another commit. Against the pre-6a
// config (ba31819…) the transport is the broken one and these rows go RED.

const ROUTE_SHELL = fs.existsSync("/bin/bash") ? "/bin/bash" : "bash";
const CODEX_REPO_HOOKS_REPO_RELPATH = ".codex/hooks.json";

// Executables the login shell + the transport legitimately need. `git` is
// deliberately NOT here: the shim directory built from this list is what makes
// the git-absent row real.
const SHIM_BINARIES = Object.freeze([
  "node",
  "bash",
  "sh",
  "env",
  "cat",
  "id",
  "uname",
  "dirname",
  "basename",
  "sed",
  "grep",
  "tr",
  "expr",
  "mktemp",
  "tput",
  "locale",
  "which",
]);

function routeRow(id, pass, note, extra = {}) {
  return genericRow("repo-route", id, pass, note, extra);
}

// Read the configured commands from the active worktree file, or (bounded
// sensitivity option) from `<ref>:.codex/hooks.json`.
function readRepoHooksConfig(configRef) {
  if (!configRef) {
    return { text: fs.readFileSync(CODEX_REPO_HOOKS_PATH, "utf8"), origin: "worktree" };
  }
  const shown = spawnSync("git", ["show", `${configRef}:${CODEX_REPO_HOOKS_REPO_RELPATH}`], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    timeout: SPAWN_TIMEOUT_MS,
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  if (shown.error || shown.status !== 0) {
    throw new Error(
      `cannot read ${CODEX_REPO_HOOKS_REPO_RELPATH} at ref "${configRef}": ` +
        `status=${shown.status} ${truncate(shown.stderr, 300)}`,
    );
  }
  return { text: shown.stdout, origin: `ref ${configRef}` };
}

// Flatten the config into the exact list of command strings Codex would run.
function parseConfiguredCommands(configText) {
  const config = JSON.parse(configText);
  const commands = [];
  for (const [event, groups] of Object.entries(config.hooks || {})) {
    (groups || []).forEach((group, gi) => {
      (group.hooks || []).forEach((entry, hi) => {
        const command = entry && typeof entry.command === "string" ? entry.command : "";
        const scriptMatch = command.match(/bee-([a-z-]+)\.mjs/);
        const script = scriptMatch ? scriptMatch[1] : `unknown-${gi}-${hi}`;
        commands.push({
          event,
          matcher: group.matcher ?? null,
          script,
          command,
          id: `${event}:${script}`,
        });
      });
    });
  }
  return commands;
}

// An apply_patch envelope whose target is written RELATIVE TO THE SESSION CWD
// — which is how Codex's apply_patch addresses files. From the fixture root
// that is `.bee/state.json`; from the nested cwd it is `../../.bee/state.json`.
// Getting this right matters twice over: it is what the real tool sends, and
// it makes the row prove that the guard RESOLVES the target (a guard that
// merely string-matched ".bee/state.json" would deny the nested case for the
// wrong reason, and would also deny an innocent nested `.bee/state.json` that
// is not the bee state file at all).
function routeApplyPatchPayload(cwd, fixtureRoot) {
  const target = path
    .relative(cwd, path.join(fixtureRoot, ".bee", "state.json"))
    .split(path.sep)
    .join("/");
  return JSON.stringify({
    hook_event_name: "PreToolUse",
    tool_name: "apply_patch",
    tool_input: {
      input: `*** Begin Patch\n*** Update File: ${target}\n@@\n-old\n+new\n*** End Patch`,
    },
    cwd,
  });
}

// The event payload Codex would put on the hook's stdin.
function routePayload(event, cwd, fixtureRoot) {
  switch (event) {
    case "PreToolUse":
      return routeApplyPatchPayload(cwd, fixtureRoot);
    case "PostToolUse":
      return JSON.stringify({ hook_event_name: "PostToolUse", tool_name: "TodoWrite", cwd });
    case "SubagentStop":
      return JSON.stringify({ hook_event_name: "SubagentStop", agent_name: "kevin", cwd });
    case "SessionStart":
      return JSON.stringify({ hook_event_name: "SessionStart", source: "startup", cwd });
    case "UserPromptSubmit":
      return JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt: "status?", cwd });
    default:
      return JSON.stringify({ hook_event_name: event, cwd });
  }
}

// PreToolUse is the one configured command whose contract is a DENY; every
// other event is fail-open/advisory.
function routeExpectation(event) {
  if (event === "PreToolUse") return expectApplyPatchDenied;
  if (ADVISORY_ROUTE_EVENTS.includes(event)) return expectAdvisoryJsonOrSilent;
  return expectNoCrash;
}

const ADVISORY_ROUTE_EVENTS = Object.freeze(["PreCompact", "SubagentStop", "Stop"]);

function buildRouteFixture() {
  // Spaces AND Unicode in the root path — an unquoted "$r" dies here.
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "bee route ✦ fixture ")));
  const home = path.join(root, ".fixture-home");
  const codexHome = path.join(root, ".fixture-codex-home");
  const nested = path.join(root, "src", "deep nest ✦");
  const shim = path.join(root, ".shim-no-git");
  for (const dir of [home, codexHome, nested, shim, path.join(root, "hooks")]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // The wrappers the configured commands actually exec, plus the shared libs
  // they import at runtime.
  fs.mkdirSync(path.join(root, ".bee"), { recursive: true });
  for (const name of fs.readdirSync(HOOKS_DIR)) {
    if (name.endsWith(".mjs")) {
      fs.copyFileSync(path.join(HOOKS_DIR, name), path.join(root, "hooks", name));
    }
  }
  copyLib(root);
  fs.writeFileSync(path.join(root, ".bee", "onboarding.json"), "{}\n");
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

  const gitInit = spawnSync("git", ["init", "-q", root], {
    encoding: "utf8",
    env: { ...process.env, HOME: home },
    timeout: SPAWN_TIMEOUT_MS,
  });
  if (gitInit.error || gitInit.status !== 0) {
    throw new Error(`route fixture: git init failed: ${gitInit.error?.message || gitInit.stderr}`);
  }

  // The git-absent shim: node + bash + the login shell's usual coreutils, and
  // NO git. `command -v git` under this PATH must come back empty — a row
  // asserts exactly that before any git-absent conclusion is drawn.
  for (const bin of SHIM_BINARIES) {
    const found = spawnSync("sh", ["-c", `command -v ${bin}`], { encoding: "utf8", timeout: 5000 });
    const resolved = (found.stdout || "").trim();
    if (found.status === 0 && resolved && path.basename(resolved) !== "git") {
      try {
        fs.symlinkSync(resolved, path.join(shim, bin));
      } catch {
        // a missing optional utility is not fatal — the shim only has to carry
        // enough for `bash -lc` and `node`
      }
    }
  }

  // A directory that is inside NO git repository (the "non-git cwd" arm).
  const nonGit = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "bee route non-git ")));

  return { root, home, codexHome, nested, shim, nonGit };
}

// The environment Codex would hand the hook — minus the two Claude-only root
// variables, with HOME/CODEX_HOME caged inside the fixture.
function routeEnv(fixture, { noGit = false } = {}) {
  const env = { ...process.env };
  delete env.CLAUDE_PROJECT_DIR;
  delete env.CLAUDE_PLUGIN_ROOT;
  env.HOME = fixture.home;
  env.CODEX_HOME = fixture.codexHome;
  if (noGit) env.PATH = fixture.shim;
  return env;
}

function runRouteCommand(command, cwd, input, env) {
  return spawnSync(ROUTE_SHELL, ["-lc", command], {
    input,
    cwd,
    env,
    encoding: "utf8",
    timeout: SPAWN_TIMEOUT_MS,
    maxBuffer: SPAWN_MAX_BUFFER,
  });
}

// The pinned fail-open contract (codex-parity-6a): exit 0, stdout EMPTY,
// stderr carrying the exact diagnostic literal. Login-shell noise (an
// /etc/profile.d script complaining about a utility the shim does not carry)
// may share stderr — the literal must be PRESENT, not alone.
function expectTransportFailOpen(result) {
  if (result.error) return { pass: false, note: `spawn error: ${result.error.message}` };
  const stdout = result.stdout || "";
  const stderr = result.stderr || "";
  const problems = [];
  if (result.status !== 0) problems.push(`expected exit 0 (fail-open), got status=${result.status}`);
  if (stdout.trim()) problems.push(`expected EMPTY stdout, got: ${truncate(stdout, 300)}`);
  if (!stderr.includes(REPO_TRANSPORT_UNAVAILABLE_DIAGNOSTIC)) {
    problems.push(
      `stderr does not carry the pinned literal "${REPO_TRANSPORT_UNAVAILABLE_DIAGNOSTIC}"; got: ${truncate(stderr, 300)}`,
    );
  }
  if (problems.length > 0) return { pass: false, note: problems.join(" | ") };
  return {
    pass: true,
    note: `transport fails open VISIBLY: exit 0, empty stdout, stderr carries "${REPO_TRANSPORT_UNAVAILABLE_DIAGNOSTIC}"`,
  };
}

function liveStateFingerprint() {
  const beeDir = path.join(REPO_ROOT, ".bee");
  const fingerprint = {};
  for (const rel of ["state.json", ".inject-cache.json", path.join("logs", "hooks.jsonl")]) {
    const file = path.join(beeDir, rel);
    if (!fs.existsSync(file)) {
      fingerprint[rel] = "ABSENT";
      continue;
    }
    const bytes = fs.readFileSync(file);
    fingerprint[rel] = `${bytes.length}:${createHash("sha256").update(bytes).digest("hex")}`;
  }
  return fingerprint;
}

// "Rerun a parseable plugin census and block if a bee plugin appeared": these
// rows install nothing, and the default suite's marketplace rows run under an
// isolated CODEX_HOME. If a bee plugin has nevertheless landed in the REAL
// Codex home, the isolation claim is false and the run must say so.
function runPluginCensusRow() {
  const detect = detectCodexCli();
  if (!detect.present) {
    return routeRow(
      "route-plugin-census",
      true,
      `SKIP: codex CLI not found on PATH (${detect.reason}) — plugin census cannot run here`,
      { skip: true },
    );
  }
  const listed = spawnSync("codex", ["plugin", "list", "--json"], {
    encoding: "utf8",
    timeout: 30000,
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  let json = null;
  try {
    json = JSON.parse((listed.stdout || "").trim());
  } catch {
    json = null;
  }
  if (listed.error || listed.status !== 0 || !json || typeof json !== "object") {
    return routeRow(
      "route-plugin-census",
      false,
      "plugin census is not parseable: " +
        `status=${listed.status} stdout=${truncate(listed.stdout, 300)} stderr=${truncate(listed.stderr, 300)}`,
      listed,
    );
  }
  const entries = Object.values(json)
    .filter(Array.isArray)
    .flat()
    .filter((p) => p && typeof p === "object");
  const bee = entries.find(
    (p) => p.name === "bee" || (typeof p.pluginId === "string" && p.pluginId.startsWith("bee@")),
  );
  return routeRow(
    "route-plugin-census",
    !bee,
    bee
      ? `A BEE PLUGIN APPEARED in the real Codex home (${bee.pluginId || bee.name}) — these rows install nothing; isolation is broken`
      : `plugin census parses (${entries.length} entr(y|ies)) and carries no bee plugin — nothing was installed into the real Codex home`,
    listed,
  );
}

// The REQUIRED-ROW MANIFEST for the route group, computed from the CONFIG —
// deliberately NOT from the rows that were actually produced. If the manifest
// were assembled as a side effect of building rows, then deleting a whole arm
// (say, the git-absent one) would delete its own requirement along with it and
// the suite would go green on less work. Derived this way, every command in
// .codex/hooks.json owes four arm rows and every Stop command owes a handler
// row: drop one and the run reports REQUIRED ROW ABSENT and exits non-zero.
function routeRequiredRowIds(commands, { configRef = null } = {}) {
  const ids = [
    "route-config-readable",
    "route-config-nine-commands",
    "route-gitabsent-shim-precondition",
    "route-nongit-cwd-precondition",
    "route-pretooluse-command-present",
    "route-pretooluse-applypatch-deny",
    "route-live-state-untouched",
  ];
  if (configRef) ids.push("route-config-ref-differs-from-worktree");
  for (const cmd of commands) {
    ids.push(
      `route-root:${cmd.id}`,
      `route-nested:${cmd.id}`,
      `route-nongit:${cmd.id}`,
      `route-gitabsent:${cmd.id}`,
    );
  }
  for (const cmd of commands.filter((c) => c.event === "Stop")) {
    ids.push(`route-stop-handler:${cmd.script}`);
  }
  return ids;
}

// Returns { rows, requiredIds }.
function runRepoRouteRows({ configRef = null } = {}) {
  const rows = [];

  let config;
  try {
    config = readRepoHooksConfig(configRef);
  } catch (error) {
    rows.push(routeRow("route-config-readable", false, String(error.message)));
    return { rows, requiredIds: routeRequiredRowIds([], { configRef }) };
  }
  rows.push(
    routeRow(
      "route-config-readable",
      true,
      `configured Codex commands read from ${config.origin} (${CODEX_REPO_HOOKS_REPO_RELPATH})`,
    ),
  );

  // RED-sensitivity guard (validation blocker 6b-C2): a --config-ref run only
  // MEANS anything if that ref's config actually differs from the active one.
  // If they are byte-identical, the "RED" would be fabricated — fail loudly
  // instead of reporting a red/green split that does not exist.
  if (configRef) {
    const worktree = fs.readFileSync(CODEX_REPO_HOOKS_PATH, "utf8");
    const differs = worktree !== config.text;
    rows.push(
      routeRow(
        "route-config-ref-differs-from-worktree",
        differs,
        differs
          ? `sensitivity ref "${configRef}" carries a DIFFERENT .codex/hooks.json than the worktree — a RED here is a real RED`
          : `sensitivity ref "${configRef}" is BYTE-IDENTICAL to the worktree .codex/hooks.json — no red/green split exists at this ref; any "RED" reported from it would be fabricated`,
      ),
    );
  }

  const commands = parseConfiguredCommands(config.text);
  const requiredIds = routeRequiredRowIds(commands, { configRef });
  rows.push(
    routeRow(
      "route-config-nine-commands",
      commands.length === 9,
      commands.length === 9
        ? `all 9 configured commands loaded from ${config.origin} and exercised through ${ROUTE_SHELL} -lc`
        : `expected 9 configured commands, found ${commands.length} (${commands.map((c) => c.id).join(", ")})`,
    ),
  );

  const before = liveStateFingerprint();
  const fixture = buildRouteFixture();

  try {
    // -- precondition: the shim really removes git, and keeps node ------------
    const shimEnv = routeEnv(fixture, { noGit: true });
    const gitProbe = runRouteCommand("command -v git", fixture.nested, "", shimEnv);
    const nodeProbe = runRouteCommand("command -v node", fixture.nested, "", shimEnv);
    const shimOk = !(gitProbe.stdout || "").trim() && Boolean((nodeProbe.stdout || "").trim());
    rows.push(
      routeRow(
        "route-gitabsent-shim-precondition",
        shimOk,
        shimOk
          ? `PATH shim ${fixture.shim} resolves node but NOT git — the git-absent rows below are real`
          : `git-absent shim is not honest: command -v git => "${truncate(gitProbe.stdout, 120)}", ` +
              `command -v node => "${truncate(nodeProbe.stdout, 120)}" (a naive PATH shim that still exposes git would make every git-absent row a false PASS)`,
        gitProbe,
      ),
    );

    // -- precondition: the non-git cwd is really outside any git repo ---------
    const nonGitProbe = spawnSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: fixture.nonGit,
      encoding: "utf8",
      timeout: SPAWN_TIMEOUT_MS,
    });
    const nonGitOk = nonGitProbe.status !== 0 && !(nonGitProbe.stdout || "").trim();
    rows.push(
      routeRow(
        "route-nongit-cwd-precondition",
        nonGitOk,
        nonGitOk
          ? `${fixture.nonGit} is inside no git repository — the non-git rows below are real`
          : `the "non-git" cwd resolves a git root (${truncate(nonGitProbe.stdout, 200)}) — the non-git rows would be false PASSes`,
        nonGitProbe,
      ),
    );

    const env = routeEnv(fixture);

    for (const cmd of commands) {
      // -- arm 1: repo ROOT cwd ------------------------------------------------
      const atRoot = runRouteCommand(
        cmd.command,
        fixture.root,
        routePayload(cmd.event, fixture.root, fixture.root),
        env,
      );
      const rootVerdict = routeExpectation(cmd.event)(atRoot);
      rows.push(
        routeRow(
          `route-root:${cmd.id}`,
          rootVerdict.pass,
          `[cwd=fixture root] ${rootVerdict.note}`,
          atRoot,
        ),
      );

      // -- arm 2: NESTED cwd (git-root resolution genuinely exercised) ---------
      const atNested = runRouteCommand(
        cmd.command,
        fixture.nested,
        routePayload(cmd.event, fixture.nested, fixture.root),
        env,
      );
      const nestedVerdict = routeExpectation(cmd.event)(atNested);
      rows.push(
        routeRow(
          `route-nested:${cmd.id}`,
          nestedVerdict.pass,
          `[cwd=nested, spaces+Unicode path] ${nestedVerdict.note}`,
          atNested,
        ),
      );

      // -- arm 3: NON-GIT cwd -> visible fail-open ------------------------------
      const atNonGit = runRouteCommand(
        cmd.command,
        fixture.nonGit,
        routePayload(cmd.event, fixture.nonGit, fixture.root),
        env,
      );
      const nonGitVerdict = expectTransportFailOpen(atNonGit);
      rows.push(
        routeRow(
          `route-nongit:${cmd.id}`,
          nonGitVerdict.pass,
          `[cwd=non-git dir] ${nonGitVerdict.note}`,
          atNonGit,
        ),
      );

      // -- arm 4: git ABSENT FROM PATH -> visible fail-open ---------------------
      //
      // THE row this cell exists for (validation blocker F2(b)): with `git`
      // off the PATH, `$(git rev-parse --show-toplevel)` collapses to the empty
      // string. That is precisely the condition that produced the original
      // MODULE_NOT_FOUND. Under the repaired transport it must fail open
      // VISIBLY; under the pre-fix transport it crashes.
      const atGitAbsent = runRouteCommand(
        cmd.command,
        fixture.nested,
        routePayload(cmd.event, fixture.nested, fixture.root),
        shimEnv,
      );
      const gitAbsentVerdict = expectTransportFailOpen(atGitAbsent);
      rows.push(
        routeRow(
          `route-gitabsent:${cmd.id}`,
          gitAbsentVerdict.pass,
          `[git shimmed OFF the PATH — the exact MODULE_NOT_FOUND branch] ${gitAbsentVerdict.note}`,
          atGitAbsent,
        ),
      );
    }

    // -- the two configured Stop handlers, asserted individually ---------------
    //
    // Both must exit 0. bee-session-close is the handler with an output path:
    // the fixture (mid-phase, no HANDOFF) FORCES its "hive door open" advisory,
    // so its stdout must be NON-EMPTY and must parse as a JSON systemMessage
    // with no decision:"block". bee-state-sync has no stdout path at all (it is
    // silent by contract, cell codex-parity-3) — silence there is proved to be
    // REAL WORK rather than a dead command by requiring that the route run
    // actually mutated the FIXTURE's .bee/state.json.
    const stopCommands = commands.filter((c) => c.event === "Stop");
    for (const cmd of stopCommands) {
      const fixtureState = path.join(fixture.root, ".bee", "state.json");
      const stateBefore = fs.readFileSync(fixtureState, "utf8");
      const result = runRouteCommand(
        cmd.command,
        fixture.nested,
        routePayload("Stop", fixture.nested, fixture.root),
        env,
      );
      const parsed = parseAdvisoryStdout(result.stdout);
      const exitOk = result.status === 0;
      const notBlocking = !parsed.json || parsed.json.decision !== "block";

      if (cmd.script === "state-sync") {
        const stateAfter = fs.readFileSync(fixtureState, "utf8");
        let mutated = false;
        try {
          mutated = Boolean(JSON.parse(stateAfter).last_activity) && stateAfter !== stateBefore;
        } catch {
          mutated = false;
        }
        const pass = exitOk && parsed.empty && mutated;
        rows.push(
          routeRow(
            `route-stop-handler:${cmd.script}`,
            pass,
            pass
              ? "Stop handler bee-state-sync ran through the installed command route: exit 0, silent by contract, " +
                  "and it actually refreshed the FIXTURE .bee/state.json (last_activity) — the silence is real work, not a dead command"
              : `Stop handler bee-state-sync: expected exit 0 + empty stdout + a mutated fixture .bee/state.json; ` +
                  `got status=${result.status} stdout=${truncate(result.stdout, 200)} stateMutated=${mutated} stderr=${truncate(result.stderr, 300)}`,
            result,
          ),
        );
        continue;
      }

      const hasSystemMessage =
        Boolean(parsed.json) &&
        typeof parsed.json === "object" &&
        !Array.isArray(parsed.json) &&
        typeof parsed.json.systemMessage === "string" &&
        parsed.json.systemMessage.trim().length > 0;
      const pass = exitOk && !parsed.empty && hasSystemMessage && notBlocking;
      rows.push(
        routeRow(
          `route-stop-handler:${cmd.script}`,
          pass,
          pass
            ? `Stop handler bee-${cmd.script} ran through the installed command route: exit 0, NON-EMPTY stdout parsing as ` +
                'a JSON systemMessage, no decision:"block"'
            : `Stop handler bee-${cmd.script}: expected exit 0 + non-empty stdout parsing as a JSON systemMessage with no ` +
                `decision:"block"; got status=${result.status} stdout=${truncate(result.stdout, 300)} stderr=${truncate(result.stderr, 300)}`,
          result,
        ),
      );
    }

    // -- the CONFIGURED PreToolUse command denies the gated apply_patch --------
    //
    // Not a direct wrapper call: the command string out of .codex/hooks.json,
    // through the login shell, must itself come back exit 2 with a reason.
    const preToolUse = commands.filter((c) => c.event === "PreToolUse");
    rows.push(
      routeRow(
        "route-pretooluse-command-present",
        preToolUse.length === 1,
        preToolUse.length === 1
          ? "exactly one configured PreToolUse command to exercise"
          : `expected exactly 1 configured PreToolUse command, found ${preToolUse.length}`,
      ),
    );
    for (const cmd of preToolUse) {
      const denied = runRouteCommand(
        cmd.command,
        fixture.nested,
        routeApplyPatchPayload(fixture.nested, fixture.root),
        env,
      );
      const verdict = expectApplyPatchDenied(denied);
      rows.push(
        routeRow(
          "route-pretooluse-applypatch-deny",
          verdict.pass,
          `[configured PreToolUse command, not a direct wrapper call] ${verdict.note}`,
          denied,
        ),
      );
    }

    // -- the live repository was not touched -----------------------------------
    const after = liveStateFingerprint();
    const drifted = Object.keys(before).filter((k) => before[k] !== after[k]);
    rows.push(
      routeRow(
        "route-live-state-untouched",
        drifted.length === 0,
        drifted.length === 0
          ? "live .bee/state.json hash and the presence/bytes of .bee/.inject-cache.json and .bee/logs/hooks.jsonl are " +
              "IDENTICAL before and after — these rows drove real state-mutating hooks entirely inside the fixture"
          : `LIVE STATE MUTATED by the route rows: ${drifted
              .map((k) => `${k} (${before[k]} -> ${after[k]})`)
              .join(", ")}`,
      ),
    );

    rows.push(runPluginCensusRow());

    return { rows, requiredIds };
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
    fs.rmSync(fixture.nonGit, { recursive: true, force: true });
  }
}

// --- main ----------------------------------------------------------------

// STRICT argv (cell codex-parity-6a). Previously ANY unrecognized flag was
// silently ignored and the runner fell through to the default suite, printed
// ALL PASS, and exited 0 — so a verify command naming a mode that was never
// implemented passed GREEN against a broken tree. An unknown flag is now a
// hard, non-zero error that names the modes it does know.
const KNOWN_FLAGS = Object.freeze(["--baseline", "--catalog-only", "--repo-route-only"]);
const CONFIG_REF_PREFIX = "--config-ref=";

function parseArgv(argv) {
  const unknown = argv.filter(
    (a) => !KNOWN_FLAGS.includes(a) && !(a.startsWith(CONFIG_REF_PREFIX) && a.length > CONFIG_REF_PREFIX.length),
  );
  if (unknown.length > 0) {
    return { ok: false, unknown };
  }
  const refArg = argv.find((a) => a.startsWith(CONFIG_REF_PREFIX));
  return {
    ok: true,
    baselineMode: argv.includes("--baseline"),
    catalogOnlyMode: argv.includes("--catalog-only"),
    repoRouteOnlyMode: argv.includes("--repo-route-only"),
    configRef: refArg ? refArg.slice(CONFIG_REF_PREFIX.length) : null,
  };
}

function reportRows(results, headline) {
  const failures = results.filter((r) => !r.pass);
  const skipped = results.filter((r) => r.skip);
  for (const r of results) {
    const mark = r.skip ? "SKIP" : r.pass ? "ok  " : "FAIL";
    process.stdout.write(`${mark} - ${r.wrapper} :: ${r.id} :: ${r.note}\n`);
  }
  process.stdout.write(
    `\n${headline}: ${results.length} rows (${skipped.length} skipped), ${failures.length} failing target contract\n`,
  );
  process.stdout.write(`\n${failures.length === 0 ? "ALL PASS" : `${failures.length} FAILURE(S)`}\n`);
  return failures.length;
}

async function main() {
  const parsed = parseArgv(process.argv.slice(2));
  if (!parsed.ok) {
    process.stderr.write(
      `test_hook_contracts: unknown flag(s): ${parsed.unknown.join(", ")}\n` +
        `known modes: ${KNOWN_FLAGS.join(", ")} (or no flag for the full default suite)\n`,
    );
    process.exitCode = 2;
    return;
  }
  const { baselineMode, catalogOnlyMode, repoRouteOnlyMode, configRef } = parsed;

  // Modes are mutually exclusive, and --config-ref is BOUNDED: it is a
  // sensitivity probe for the installed-route rows only. It can never be used
  // to make the default suite (or --catalog-only) grade itself against some
  // other commit's config.
  if ([baselineMode, catalogOnlyMode, repoRouteOnlyMode].filter(Boolean).length > 1) {
    process.stderr.write(
      "test_hook_contracts: --baseline, --catalog-only and --repo-route-only are mutually exclusive\n",
    );
    process.exitCode = 2;
    return;
  }
  if (configRef && !repoRouteOnlyMode) {
    process.stderr.write(
      `test_hook_contracts: ${CONFIG_REF_PREFIX}<ref> is only valid with --repo-route-only ` +
        "(it is a RED-sensitivity probe for the installed-route rows, not a way to grade any other suite " +
        "against a different commit's config)\n",
    );
    process.exitCode = 2;
    return;
  }

  // --repo-route-only (cell codex-parity-6b): run ONLY the installed-route
  // rows — every command in the ACTIVE .codex/hooks.json, executed the way
  // Codex executes it. Every row here is REQUIRED (ids derived from the config
  // itself): an absent or skipped one exits non-zero, so this mode cannot pass
  // by not doing the work.
  if (repoRouteOnlyMode) {
    const { rows, requiredIds } = runRepoRouteRows({ configRef });
    const results = [...rows];
    results.push(...enforceRequiredRows(results, requiredIds, "repo-route"));
    const failures = reportRows(
      results,
      `--repo-route-only${configRef ? ` (config-ref ${configRef})` : ""}`,
    );
    process.exitCode = failures === 0 ? 0 : 1;
    return;
  }

  // --catalog-only (cell codex-parity-2 verify mode; extended by cell
  // codex-parity-6a with the repo-target rows): run ONLY the catalog-drift +
  // codex-acceptance row groups. The bare default mode below keeps gating the
  // FULL seven-wrapper table (that table's green state is cell
  // codex-parity-3's exit target), and --baseline keeps cell codex-parity-1's
  // characterization contract untouched.
  if (catalogOnlyMode) {
    const results = [...runCatalogDriftChecks(), ...runCodexAcceptanceRows()];
    results.push(...enforceRequiredRows(results, REQUIRED_CATALOG_ROW_IDS));
    const failures = results.filter((r) => !r.pass);
    const skipped = results.filter((r) => r.skip);
    for (const r of results) {
      const mark = r.skip ? "SKIP" : r.pass ? "ok  " : "FAIL";
      process.stdout.write(`${mark} - ${r.wrapper} :: ${r.id} :: ${r.note}\n`);
    }
    process.stdout.write(
      `\n--catalog-only: ${results.length} rows (${skipped.length} skipped), ${failures.length} failing target contract\n`,
    );
    process.stdout.write(
      `\n${failures.length === 0 ? "ALL PASS" : `${failures.length} FAILURE(S)`}\n`,
    );
    process.exitCode = failures.length === 0 ? 0 : 1;
    return;
  }

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

  if (baselineMode) {
    // cell codex-parity-1's contract, byte-for-byte unchanged: baseline mode
    // only ever characterizes the seven-wrapper fixture table.
    const failures = results.filter((r) => !r.pass);

    for (const r of results) {
      const mark = r.pass ? "ok  " : "FAIL";
      process.stdout.write(`${mark} - ${r.wrapper} :: ${r.id} :: ${r.note}\n`);
    }
    process.stdout.write(
      `\n${results.length} rows across ${WRAPPERS.length} wrappers, ${failures.length} failing target contract\n`,
    );

    writeBaselineReport(results, failures);
    process.stdout.write(
      `\nred-baseline.md written (${REPORT_PATH}) with ${failures.length} RED finding(s).\n`,
    );
    process.stdout.write("BASELINE CAPTURE COMPLETE\n");
    process.exitCode = 0;
    return;
  }

  // Default (non-baseline) mode is the cell's verify contract: the
  // seven-wrapper table must be GREEN, plus cell codex-parity-2's catalog
  // drift-check, allowed-differences, and isolated-CODEX_HOME
  // codex-acceptance rows, plus cell codex-parity-3's adapter contract rows
  // (registered-worker nickname matching and visible coverage-gap logging).
  results.push(...runCatalogDriftChecks());
  results.push(...runCodexAcceptanceRows());
  results.push(...runNicknameRows());
  results.push(...runCoverageGapRows());
  // ...plus cell codex-parity-6b's installed-route rows: the default suite
  // must also prove the ACTIVE .codex/hooks.json commands work through the
  // real Codex route, so deleting the route group cannot hide behind
  // "--repo-route-only was green last week".
  const route = runRepoRouteRows({ configRef: null });
  results.push(...route.rows);
  // The required-row manifests bind in the default suite too, not only in the
  // dedicated modes: an absent or skipped required row fails EVERY path.
  results.push(...enforceRequiredRows(results, REQUIRED_CATALOG_ROW_IDS));
  results.push(...enforceRequiredRows(results, route.requiredIds, "repo-route"));

  const failures = results.filter((r) => !r.pass);
  const skipped = results.filter((r) => r.skip);

  for (const r of results) {
    const mark = r.skip ? "SKIP" : r.pass ? "ok  " : "FAIL";
    process.stdout.write(`${mark} - ${r.wrapper} :: ${r.id} :: ${r.note}\n`);
  }
  const groupCount = new Set(results.map((r) => r.wrapper)).size;
  process.stdout.write(
    `\n${results.length} rows across ${groupCount} check group(s) (${skipped.length} skipped), ${failures.length} failing target contract\n`,
  );

  process.stdout.write(`\n${failures.length === 0 ? "ALL PASS" : `${failures.length} FAILURE(S)`}\n`);
  process.exitCode = failures.length === 0 ? 0 : 1;
}

await main();
