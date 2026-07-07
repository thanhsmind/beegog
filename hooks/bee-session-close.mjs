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

// Repository-harness lesson: review the session for an unrecorded decision
// before it ends. When source files changed with no bee flow active and no
// recent decision logged, nudge once (deduped) — never block.
const NUDGE_ALLOWED = /^(\.bee\/|docs\/|\.spikes\/|plans\/|AGENTS\.md$)/;
const DECISION_RECENT_MS = 6 * 3600 * 1000;

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
      return;
    }
    const decisionsLib = await import(libModuleUrl(root, "decisions.mjs"));
    const injectLib = await import(libModuleUrl(root, "inject.mjs"));
    const recent = decisionsLib.activeDecisions(root, { recent: 1 });
    const lastTs = recent[0] && recent[0].date ? Date.parse(recent[0].date) : 0;
    if (lastTs && Date.now() - lastTs < DECISION_RECENT_MS) {
      return;
    }
    const hash = changed.sort().join("|");
    if (!injectLib.shouldInject(root, "decision-nudge", hash)) {
      return;
    }
    injectLib.markInjected(root, "decision-nudge", hash);
    process.stdout.write(
      `bee decision review: ${changed.length} source file(s) changed with no bee flow active ` +
        "and no recent decision logged. Before finishing, ask the user: is there a durable " +
        'decision or convention here worth recording? If yes: node .bee/bin/bee_decisions.mjs log ' +
        '--decision "..." --rationale "..." (or a dated learning in docs/history/learnings/). ' +
        "If not, carry on.",
    );
  } catch {
    // fail-open: no git, no lib, no problem
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
      return;
    }
    const decisionsLib = await import(libModuleUrl(root, "decisions.mjs"));
    const injectLib = await import(libModuleUrl(root, "inject.mjs"));
    const recent = decisionsLib.activeDecisions(root, { recent: 1 });
    const lastDecision = recent[0];
    const decisionTs = lastDecision && lastDecision.date ? Date.parse(lastDecision.date) : 0;
    if (!decisionTs) {
      return;
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
      return;
    }
    const hash = String(lastDecision.id || lastDecision.date);
    if (!injectLib.shouldInject(root, "capture-nudge", hash)) {
      return;
    }
    injectLib.markInjected(root, "capture-nudge", hash);
    process.stdout.write(
      "bee capture nudge (decision 0003): the newest decision is more recent than every " +
        "area spec under docs/specs/ — a settled outcome may exist only in the decision log " +
        "and the chat. Before finishing, invoke bee-scribing capture to merge it into the " +
        "touched area's spec (or confirm no spec is affected).\n",
    );
  } catch {
    // fail-open: no specs, no lib, no problem
  }
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
    await maybeCaptureNudge(root);
    const state = stateLib.readState(root);
    const phase = state.phase || "idle";
    if (phase === "idle" || phase === "compounding-complete") {
      await maybeDecisionNudge(root);
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
