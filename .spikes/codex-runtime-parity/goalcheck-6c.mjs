#!/usr/bin/env node
// SCRATCH SPIKE (read-only against the real repo) — proves the byte-safety
// shape of cell codex-parity-6c BEFORE any real file is touched.
//
// It imports the REAL hooks/catalog.mjs unmodified (only reads exported
// symbols: RUNTIMES, TARGETS, CATALOG is NOT exported so we re-derive the
// per-event command list by calling the real renderProjection and inspecting
// its shape) and independently re-implements the PROPOSED commandFor/
// repoCommand with `event` threaded in, entirely in this scratch file. It
// then proves:
//
//   1. The proposed plugin-target rendering (event-aware commandFor, but
//      event only matters on the REPO branch) is BYTE-IDENTICAL to the real
//      renderProjectionText for both "claude" and "codex" at the (default)
//      "plugin" target — i.e. hooks/claude-hooks.json and hooks/hooks.json
//      would not change by a single byte.
//   2. The proposed repo-target rendering differs from the CURRENT
//      .codex/hooks.json in EXACTLY one place: the PreToolUse command.
//   3. Prints the exact new PreToolUse command string for review.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  RUNTIMES,
  TARGETS,
  renderProjection,
  renderProjectionText,
} from "../../hooks/catalog.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..");

// --- PROPOSED shape (mirrors the review's fix sketch) ----------------------

const REPO_TRANSPORT_UNAVAILABLE_DIAGNOSTIC = "bee: hook transport unavailable (no git root)";
const WRITE_GUARD_TRANSPORT_DENIED_DIAGNOSTIC =
  "bee write guard: cannot resolve repo root — refusing write";

function proposedRepoCommand(script, event) {
  if (event === "PreToolUse") {
    return [
      'r="$(git rev-parse --show-toplevel 2>/dev/null)"',
      `[ -n "$r" ] && [ -f "$r/hooks/${script}" ] || { echo "${WRITE_GUARD_TRANSPORT_DENIED_DIAGNOSTIC}" >&2; exit 2; }`,
      `exec node "$r"/hooks/${script} --source=repo`,
    ].join("\n");
  }
  return [
    'r="$(git rev-parse --show-toplevel 2>/dev/null)"',
    `[ -n "$r" ] || { echo "${REPO_TRANSPORT_UNAVAILABLE_DIAGNOSTIC}" >&2; exit 0; }`,
    `exec node "$r"/hooks/${script} --source=repo`,
  ].join("\n");
}

function proposedCommandFor(script, target, event) {
  if (target === TARGETS.REPO) return proposedRepoCommand(script, event);
  return `node "\${CLAUDE_PLUGIN_ROOT}/hooks/${script}"`;
}

// Re-render a projection using the REAL structural shape (event/groups/hooks
// from the real renderProjection output — we do NOT re-derive CATALOG since
// it is not exported; instead we take the real rendered object, which already
// carries {event -> groups -> hooks[].script is not present in the OUTPUT
// (only "command" is) so instead we recompute using the real renderProjection
// at "plugin" target to recover script names from the command string, which
// is exact and lossless: "node \"${CLAUDE_PLUGIN_ROOT}/hooks/X.mjs\"" always
// names the script losslessly.
function scriptFromPluginCommand(command) {
  const m = command.match(/hooks\/([a-zA-Z0-9_-]+\.mjs)"$/);
  if (!m) throw new Error(`cannot recover script name from: ${command}`);
  return m[1];
}

function reprojectWithProposedCommandFor(runtime, target) {
  const pluginShape = renderProjection(runtime, { target: TARGETS.PLUGIN });
  const out = { hooks: {} };
  for (const [event, groups] of Object.entries(pluginShape.hooks)) {
    out.hooks[event] = groups.map((g) => {
      const newGroup = {};
      if (g.matcher !== undefined) newGroup.matcher = g.matcher;
      newGroup.hooks = g.hooks.map((h) => {
        const script = scriptFromPluginCommand(h.command);
        return {
          type: "command",
          command: proposedCommandFor(script, target, event),
          statusMessage: h.statusMessage,
        };
      });
      return newGroup;
    });
  }
  return out;
}

function textOf(obj) {
  return `${JSON.stringify(obj, null, 2)}\n`;
}

let failures = 0;
function check(label, cond) {
  console.log(`${cond ? "PASS" : "FAIL"} - ${label}`);
  if (!cond) failures++;
}

// --- 1. plugin-target byte-identity (both runtimes) ------------------------

const realClaudePluginText = renderProjectionText(RUNTIMES.CLAUDE);
const realCodexPluginText = renderProjectionText(RUNTIMES.CODEX);
const proposedClaudePluginText = textOf(
  reprojectWithProposedCommandFor(RUNTIMES.CLAUDE, TARGETS.PLUGIN),
);
const proposedCodexPluginText = textOf(
  reprojectWithProposedCommandFor(RUNTIMES.CODEX, TARGETS.PLUGIN),
);

const onDiskClaudeHooks = fs.readFileSync(
  path.join(REPO_ROOT, "hooks", "claude-hooks.json"),
  "utf8",
);
const onDiskCodexHooks = fs.readFileSync(path.join(REPO_ROOT, "hooks", "hooks.json"), "utf8");

check(
  "proposed claude/plugin rendering === real renderProjectionText(claude)",
  proposedClaudePluginText === realClaudePluginText,
);
check(
  "proposed codex/plugin rendering === real renderProjectionText(codex)",
  proposedCodexPluginText === realCodexPluginText,
);
check(
  "proposed claude/plugin rendering === on-disk hooks/claude-hooks.json (byte-identical, D1)",
  proposedClaudePluginText === onDiskClaudeHooks,
);
check(
  "proposed codex/plugin rendering === on-disk hooks/hooks.json (byte-identical, D1)",
  proposedCodexPluginText === onDiskCodexHooks,
);

// --- 2. repo-target: prove EXACTLY one command differs ----------------------

const onDiskRepoHooks = fs.readFileSync(path.join(REPO_ROOT, ".codex", "hooks.json"), "utf8");
const currentRepoProjection = JSON.parse(
  renderProjectionText(RUNTIMES.CODEX, { target: TARGETS.REPO }),
);
const proposedRepoProjection = JSON.parse(
  textOf(reprojectWithProposedCommandFor(RUNTIMES.CODEX, TARGETS.REPO)),
);

check(
  "current renderProjectionText(codex,{repo}) === on-disk .codex/hooks.json (sanity baseline)",
  renderProjectionText(RUNTIMES.CODEX, { target: TARGETS.REPO }) === onDiskRepoHooks,
);

const diffs = [];
for (const [event, groups] of Object.entries(currentRepoProjection.hooks)) {
  const proposedGroups = proposedRepoProjection.hooks[event] || [];
  groups.forEach((g, gi) => {
    (g.hooks || []).forEach((h, hi) => {
      const proposedCmd = proposedGroups[gi]?.hooks[hi]?.command;
      if (proposedCmd !== h.command) {
        diffs.push({ event, groupIndex: gi, hookIndex: hi, before: h.command, after: proposedCmd });
      }
    });
  });
}

check("exactly one repo-target command string changes", diffs.length === 1);
check(
  "the one changed command is PreToolUse (write-guard)",
  diffs.length === 1 && diffs[0].event === "PreToolUse",
);

console.log("\n--- diff detail ---");
for (const d of diffs) {
  console.log(`\nevent=${d.event} group=${d.groupIndex} hook=${d.hookIndex}`);
  console.log("BEFORE:");
  console.log(d.before);
  console.log("AFTER:");
  console.log(d.after);
}

console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
process.exitCode = failures === 0 ? 0 : 1;
