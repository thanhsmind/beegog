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

          // hardening-1-7-10 (D3) — also refresh this session's CROSS-WORKTREE
          // ledger holds (worktree-holds.mjs's renewHolds), same try-once/
          // never-block posture as the local renewal above: a missed
          // renewal is skipped, never waited on, never escalated past this
          // hook's own fail-open try/catch. The ledger always lives in the
          // MAIN checkout's store (never this checkout's own `.bee/`), so
          // mainRoot is resolved the same way bee.mjs's private
          // resolveMainRoot does — ordinary checkout: mainRoot is `root`
          // itself; linked worktree (granted or not): resolveRoots' own
          // `mainRoot` field, independent of THIS checkout's own grant
          // state. Duplicated here rather than imported from bee.mjs
          // because bee.mjs is the CLI entry point, not a lib module a hook
          // imports.
          try {
            let mainRoot = root;
            const resolution = stateLib.resolveRoots(process.cwd());
            if (resolution.worktreeResolution === "linked-valid" && resolution.mainRoot) {
              mainRoot = resolution.mainRoot;
            }
            const holdsLib = await import(libModuleUrl(root, "worktree-holds.mjs"));
            await holdsLib.renewHolds(mainRoot, sessionId, { maxAttempts: 1 });
          } catch (error) {
            logCrash(root, HOOK_NAME, error, ctx.source);
          }
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
