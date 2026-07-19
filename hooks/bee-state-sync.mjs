#!/usr/bin/env node
// bee-state-sync: PostToolUse (update_plan|TaskCreate|TaskUpdate|TodoWrite) + SubagentStop + Stop.
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

    // D5 — throttled heartbeat + claim/hold lease renewal, same contract as
    // bee-prompt-context.mjs: session id off the hook payload, own try/catch
    // so a throw here never blocks this hook's primary job (the state
    // counts/last_activity refresh below).
    const sessionId =
      typeof ctx.payload.session_id === "string" && ctx.payload.session_id.trim()
        ? ctx.payload.session_id.trim()
        : null;
    if (sessionId) {
      try {
        const claims = await import(libModuleUrl(root, "claims.mjs"));
        const touch = await claims.heartbeatTouch(root, sessionId);
        if (touch && touch.touched) {
          const reservations = await import(libModuleUrl(root, "reservations.mjs"));
          await reservations.renewHoldsBySession(root, sessionId, { lockOptions: { maxAttempts: 1 } });
        }
      } catch (error) {
        logCrash(root, HOOK_NAME, error, ctx.source);
      }
    }

    const cellsLib = await import(libModuleUrl(root, "cells.mjs"));

    const counts = { open: 0, claimed: 0, capped: 0, blocked: 0 };
    for (const cell of cellsLib.listCells(root, {})) {
      if (cell && typeof cell.status === "string" && counts[cell.status] !== undefined) {
        counts[cell.status] += 1;
      }
    }

    // D3-amended: this hook's own state read-modify-write is a store write
    // too — an unlocked hook write racing a locked CLI write would reintroduce
    // the exact lost-update D2 exists to kill. Same try-once/skip-on-busy
    // contract as the touch above: LOCK_BUSY skips this sync silently
    // (fail-open preserved), never waited on, never escalated to a crash log.
    const lockLib = await import(libModuleUrl(root, "lock.mjs"));
    try {
      await lockLib.withStoreLock(
        root,
        "state",
        () => {
          const state = stateLib.readState(root);
          state.cells = counts;
          state.last_activity = new Date().toISOString();
          stateLib.writeState(root, state);
        },
        { maxAttempts: 1 },
      );
    } catch (error) {
      if (!(error instanceof lockLib.LockBusyError)) throw error;
    }
  } catch (error) {
    logCrash(root, HOOK_NAME, error, ctx.source);
    return 0;
  }
  return 0;
}

process.exitCode = await main();
