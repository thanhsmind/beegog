#!/usr/bin/env node
// bee-write-guard: PreToolUse (Edit|Write|MultiEdit|Bash|Read|Glob|Grep).
// Three checks in one guard, first hit wins:
//   (a) gate guard   - no source writes before Gate 3 (execution approval)
//   (b) reservation  - during swarming, writes to unreserved paths are denied
//   (c) privacy/scout- secret-file reads emit the @@BEE_PRIVACY@@ marker;
//                      scout dirs (node_modules/, dist/, ...) are denied
// Deny = exit 2 with the reason (and marker, for privacy) on stderr.
// Everything else is fail-open: exit 0 (crashes logged to .bee/logs/hooks.jsonl).

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const HOOK_NAME = "write-guard";
const READ_TOOLS = new Set(["Read", "Glob", "Grep"]);
const WRITE_TOOLS = new Set(["Edit", "Write", "MultiEdit"]);

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

function libModuleUrl(root, name) {
  return pathToFileURL(path.join(root, ".bee", "bin", "lib", name)).href;
}

// Convert a tool-supplied path (absolute or relative) to a forward-slash
// path relative to the repo root. Returns null when the path escapes the repo.
function toRelPath(root, cwd, rawPath) {
  if (!rawPath || typeof rawPath !== "string") {
    return null;
  }
  const abs = path.isAbsolute(rawPath) ? rawPath : path.resolve(cwd || root, rawPath);
  const rel = path.relative(root, abs);
  if (!rel || rel === "." || rel.startsWith("..") || path.isAbsolute(rel)) {
    return null;
  }
  return rel.split(path.sep).join("/");
}

function getNestedString(obj, keys) {
  for (const key of keys) {
    const value = obj && typeof obj === "object" ? obj[key] : undefined;
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function inferAgentName(payload, toolInput) {
  const fromPayload = getNestedString(payload, [
    "agent_name",
    "agentName",
    "agent_nickname",
    "subagent_type",
  ]);
  if (fromPayload) {
    return fromPayload;
  }
  const command = typeof toolInput.command === "string" ? toolInput.command : "";
  const match = command.match(/\bBEE_AGENT_NAME=(["']?)([^"'\s]+)\1/);
  if (match) {
    return match[2];
  }
  return process.env.BEE_AGENT_NAME || null;
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

  let denial = null; // { reason }
  try {
    const stateLib = await import(libModuleUrl(root, "state.mjs"));
    if (!stateLib.hookEnabled(root, HOOK_NAME)) {
      return 0;
    }
    const guards = await import(libModuleUrl(root, "guards.mjs"));

    const toolName = payload.tool_name || payload.toolName || "";
    const toolInput =
      payload.tool_input && typeof payload.tool_input === "object" ? payload.tool_input : {};
    const cwd = payload.cwd || process.cwd();

    if (READ_TOOLS.has(toolName)) {
      const rel = toRelPath(root, cwd, toolInput.file_path || toolInput.path || "");
      if (rel) {
        const verdict = guards.checkRead(rel);
        if (verdict && verdict.allow === false) {
          const parts = [verdict.reason || `bee ${verdict.kind || "read"} guard denied: ${rel}`];
          if (verdict.marker) {
            parts.push(verdict.marker);
          }
          denial = { reason: parts.join("\n") };
        }
      }
    } else if (WRITE_TOOLS.has(toolName) || toolName === "Bash") {
      const state = stateLib.readState(root);
      const agentName = inferAgentName(payload, toolInput);
      let relPaths = [];

      if (toolName === "Bash") {
        const command = typeof toolInput.command === "string" ? toolInput.command : "";
        if (command) {
          const targets = guards.extractBashTargets(command);
          const paths = (targets && targets.paths) || [];
          relPaths = paths.map((p) => toRelPath(root, cwd, p)).filter(Boolean);
          if (relPaths.length === 0 && targets && targets.broadWrite) {
            relPaths = ["**"];
          }
        }
      } else {
        const rel = toRelPath(root, cwd, toolInput.file_path || "");
        if (rel) {
          relPaths = [rel];
        }
      }

      for (const rel of relPaths) {
        const verdict = guards.checkWrite(root, state, rel, agentName);
        if (verdict && verdict.allow === false) {
          denial = {
            reason:
              verdict.reason || `bee ${verdict.kind || "write"} guard denied write to: ${rel}`,
          };
          break;
        }
      }
    }
  } catch (error) {
    logCrash(root, error);
    return 0;
  }

  if (denial) {
    // Deliberate deny: exit 2 with the reason on stderr (Claude Code feeds
    // stderr back to the model on PreToolUse exit 2).
    process.stderr.write(denial.reason);
    return 2;
  }
  return 0;
}

process.exitCode = await main();
