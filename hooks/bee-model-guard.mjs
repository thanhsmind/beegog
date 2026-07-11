#!/usr/bin/env node
// bee-model-guard: PreToolUse (Agent|Task).
// Enforces explicit-tier transport on subagent dispatch (decision 0023, plan
// docs/history/model-tier-guard/plan.md D1/D2): every Agent/Task dispatch must
// carry either tool_input.model (a non-empty string) or a case-insensitive
// [bee-tier: <tier>] marker ANCHORED to a reserved position: the first
// non-whitespace token of tool_input.prompt, or the start of
// tool_input.description (leading whitespace allowed either way). A marker
// occurring anywhere else (embedded after other prompt text, mid-description)
// never satisfies the transport — that would let quoted plan text, user
// content, or retrieved docs forge the tier with no real decision made
// (review-findings.md P1-1). A bare dispatch (no param, no anchored marker)
// silently inherits the most expensive session model, so it is denied.
// Deny = exit 2 with the reason (rule + FIX line) on stderr, and a
// {hook:'model-guard',event:'deny',...} line appended to .bee/logs/hooks.jsonl.
// Everything else is fail-open: exit 0 (crashes logged to .bee/logs/hooks.jsonl).
// Deny only — this hook never auto-injects or rewrites the model param.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const HOOK_NAME = "model-guard";
const DISPATCH_TOOLS = new Set(["Agent", "Task"]);
// Anchored to the start of the string (leading whitespace allowed): the
// marker must be the first thing in prompt/description, never merely present
// somewhere inside it (P1-1 — no 500-char scan window, no mid-text match).
const ANCHORED_TIER_MARKER_RE = /^\s*\[bee-tier:\s*(ceiling|generation|extraction|review)\]/i;

async function readStdinPayload() {
  const chunks = [];
  try {
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
  } catch {
    return {};
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

function findRepoRoot(startDir) {
  let candidate = path.resolve(startDir || process.cwd());
  while (true) {
    if (fs.existsSync(path.join(candidate, ".bee", "onboarding.json"))) {
      return candidate;
    }
    const parent = path.dirname(candidate);
    if (parent === candidate) {
      return null;
    }
    candidate = parent;
  }
}

function logCrash(root, error) {
  try {
    const logsDir = path.join(root, ".bee", "logs");
    fs.mkdirSync(logsDir, { recursive: true });
    fs.appendFileSync(
      path.join(logsDir, "hooks.jsonl"),
      `${JSON.stringify({
        ts: new Date().toISOString(),
        hook: HOOK_NAME,
        error: String((error && error.stack) || error),
      })}\n`,
    );
  } catch {
    // fail-open
  }
}

function logDeny(root, toolName, toolInput) {
  try {
    const logsDir = path.join(root, ".bee", "logs");
    fs.mkdirSync(logsDir, { recursive: true });
    fs.appendFileSync(
      path.join(logsDir, "hooks.jsonl"),
      `${JSON.stringify({
        ts: new Date().toISOString(),
        hook: HOOK_NAME,
        event: "deny",
        tool_name: toolName,
        tool_input_keys: Object.keys(toolInput),
      })}\n`,
    );
  } catch {
    // never block the deny itself on a log failure
  }
}

function libModuleUrl(root, name) {
  return pathToFileURL(path.join(root, ".bee", "bin", "lib", name)).href;
}

function startsWithTierMarker(text) {
  return typeof text === "string" && ANCHORED_TIER_MARKER_RE.test(text);
}

function hasTierMarker(toolInput) {
  const description = typeof toolInput.description === "string" ? toolInput.description : "";
  if (startsWithTierMarker(description)) {
    return true;
  }
  const prompt = typeof toolInput.prompt === "string" ? toolInput.prompt : "";
  return startsWithTierMarker(prompt);
}

async function main() {
  // FAIL-OPEN PRECISION: normalize the parsed payload before ANY property
  // access. `JSON.parse("null")` / `JSON.parse("[]")` succeed without
  // throwing, so a null/array top-level payload must be caught here, not left
  // to crash on the first `.` access (P1-2 — the recorded red was an
  // uncaught TypeError on `payload.cwd` for `echo null | ...`).
  const rawPayload = await readStdinPayload();
  const payload =
    rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload) ? rawPayload : {};
  const cwd = typeof payload.cwd === "string" && payload.cwd.trim() ? payload.cwd : process.cwd();

  // Root resolution lives inside the try/catch below so ANY throw during
  // discovery (not just the state.mjs import) lands in logCrash + exit 0
  // (P1-2). `root` is captured in the outer scope so the catch can still log
  // against it once it has been resolved.
  let root = null;
  try {
    root = findRepoRoot(cwd);
    if (!root) {
      return 0;
    }
    if (!fs.existsSync(path.join(root, ".bee", "bin", "lib", "state.mjs"))) {
      return 0;
    }

    const toolName = payload.tool_name || payload.toolName || "";
    if (!DISPATCH_TOOLS.has(toolName)) {
      return 0;
    }

    const stateLib = await import(libModuleUrl(root, "state.mjs"));
    if (!stateLib.hookEnabled(root, HOOK_NAME)) {
      return 0;
    }

    // An absent or non-object tool_input can never reach the deny branch —
    // silent exit 0, no stderr.
    const rawToolInput = payload.tool_input;
    if (!rawToolInput || typeof rawToolInput !== "object" || Array.isArray(rawToolInput)) {
      return 0;
    }
    const toolInput = rawToolInput;

    if (typeof toolInput.model === "string" && toolInput.model.trim()) {
      return 0;
    }
    if (hasTierMarker(toolInput)) {
      return 0;
    }

    const generationModel = stateLib.modelForTier(root, "generation", "claude") || "generation";
    const reason =
      "bee-model-guard: every Agent/Task dispatch needs an explicit tier — a `model` " +
      "param or a `[bee-tier: <tier>]` marker in the prompt/description (decision 0023). " +
      "A bare dispatch would silently inherit the most expensive session model.\n" +
      `FIX: pass model: "${generationModel}" for the generation tier, or add ` +
      "[bee-tier: ceiling] (or another tier: generation/extraction/review) to the prompt/description.";

    logDeny(root, toolName, toolInput);
    // Deliberate deny: exit 2 with the reason on stderr (Claude Code feeds
    // stderr back to the model on PreToolUse exit 2).
    process.stderr.write(reason);
    return 2;
  } catch (error) {
    if (root) {
      logCrash(root, error);
    }
    return 0;
  }
}

process.exitCode = await main();
