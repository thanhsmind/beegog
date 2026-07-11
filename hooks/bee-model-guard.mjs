#!/usr/bin/env node
// bee-model-guard: PreToolUse (Agent|Task).
// Enforces explicit-tier transport on subagent dispatch (decision 0023, plan
// docs/history/model-tier-guard/plan.md D1/D2): every Agent/Task dispatch must
// carry either tool_input.model (a non-empty string) or a case-insensitive
// [bee-tier: <tier>] marker in tool_input.description or the first 500 chars
// of tool_input.prompt. A bare dispatch (neither) silently inherits the most
// expensive session model, so it is denied.
// Deny = exit 2 with the reason (rule + FIX line) on stderr, and a
// {hook:'model-guard',event:'deny',...} line appended to .bee/logs/hooks.jsonl.
// Everything else is fail-open: exit 0 (crashes logged to .bee/logs/hooks.jsonl).
// Deny only — this hook never auto-injects or rewrites the model param.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const HOOK_NAME = "model-guard";
const DISPATCH_TOOLS = new Set(["Agent", "Task"]);
const PROMPT_WINDOW = 500;
const TIER_MARKER_RE = /\[bee-tier:\s*(ceiling|generation|extraction|review)\]/i;

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

function hasTierMarker(toolInput) {
  const description = typeof toolInput.description === "string" ? toolInput.description : "";
  if (TIER_MARKER_RE.test(description)) {
    return true;
  }
  const prompt = typeof toolInput.prompt === "string" ? toolInput.prompt : "";
  const window = prompt.slice(0, PROMPT_WINDOW);
  return TIER_MARKER_RE.test(window);
}

async function main() {
  const payload = await readStdinPayload();
  const root = findRepoRoot(payload.cwd || process.cwd());
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

  let denial = null; // { reason, toolInput }
  try {
    const stateLib = await import(libModuleUrl(root, "state.mjs"));
    if (!stateLib.hookEnabled(root, HOOK_NAME)) {
      return 0;
    }

    // FAIL-OPEN PRECISION: an absent or non-object tool_input can never reach
    // the deny branch — silent exit 0, no stderr.
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
    denial = { reason, toolInput };
  } catch (error) {
    logCrash(root, error);
    return 0;
  }

  if (denial) {
    logDeny(root, toolName, denial.toolInput);
    // Deliberate deny: exit 2 with the reason on stderr (Claude Code feeds
    // stderr back to the model on PreToolUse exit 2).
    process.stderr.write(denial.reason);
    return 2;
  }
  return 0;
}

process.exitCode = await main();
