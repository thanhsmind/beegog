#!/usr/bin/env node
// bee-session-close: Stop.
// The "hive door open" check: if the session ends mid-phase with no
// .bee/HANDOFF.json, print a warning listing claimed-but-uncapped cells and
// active reservations. Never blocks; always exits 0.
// Fail-open: any miss or crash -> exit 0 (crash logged to .bee/logs/hooks.jsonl).

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const HOOK_NAME = "session-close";

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
    if (phase === "idle" || phase === "compounding-complete") {
      return 0;
    }
    if (stateLib.readHandoff(root)) {
      return 0;
    }

    const cellsLib = await import(libModuleUrl(root, "cells.mjs"));
    const reservationsLib = await import(libModuleUrl(root, "reservations.mjs"));
    const claimed = cellsLib.listCells(root, { status: "claimed" });
    const active = reservationsLib.listReservations(root, { activeOnly: true });

    const lines = [
      `bee session-close warning: session is ending mid-phase (phase: ${phase}) ` +
        "with no .bee/HANDOFF.json. You are about to leave the hive door open.",
    ];
    if (claimed.length > 0) {
      lines.push(
        `Claimed-but-uncapped cells: ${claimed
          .map((cell) => `${cell.id}${cell.trace && cell.trace.worker ? ` (${cell.trace.worker})` : ""}`)
          .join(", ")}.`,
      );
    }
    if (active.length > 0) {
      lines.push(
        `Active reservations: ${active
          .map((r) => `${r.agent} -> ${r.path}${r.cell ? ` (cell ${r.cell})` : ""}`)
          .join("; ")}.`,
      );
    }
    lines.push(
      "Either finish and cap the work, or write .bee/HANDOFF.json and release " +
        "reservations so the next session can resume cleanly.",
    );
    process.stdout.write(lines.join("\n"));
  } catch (error) {
    logCrash(root, error);
    return 0;
  }
  return 0;
}

process.exitCode = await main();
