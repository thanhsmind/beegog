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
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  RUNTIMES,
  renderProjection,
  renderProjectionText,
  ALLOWED_DIFFERENCES,
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

// --- main ----------------------------------------------------------------

async function main() {
  const baselineMode = process.argv.includes("--baseline");
  // --catalog-only (cell codex-parity-2 verify mode): run ONLY the
  // catalog-drift + codex-acceptance row groups — this cell's own contract.
  // The bare default mode below keeps gating the FULL seven-wrapper table
  // (that table's green state is cell codex-parity-3's exit target), and
  // --baseline keeps cell codex-parity-1's characterization contract
  // untouched.
  const catalogOnlyMode = process.argv.includes("--catalog-only");
  if (baselineMode && catalogOnlyMode) {
    process.stderr.write(
      "test_hook_contracts: --baseline and --catalog-only are mutually exclusive\n",
    );
    process.exitCode = 1;
    return;
  }

  if (catalogOnlyMode) {
    const results = [...runCatalogDriftChecks(), ...runCodexAcceptanceRows()];
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
  // codex-acceptance rows.
  results.push(...runCatalogDriftChecks());
  results.push(...runCodexAcceptanceRows());

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
