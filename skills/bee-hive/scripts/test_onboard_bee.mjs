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

function runOnboard(args, fakeHome = makeFakeHome()) {
  const env = { ...process.env, HOME: fakeHome, USERPROFILE: fakeHome };
  spawnedHomes.push({ HOME: env.HOME, USERPROFILE: env.USERPROFILE });
  const result = spawnSync(process.execPath, [ONBOARD, ...args], { encoding: "utf8", env });
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
