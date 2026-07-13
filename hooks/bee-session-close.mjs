#!/usr/bin/env node
// bee-session-close: Stop + PreCompact.
// The "hive door open" check: if the session ends mid-phase with no
// .bee/HANDOFF.json, warn with claimed-but-uncapped cells and active
// reservations, plus the decision/capture/capture-queue nudges. Never blocks;
// always exits 0.
// Input/root/logging go through the shared runtime adapter (hooks/adapter.mjs,
// cell codex-parity-3, decision D2). Stop and PreCompact are advisory events:
// all messages for one invocation are collected and emitted as ONE parseable
// JSON systemMessage (Codex ignores plain PreCompact stdout and requires JSON
// for non-empty Stop stdout; multiple raw writes would not parse). Never
// decision:"block" — that would loop the main turn instead of advising.
// Fail-open: any miss or crash -> exit 0 (crash logged to .bee/logs/hooks.jsonl).

import fs from "node:fs";
import path from "node:path";
import { readHookContext, logCrash, libModuleUrl, emitHookOutput } from "./adapter.mjs";

const HOOK_NAME = "session-close";

// Repository-harness lesson: review the session for an unrecorded decision
// before it ends. When source files changed with no bee flow active and no
// recent decision logged, nudge once (deduped) — never block.
const NUDGE_ALLOWED = /^(\.bee\/|docs\/|plans\/|AGENTS\.md$)/;
const DECISION_RECENT_MS = 6 * 3600 * 1000;

// fresh-session-handoff fsh-6 (D4): a bound session's PHASE comes from its
// lane via resolvePipeline; no session_id, an unbound session, or an
// unresolvable binding all fall back to the default record — this hook is
// advisory only and must never let a lane-resolution gap block the "hive
// door open" warning (fail-open, matching the file's own documented
// discipline).
function getSessionId(payload) {
  return typeof payload.session_id === "string" && payload.session_id.trim()
    ? payload.session_id.trim()
    : null;
}

async function maybeDecisionNudge(root) {
  try {
    const { execSync } = await import("node:child_process");
    const out = execSync("git status --porcelain", {
      cwd: root,
      timeout: 3000,
      stdio: ["ignore", "pipe", "ignore"],
    }).toString();
    const changed = out
      .split("\n")
      .map((line) => line.slice(3).trim().replace(/^"|"$/g, ""))
      .filter(Boolean)
      .filter((p) => !NUDGE_ALLOWED.test(p));
    if (changed.length === 0) {
      return null;
    }
    const decisionsLib = await import(libModuleUrl(root, "decisions.mjs"));
    const injectLib = await import(libModuleUrl(root, "inject.mjs"));
    const recent = decisionsLib.activeDecisions(root, { recent: 1 });
    const lastTs = recent[0] && recent[0].date ? Date.parse(recent[0].date) : 0;
    if (lastTs && Date.now() - lastTs < DECISION_RECENT_MS) {
      return null;
    }
    const hash = changed.sort().join("|");
    if (!injectLib.shouldInject(root, "decision-nudge", hash)) {
      return null;
    }
    injectLib.markInjected(root, "decision-nudge", hash);
    return (
      `bee decision review: ${changed.length} source file(s) changed with no bee flow active ` +
      "and no recent decision logged. Before finishing, ask the user: is there a durable " +
      'decision or convention here worth recording? If yes: node .bee/bin/bee.mjs decisions log ' +
      '--decision "..." --rationale "..." (or a dated learning in docs/history/learnings/). ' +
      "If not, carry on."
    );
  } catch {
    // fail-open: no git, no lib, no problem
    return null;
  }
}

// Decision 0003 capture nudge: a settled outcome must reach the state layer in
// the same session it settled. When the newest active decision is more recent
// than every docs/specs/*.md update, warn (deduped) that something settled was
// never captured — invoke bee-scribing capture before closing. Never blocks.
async function maybeCaptureNudge(root) {
  try {
    const specsDir = path.join(root, "docs", "specs");
    if (!fs.existsSync(specsDir)) {
      return null;
    }
    const decisionsLib = await import(libModuleUrl(root, "decisions.mjs"));
    const injectLib = await import(libModuleUrl(root, "inject.mjs"));
    const recent = decisionsLib.activeDecisions(root, { recent: 1 });
    const lastDecision = recent[0];
    const decisionTs = lastDecision && lastDecision.date ? Date.parse(lastDecision.date) : 0;
    if (!decisionTs) {
      return null;
    }
    let newestSpec = 0;
    for (const name of fs.readdirSync(specsDir)) {
      if (!name.endsWith(".md")) {
        continue;
      }
      const mtime = fs.statSync(path.join(specsDir, name)).mtimeMs;
      if (mtime > newestSpec) {
        newestSpec = mtime;
      }
    }
    if (decisionTs <= newestSpec) {
      return null;
    }
    const hash = String(lastDecision.id || lastDecision.date);
    if (!injectLib.shouldInject(root, "capture-nudge", hash)) {
      return null;
    }
    injectLib.markInjected(root, "capture-nudge", hash);
    return (
      "bee capture nudge (decision 0003): the newest decision is more recent than every " +
      "area spec under docs/specs/ — a settled outcome may exist only in the decision log " +
      "and the chat. Before finishing, invoke bee-scribing capture to merge it into the " +
      "touched area's spec (or confirm no spec is affected)."
    );
  } catch {
    // fail-open: no specs, no lib, no problem
    return null;
  }
}

// Decision 0017: capture stubs queued mid-flow must not die with the context.
// On Stop the warning is deduped (same pending set warns once per interval);
// on PreCompact it always fires — compaction is the point where an unflushed
// queue would silently outlive the conversation that explains it.
async function maybeCaptureQueueNudge(root, { force = false } = {}) {
  try {
    const captureLib = await import(libModuleUrl(root, "capture.mjs"));
    const injectLib = await import(libModuleUrl(root, "inject.mjs"));
    const pending = captureLib.pendingCaptureStubs(root);
    if (pending.length === 0) {
      return null;
    }
    const hash = pending.map((stub) => stub.id).sort().join("|");
    if (!force) {
      if (!injectLib.shouldInject(root, "capture-queue-nudge", hash)) {
        return null;
      }
      injectLib.markInjected(root, "capture-queue-nudge", hash);
    }
    return (
      `bee capture queue (decision 0017): ${pending.length} settlement stub(s) are queued and ` +
      "unflushed. Flush them now via bee-scribing (drain oldest-first, merge each into its " +
      "area spec) — or they must survive into the next session's preamble, never be dropped."
    );
  } catch {
    // fail-open: no lib, no problem
    return null;
  }
}

async function main() {
  const ctx = await readHookContext(HOOK_NAME);
  const root = ctx.root;
  if (!root) {
    return 0;
  }
  if (!fs.existsSync(path.join(root, ".bee", "bin", "lib", "state.mjs"))) {
    return 0;
  }

  const parts = [];
  try {
    const stateLib = await import(libModuleUrl(root, "state.mjs"));
    if (!stateLib.hookEnabled(root, HOOK_NAME)) {
      return 0;
    }
    const queueMsg = await maybeCaptureQueueNudge(root, {
      force: ctx.event === "PreCompact",
    });
    if (queueMsg) {
      parts.push(queueMsg);
    }
    const captureMsg = await maybeCaptureNudge(root);
    if (captureMsg) {
      parts.push(captureMsg);
    }
    const state = stateLib.readState(root);
    const pipeline = stateLib.resolvePipeline(root, { sessionId: getSessionId(ctx.payload) });
    const phase = (pipeline.ok ? pipeline.record.phase : state.phase) || "idle";
    if (phase === "idle" || phase === "compounding-complete") {
      const decisionMsg = await maybeDecisionNudge(root);
      if (decisionMsg) {
        parts.push(decisionMsg);
      }
    } else if (!stateLib.readHandoff(root)) {
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
      parts.push(lines.join("\n"));
    }
  } catch (error) {
    logCrash(root, HOOK_NAME, error, ctx.source);
    // fall through: advisory parts already collected are still emitted below,
    // matching the old behavior where earlier nudges had already printed.
  }
  if (parts.length > 0) {
    // This wrapper is only wired to Stop and PreCompact — both advisory —
    // so a payload missing hook_event_name still encodes as an advisory.
    emitHookOutput(ctx, parts.join("\n"), { defaultEvent: "Stop" });
  }
  return 0;
}

process.exitCode = await main();
