#!/usr/bin/env node
// bee-prompt-context: UserPromptSubmit.
// Injects a 1-3 line phase/mode/next-action/gate reminder, deduped via the
// injection cache (only when state changed or >30 min since last injection).
// Input/root/logging go through the shared runtime adapter (hooks/adapter.mjs,
// cell codex-parity-3, decision D2): stdin is normalized before any property
// access and root discovery lives inside the fail-open boundary.
// UserPromptSubmit stdout stays plain developer context on both hosts.
// Fail-open: any miss or crash -> exit 0 (crash logged to .bee/logs/hooks.jsonl).

import fs from "node:fs";
import path from "node:path";
import { readHookContext, logCrash, libModuleUrl } from "./adapter.mjs";

const HOOK_NAME = "prompt-context";

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
    const state = await import(libModuleUrl(root, "state.mjs"));
    if (!state.hookEnabled(root, HOOK_NAME)) {
      return 0;
    }

    // D5 — throttled heartbeat + claim/hold lease renewal. Session id comes
    // straight off the hook payload (bee-session-init.mjs:49-51 pattern),
    // never handed down. Wrapped in its OWN try/catch, separate from the
    // reminder logic below: a throw here must never block the hook's
    // primary job (printing the reminder) — the outer catch alone would
    // abort that too if this ran unguarded inside it.
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

    const inject = await import(libModuleUrl(root, "inject.mjs"));
    // P0 (codex-loop-p0): pass the resolved sessionId so a session bound to a
    // feature lane sees ITS OWN phase/gate/next-action, not the default state's.
    // buildPromptReminder already threads {sessionId} through resolvePipeline;
    // dropping it here made every bound session read the default record (usually
    // idle), which pulled it back toward hive — a top driver of the looping.
    const reminder = inject.buildPromptReminder(root, { sessionId });
    if (!reminder || !reminder.text || !String(reminder.text).trim()) {
      return 0;
    }
    // codex-loop (advisor #54): the dedup key was the repo-global string
    // "prompt", so two sessions working the same checkout each invalidated the
    // other's last-injected hash — turning the 30-minute throttle into a
    // reminder on nearly every turn. Key it by the acting session (falling back
    // to the global key only when no session id is available, which preserves
    // today's single-session behaviour exactly).
    const injectKey = sessionId ? `prompt:${sessionId}` : "prompt";
    if (inject.shouldInject(root, injectKey, reminder.hash)) {
      process.stdout.write(String(reminder.text));
      inject.markInjected(root, injectKey, reminder.hash);
    }
  } catch (error) {
    logCrash(root, HOOK_NAME, error, ctx.source);
    return 0;
  }
  return 0;
}

process.exitCode = await main();
