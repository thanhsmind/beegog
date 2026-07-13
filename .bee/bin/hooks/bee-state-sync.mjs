#!/usr/bin/env node
// bee-state-sync: PostToolUse (TaskCreate|TaskUpdate|TodoWrite) + SubagentStop + Stop.
// Refreshes cell status counts and last_activity into .bee/state.json so state
// stays fresh as a side effect of working. Always silent — it never emits
// stdout, so the Codex SubagentStop/Stop JSON-output requirement is satisfied
// by silence (cell codex-parity-3, decision D2).
// Input/root/logging go through the shared runtime adapter (hooks/adapter.mjs):
// stdin is normalized before any property access and root discovery lives
// inside the fail-open boundary.
// Fail-open: any miss or crash -> exit 0 (crash logged to .bee/logs/hooks.jsonl).

import fs from "node:fs";
import path from "node:path";
import { readHookContext, logCrash, libModuleUrl } from "./adapter.mjs";

const HOOK_NAME = "state-sync";

async function main() {
  const ctx = await readHookContext(HOOK_NAME);
  const root = ctx.root;
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
    const cellsLib = await import(libModuleUrl(root, "cells.mjs"));

    const counts = { open: 0, claimed: 0, capped: 0, blocked: 0 };
    for (const cell of cellsLib.listCells(root, {})) {
      if (cell && typeof cell.status === "string" && counts[cell.status] !== undefined) {
        counts[cell.status] += 1;
      }
    }

    const state = stateLib.readState(root);
    state.cells = counts;
    state.last_activity = new Date().toISOString();
    stateLib.writeState(root, state);
  } catch (error) {
    logCrash(root, HOOK_NAME, error, ctx.source);
    return 0;
  }
  return 0;
}

process.exitCode = await main();
