#!/usr/bin/env node
// test_onboard_bee.mjs - self-contained test for onboard_bee.mjs.
// Creates a temp repo, runs plan mode (expects changes_needed), applies,
// verifies AGENTS.md markers + .bee tree + vendored bin/lib, re-runs plan
// (expects up_to_date), checks AGENTS block idempotency and the never-
// overwrite rule, then exercises --repo-hooks. Exits 1 on any failure.

import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
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

// --- hermetic per-case fake HOME/USERPROFILE isolation ----------------------
// The real home must be unreachable by construction: every spawned onboard
// process gets HOME and USERPROFILE pointed at a fake per-case temp dir, never
// at the developer's real home. Single-call cases get a fresh fake home per
// call (default param below); multi-call cases (apply-then-recheck, etc.)
// create ONE fake home explicitly and pass it to every call in that case.
const REAL_HOME = process.env.HOME;
const REAL_USERPROFILE = process.env.USERPROFILE;
const spawnedHomes = [];

function makeFakeHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bee-onboard-home-"));
}

function runOnboardAt(scriptPath, args, fakeHome = makeFakeHome()) {
  const env = { ...process.env, HOME: fakeHome, USERPROFILE: fakeHome };
  spawnedHomes.push({ HOME: env.HOME, USERPROFILE: env.USERPROFILE });
  const result = spawnSync(process.execPath, [scriptPath, ...args], { encoding: "utf8", env });
  let payload = null;
  try {
    payload = JSON.parse(result.stdout || "null");
  } catch {
    payload = null;
  }
  return { ...result, payload };
}

function runOnboard(args, fakeHome = makeFakeHome()) {
  return runOnboardAt(ONBOARD, args, fakeHome);
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
// Main flow reuses `tmp` across many runOnboard calls -> one shared fake home.
const tmpHome = makeFakeHome();

try {
  // --- 1. plan mode on empty repo -> changes_needed -----------------------
  const plan1 = runOnboard(["--repo-root", tmp, "--json"], tmpHome);
  check(plan1.status === 0, "plan mode exits 0", plan1.stderr);
  check(plan1.payload?.status === "changes_needed", "empty repo reports changes_needed",
    `got: ${plan1.payload?.status}`);
  check(Array.isArray(plan1.payload?.plan) && plan1.payload.plan.length > 0,
    "plan mode lists planned actions");
  check(!fs.existsSync(path.join(tmp, "AGENTS.md")), "plan mode writes nothing");
  const plan1Actions = (plan1.payload?.plan || []).map((i) => i.action);
  check(plan1Actions.includes("create_agents_block") &&
    plan1Actions.includes("propose_agents_header"),
    "empty repo plans create_agents_block + propose_agents_header (D4)",
    JSON.stringify(plan1Actions));
  check(plan1Actions.indexOf("propose_agents_header") >
    plan1Actions.indexOf("create_agents_block"),
    "propose_agents_header ordered after create_agents_block");

  // --- 2. apply ------------------------------------------------------------
  const apply1 = runOnboard(["--repo-root", tmp, "--apply", "--json"], tmpHome);
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
  check(agentsText.includes("commands.verify") && agentsText.includes("never build on red"),
    "AGENTS block carries the baseline-gate startup step");

  // --- 3a. minimal header above the block (D4, propose_agents_header) -------
  check(agentsText.startsWith(`# ${path.basename(tmp)}\n`),
    "applied header opens with the repo folder title above the block");
  check(agentsText.includes("<!-- [unknown] one-line project description - replace me -->"),
    "header carries the loud [unknown] fill-me gap line");
  check(!agentsText.includes("- README.md") && !agentsText.includes("- docs/specs/"),
    "no pointer lines for files that do not exist");
  const applyHeaderAgain = runOnboard(["--repo-root", tmp, "--apply", "--json"], tmpHome);
  check(applyHeaderAgain.payload?.status === "applied", "re-apply after header succeeds");
  check(fs.readFileSync(path.join(tmp, "AGENTS.md"), "utf8") === agentsText,
    "re-apply leaves header AGENTS.md byte-identical (idempotent)");

  // --- 3b. standard-commands capture notice (docs/09 item 1) ----------------
  check(Array.isArray(apply1.payload?.notices) &&
    apply1.payload.notices.some((n) => n.includes("standard commands")),
    "apply on repo without commands surfaces the capture notice");
  // No manifests in this repo -> the open-question notice, no detected candidates (D3).
  check(apply1.payload.notices.some((n) => n.includes("Ask the user")) &&
    !apply1.payload.notices.some((n) => n.includes("Detected candidates")),
    "notice stays the open question when detection finds nothing");
  // P1 / docs/09 item 6: first onboard without a build carries the init-lane offer.
  check(apply1.payload.notices.some((n) => n.includes("init lane") && n.includes("init cell")),
    "first onboard without a build surfaces the greenfield init-lane notice");
  const reapplyNotice = runOnboard(["--repo-root", tmp, "--json"], tmpHome);
  check(!(reapplyNotice.payload?.notices || []).some((n) => n.includes("init lane")),
    "init-lane notice fires on the FIRST onboard only",
    JSON.stringify(reapplyNotice.payload?.notices || null));
  const cfgPath = path.join(tmp, ".bee", "config.json");
  const cfgRaw = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  cfgRaw.commands = { verify: "npm test" };
  fs.writeFileSync(cfgPath, `${JSON.stringify(cfgRaw, null, 2)}\n`, "utf8");
  const planNotice = runOnboard(["--repo-root", tmp, "--json"], tmpHome);
  check(Array.isArray(planNotice.payload?.notices) && planNotice.payload.notices.length === 0,
    "notice disappears once commands are recorded",
    JSON.stringify(planNotice.payload?.notices || null));
  delete cfgRaw.commands;
  fs.writeFileSync(cfgPath, `${JSON.stringify(cfgRaw, null, 2)}\n`, "utf8");
  const stateSource = fs.readFileSync(path.join(TEMPLATES_LIB_DIR, "state.mjs"), "utf8");
  const stateKeys = stateSource.match(/COMMAND_KEYS = \[([^\]]+)\]/)?.[1] || "";
  const onboardSource = fs.readFileSync(path.join(SCRIPTS_DIR, "onboard_bee.mjs"), "utf8");
  const onboardKeys = onboardSource.match(/COMMAND_KEYS = \[([^\]]+)\]/)?.[1] || "";
  const normKeys = (s) => s.replace(/["'\s]/g, "");
  check(stateKeys && normKeys(stateKeys) === normKeys(onboardKeys),
    "onboard_bee.mjs COMMAND_KEYS matches lib/state.mjs (no drift)",
    `state: [${stateKeys}] vs onboard: [${onboardKeys}]`);

  // --- 3c. detected command candidates ride the notice, propose-only (D3) ---
  const detTmp = fs.mkdtempSync(path.join(os.tmpdir(), "bee-detect-test-"));
  try {
    fs.writeFileSync(path.join(detTmp, "package.json"),
      `${JSON.stringify({ name: "fixture", scripts: { test: "vitest run" } }, null, 2)}\n`, "utf8");
    const detApply = runOnboard(["--repo-root", detTmp, "--apply", "--json"]);
    check(detApply.payload?.status === "applied", "apply on manifest-bearing repo succeeds");
    const detNotices = detApply.payload?.notices || [];
    check(detNotices.some((n) => n.includes("Detected candidates") &&
      n.includes("test: npm test — package.json")),
      "notice lists detected candidates as key: value — source proposals",
      JSON.stringify(detNotices));
    check(detNotices.some((n) => n.includes("confirmation question") && n.includes("confirmed")),
      "candidate notice instructs confirm-before-write");
    check(!detNotices.some((n) => n.includes("init lane")),
      "a repo WITH a detectable build never gets the init-lane notice");
    const detConfig = JSON.parse(
      fs.readFileSync(path.join(detTmp, ".bee", "config.json"), "utf8"));
    check(detConfig.commands === undefined,
      "apply writes no detected values to config.json commands",
      JSON.stringify(detConfig.commands || null));
  } finally {
    try {
      fs.rmSync(detTmp, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }

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
  check(fs.existsSync(path.join(tmp, "docs", "history", "learnings", "critical-patterns.md")),
    "docs/history/learnings/critical-patterns.md stub exists");

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
  const plan2 = runOnboard(["--repo-root", tmp, "--json"], tmpHome);
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

  const plan3 = runOnboard(["--repo-root", tmp, "--json"], tmpHome);
  check(plan3.payload?.status === "changes_needed", "tampered block detected as changes_needed");
  check(plan3.payload?.plan?.some((i) => i.action === "update_agents_block"),
    "plan includes update_agents_block");

  const apply2 = runOnboard(["--repo-root", tmp, "--apply", "--json"], tmpHome);
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

  const apply3 = runOnboard(["--repo-root", tmp, "--apply", "--json"], tmpHome);
  const afterThird = fs.readFileSync(path.join(tmp, "AGENTS.md"), "utf8");
  check(afterThird === restored, "third apply is byte-identical (idempotent)");
  check(apply3.payload?.recheck === "up_to_date", "third apply recheck up_to_date");

  // --- 7b. propose_agents_header semantics (D4) -------------------------------
  // Prose outside the markers -> never proposed, prose preserved byte-for-byte.
  const proseTmp = fs.mkdtempSync(path.join(os.tmpdir(), "bee-header-prose-"));
  const proseHome = makeFakeHome();
  try {
    const prose = "# Handwritten\n\nThis project does X.";
    fs.writeFileSync(path.join(proseTmp, "AGENTS.md"), `${prose}\n`, "utf8");
    const prosePlan = runOnboard(["--repo-root", proseTmp, "--json"], proseHome);
    check(!(prosePlan.payload?.plan || []).some((i) => i.action === "propose_agents_header"),
      "prose outside markers never yields propose_agents_header",
      JSON.stringify(prosePlan.payload?.plan || []));
    runOnboard(["--repo-root", proseTmp, "--apply", "--json"], proseHome);
    const proseAfter = fs.readFileSync(path.join(proseTmp, "AGENTS.md"), "utf8");
    check(proseAfter.startsWith(prose),
      "existing prose preserved byte-for-byte ahead of the appended block");
    check(!proseAfter.includes("[unknown] one-line project description"),
      "no header injected into a prose-bearing AGENTS.md");
  } finally {
    try {
      fs.rmSync(proseTmp, { recursive: true, force: true });
      fs.rmSync(proseHome, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }

  // Pointer lines appear only for files that exist at plan time.
  const ptrTmp = fs.mkdtempSync(path.join(os.tmpdir(), "bee-header-ptr-"));
  try {
    fs.writeFileSync(path.join(ptrTmp, "README.md"), "# readme\n", "utf8");
    fs.mkdirSync(path.join(ptrTmp, "docs", "specs"), { recursive: true });
    fs.writeFileSync(path.join(ptrTmp, "docs", "specs", "reading-map.md"), "# map\n", "utf8");
    runOnboard(["--repo-root", ptrTmp, "--apply", "--json"]);
    const ptrText = fs.readFileSync(path.join(ptrTmp, "AGENTS.md"), "utf8");
    check(ptrText.includes("- README.md") && ptrText.includes("- docs/specs/reading-map.md"),
      "header pointer lines present for files that exist");
    check(!ptrText.includes("- docs/specs/system-overview.md"),
      "no pointer line for the missing system-overview.md");
  } finally {
    try {
      fs.rmSync(ptrTmp, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }

  // Block-only AGENTS.md (already-onboarded, pre-header) flips up_to_date ->
  // changes_needed with only the propose item: intended propose-only upgrade.
  const flipTmp = fs.mkdtempSync(path.join(os.tmpdir(), "bee-header-flip-"));
  const flipHome = makeFakeHome();
  try {
    runOnboard(["--repo-root", flipTmp, "--apply", "--json"], flipHome);
    const flipFull = fs.readFileSync(path.join(flipTmp, "AGENTS.md"), "utf8");
    const blockOnly = flipFull.slice(flipFull.indexOf("<!-- BEE:START -->"));
    fs.writeFileSync(path.join(flipTmp, "AGENTS.md"),
      `<!-- keep\nthis multi-line comment -->\n${blockOnly}`, "utf8");
    const flipPlan = runOnboard(["--repo-root", flipTmp, "--json"], flipHome);
    check(flipPlan.payload?.status === "changes_needed" &&
      (flipPlan.payload?.plan || []).length > 0 &&
      flipPlan.payload.plan.every((i) => i.action === "propose_agents_header"),
      "block-only AGENTS.md flips up_to_date -> changes_needed with only propose_agents_header",
      JSON.stringify(flipPlan.payload?.plan || []));
    runOnboard(["--repo-root", flipTmp, "--apply", "--json"], flipHome);
    const flipAfter = fs.readFileSync(path.join(flipTmp, "AGENTS.md"), "utf8");
    check(flipAfter.startsWith(`# ${path.basename(flipTmp)}\n`),
      "header prepended at the top of a block-only AGENTS.md");
    check(flipAfter.includes("<!-- keep\nthis multi-line comment -->"),
      "comment-only content outside markers preserved (comments are not prose)");
    const flipRecheck = runOnboard(["--repo-root", flipTmp, "--json"], flipHome);
    check(flipRecheck.payload?.status === "up_to_date",
      "header apply settles the flip back to up_to_date");
  } finally {
    try {
      fs.rmSync(flipTmp, { recursive: true, force: true });
      fs.rmSync(flipHome, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }

  // --- 8. never overwrite existing state/decisions/cells ---------------------
  const customState = { schema_version: "1.0", phase: "swarming", marker: "user-owned" };
  fs.writeFileSync(path.join(tmp, ".bee", "state.json"),
    `${JSON.stringify(customState, null, 2)}\n`, "utf8");
  fs.appendFileSync(path.join(tmp, ".bee", "decisions.jsonl"),
    `${JSON.stringify({ event: "decide", decision: "keep me" })}\n`, "utf8");
  fs.writeFileSync(path.join(tmp, ".bee", "cells", "demo-1.json"),
    `${JSON.stringify({ id: "demo-1", status: "open" })}\n`, "utf8");

  runOnboard(["--repo-root", tmp, "--apply", "--json"], tmpHome);
  const stateAfter = JSON.parse(fs.readFileSync(path.join(tmp, ".bee", "state.json"), "utf8"));
  check(stateAfter.marker === "user-owned" && stateAfter.phase === "swarming",
    "existing state.json never overwritten");
  check(fs.readFileSync(path.join(tmp, ".bee", "decisions.jsonl"), "utf8").includes("keep me"),
    "existing decisions.jsonl never overwritten");
  check(fs.existsSync(path.join(tmp, ".bee", "cells", "demo-1.json")),
    "existing cells never removed");

  // --- 9. --repo-hooks --------------------------------------------------------
  const hooksPlan = runOnboard(["--repo-root", tmp, "--repo-hooks", "--json"], tmpHome);
  check(hooksPlan.payload?.status === "changes_needed", "--repo-hooks plan reports changes_needed");

  // Pre-seed a settings.json so the .bak backup path is exercised.
  fs.mkdirSync(path.join(tmp, ".claude"), { recursive: true });
  fs.writeFileSync(path.join(tmp, ".claude", "settings.json"),
    `${JSON.stringify({ permissions: { allow: ["Bash(ls:*)"] } }, null, 2)}\n`, "utf8");

  const hooksApply = runOnboard(["--repo-root", tmp, "--apply", "--repo-hooks", "--json"], tmpHome);
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
  runOnboard(["--repo-root", tmp, "--apply", "--repo-hooks", "--json"], tmpHome);
  const settings2 = JSON.parse(
    fs.readFileSync(path.join(tmp, ".claude", "settings.json"), "utf8"));
  const initCount = JSON.stringify(settings2).split("bee-session-init.mjs").length - 1;
  check(initCount === 1, "no duplicate hook entries after second --repo-hooks apply",
    `count: ${initCount}`);

  // --claude-md: fresh repo -> created with header + bare import.
  const cmTmp = fs.mkdtempSync(path.join(os.tmpdir(), "bee-claudemd-test-"));
  const cmHome = makeFakeHome();
  try {
    runOnboard(["--repo-root", cmTmp, "--apply", "--claude-md", "--json"], cmHome);
    const created = fs.readFileSync(path.join(cmTmp, "CLAUDE.md"), "utf8");
    check(created.startsWith("# Project Rules"), "--claude-md creates CLAUDE.md with header");
    check(/^@AGENTS\.md\s*$/m.test(created), "created CLAUDE.md carries a bare @AGENTS.md import");
    const cmRecheck = runOnboard(["--repo-root", cmTmp, "--claude-md", "--json"], cmHome);
    check(cmRecheck.payload && cmRecheck.payload.status === "up_to_date",
      "--claude-md recheck up_to_date");

    // existing CLAUDE.md without the import -> appended, user content preserved.
    fs.writeFileSync(path.join(cmTmp, "CLAUDE.md"), "# My rules\n\nDo X.\n", "utf8");
    runOnboard(["--repo-root", cmTmp, "--apply", "--claude-md", "--json"], cmHome);
    const appended = fs.readFileSync(path.join(cmTmp, "CLAUDE.md"), "utf8");
    check(appended.startsWith("# My rules"), "--claude-md preserves existing CLAUDE.md content");
    check(/^@AGENTS\.md\s*$/m.test(appended), "--claude-md appends the import to existing CLAUDE.md");
    const importCount = appended.split("@AGENTS.md").length - 1;
    check(importCount === 1, "no duplicate @AGENTS.md import", `count: ${importCount}`);
  } finally {
    try {
      fs.rmSync(cmTmp, { recursive: true, force: true });
      fs.rmSync(cmHome, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
} finally {
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.rmSync(tmpHome, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
}

// --- 10. skill-sync (D1-D5): safety-critical behavioral cases ---------------
// Fixture authority (F4): source authority = the EXECUTING file's own tree, so
// fake-source cases copy the launcher + its relative deps into the fake
// skills/bee-hive tree and run THAT copy; only cases about the real tree run
// the real launcher. The real ~/.claude is never read or written: every spawn
// goes through runOnboardAt's fake HOME/USERPROFILE.

const REAL_ONBOARD_SRC = fs.readFileSync(ONBOARD, "utf8");
const REAL_DETECT_SRC = fs.readFileSync(
  path.join(TEMPLATES_LIB_DIR, "commands_detect.mjs"), "utf8");
const REAL_AGENTS_BLOCK_SRC = fs.readFileSync(
  path.join(TEMPLATES_DIR, "AGENTS.block.md"), "utf8");

function fakeStateSource(version) {
  return `export const BEE_VERSION = '${version}';\n` +
    `export const COMMAND_KEYS = ['setup', 'start', 'test', 'verify'];\n`;
}

function writeSkillFiles(skillsRoot, skill, files) {
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(skillsRoot, skill, ...rel.split("/"));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, "utf8");
  }
}

// Build a fake bee source tree at skillsRoot whose bee-hive dir carries a REAL
// copy of the launcher + its relative deps (F4), with a controlled version.
function makeFakeSkillsRoot(skillsRoot, {
  version = "0.1.19",
  hiveDirName = "bee-hive",
  skills = { "bee-alpha": { "SKILL.md": "# alpha v1\n" } },
  stateText = null,
} = {}) {
  const hive = path.join(skillsRoot, hiveDirName);
  fs.mkdirSync(path.join(hive, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(hive, "templates", "lib"), { recursive: true });
  fs.writeFileSync(path.join(hive, "scripts", "onboard_bee.mjs"), REAL_ONBOARD_SRC, "utf8");
  fs.writeFileSync(
    path.join(hive, "templates", "lib", "commands_detect.mjs"), REAL_DETECT_SRC, "utf8");
  fs.writeFileSync(
    path.join(hive, "templates", "lib", "state.mjs"),
    stateText !== null ? stateText : fakeStateSource(version), "utf8");
  fs.writeFileSync(path.join(hive, "templates", "AGENTS.block.md"), REAL_AGENTS_BLOCK_SRC, "utf8");
  fs.writeFileSync(path.join(hive, "SKILL.md"), "# fake bee-hive\n", "utf8");
  for (const [skill, files] of Object.entries(skills)) {
    writeSkillFiles(skillsRoot, skill, files);
  }
  return { skillsRoot, launcher: path.join(hive, "scripts", "onboard_bee.mjs") };
}

function makeInstalledSkills(fakeHome, { version = "0.1.19", stateText = null, skills = {} } = {}) {
  const root = path.join(fakeHome, ".claude", "skills");
  fs.mkdirSync(root, { recursive: true });
  if (version !== null || stateText !== null) {
    writeSkillFiles(root, "bee-hive", {
      "SKILL.md": "# installed hive\n",
      "templates/lib/state.mjs": stateText !== null ? stateText : fakeStateSource(version),
    });
  }
  for (const [skill, files] of Object.entries(skills)) {
    writeSkillFiles(root, skill, files);
  }
  return root;
}

function readInstalled(fakeHome, rel) {
  const abs = path.join(fakeHome, ".claude", "skills", ...rel.split("/"));
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : null;
}

// Stable full-tree digest (lstat semantics: symlinks recorded by target, never
// followed) for byte-identical / zero-mutation assertions.
function hashTree(dir) {
  if (!fs.existsSync(dir)) {
    return "ABSENT";
  }
  const lines = [];
  const walk = (d, prefix) => {
    const entries = fs.readdirSync(d, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      const abs = path.join(d, e.name);
      if (e.isSymbolicLink()) {
        lines.push(`link ${rel} -> ${fs.readlinkSync(abs)}`);
      } else if (e.isDirectory()) {
        lines.push(`dir ${rel}`);
        walk(abs, rel);
      } else {
        lines.push(
          `file ${rel} ${crypto.createHash("sha256").update(fs.readFileSync(abs)).digest("hex")}`);
      }
    }
  };
  walk(dir, "");
  return lines.join("\n");
}

// --- 10a. fresh install: absent target -> full sync, no refusal (D3) --------
{
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "bee-skillsync-fresh-"));
  const home = makeFakeHome();
  try {
    const { launcher } = makeFakeSkillsRoot(path.join(base, "skills"), {
      skills: {
        "bee-alpha": { "SKILL.md": "# alpha v1\n" },
        "bee-beta": { "SKILL.md": "# beta\n", "references/notes.md": "beta notes\n" },
      },
    });
    const repo = path.join(base, "repo");
    fs.mkdirSync(repo, { recursive: true });
    const plan = runOnboardAt(launcher, ["--repo-root", repo, "--json"], home);
    check(plan.status === 0 && plan.payload?.status === "changes_needed",
      "fresh install: plan reports changes_needed",
      `exit ${plan.status} status ${plan.payload?.status}`);
    const syncSkills = (plan.payload?.plan || [])
      .filter((i) => i.action === "sync_skill").map((i) => i.skill).sort();
    check(JSON.stringify(syncSkills) === JSON.stringify(["bee-alpha", "bee-beta", "bee-hive"]),
      "fresh install: plan lists sync_skill for every source bee-* skill",
      JSON.stringify(syncSkills));
    check(!fs.existsSync(path.join(home, ".claude")),
      "fresh install: plan mode writes nothing to the fake home");
    const apply = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--json"], home);
    check(apply.status === 0 && apply.payload?.status === "applied",
      "fresh install: absent target proceeds as fresh install, no refusal (D3)",
      `exit ${apply.status} status ${apply.payload?.status}`);
    check(apply.payload?.recheck === "up_to_date",
      "fresh install: recheck lands up_to_date on content-hash parity (D5)",
      JSON.stringify(apply.payload?.recheck_plan || []));
    check(readInstalled(home, "bee-alpha/SKILL.md") === "# alpha v1\n",
      "fresh install: bee-alpha synced byte-exact");
    check(readInstalled(home, "bee-beta/references/notes.md") === "beta notes\n",
      "fresh install: nested skill files synced");
  } finally {
    try {
      fs.rmSync(base, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}

// --- 10b. fence payload + equal-version drift + removal (D4/D5) -------------
{
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "bee-skillsync-fence-"));
  const home = makeFakeHome();
  try {
    const { launcher } = makeFakeSkillsRoot(path.join(base, "skills"), {
      skills: { "bee-alpha": { "SKILL.md": "# alpha v2\n" } },
    });
    const repo = path.join(base, "repo");
    fs.mkdirSync(repo, { recursive: true });
    const installedRoot = makeInstalledSkills(home, {
      version: "0.1.19",
      skills: {
        "bee-alpha": { "SKILL.md": "# alpha v1 STALE\n" },
        "bee-obsolete": { "SKILL.md": "# obsolete\n", "references/old.md": "old\n" },
      },
    });
    // Non-bee payload: must be byte-identical after a deletion-bearing sync.
    writeSkillFiles(installedRoot, "agent-browser", {
      "SKILL.md": "# not bee's business\n",
      "references/deep/data.md": "precious user data\n",
    });
    const payloadBefore = hashTree(path.join(installedRoot, "agent-browser"));
    const plan = runOnboardAt(launcher, ["--repo-root", repo, "--json"], home);
    check((plan.payload?.plan || []).some((i) => i.action === "sync_skill" && i.skill === "bee-alpha"),
      "equal-version byte drift produces a sync_skill item (D5)",
      JSON.stringify(plan.payload?.plan || []));
    check((plan.payload?.plan || []).some((i) => i.action === "remove_skill" && i.skill === "bee-obsolete"),
      "skill absent from the anchored source planned as remove_skill (D2/D4)");
    const apply = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--json"], home);
    check(apply.status === 0 && apply.payload?.status === "applied",
      "fence: deletion-bearing apply succeeds", `exit ${apply.status}`);
    check(readInstalled(home, "bee-alpha/SKILL.md") === "# alpha v2\n",
      "drifted skill mirrored back to source bytes (D5)");
    check(!fs.existsSync(path.join(installedRoot, "bee-obsolete")),
      "removed-from-source skill deleted from the install (D4 mirror)");
    check(hashTree(path.join(installedRoot, "agent-browser")) === payloadBefore,
      "non-bee sibling byte-identical after a deletion-bearing sync (D4 fence payload)");
    check(apply.payload?.recheck === "up_to_date", "fence: recheck up_to_date");
  } finally {
    try {
      fs.rmSync(base, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}

// --- 10c. zero-mutation downgrade refusal (D3) -------------------------------
{
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "bee-skillsync-refuse-"));
  const home = makeFakeHome();
  try {
    const { launcher } = makeFakeSkillsRoot(path.join(base, "skills"), { version: "0.1.18" });
    const repo = path.join(base, "repo");
    fs.mkdirSync(repo, { recursive: true });
    makeInstalledSkills(home, { version: "0.1.19" });
    const homeBefore = hashTree(home);
    const repoBefore = hashTree(repo);
    const plan = runOnboardAt(launcher, ["--repo-root", repo, "--json"], home);
    check(plan.status === 0 && plan.payload?.status === "blocked_downgrade",
      "downgrade: plan mode reports blocked_downgrade with exit 0",
      `exit ${plan.status} status ${plan.payload?.status}`);
    const apply = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--json"], home);
    check(apply.status === 1, "downgrade: apply exits 1", `exit ${apply.status}`);
    check(apply.payload?.status === "blocked_downgrade",
      "downgrade: apply reports blocked_downgrade", JSON.stringify(apply.payload));
    const v = apply.payload?.versions || {};
    check(v.source === "0.1.18" && v.host_helpers === "absent" && v.installed_skills === "0.1.19",
      "refusal reports all three versions (source/host_helpers/installed_skills)",
      JSON.stringify(v));
    check(typeof apply.payload?.reason === "string" && apply.payload.reason.length > 0,
      "refusal carries a one-line reason");
    check(hashTree(home) === homeBefore,
      "refused apply leaves the target tree byte-identical (zero mutations)");
    check(hashTree(repo) === repoBefore,
      "refused apply leaves the repo byte-identical (post-loop onboarding.json write unreachable)");
    check(!fs.existsSync(path.join(repo, ".bee")),
      "refused apply creates no .bee dir at all");
  } finally {
    try {
      fs.rmSync(base, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}

// --- 10d. existing-but-unreadable tree = unknown = refuse, never forceable ---
{
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "bee-skillsync-unknown-"));
  const home = makeFakeHome();
  try {
    const { launcher } = makeFakeSkillsRoot(path.join(base, "skills"), { version: "0.1.19" });
    const repo = path.join(base, "repo");
    fs.mkdirSync(repo, { recursive: true });
    makeInstalledSkills(home, { stateText: "// corrupt: no version constant here\n" });
    const homeBefore = hashTree(home);
    const repoBefore = hashTree(repo);
    const apply = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--json"], home);
    check(apply.status === 1 && apply.payload?.status === "blocked_downgrade",
      "existing-but-unreadable installed tree refuses (unknown, D3)",
      `exit ${apply.status} status ${apply.payload?.status}`);
    check(apply.payload?.versions?.installed_skills === "unknown",
      "unreadable installed version reported as unknown",
      JSON.stringify(apply.payload?.versions || {}));
    const forced = runOnboardAt(launcher,
      ["--repo-root", repo, "--apply", "--force-downgrade", "--json"], home);
    check(forced.status === 1 && forced.payload?.status === "blocked_downgrade",
      "unknown is NEVER forceable: --force-downgrade still refuses",
      `exit ${forced.status} status ${forced.payload?.status}`);
    check(forced.payload?.forced_downgrade === undefined,
      "refused force reports no forced_downgrade");
    check(hashTree(home) === homeBefore && hashTree(repo) === repoBefore,
      "unforceable refusal keeps repo and target byte-identical");
  } finally {
    try {
      fs.rmSync(base, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}

// --- 10e. --force-downgrade with all three versions numeric (F9) ------------
{
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "bee-skillsync-force-"));
  const home = makeFakeHome();
  try {
    const { launcher } = makeFakeSkillsRoot(path.join(base, "skills"), { version: "0.1.18" });
    const repo = path.join(base, "repo");
    fs.mkdirSync(path.join(repo, ".bee", "bin", "lib"), { recursive: true });
    fs.writeFileSync(path.join(repo, ".bee", "bin", "lib", "state.mjs"),
      fakeStateSource("0.1.19"), "utf8");
    makeInstalledSkills(home, { version: "0.1.19" });
    const refused = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--json"], home);
    check(refused.status === 1 && refused.payload?.status === "blocked_downgrade",
      "all-numeric downgrade still refuses by default");
    const forced = runOnboardAt(launcher,
      ["--repo-root", repo, "--apply", "--force-downgrade", "--json"], home);
    check(forced.status === 0 && forced.payload?.status === "applied",
      "--force-downgrade proceeds when all three versions resolved numeric",
      `exit ${forced.status} status ${forced.payload?.status}`);
    check(forced.payload?.forced_downgrade === true,
      "forced apply reports forced_downgrade: true in its JSON (F9)");
    const fv = forced.payload?.versions || {};
    check(fv.source === "0.1.18" && fv.host_helpers === "0.1.19" && fv.installed_skills === "0.1.19",
      "forced apply reports the versions triple alongside the flag (F9)",
      JSON.stringify(fv));
    check(readInstalled(home, "bee-hive/templates/lib/state.mjs") === fakeStateSource("0.1.18"),
      "forced apply actually syncs the older source into the install");
  } finally {
    try {
      fs.rmSync(base, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}

// --- 10f. symlink fail-closed at BOTH levels (F6, panel-2 NEW-2) -------------
{
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "bee-skillsync-symlink-"));
  const home = makeFakeHome();
  try {
    const { launcher } = makeFakeSkillsRoot(path.join(base, "skills"), {
      skills: {
        "bee-alpha": { "SKILL.md": "# alpha v2\n" },
        "bee-beta": { "SKILL.md": "# beta v2\n" },
      },
    });
    const repo = path.join(base, "repo");
    fs.mkdirSync(repo, { recursive: true });
    const outsideA = path.join(base, "outside-a");
    const outsideB = path.join(base, "outside-b");
    fs.mkdirSync(outsideA, { recursive: true });
    fs.mkdirSync(outsideB, { recursive: true });
    fs.writeFileSync(path.join(outsideA, "real-work.md"), "do not touch A\n", "utf8");
    fs.writeFileSync(path.join(outsideB, "real-work.md"), "do not touch B\n", "utf8");
    const installedRoot = makeInstalledSkills(home, { version: "0.1.19" });
    // (i) top-level bee-* entry that IS a symlink to an outside dir
    fs.symlinkSync(outsideA, path.join(installedRoot, "bee-alpha"));
    // (ii) managed dir with a NESTED symlink pointing outside
    writeSkillFiles(installedRoot, "bee-beta", { "SKILL.md": "# beta v1\n" });
    fs.symlinkSync(outsideB, path.join(installedRoot, "bee-beta", "link"));
    // (iii) symlinked bee-* entry ABSENT from source: removal path must not unlink
    fs.symlinkSync(outsideA, path.join(installedRoot, "bee-gone"));
    const outsideABefore = hashTree(outsideA);
    const outsideBBefore = hashTree(outsideB);
    const betaBefore = hashTree(path.join(installedRoot, "bee-beta"));
    const plan = runOnboardAt(launcher, ["--repo-root", repo, "--json"], home);
    const planBlocked = (plan.payload?.plan || [])
      .filter((i) => i.action === "blocked_symlink").map((i) => i.skill).sort();
    check(["bee-alpha", "bee-beta", "bee-gone"].every((s) => planBlocked.includes(s)),
      "plan reports blocked_symlink loudly for every affected skill",
      JSON.stringify(planBlocked));
    const apply = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--json"], home);
    check(apply.status === 0 && apply.payload?.status === "applied",
      "symlink: apply still proceeds for unaffected skills", `exit ${apply.status}`);
    const skipped = (apply.payload?.skills?.skipped || []).map((s) => s.skill).sort();
    check(["bee-alpha", "bee-beta", "bee-gone"].every((s) => skipped.includes(s)),
      "apply reports each symlinked skill as skipped (loud per-skill report)",
      JSON.stringify(apply.payload?.skills || null));
    check(fs.lstatSync(path.join(installedRoot, "bee-alpha")).isSymbolicLink() &&
      fs.readlinkSync(path.join(installedRoot, "bee-alpha")) === outsideA,
      "top-level symlinked skill entry never unlinked or replaced");
    check(fs.lstatSync(path.join(installedRoot, "bee-gone")).isSymbolicLink(),
      "symlinked entry absent from source never unlinked (removal path fail-closed)");
    check(hashTree(outsideA) === outsideABefore,
      "top-level link target contents byte-identical (never written through)");
    check(hashTree(path.join(installedRoot, "bee-beta")) === betaBefore,
      "skill with a nested symlink left byte-identical (skipped whole, never traversed)");
    check(hashTree(outsideB) === outsideBBefore,
      "nested link target contents byte-identical");
    check(readInstalled(home, "bee-hive/SKILL.md") === "# fake bee-hive\n",
      "unaffected sibling skill still synced in the same run");
    check(apply.payload?.recheck === "changes_needed",
      "recheck stays changes_needed while a skill is symlink-blocked (parity unresolved)");
  } finally {
    try {
      fs.rmSync(base, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}

// --- 10g. ancestor overlap of source/target roots fails closed (F6) ---------
{
  // Direction 1: source root strictly inside the target root.
  const home = fs.realpathSync(makeFakeHome());
  const repoBase = fs.mkdtempSync(path.join(os.tmpdir(), "bee-skillsync-ovl1-"));
  try {
    const nestedRoot = path.join(home, ".claude", "skills", "bee-dev", "checkout", "skills");
    const { launcher } = makeFakeSkillsRoot(nestedRoot, {});
    const repo = path.join(repoBase, "repo");
    fs.mkdirSync(repo, { recursive: true });
    const homeBefore = hashTree(home);
    const repoBefore = hashTree(repo);
    const apply = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--json"], home);
    check(apply.status === 1 && apply.payload?.status === "blocked_no_source",
      "ancestor overlap (source inside target) fails closed on apply",
      `exit ${apply.status} status ${apply.payload?.status}`);
    check(hashTree(home) === homeBefore && hashTree(repo) === repoBefore,
      "overlap refusal (source inside target) mutates nothing anywhere");
  } finally {
    try {
      fs.rmSync(home, { recursive: true, force: true });
      fs.rmSync(repoBase, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}
{
  // Direction 2: target root strictly inside the source root.
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "bee-skillsync-ovl2-")));
  try {
    const skillsRoot = path.join(base, "skills");
    const { launcher } = makeFakeSkillsRoot(skillsRoot, {});
    const innerHome = path.join(skillsRoot, "home");
    fs.mkdirSync(innerHome, { recursive: true });
    const repo = path.join(base, "repo");
    fs.mkdirSync(repo, { recursive: true });
    const sourceBefore = hashTree(skillsRoot);
    const repoBefore = hashTree(repo);
    const apply = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--json"], innerHome);
    check(apply.status === 1 && apply.payload?.status === "blocked_no_source",
      "ancestor overlap (target inside source) fails closed on apply",
      `exit ${apply.status} status ${apply.payload?.status}`);
    check(hashTree(skillsRoot) === sourceBefore && hashTree(repo) === repoBefore,
      "overlap refusal (target inside source) mutates nothing anywhere");
  } finally {
    try {
      fs.rmSync(base, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}

// --- 10h. installed-copy self-invocation = verify-only NOOP (D2) -------------
{
  const home = makeFakeHome();
  const repoBase = fs.mkdtempSync(path.join(os.tmpdir(), "bee-skillsync-noop-"));
  try {
    const skillsRoot = path.join(home, ".claude", "skills");
    const { launcher } = makeFakeSkillsRoot(skillsRoot, {
      skills: { "bee-alpha": { "SKILL.md": "# alpha installed\n" } },
    });
    const repo = path.join(repoBase, "repo");
    fs.mkdirSync(repo, { recursive: true });
    const before = hashTree(skillsRoot);
    const apply = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--json"], home);
    check(apply.status === 0 && apply.payload?.status === "applied",
      "installed-copy run applies host-repo onboarding normally",
      `exit ${apply.status} status ${apply.payload?.status}`);
    check(apply.payload?.skills?.mode === "noop",
      "source==target realpath resolves the skill stage to verify-only NOOP (D2)",
      JSON.stringify(apply.payload?.skills || null));
    check(!(apply.payload?.applied || []).some(
      (i) => i.action === "sync_skill" || i.action === "remove_skill"),
      "NOOP run emits no skill mutations");
    check(hashTree(skillsRoot) === before,
      "NOOP run leaves the installed skill tree byte-identical");
    check(fs.existsSync(path.join(repo, "AGENTS.md")),
      "host-repo onboarding still lands during a NOOP skill stage");
    check(apply.payload?.recheck === "up_to_date", "NOOP recheck up_to_date",
      JSON.stringify(apply.payload?.recheck_plan || []));
  } finally {
    try {
      fs.rmSync(home, { recursive: true, force: true });
      fs.rmSync(repoBase, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}

// --- 10i. realpath identity anchor: misplaced launcher never adopts a tree ---
{
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "bee-skillsync-ident-"));
  const home = makeFakeHome();
  try {
    const { launcher } = makeFakeSkillsRoot(path.join(base, "skills"), {
      hiveDirName: "bee-hive-moved",
    });
    const repo = path.join(base, "repo");
    fs.mkdirSync(repo, { recursive: true });
    const homeBefore = hashTree(home);
    const repoBefore = hashTree(repo);
    const plan = runOnboardAt(launcher, ["--repo-root", repo, "--json"], home);
    check(plan.status === 0 && plan.payload?.status === "blocked_no_source",
      "identity failure: plan reports blocked_no_source with exit 0",
      `exit ${plan.status} status ${plan.payload?.status}`);
    const apply = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--json"], home);
    check(apply.status === 1 && apply.payload?.status === "blocked_no_source",
      "identity failure aborts the whole apply with exit 1 (F2)",
      `exit ${apply.status} status ${apply.payload?.status}`);
    const forced = runOnboardAt(launcher,
      ["--repo-root", repo, "--apply", "--force-downgrade", "--json"], home);
    check(forced.status === 1 && forced.payload?.status === "blocked_no_source",
      "blocked_no_source is NEVER forceable");
    check(hashTree(home) === homeBefore && hashTree(repo) === repoBefore,
      "no-source refusal mutates nothing anywhere (repo and target byte-identical)");
  } finally {
    try {
      fs.rmSync(base, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}

// --- 10j. source<helpers only refusal, driven solely by host_helpers (F3) ---
{
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "bee-skillsync-hostonly-"));
  const home = makeFakeHome();
  try {
    const { launcher } = makeFakeSkillsRoot(path.join(base, "skills"), { version: "0.1.18" });
    const repo = path.join(base, "repo");
    fs.mkdirSync(path.join(repo, ".bee", "bin", "lib"), { recursive: true });
    fs.writeFileSync(path.join(repo, ".bee", "bin", "lib", "state.mjs"),
      fakeStateSource("0.1.19"), "utf8"); // host_helpers newer than source
    makeInstalledSkills(home, { version: "0.1.17" }); // installed OLDER: never triggers
    const homeBefore = hashTree(home);
    const repoBefore = hashTree(repo);
    const plan = runOnboardAt(launcher, ["--repo-root", repo, "--json"], home);
    check(plan.status === 0 && plan.payload?.status === "blocked_downgrade",
      "source<helpers only: plan mode reports blocked_downgrade (F3)",
      `exit ${plan.status} status ${plan.payload?.status}`);
    const apply = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--json"], home);
    check(apply.status === 1 && apply.payload?.status === "blocked_downgrade",
      "source<helpers only: apply refuses driven solely by host_helpers (independent branch)",
      `exit ${apply.status} status ${apply.payload?.status}`);
    const v = apply.payload?.versions || {};
    check(v.source === "0.1.18" && v.host_helpers === "0.1.19" && v.installed_skills === "0.1.17",
      "source<helpers only: an OLDER installed_skills never masks the host_helpers refusal",
      JSON.stringify(v));
    check(hashTree(home) === homeBefore && hashTree(repo) === repoBefore,
      "source<helpers only: refusal mutates nothing anywhere");
    const forced = runOnboardAt(launcher,
      ["--repo-root", repo, "--apply", "--force-downgrade", "--json"], home);
    check(forced.status === 0 && forced.payload?.status === "applied" &&
      forced.payload?.forced_downgrade === true,
      "source<helpers only: --force-downgrade proceeds once all three versions resolved numeric",
      `exit ${forced.status} status ${forced.payload?.status}`);
  } finally {
    try {
      fs.rmSync(base, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}

// --- 10k. host_helpers existing-but-unreadable -> unknown -> refuse, never forceable ---
{
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "bee-skillsync-hostunknown-"));
  const home = makeFakeHome();
  try {
    const { launcher } = makeFakeSkillsRoot(path.join(base, "skills"), { version: "0.1.19" });
    const repo = path.join(base, "repo");
    fs.mkdirSync(path.join(repo, ".bee", "bin", "lib"), { recursive: true });
    fs.writeFileSync(path.join(repo, ".bee", "bin", "lib", "state.mjs"),
      "// corrupt: no version constant here\n", "utf8");
    const homeBefore = hashTree(home);
    const repoBefore = hashTree(repo);
    const apply = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--json"], home);
    check(apply.status === 1 && apply.payload?.status === "blocked_downgrade",
      "existing-but-unreadable vendored state.mjs refuses (host_helpers unknown, D3)",
      `exit ${apply.status} status ${apply.payload?.status}`);
    check(apply.payload?.versions?.host_helpers === "unknown",
      "unreadable host_helpers version reported as unknown",
      JSON.stringify(apply.payload?.versions || {}));
    const forced = runOnboardAt(launcher,
      ["--repo-root", repo, "--apply", "--force-downgrade", "--json"], home);
    check(forced.status === 1 && forced.payload?.status === "blocked_downgrade",
      "host_helpers unknown is NEVER forceable: --force-downgrade still refuses",
      `exit ${forced.status} status ${forced.payload?.status}`);
    check(forced.payload?.forced_downgrade === undefined,
      "refused force reports no forced_downgrade");
    check(hashTree(home) === homeBefore && hashTree(repo) === repoBefore,
      "unforceable host_helpers-unknown refusal keeps repo and target byte-identical");
  } finally {
    try {
      fs.rmSync(base, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}

// --- 10l. source EXISTING-but-unreadable -> unknown -> refuse, never forceable (F3) ---
{
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "bee-skillsync-srcunknown-"));
  const home = makeFakeHome();
  try {
    // The source tree's state.mjs is imported as a real ESM module (by
    // commands_detect.mjs, for COMMAND_KEYS), unlike the installed/host
    // state.mjs which is only regex-read - so "corrupt" here must stay valid
    // JS with a working COMMAND_KEYS export; only BEE_VERSION is malformed.
    const { launcher } = makeFakeSkillsRoot(path.join(base, "skills"), {
      stateText: "export const COMMAND_KEYS = ['setup', 'start', 'test', 'verify'];\n" +
        "export const BEE_VERSION = 'not-a-version';\n",
    });
    const repo = path.join(base, "repo");
    fs.mkdirSync(repo, { recursive: true });
    const homeBefore = hashTree(home);
    const repoBefore = hashTree(repo);
    const apply = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--json"], home);
    check(apply.status === 1 && apply.payload?.status === "blocked_downgrade",
      "existing-but-unreadable SOURCE state.mjs refuses (source unknown, D3/F3)",
      `exit ${apply.status} status ${apply.payload?.status}`);
    check(apply.payload?.versions?.source === "unknown",
      "unreadable source version reported as unknown",
      JSON.stringify(apply.payload?.versions || {}));
    const forced = runOnboardAt(launcher,
      ["--repo-root", repo, "--apply", "--force-downgrade", "--json"], home);
    check(forced.status === 1 && forced.payload?.status === "blocked_downgrade",
      "source unknown is NEVER forceable: --force-downgrade still refuses",
      `exit ${forced.status} status ${forced.payload?.status}`);
    check(forced.payload?.forced_downgrade === undefined,
      "refused force reports no forced_downgrade");
    check(hashTree(home) === homeBefore && hashTree(repo) === repoBefore,
      "unforceable source-unknown refusal keeps repo and target byte-identical");
  } finally {
    try {
      fs.rmSync(base, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}

// --- 10m. source newer than both host_helpers and installed_skills -> proceeds ----
{
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "bee-skillsync-srcnewer-"));
  const home = makeFakeHome();
  try {
    const { launcher } = makeFakeSkillsRoot(path.join(base, "skills"), {
      version: "0.2.0",
      skills: { "bee-alpha": { "SKILL.md": "# alpha v3\n" } },
    });
    const repo = path.join(base, "repo");
    fs.mkdirSync(path.join(repo, ".bee", "bin", "lib"), { recursive: true });
    fs.writeFileSync(path.join(repo, ".bee", "bin", "lib", "state.mjs"),
      fakeStateSource("0.1.19"), "utf8");
    makeInstalledSkills(home, {
      version: "0.1.19",
      skills: { "bee-alpha": { "SKILL.md": "# alpha v3\n" } },
    });
    const apply = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--json"], home);
    check(apply.status === 0 && apply.payload?.status === "applied",
      "source newer than both host_helpers and installed_skills proceeds without --force-downgrade",
      `exit ${apply.status} status ${apply.payload?.status}`);
    const v = apply.payload?.skills?.versions || {};
    check(v.source === "0.2.0" && v.host_helpers === "0.1.19" && v.installed_skills === "0.1.19",
      "source-newer apply reports the versions triple with source strictly ahead",
      JSON.stringify(v));
    check(apply.payload?.forced_downgrade === undefined,
      "source-newer apply carries no forced_downgrade marker (force was never needed)");
  } finally {
    try {
      fs.rmSync(base, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}

// --- 10n. repo never onboarded (host_helpers absent) + an older installed tree ---
// -> proceeds. Distinct from 10c: there, host absent still refuses because
// installed_skills is NEWER; here installed_skills is OLDER, proving "absent"
// is never itself a refusal trigger - only a resolved comparison is.
{
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "bee-skillsync-neveronboarded-"));
  const home = makeFakeHome();
  try {
    const { launcher } = makeFakeSkillsRoot(path.join(base, "skills"), {
      version: "0.1.19",
      skills: { "bee-alpha": { "SKILL.md": "# alpha v2\n" } },
    });
    const repo = path.join(base, "repo"); // never onboarded: no .bee dir at all
    fs.mkdirSync(repo, { recursive: true });
    makeInstalledSkills(home, {
      version: "0.1.18", // older than source, but present -> not "absent"
      skills: { "bee-alpha": { "SKILL.md": "# alpha v1\n" } },
    });
    const apply = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--json"], home);
    check(apply.status === 0 && apply.payload?.status === "applied",
      "repo never onboarded (host_helpers absent) proceeds as first onboard, no refusal",
      `exit ${apply.status} status ${apply.payload?.status}`);
    const v = apply.payload?.skills?.versions || {};
    check(v.host_helpers === "absent" && v.installed_skills === "0.1.18" && v.source === "0.1.19",
      "first-onboard apply reports host_helpers absent distinctly from unknown",
      JSON.stringify(v));
    check(readInstalled(home, "bee-alpha/SKILL.md") === "# alpha v2\n",
      "first-onboard apply still syncs the newer skill content");
  } finally {
    try {
      fs.rmSync(base, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}

// --- 10o. deep mirror: nested file removed, new skill appears, stale skill gone ---
{
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "bee-skillsync-deepmirror-"));
  const home = makeFakeHome();
  try {
    const { launcher } = makeFakeSkillsRoot(path.join(base, "skills"), {
      skills: {
        "bee-kept": {
          "SKILL.md": "# kept\n",
          "references/keep-me.md": "keep\n",
        },
        "bee-new": { "SKILL.md": "# brand new\n", "scripts/run.mjs": "// new\n" },
      },
    });
    const repo = path.join(base, "repo");
    fs.mkdirSync(repo, { recursive: true });
    const installedRoot = makeInstalledSkills(home, {
      version: "0.1.19",
      skills: {
        "bee-kept": {
          "SKILL.md": "# kept\n",
          "references/keep-me.md": "keep\n",
          "references/deep/stale.md": "stale nested file to remove\n",
        },
        "bee-stale": { "SKILL.md": "# going away\n", "references/old.md": "old\n" },
      },
    });
    const plan = runOnboardAt(launcher, ["--repo-root", repo, "--json"], home);
    const planActions = (plan.payload?.plan || []).map((i) => `${i.action}:${i.skill}`).sort();
    check(planActions.includes("sync_skill:bee-kept"),
      "deep mirror: plan syncs bee-kept (a nested file differs)", JSON.stringify(planActions));
    check(planActions.includes("sync_skill:bee-new"),
      "deep mirror: plan syncs the brand-new bee-new skill", JSON.stringify(planActions));
    check(planActions.includes("remove_skill:bee-stale"),
      "deep mirror: plan removes the stale bee-stale skill", JSON.stringify(planActions));
    const apply = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--json"], home);
    check(apply.status === 0 && apply.payload?.status === "applied",
      "deep mirror apply succeeds", `exit ${apply.status}`);
    check(!fs.existsSync(path.join(installedRoot, "bee-kept", "references", "deep", "stale.md")),
      "deep mirror: a file removed from nested references/ of a KEPT skill disappears");
    check(readInstalled(home, "bee-kept/references/keep-me.md") === "keep\n",
      "deep mirror: sibling nested file in the kept skill left untouched");
    check(readInstalled(home, "bee-new/scripts/run.mjs") === "// new\n",
      "deep mirror: a brand-new bee skill's nested file synced in full");
    check(!fs.existsSync(path.join(installedRoot, "bee-stale")),
      "deep mirror: a bee skill removed from source is fully deleted from the install");
    check(apply.payload?.recheck === "up_to_date", "deep mirror: recheck up_to_date",
      JSON.stringify(apply.payload?.recheck_plan || []));
  } finally {
    try {
      fs.rmSync(base, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}

// --- 10p. idempotency: second apply -> up_to_date, zero items, manifest parity ---
{
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "bee-skillsync-idempotent-"));
  const home = makeFakeHome();
  try {
    const { launcher } = makeFakeSkillsRoot(path.join(base, "skills"), {
      skills: {
        "bee-alpha": { "SKILL.md": "# alpha\n", "references/notes.md": "notes\n" },
        "bee-beta": { "SKILL.md": "# beta\n" },
      },
    });
    const repo = path.join(base, "repo");
    fs.mkdirSync(repo, { recursive: true });
    const sourceRoot = path.join(base, "skills");
    const installedRoot = path.join(home, ".claude", "skills");
    runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--json"], home);
    const plan2 = runOnboardAt(launcher, ["--repo-root", repo, "--json"], home);
    check(plan2.status === 0 && plan2.payload?.status === "up_to_date",
      "idempotency: second run's plan mode reports up_to_date",
      `exit ${plan2.status} status ${plan2.payload?.status}`);
    check(Array.isArray(plan2.payload?.plan) && plan2.payload.plan.length === 0,
      "idempotency: second run's plan carries zero items",
      JSON.stringify(plan2.payload?.plan || []));
    for (const skill of ["bee-alpha", "bee-beta", "bee-hive"]) {
      const sourceHash = hashTree(path.join(sourceRoot, skill));
      const installedHash = hashTree(path.join(installedRoot, skill));
      check(sourceHash === installedHash,
        `idempotency: ${skill} manifest hash parity between source and installed`,
        `source: ${sourceHash} installed: ${installedHash}`);
    }
    const apply2 = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--json"], home);
    check(apply2.payload?.status === "applied" && apply2.payload?.recheck === "up_to_date",
      "idempotency: second apply is a no-op, recheck up_to_date");
    check(Array.isArray(apply2.payload?.applied) &&
      !apply2.payload.applied.some((i) => i.action === "sync_skill" || i.action === "remove_skill"),
      "idempotency: second apply performs no skill mutations",
      JSON.stringify(apply2.payload?.applied || []));
  } finally {
    try {
      fs.rmSync(base, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}

// --- suite-wide isolation invariant -----------------------------------------
// Helper-level check: not a single spawn across the whole suite inherited the
// real HOME/USERPROFILE unmodified. spawnedHomes is populated by runOnboard
// itself, so this covers every call site regardless of case.
check(spawnedHomes.length > 0, "at least one onboard process was spawned",
  `count: ${spawnedHomes.length}`);
check(spawnedHomes.every((h) => h.HOME !== REAL_HOME && h.HOME && h.HOME.length > 0),
  "no spawn ever inherited the real HOME unmodified",
  JSON.stringify({ real: REAL_HOME, count: spawnedHomes.length }));
check(spawnedHomes.every((h) => h.USERPROFILE !== REAL_USERPROFILE &&
  h.USERPROFILE && h.USERPROFILE.length > 0),
  "no spawn ever inherited the real USERPROFILE unmodified",
  JSON.stringify({ real: REAL_USERPROFILE, count: spawnedHomes.length }));

process.stdout.write(`\n${failures === 0 ? "PASS" : "FAIL"} - failures: ${failures}, skipped: ${skips}\n`);
process.exitCode = failures === 0 ? 0 : 1;
