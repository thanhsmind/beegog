#!/usr/bin/env node
// bee-session-init: SessionStart (startup|resume|clear|compact).
// Prints the bee session preamble (status, gates, HANDOFF surfacing, patterns,
// decisions) built by the target repo's own .bee/bin/lib/inject.mjs.
// Input/root/logging go through the shared runtime adapter (hooks/adapter.mjs,
// cell codex-parity-3, decision D2): stdin is normalized before any property
// access and root discovery lives inside the fail-open boundary.
// SessionStart stdout stays plain developer context on both hosts.
// Fail-open: any miss or crash -> exit 0 (crash logged to .bee/logs/hooks.jsonl).
//
// fresh-session-handoff fsh-10 (D1, D4): this is the ONLY place a
// planned-next handoff is ever adopted — buildSessionPreamble stays a PURE
// renderer (PURITY PIN, panel W2); the mutation lives here.
//   1. Register/refresh the acting session record from payload.session_id
//      (createSession-or-heartbeat via the repo's vendored claims.mjs).
//      Fail-open: a registration failure never blocks the preamble.
//   2. EVENT-SCOPE PIN (panel W1): the adopt+start-now path runs ONLY when
//      payload.source is "clear" or "startup" (the fresh-session boundaries
//      D1 names) — on "resume"/"compact" this hook NEVER calls adoptHandoff,
//      a planned-next handoff stays on disk and renders as a pending-wait
//      block. A "startup" whose handoff.writer_session equals the acting
//      session is ALSO refused without adopting: that is not a fresh-session
//      boundary, just the same session starting up again.
//   3. When the source qualifies, adoptHandoff(sessionId)'s typed outcome is
//      passed into buildSessionPreamble, never mutated further here.
import fs from "node:fs";
import path from "node:path";
import { readHookContext, logCrash, libModuleUrl } from "./adapter.mjs";

const HOOK_NAME = "session-init";
const ADOPT_SOURCES = new Set(["clear", "startup"]);

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

    const sessionId =
      typeof ctx.payload.session_id === "string" && ctx.payload.session_id.trim()
        ? ctx.payload.session_id.trim()
        : null;
    const eventSource =
      typeof ctx.payload.source === "string" && ctx.payload.source.trim()
        ? ctx.payload.source.trim()
        : "";

    if (sessionId) {
      try {
        const claims = await import(libModuleUrl(root, "claims.mjs"));
        const created = claims.createSession(root, { id: sessionId });
        if (!created.ok) {
          claims.heartbeatSession(root, sessionId);
        }
      } catch (error) {
        // fail-open: registration/heartbeat never blocks the preamble.
        logCrash(root, HOOK_NAME, error, ctx.source);
      }
    }

    let handoffOutcome = null;
    if (sessionId) {
      const handoff = state.readHandoff(root);
      if (handoff && handoff.kind === "planned-next") {
        if (!ADOPT_SOURCES.has(eventSource)) {
          handoffOutcome = {
            ok: false,
            code: "WRONG_SOURCE",
            reason: `a planned-next handoff never auto-adopts on source "${eventSource || "unknown"}" — only "clear"/"startup" qualify (D1).`,
          };
        } else if (eventSource === "startup" && handoff.writer_session === sessionId) {
          handoffOutcome = {
            ok: false,
            code: "SAME_SESSION_STARTUP",
            reason:
              "the acting session is the same session that wrote this handoff — not a fresh-session boundary, never self-adopted.",
          };
        } else {
          try {
            handoffOutcome = state.adoptHandoff(root, sessionId);
          } catch (error) {
            // fail-open: an adoption crash never blocks the preamble; render
            // as if adoption were never attempted (today's wait block).
            logCrash(root, HOOK_NAME, error, ctx.source);
            handoffOutcome = null;
          }
        }
      }
    }

    const inject = await import(libModuleUrl(root, "inject.mjs"));
    const preamble = inject.buildSessionPreamble(root, { sessionId, handoffOutcome });
    if (preamble && String(preamble).trim()) {
      process.stdout.write(String(preamble));
    }
  } catch (error) {
    logCrash(root, HOOK_NAME, error, ctx.source);
    return 0;
  }
  return 0;
}

process.exitCode = await main();
