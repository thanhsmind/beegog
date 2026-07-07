#!/usr/bin/env node
// test_onboard_bee.mjs - self-contained test for onboard_bee.mjs.
// Creates a temp repo, runs plan mode (expects changes_needed), applies,
// verifies AGENTS.md markers + .bee tree + vendored bin/lib, re-runs plan
// (expects up_to_date), checks AGENTS block idempotency and the never-
// overwrite rule, then exercises --repo-hooks. Exits 1 on any failure.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPTS_DIR = path.dirname(SCRIPT_PATH);
const ONBOARD = path.join(SCRIPTS_DIR, "onboard_bee.mjs");
const TEMPLATES_DIR = path.join(path.dirname(SCRIPTS_DIR), "templates");
const TEMPLATES_LIB_DIR = path.join(TEMPLATES_DIR, "lib");

let failures = 0;
let skips = 0;

function check(condition, label, extra = "") {
  if (condition) {
    process.stdout.write(`ok    - ${label}\n`);
  } else {
    failures += 1;
    process.stdout.write(`FAIL  - ${label}${extra ? ` :: ${extra}` : ""}\n`);
  }
}

function skip(label, why) {
  skips += 1;
  process.stdout.write(`skip  - ${label} (${why})\n`);
}

function runOnboard(args) {
  const result = spawnSync(process.execPath, [ONBOARD, ...args], { encoding: "utf8" });
  let payload = null;
  try {
    payload = JSON.parse(result.stdout || "null");
  } catch {
    payload = null;
  }
  return { ...result, payload };
}

function listMjs(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".mjs"))
    .map((e) => e.name)
    .sort();
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "bee-onboard-test-"));
process.stdout.write(`test repo: ${tmp}\n`);

try {
  // --- 1. plan mode on empty repo -> changes_needed -----------------------
  const plan1 = runOnboard(["--repo-root", tmp, "--json"]);
  check(plan1.status === 0, "plan mode exits 0", plan1.stderr);
  check(plan1.payload?.status === "changes_needed", "empty repo reports changes_needed",
    `got: ${plan1.payload?.status}`);
  check(Array.isArray(plan1.payload?.plan) && plan1.payload.plan.length > 0,
    "plan mode lists planned actions");
  check(!fs.existsSync(path.join(tmp, "AGENTS.md")), "plan mode writes nothing");

  // --- 2. apply ------------------------------------------------------------
  const apply1 = runOnboard(["--repo-root", tmp, "--apply", "--json"]);
  check(apply1.status === 0, "apply exits 0", apply1.stderr);
  check(apply1.payload?.status === "applied", "apply reports applied");
  check(apply1.payload?.recheck === "up_to_date", "apply recheck is up_to_date",
    JSON.stringify(apply1.payload?.recheck_plan || []));

  // --- 3. verify AGENTS.md markers ------------------------------------------
  const agentsText = fs.existsSync(path.join(tmp, "AGENTS.md"))
    ? fs.readFileSync(path.join(tmp, "AGENTS.md"), "utf8")
    : "";
  check(agentsText.includes("<!-- BEE:START -->") && agentsText.includes("<!-- BEE:END -->"),
    "AGENTS.md contains BEE:START/END markers");
  check(agentsText.includes("bee_status.mjs"), "AGENTS block mentions bee_status first step");

  // --- 4. verify .bee tree ---------------------------------------------------
  for (const rel of [
    ".bee/onboarding.json",
    ".bee/state.json",
    ".bee/config.json",
    ".bee/reservations.json",
    ".bee/decisions.jsonl",
    ".bee/backlog.jsonl",
  ]) {
    check(fs.existsSync(path.join(tmp, rel)), `${rel} exists`);
  }
  for (const rel of [".bee/cells", ".bee/logs"]) {
    check(fs.existsSync(path.join(tmp, rel)) && fs.statSync(path.join(tmp, rel)).isDirectory(),
      `${rel}/ directory exists`);
  }
  check(fs.existsSync(path.join(tmp, "history", "learnings", "critical-patterns.md")),
    "history/learnings/critical-patterns.md stub exists");

  const config = JSON.parse(fs.readFileSync(path.join(tmp, ".bee", "config.json"), "utf8"));
  check(config.hooks && Object.values(config.hooks).every((v) => v === true) &&
    Object.keys(config.hooks).length === 6, "config.json has all 6 hooks enabled");

  // --- 5. verify bin/lib copy (tolerate missing templates: parallel INFRA) ---
  const helperNames = listMjs(TEMPLATES_DIR);
  if (helperNames.length === 0) {
    skip("helper copy to .bee/bin", "no templates/*.mjs present yet");
  } else {
    for (const name of helperNames) {
      const src = fs.readFileSync(path.join(TEMPLATES_DIR, name), "utf8");
      const dst = path.join(tmp, ".bee", "bin", name);
      check(fs.existsSync(dst) && fs.readFileSync(dst, "utf8") === src,
        `.bee/bin/${name} copied verbatim`);
    }
  }
  const libNames = listMjs(TEMPLATES_LIB_DIR);
  if (libNames.length === 0) {
    skip("lib copy to .bee/bin/lib", "no templates/lib/*.mjs present yet");
  } else {
    for (const name of libNames) {
      const src = fs.readFileSync(path.join(TEMPLATES_LIB_DIR, name), "utf8");
      const dst = path.join(tmp, ".bee", "bin", "lib", name);
      check(fs.existsSync(dst) && fs.readFileSync(dst, "utf8") === src,
        `.bee/bin/lib/${name} copied verbatim`);
    }
  }
  check(!fs.existsSync(path.join(tmp, ".bee", "bin", "AGENTS.block.md")),
    "AGENTS.block.md is NOT copied into .bee/bin");

  // --- 6. plan mode again -> up_to_date --------------------------------------
  const plan2 = runOnboard(["--repo-root", tmp, "--json"]);
  check(plan2.payload?.status === "up_to_date", "second plan run reports up_to_date",
    JSON.stringify(plan2.payload?.plan || []));

  // --- 7. AGENTS block idempotency -------------------------------------------
  // User content outside the markers must survive; a tampered block inside the
  // markers must be restored; a second apply must be a byte-level no-op.
  const userHeader = "# My project\n\nHand-written intro that bee must not touch.\n\n";
  const userFooter = "\n## Appendix\n\nMore hand-written content after the block.\n";
  const current = fs.readFileSync(path.join(tmp, "AGENTS.md"), "utf8");
  const tampered = current.replace(
    /<!-- BEE:START -->[\s\S]*?<!-- BEE:END -->/,
    "<!-- BEE:START -->\nTAMPERED CONTENT\n<!-- BEE:END -->",
  );
  fs.writeFileSync(path.join(tmp, "AGENTS.md"), userHeader + tampered + userFooter, "utf8");

  const plan3 = runOnboard(["--repo-root", tmp, "--json"]);
  check(plan3.payload?.status === "changes_needed", "tampered block detected as changes_needed");
  check(plan3.payload?.plan?.some((i) => i.action === "update_agents_block"),
    "plan includes update_agents_block");

  const apply2 = runOnboard(["--repo-root", tmp, "--apply", "--json"]);
  check(apply2.payload?.status === "applied", "re-apply after tamper succeeds");
  const restored = fs.readFileSync(path.join(tmp, "AGENTS.md"), "utf8");
  check(restored.includes("Hand-written intro that bee must not touch."),
    "user content before the block preserved");
  check(restored.includes("More hand-written content after the block."),
    "user content after the block preserved");
  check(!restored.includes("TAMPERED CONTENT"), "tampered block content restored");
  check(restored.includes("<!-- BEE:START -->") &&
    restored.indexOf("<!-- BEE:START -->") === restored.lastIndexOf("<!-- BEE:START -->"),
    "exactly one BEE block after re-apply");

  const apply3 = runOnboard(["--repo-root", tmp, "--apply", "--json"]);
  const afterThird = fs.readFileSync(path.join(tmp, "AGENTS.md"), "utf8");
  check(afterThird === restored, "third apply is byte-identical (idempotent)");
  check(apply3.payload?.recheck === "up_to_date", "third apply recheck up_to_date");

  // --- 8. never overwrite existing state/decisions/cells ---------------------
  const customState = { schema_version: "1.0", phase: "swarming", marker: "user-owned" };
  fs.writeFileSync(path.join(tmp, ".bee", "state.json"),
    `${JSON.stringify(customState, null, 2)}\n`, "utf8");
  fs.appendFileSync(path.join(tmp, ".bee", "decisions.jsonl"),
    `${JSON.stringify({ event: "decide", decision: "keep me" })}\n`, "utf8");
  fs.writeFileSync(path.join(tmp, ".bee", "cells", "demo-1.json"),
    `${JSON.stringify({ id: "demo-1", status: "open" })}\n`, "utf8");

  runOnboard(["--repo-root", tmp, "--apply", "--json"]);
  const stateAfter = JSON.parse(fs.readFileSync(path.join(tmp, ".bee", "state.json"), "utf8"));
  check(stateAfter.marker === "user-owned" && stateAfter.phase === "swarming",
    "existing state.json never overwritten");
  check(fs.readFileSync(path.join(tmp, ".bee", "decisions.jsonl"), "utf8").includes("keep me"),
    "existing decisions.jsonl never overwritten");
  check(fs.existsSync(path.join(tmp, ".bee", "cells", "demo-1.json")),
    "existing cells never removed");

  // --- 9. --repo-hooks --------------------------------------------------------
  const hooksPlan = runOnboard(["--repo-root", tmp, "--repo-hooks", "--json"]);
  check(hooksPlan.payload?.status === "changes_needed", "--repo-hooks plan reports changes_needed");

  // Pre-seed a settings.json so the .bak backup path is exercised.
  fs.mkdirSync(path.join(tmp, ".claude"), { recursive: true });
  fs.writeFileSync(path.join(tmp, ".claude", "settings.json"),
    `${JSON.stringify({ permissions: { allow: ["Bash(ls:*)"] } }, null, 2)}\n`, "utf8");

  const hooksApply = runOnboard(["--repo-root", tmp, "--apply", "--repo-hooks", "--json"]);
  check(hooksApply.payload?.status === "applied", "--repo-hooks apply succeeds");
  check(hooksApply.payload?.recheck === "up_to_date", "--repo-hooks recheck up_to_date",
    JSON.stringify(hooksApply.payload?.recheck_plan || []));

  const settings = JSON.parse(
    fs.readFileSync(path.join(tmp, ".claude", "settings.json"), "utf8"));
  check(settings.permissions?.allow?.[0] === "Bash(ls:*)",
    "existing settings.json content preserved by merge");
  const settingsText = JSON.stringify(settings);
  for (const name of [
    "bee-session-init.mjs",
    "bee-prompt-context.mjs",
    "bee-write-guard.mjs",
    "bee-state-sync.mjs",
    "bee-chain-nudge.mjs",
    "bee-session-close.mjs",
  ]) {
    check(settingsText.includes(`.bee/bin/hooks/${name}`), `settings.json wires ${name}`);
    check(fs.existsSync(path.join(tmp, ".bee", "bin", "hooks", name)),
      `.bee/bin/hooks/${name} copied`);
  }
  check(settingsText.includes('\\"$CLAUDE_PROJECT_DIR\\"') ||
    settingsText.includes('"$CLAUDE_PROJECT_DIR"'),
    "hook commands use $CLAUDE_PROJECT_DIR-style paths");
  check(fs.existsSync(path.join(tmp, ".claude", "settings.json.bak")),
    "settings.json.bak backup created");

  // --repo-hooks apply twice -> no duplicate bee entries.
  runOnboard(["--repo-root", tmp, "--apply", "--repo-hooks", "--json"]);
  const settings2 = JSON.parse(
    fs.readFileSync(path.join(tmp, ".claude", "settings.json"), "utf8"));
  const initCount = JSON.stringify(settings2).split("bee-session-init.mjs").length - 1;
  check(initCount === 1, "no duplicate hook entries after second --repo-hooks apply",
    `count: ${initCount}`);

  // --claude-md: fresh repo -> created with header + bare import.
  const cmTmp = fs.mkdtempSync(path.join(os.tmpdir(), "bee-claudemd-test-"));
  try {
    runOnboard(["--repo-root", cmTmp, "--apply", "--claude-md", "--json"]);
    const created = fs.readFileSync(path.join(cmTmp, "CLAUDE.md"), "utf8");
    check(created.startsWith("# Project Rules"), "--claude-md creates CLAUDE.md with header");
    check(/^@AGENTS\.md\s*$/m.test(created), "created CLAUDE.md carries a bare @AGENTS.md import");
    const cmRecheck = runOnboard(["--repo-root", cmTmp, "--claude-md", "--json"]);
    check(cmRecheck.payload && cmRecheck.payload.status === "up_to_date",
      "--claude-md recheck up_to_date");

    // existing CLAUDE.md without the import -> appended, user content preserved.
    fs.writeFileSync(path.join(cmTmp, "CLAUDE.md"), "# My rules\n\nDo X.\n", "utf8");
    runOnboard(["--repo-root", cmTmp, "--apply", "--claude-md", "--json"]);
    const appended = fs.readFileSync(path.join(cmTmp, "CLAUDE.md"), "utf8");
    check(appended.startsWith("# My rules"), "--claude-md preserves existing CLAUDE.md content");
    check(/^@AGENTS\.md\s*$/m.test(appended), "--claude-md appends the import to existing CLAUDE.md");
    const importCount = appended.split("@AGENTS.md").length - 1;
    check(importCount === 1, "no duplicate @AGENTS.md import", `count: ${importCount}`);
  } finally {
    try {
      fs.rmSync(cmTmp, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
} finally {
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
}

process.stdout.write(`\n${failures === 0 ? "PASS" : "FAIL"} - failures: ${failures}, skipped: ${skips}\n`);
process.exitCode = failures === 0 ? 0 : 1;
