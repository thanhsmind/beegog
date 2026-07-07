#!/usr/bin/env node
// bee-chain-nudge: SubagentStop.
// Advances the bee chain mechanically: when a registered bee worker stops (or
// the phase is swarming) it nudges the orchestrator to collect the [STATUS],
// update the cell, and check reservations; when the phase is reviewing it
// nudges reviewer synthesis. Otherwise silent.
// Fail-open: any miss or crash -> exit 0 (crash logged to .bee/logs/hooks.jsonl).

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const HOOK_NAME = "chain-nudge";

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

function getAgentName(payload) {
  const candidates = [
    payload.agent_name,
    payload.agentName,
    payload.agent_nickname,
    payload.subagent_type,
    payload.agent_type,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function workerName(entry) {
  if (typeof entry === "string") {
    return entry;
  }
  if (entry && typeof entry === "object") {
    return entry.name || entry.agent || entry.worker || "";
  }
  return "";
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

  try {
    const stateLib = await import(libModuleUrl(root, "state.mjs"));
    if (!stateLib.hookEnabled(root, HOOK_NAME)) {
      return 0;
    }
    const state = stateLib.readState(root);
    const phase = state.phase || "idle";
    const agentName = getAgentName(payload);
    const workers = Array.isArray(state.workers) ? state.workers : [];
    const isRegisteredWorker =
      agentName !== "" && workers.some((entry) => workerName(entry) === agentName);

    if (phase === "reviewing") {
      process.stdout.write(
        "bee chain-nudge: a review agent finished. Collect its findings report, " +
          "score severities independently (P1/P2/P3), and when all reviewers are done " +
          "synthesize findings (corroboration promotes one level; disagreements go " +
          "conservative), then present Gate 4.",
      );
    } else if (isRegisteredWorker || phase === "swarming") {
      const who = agentName ? `Worker "${agentName}"` : "A bee worker";
      process.stdout.write(
        `bee chain-nudge: ${who} returned - collect its [STATUS] token ` +
          "([DONE]/[BLOCKED]/[HANDOFF]/[NOOP]), update the cell " +
          "(node .bee/bin/bee_cells.mjs), and check/release its reservations " +
          "(node .bee/bin/bee_reservations.mjs list --active-only). " +
          "When the wave is clean, move to the next wave or the next chain step.",
      );
    }
    // else: not a bee-managed subagent -> silent.
  } catch (error) {
    logCrash(root, error);
    return 0;
  }
  return 0;
}

process.exitCode = await main();
