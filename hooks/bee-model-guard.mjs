#!/usr/bin/env node
// bee-model-guard: PreToolUse (Agent|Task) — Claude projection only
// (hooks/catalog.mjs ALLOWED_DIFFERENCES: Codex does not expose collaboration
// spawn through PreToolUse).
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
// Input/root/crash-logging go through the shared runtime adapter
// (hooks/adapter.mjs, cell codex-parity-3): stdin is normalized before any
// property access and root discovery lives inside the fail-open boundary.
// Everything else is fail-open: exit 0 (crashes logged to .bee/logs/hooks.jsonl).
// Deny only — this hook never auto-injects or rewrites the model param.

import fs from "node:fs";
import path from "node:path";
import { readHookContext, logCrash, libModuleUrl, appendHookLog } from "./adapter.mjs";

const HOOK_NAME = "model-guard";
const DISPATCH_TOOLS = new Set(["Agent", "Task"]);
// Anchored to the start of the string (leading whitespace allowed): the
// marker must be the first thing in prompt/description, never merely present
// somewhere inside it (P1-1 — no 500-char scan window, no mid-text match).
const ANCHORED_TIER_MARKER_RE = /^\s*\[bee-tier:\s*(ceiling|generation|extraction|review)\]/i;

function logDeny(root, toolName, toolInput) {
  // appendHookLog is itself fail-open: a log failure never blocks the deny.
  appendHookLog(root, {
    ts: new Date().toISOString(),
    hook: HOOK_NAME,
    event: "deny",
    tool_name: toolName,
    tool_input_keys: Object.keys(toolInput),
  });
}

function startsWithTierMarker(text) {
  if (typeof text !== "string") {
    return null;
  }
  const match = ANCHORED_TIER_MARKER_RE.exec(text);
  return match ? match[1].toLowerCase() : null;
}

function markerTier(toolInput) {
  return (
    startsWithTierMarker(toolInput.description) || startsWithTierMarker(toolInput.prompt) || null
  );
}

// Dispatch audit log (P22, feature dispatch-log): one line per evaluated
// Agent/Task dispatch — allowed or denied — so the resolved model/tier is
// auditable independent of what the UI shows. Fail-open like logDeny: a log
// failure never changes the guard's decision or exit code.
function logDispatch(root, toolName, toolInput, transport, model, tier) {
  try {
    const logsDir = path.join(root, ".bee", "logs");
    fs.mkdirSync(logsDir, { recursive: true });
    const description =
      typeof toolInput.description === "string" ? toolInput.description.slice(0, 120) : "";
    fs.appendFileSync(
      path.join(logsDir, "dispatch.jsonl"),
      `${JSON.stringify({
        ts: new Date().toISOString(),
        tool: toolName,
        transport,
        model: model || null,
        tier: tier || null,
        subagent_type: typeof toolInput.subagent_type === "string" ? toolInput.subagent_type : null,
        description,
      })}\n`,
    );
  } catch {
    // fail-open — auditing never blocks a dispatch
  }
}

async function main() {
  // FAIL-OPEN PRECISION (P1-2, now owned by hooks/adapter.mjs): the adapter
  // normalizes the payload before ANY property access — a top-level null or
  // array payload, or a non-string cwd, can never reach a `.` access or
  // path.resolve — and resolves the repo root inside its own fail-open
  // boundary.
  const ctx = await readHookContext(HOOK_NAME);
  const payload = ctx.payload;
  const root = ctx.root;
  if (!root) {
    return 0;
  }

  try {
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
      logDispatch(root, toolName, toolInput, "model-param", toolInput.model.trim(), null);
      return 0;
    }
    const tier = markerTier(toolInput);
    if (tier) {
      logDispatch(root, toolName, toolInput, "marker", null, tier);
      return 0;
    }

    const generationModel = stateLib.modelForTier(root, "generation", "claude") || "generation";
    const reason =
      "bee-model-guard: every Agent/Task dispatch needs an explicit tier — a `model` " +
      "param or a `[bee-tier: <tier>]` marker in the prompt/description (decision 0023). " +
      "A bare dispatch would silently inherit the most expensive session model.\n" +
      `FIX: pass model: "${generationModel}" for the generation tier, or add ` +
      "[bee-tier: ceiling] (or another tier: generation/extraction/review) to the prompt/description.";

    logDispatch(root, toolName, toolInput, "bare-denied", null, null);
    logDeny(root, toolName, toolInput);
    // Deliberate deny: exit 2 with the reason on stderr (Claude Code feeds
    // stderr back to the model on PreToolUse exit 2).
    process.stderr.write(reason);
    return 2;
  } catch (error) {
    logCrash(root, HOOK_NAME, error, ctx.source);
    return 0;
  }
}

process.exitCode = await main();
