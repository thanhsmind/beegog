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
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPTS_DIR = path.dirname(SCRIPT_PATH);
const ONBOARD = path.join(SCRIPTS_DIR, "onboard_bee.mjs");
const TEMPLATES_DIR = path.join(path.dirname(SCRIPTS_DIR), "templates");
const TEMPLATES_LIB_DIR = path.join(TEMPLATES_DIR, "lib");
const REPO_ROOT = path.join(SCRIPTS_DIR, "..", "..", "..");

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

  // --- 2b. per-project skill roots (installer-hardening D2/D6) --------------
  // A fresh host onboard --apply materializes the full bee-* skill set under
  // BOTH <repo>/.claude/skills and <repo>/.agents/skills by default, never
  // touches ~/.claude/skills without --global-skills, and never gitignores
  // the committed trees (D4).
  const SOURCE_SKILLS_ROOT = path.join(REPO_ROOT, "skills");
  const sourceBeeSkills = fs.readdirSync(SOURCE_SKILLS_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith("bee-"))
    .map((e) => e.name)
    .sort();
  check(sourceBeeSkills.length === 15,
    "source tree carries the expected 15 bee-* skills", JSON.stringify(sourceBeeSkills));
  for (const relRoot of [".claude/skills", ".agents/skills"]) {
    const rootAbs = path.join(tmp, ...relRoot.split("/"));
    const installed = fs.existsSync(rootAbs)
      ? fs.readdirSync(rootAbs, { withFileTypes: true })
          .filter((e) => e.isDirectory() && e.name.startsWith("bee-"))
          .map((e) => e.name)
          .sort()
      : [];
    check(JSON.stringify(installed) === JSON.stringify(sourceBeeSkills),
      `fresh host apply materializes all 15 bee-* dirs under ${relRoot}`,
      JSON.stringify(installed));
  }
  const applyTargetKinds = (apply1.payload?.skills?.targets || []).map((t) => t.kind);
  check(JSON.stringify(applyTargetKinds) === JSON.stringify(["repo-claude", "repo-agents"]),
    "default apply reports exactly the two in-repo targets (no global without --global-skills)",
    JSON.stringify(applyTargetKinds));
  check(!fs.existsSync(path.join(tmpHome, ".claude", "skills")),
    "without --global-skills, ~/.claude/skills is never written");
  const gitignoreAfterApply = fs.readFileSync(path.join(tmp, ".gitignore"), "utf8");
  check(!gitignoreAfterApply.includes(".claude/skills") &&
    !gitignoreAfterApply.includes(".agents/skills"),
    "per-project skill trees are never gitignored (D4: committed to the host repo)",
    gitignoreAfterApply);

  // --- 3. verify AGENTS.md markers ------------------------------------------
  const agentsText = fs.existsSync(path.join(tmp, "AGENTS.md"))
    ? fs.readFileSync(path.join(tmp, "AGENTS.md"), "utf8")
    : "";
  check(agentsText.includes("<!-- BEE:START -->") && agentsText.includes("<!-- BEE:END -->"),
    "AGENTS.md contains BEE:START/END markers");
  check(agentsText.includes("node .bee/bin/bee.mjs status --json"), "AGENTS block mentions bee.mjs status first step");
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

  // --- 3b-drift. STALE_ADVISOR_KEY_WARNING text must not drift (P2, fanout-4
  // review fix) --- onboard_bee.mjs deliberately does NOT import lib/state.mjs
  // (see the comment at its own STALE_ADVISOR_KEY_WARNING definition) — pin the
  // two literal warning strings with a text-scan instead, same pattern as the
  // COMMAND_KEYS drift check just above.
  const warningRe = /STALE_ADVISOR_KEY_WARNING\s*=\s*['"]([^'"]+)['"]/;
  const stateWarning = stateSource.match(warningRe)?.[1] || "";
  const onboardWarning = onboardSource.match(warningRe)?.[1] || "";
  check(stateWarning.length > 0 && stateWarning === onboardWarning,
    "onboard_bee.mjs STALE_ADVISOR_KEY_WARNING text matches lib/state.mjs (no drift)",
    `state: "${stateWarning}" vs onboard: "${onboardWarning}"`);

  // --- 3b-advisor. a host fixture with a stale advisor key surfaces the
  // stale-key notice (P1, fanout-4 review fix); the notice disappears once the
  // key is removed --------------------------------------------------------
  const advisorTmp = fs.mkdtempSync(path.join(os.tmpdir(), "bee-advisor-notice-test-"));
  const advisorHome = makeFakeHome();
  try {
    const advisorApply = runOnboardAt(ONBOARD, ["--repo-root", advisorTmp, "--apply", "--json"], advisorHome);
    check(advisorApply.payload?.status === "applied", "apply on fresh advisor-notice fixture succeeds");
    const advisorCfgPath = path.join(advisorTmp, ".bee", "config.json");
    const advisorCfgRaw = JSON.parse(fs.readFileSync(advisorCfgPath, "utf8"));
    advisorCfgRaw.advisor = { enabled: true, at: ["execution"], model: "opus" };
    fs.writeFileSync(advisorCfgPath, `${JSON.stringify(advisorCfgRaw, null, 2)}\n`, "utf8");
    const advisorPlanNotice = runOnboardAt(ONBOARD, ["--repo-root", advisorTmp, "--json"], advisorHome);
    check(Array.isArray(advisorPlanNotice.payload?.notices) &&
      advisorPlanNotice.payload.notices.some((n) => n === stateWarning),
      "a host fixture whose config carries a stale advisor key surfaces the stale-key notice line",
      JSON.stringify(advisorPlanNotice.payload?.notices || null));
    delete advisorCfgRaw.advisor;
    fs.writeFileSync(advisorCfgPath, `${JSON.stringify(advisorCfgRaw, null, 2)}\n`, "utf8");
    const advisorCleanNotice = runOnboardAt(ONBOARD, ["--repo-root", advisorTmp, "--json"], advisorHome);
    check(!(advisorCleanNotice.payload?.notices || []).some((n) => n === stateWarning),
      "stale-advisor notice disappears once the key is removed from config.json",
      JSON.stringify(advisorCleanNotice.payload?.notices || null));
  } finally {
    try {
      fs.rmSync(advisorTmp, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }

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
    "bee-model-guard.mjs",
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

  // --- 9a. structural PreToolUse wiring (P1-4): parse, don't string-search ---
  // A wrong event, wrong matcher, or model-guard folded into the write-guard
  // entry must all turn this red; string containment (above) cannot tell.
  const preToolUse = Array.isArray(settings.hooks?.PreToolUse) ? settings.hooks.PreToolUse : [];
  const modelGuardEntries = preToolUse.filter((e) =>
    (e.hooks || []).some((h) => String(h.command || "").includes("bee-model-guard.mjs")));
  check(modelGuardEntries.length === 1 && modelGuardEntries[0].matcher === "Agent|Task",
    "exactly one PreToolUse entry wires bee-model-guard.mjs, matcher is exactly 'Agent|Task'",
    JSON.stringify(modelGuardEntries));

  const writeGuardEntries = preToolUse.filter((e) =>
    (e.hooks || []).some((h) => String(h.command || "").includes("bee-write-guard.mjs")));
  check(writeGuardEntries.length === 1 &&
    writeGuardEntries[0].matcher === "Edit|Write|MultiEdit|Bash|Read|Glob|Grep",
    "exactly one PreToolUse entry wires bee-write-guard.mjs, matcher is byte-identical to the write-guard matcher",
    JSON.stringify(writeGuardEntries));

  // model-guard must not be folded into any other event or entry anywhere in
  // the applied settings tree.
  const modelGuardSightings = [];
  for (const [eventName, entries] of Object.entries(settings.hooks || {})) {
    for (const entry of Array.isArray(entries) ? entries : []) {
      for (const hook of entry.hooks || []) {
        if (String(hook.command || "").includes("bee-model-guard.mjs")) {
          modelGuardSightings.push({ event: eventName, matcher: entry.matcher ?? null });
        }
      }
    }
  }
  check(modelGuardSightings.length === 1 &&
    modelGuardSightings[0].event === "PreToolUse" && modelGuardSightings[0].matcher === "Agent|Task",
    "bee-model-guard.mjs appears exactly once anywhere in settings.hooks: PreToolUse / Agent|Task",
    JSON.stringify(modelGuardSightings));

  // --- 9b. Claude plugin <-> repo parity: same (event, matcher, filename) ---
  // triples. hooks/claude-hooks.json (plugin, CLAUDE_PLUGIN_ROOT, wired by
  // .claude-plugin/plugin.json) and renderRepoHookEntries()'s applied output
  // (repo, CLAUDE_PROJECT_DIR) must expose an identical hook contract once
  // command roots are normalized away and statusMessage ignored. Since the
  // codex-parity-2 catalog inversion (commit d1777ed), hooks/hooks.json is
  // the CODEX default projection instead, so the Claude-settings parity
  // check compares against hooks/claude-hooks.json (codex-parity-2b).
  function hookFilenameFromCommand(command) {
    const m = String(command || "").match(/([A-Za-z0-9_.-]+\.mjs)/);
    return m ? m[1] : null;
  }
  function flattenHookTriples(hooksObj) {
    const triples = [];
    for (const [eventName, entries] of Object.entries(hooksObj || {})) {
      for (const entry of Array.isArray(entries) ? entries : []) {
        const matcher = entry.matcher ?? null;
        for (const hook of entry.hooks || []) {
          const filename = hookFilenameFromCommand(hook.command);
          if (filename) {
            triples.push(`${eventName}::${matcher}::${filename}`);
          }
        }
      }
    }
    return triples.sort();
  }
  const claudeHooksJsonPath = path.join(REPO_ROOT, "hooks", "claude-hooks.json");
  const claudeHooksJson = JSON.parse(fs.readFileSync(claudeHooksJsonPath, "utf8"));
  const claudeCatalogTriples = flattenHookTriples(claudeHooksJson.hooks);
  const repoTriples = flattenHookTriples(settings.hooks);
  check(claudeCatalogTriples.length > 0, "hooks/claude-hooks.json parsed at least one hook triple",
    JSON.stringify(claudeCatalogTriples));
  check(JSON.stringify(claudeCatalogTriples) === JSON.stringify(repoTriples),
    "hooks/claude-hooks.json and the applied repo settings expose identical (event, matcher, filename) triples",
    `claude-hooks.json: ${JSON.stringify(claudeCatalogTriples)}\nrepo:   ${JSON.stringify(repoTriples)}`);

  // --- 9b2. Codex <-> Claude projection parity via hooks/catalog.mjs -------
  // hooks/hooks.json (Codex default projection) and hooks/claude-hooks.json
  // (Claude projection) must differ ONLY by the differences hooks/catalog.mjs
  // declares as allowed (ALLOWED_DIFFERENCES export) — the boundary is
  // imported from the catalog, never re-hardcoded here, and this check must
  // never be dropped (codex-parity-2b; CONTEXT.md decisions D1/D2).
  const catalogModulePath = path.join(REPO_ROOT, "hooks", "catalog.mjs");
  const { ALLOWED_DIFFERENCES } = await import(pathToFileURL(catalogModulePath).href);
  const codexHooksJsonPath = path.join(REPO_ROOT, "hooks", "hooks.json");
  const codexHooksJson = JSON.parse(fs.readFileSync(codexHooksJsonPath, "utf8"));
  const codexProjectionTriples = flattenHookTriples(codexHooksJson.hooks);

  function tripleEvent(triple) {
    return triple.split("::")[0];
  }
  function tripleMatcher(triple) {
    const m = triple.split("::")[1];
    return m === "null" ? null : m;
  }
  function isAllowedDifference(triple) {
    return ALLOWED_DIFFERENCES.some((d) =>
      d.event === tripleEvent(triple) && (d.matcher ?? null) === tripleMatcher(triple));
  }

  const onlyInClaudeProjection = claudeCatalogTriples.filter((t) => !codexProjectionTriples.includes(t));
  const onlyInCodexProjection = codexProjectionTriples.filter((t) => !claudeCatalogTriples.includes(t));
  const allProjectionDiffs = [...onlyInClaudeProjection, ...onlyInCodexProjection];

  check(ALLOWED_DIFFERENCES.length > 0 &&
    allProjectionDiffs.length > 0 &&
    allProjectionDiffs.every(isAllowedDifference),
    "hooks/hooks.json (Codex) and hooks/claude-hooks.json (Claude) differ only by hooks/catalog.mjs ALLOWED_DIFFERENCES",
    JSON.stringify({ onlyInClaudeProjection, onlyInCodexProjection, ALLOWED_DIFFERENCES }));
  check(ALLOWED_DIFFERENCES.every((d) =>
    allProjectionDiffs.some((t) => tripleEvent(t) === d.event && tripleMatcher(t) === (d.matcher ?? null))),
    "every hooks/catalog.mjs ALLOWED_DIFFERENCES entry corresponds to an actual projection difference",
    JSON.stringify({ ALLOWED_DIFFERENCES, allProjectionDiffs }));

  // --- 9c. Codex repo projection (.codex/hooks.json) -------------------------
  // --repo-hooks must also wire the Codex side: without .codex/hooks.json a
  // Codex session in the host repo runs with NO bee guards (the gap that
  // motivated this projection). Structural checks, not string containment.
  const codexRepoPath = path.join(tmp, ".codex", "hooks.json");
  check(fs.existsSync(codexRepoPath), "--repo-hooks creates .codex/hooks.json");
  const codexRepo = JSON.parse(fs.readFileSync(codexRepoPath, "utf8"));
  const codexRepoText = JSON.stringify(codexRepo);
  check(!codexRepoText.includes("CLAUDE_PROJECT_DIR"),
    ".codex/hooks.json never uses $CLAUDE_PROJECT_DIR (Codex never sets it)");
  check(!codexRepoText.includes("bee-model-guard.mjs"),
    ".codex/hooks.json never wires bee-model-guard.mjs (Claude-only per catalog ALLOWED_DIFFERENCES)");
  let codexCommandCount = 0;
  let codexTransportOk = true;
  let codexStatusMessageOk = true;
  for (const entries of Object.values(codexRepo.hooks || {})) {
    for (const entry of Array.isArray(entries) ? entries : []) {
      for (const hook of entry.hooks || []) {
        codexCommandCount += 1;
        const cmd = String(hook.command || "");
        if (!cmd.startsWith('r="$(git rev-parse --show-toplevel 2>/dev/null)"') ||
            !cmd.includes("bee: hook transport unavailable (no git root)") ||
            !cmd.includes('exec node "$r"/.bee/bin/hooks/bee-') ||
            !cmd.includes("--source=repo")) {
          codexTransportOk = false;
        }
        if (typeof hook.statusMessage !== "string" || !hook.statusMessage.startsWith("bee:")) {
          codexStatusMessageOk = false;
        }
      }
    }
  }
  check(codexCommandCount === 9, ".codex/hooks.json wires exactly 9 hook commands",
    `count: ${codexCommandCount}`);
  check(codexTransportOk,
    "every .codex/hooks.json command uses the git-root transport with the pinned fail-open diagnostic");
  check(codexStatusMessageOk, "every .codex/hooks.json command carries a bee statusMessage");

  // Parity with the checked-in Codex plugin projection: identical
  // (event, matcher, filename) triples — only the command root differs.
  const codexRepoTriples = flattenHookTriples(codexRepo.hooks);
  check(JSON.stringify(codexRepoTriples) === JSON.stringify(codexProjectionTriples),
    ".codex/hooks.json and hooks/hooks.json (Codex plugin projection) expose identical triples",
    `repo:   ${JSON.stringify(codexRepoTriples)}\nplugin: ${JSON.stringify(codexProjectionTriples)}`);

  // Merge discipline: a user's non-bee Codex hook survives a re-apply, bee
  // entries do not duplicate, and the pre-existing file is backed up.
  const userCodexHook = {
    type: "command",
    command: "echo user-owned-codex-hook",
  };
  // Seed the user group AFTER the bee group: the merge normalizes to
  // [non-bee..., bee...], so this ordering forces changed=true and exercises
  // the rewrite + .bak path (user-before-bee is already canonical shape).
  const codexSeed = JSON.parse(fs.readFileSync(codexRepoPath, "utf8"));
  codexSeed.hooks.SessionStart = [
    ...codexSeed.hooks.SessionStart,
    { hooks: [userCodexHook] },
  ];
  // Stale bee wiring in historical transport shapes must be REPLACED, never
  // preserved beside the canonical render (a stale twin double-fires the
  // event): the bee source repo's own "$r"/hooks form, and the dead
  // hand-authored $CLAUDE_PROJECT_DIR form.
  codexSeed.hooks.Stop = [
    {
      hooks: [{
        type: "command",
        command: 'r="$(git rev-parse --show-toplevel 2>/dev/null)"\nexec node "$r"/hooks/bee-state-sync.mjs --source=repo',
      }],
    },
    ...(codexSeed.hooks.Stop || []),
  ];
  codexSeed.hooks.UserPromptSubmit = [
    { hooks: [{ type: "command", command: 'node "$CLAUDE_PROJECT_DIR"/.bee/bin/hooks/bee-prompt-context.mjs' }] },
    ...(codexSeed.hooks.UserPromptSubmit || []),
  ];
  fs.writeFileSync(codexRepoPath, `${JSON.stringify(codexSeed, null, 2)}\n`, "utf8");

  // --- 9d. state-layer skeletons (docs/specs) --------------------------------
  // The first apply (section 2) must have created both skeletons; a re-apply
  // must never touch an existing (user/scribing-owned) file.
  check(fs.existsSync(path.join(tmp, "docs", "specs", "reading-map.md")),
    "onboarding creates docs/specs/reading-map.md skeleton");
  check(fs.existsSync(path.join(tmp, "docs", "specs", "system-overview.md")),
    "onboarding creates docs/specs/system-overview.md skeleton");
  fs.writeFileSync(path.join(tmp, "docs", "specs", "reading-map.md"),
    "# My map\n\nscribing-owned content\n", "utf8");

  // --repo-hooks apply twice -> no duplicate bee entries.
  runOnboard(["--repo-root", tmp, "--apply", "--repo-hooks", "--json"], tmpHome);
  const settings2 = JSON.parse(
    fs.readFileSync(path.join(tmp, ".claude", "settings.json"), "utf8"));
  const initCount = JSON.stringify(settings2).split("bee-session-init.mjs").length - 1;
  check(initCount === 1, "no duplicate hook entries after second --repo-hooks apply",
    `count: ${initCount}`);
  const preToolUse2 = Array.isArray(settings2.hooks?.PreToolUse) ? settings2.hooks.PreToolUse : [];
  const agentTaskEntries2 = preToolUse2.filter((e) => e.matcher === "Agent|Task");
  check(agentTaskEntries2.length === 1,
    "exactly one PreToolUse Agent|Task entry survives a second --repo-hooks apply",
    `count: ${agentTaskEntries2.length}`);

  // Codex side of the second apply: user entry preserved, no bee duplicates,
  // .bak written, and the scribing-owned specs file untouched.
  const codexRepo2 = JSON.parse(fs.readFileSync(codexRepoPath, "utf8"));
  const codexText2 = JSON.stringify(codexRepo2);
  check(codexText2.includes("user-owned-codex-hook"),
    "non-bee .codex/hooks.json entry survives a second --repo-hooks apply");
  const codexInitCount = codexText2.split("bee-session-init.mjs").length - 1;
  check(codexInitCount === 1,
    "no duplicate bee entries in .codex/hooks.json after second apply",
    `count: ${codexInitCount}`);
  check(!codexText2.includes('"$r"/hooks/bee-'),
    'stale source-repo-shape ("$r"/hooks) bee entry replaced, not preserved');
  check(!codexText2.includes("CLAUDE_PROJECT_DIR"),
    "stale $CLAUDE_PROJECT_DIR-shape bee entry replaced, not preserved");
  const codexStateSyncCount = codexText2.split("bee-state-sync.mjs").length - 1;
  check(codexStateSyncCount === 3,
    "bee-state-sync.mjs appears exactly 3x (canonical PostToolUse/SubagentStop/Stop; seeded stale Stop twin dropped)",
    `count: ${codexStateSyncCount}`);

  // --- 9e. Codex user-config status line (machine-level, add-only) -----------
  // Uses its own temp repo + fake homes: the check targets ~/.codex/config.toml
  // via $HOME, which runOnboard already fakes per case.
  const cslTmp = fs.mkdtempSync(path.join(os.tmpdir(), "bee-codex-sl-"));
  try {
    // (a) Codex absent: no item, and apply never creates the file.
    const cslHomeA = makeFakeHome();
    const cslPlanA = runOnboard(["--repo-root", cslTmp, "--json"], cslHomeA);
    check(!(cslPlanA.payload?.plan || []).some((i) => i.action === "ensure_codex_statusline"),
      "no ~/.codex/config.toml -> no ensure_codex_statusline item");
    runOnboard(["--repo-root", cslTmp, "--apply", "--json"], cslHomeA);
    check(!fs.existsSync(path.join(cslHomeA, ".codex", "config.toml")),
      "onboarding never creates ~/.codex/config.toml when Codex is absent");

    // (b) config with [tui] but no status_line: spliced under the header,
    // everything else preserved, .bak written, recheck clean.
    const cslHomeB = makeFakeHome();
    fs.mkdirSync(path.join(cslHomeB, ".codex"), { recursive: true });
    fs.writeFileSync(path.join(cslHomeB, ".codex", "config.toml"),
      'model = "gpt-x"\n\n[tui]\ntheme = "dark"\n\n[projects."/x"]\ntrust_level = "trusted"\n',
      "utf8");
    const cslPlanB = runOnboard(["--repo-root", cslTmp, "--json"], cslHomeB);
    check((cslPlanB.payload?.plan || []).some((i) => i.action === "ensure_codex_statusline"),
      "config.toml without status_line -> ensure_codex_statusline planned");
    runOnboard(["--repo-root", cslTmp, "--apply", "--json"], cslHomeB);
    const cslCfgB = fs.readFileSync(path.join(cslHomeB, ".codex", "config.toml"), "utf8");
    check(/\[tui\]\nstatus_line = \["current-dir"/.test(cslCfgB),
      "status_line spliced directly under the existing [tui] header");
    check(cslCfgB.includes("status_line_use_colors = true"),
      "status_line_use_colors rides the same splice");
    check(cslCfgB.includes('theme = "dark"') && cslCfgB.includes('trust_level = "trusted"') &&
      cslCfgB.includes('model = "gpt-x"'),
      "existing config content preserved around the splice");
    check(fs.existsSync(path.join(cslHomeB, ".codex", "config.toml.bak")),
      "config.toml.bak written before the splice");
    const cslPlanB2 = runOnboard(["--repo-root", cslTmp, "--json"], cslHomeB);
    check(!(cslPlanB2.payload?.plan || []).some((i) => i.action === "ensure_codex_statusline"),
      "recheck after apply plans no further statusline item");

    // (c) config without a [tui] section (and no trailing newline): appended.
    const cslHomeC = makeFakeHome();
    fs.mkdirSync(path.join(cslHomeC, ".codex"), { recursive: true });
    fs.writeFileSync(path.join(cslHomeC, ".codex", "config.toml"), 'model = "gpt-x"', "utf8");
    runOnboard(["--repo-root", cslTmp, "--apply", "--json"], cslHomeC);
    const cslCfgC = fs.readFileSync(path.join(cslHomeC, ".codex", "config.toml"), "utf8");
    check(cslCfgC.startsWith('model = "gpt-x"') && /\n\[tui\]\nstatus_line = \[/.test(cslCfgC),
      "[tui] section appended when absent, even after a no-trailing-newline file");

    // (d) a present status_line — custom segments — is preference, not drift.
    const cslHomeD = makeFakeHome();
    fs.mkdirSync(path.join(cslHomeD, ".codex"), { recursive: true });
    const cslCustomCfg = '[tui]\nstatus_line = ["model"]\n';
    fs.writeFileSync(path.join(cslHomeD, ".codex", "config.toml"), cslCustomCfg, "utf8");
    const cslPlanD = runOnboard(["--repo-root", cslTmp, "--json"], cslHomeD);
    check(!(cslPlanD.payload?.plan || []).some((i) => i.action === "ensure_codex_statusline"),
      "custom status_line present -> no item planned");
    runOnboard(["--repo-root", cslTmp, "--apply", "--json"], cslHomeD);
    check(fs.readFileSync(path.join(cslHomeD, ".codex", "config.toml"), "utf8") === cslCustomCfg,
      "custom status_line left untouched byte-for-byte by apply");
  } finally {
    fs.rmSync(cslTmp, { recursive: true, force: true });
  }
  check(fs.existsSync(`${codexRepoPath}.bak`),
    ".codex/hooks.json.bak backup created when merging into an existing file");
  check(fs.readFileSync(path.join(tmp, "docs", "specs", "reading-map.md"), "utf8")
    .startsWith("# My map"),
    "existing docs/specs/reading-map.md is never overwritten by a re-apply");

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

  // --- 9b-default. CLAUDE.md is a default onboarding artifact (D1): no flag
  // needed -> fresh repo plans/creates it; existing CLAUDE.md without the
  // import gets the append; existing CLAUDE.md WITH the import is untouched.
  const cmDefaultTmp = fs.mkdtempSync(path.join(os.tmpdir(), "bee-claudemd-default-test-"));
  const cmDefaultHome = makeFakeHome();
  try {
    const defaultPlan = runOnboard(["--repo-root", cmDefaultTmp, "--json"], cmDefaultHome);
    const defaultPlanActions = (defaultPlan.payload?.plan || []).map((i) => i.action);
    check(defaultPlanActions.includes("create_claude_md"),
      "default (flag omitted): plan contains create_claude_md for a repo with no CLAUDE.md",
      JSON.stringify(defaultPlanActions));

    runOnboard(["--repo-root", cmDefaultTmp, "--apply", "--json"], cmDefaultHome);
    const defaultCreated = fs.readFileSync(path.join(cmDefaultTmp, "CLAUDE.md"), "utf8");
    check(defaultCreated.startsWith("# Project Rules"),
      "default: apply creates CLAUDE.md with header");
    check(/^@AGENTS\.md\s*$/m.test(defaultCreated),
      "default: created CLAUDE.md carries a bare @AGENTS.md import");

    // Existing CLAUDE.md WITH the import already -> no CLAUDE.md plan item.
    const withImportPlan = runOnboard(["--repo-root", cmDefaultTmp, "--json"], cmDefaultHome);
    const withImportActions = (withImportPlan.payload?.plan || []).map((i) => i.action);
    check(!withImportActions.includes("create_claude_md") &&
      !withImportActions.includes("append_claude_md_import"),
      "default: existing CLAUDE.md with the @AGENTS.md import produces no CLAUDE.md plan item",
      JSON.stringify(withImportActions));

    // Existing CLAUDE.md WITHOUT the import -> append_claude_md_import.
    fs.writeFileSync(path.join(cmDefaultTmp, "CLAUDE.md"), "# House rules\n\nDo Y.\n", "utf8");
    const noImportPlan = runOnboard(["--repo-root", cmDefaultTmp, "--json"], cmDefaultHome);
    const noImportActions = (noImportPlan.payload?.plan || []).map((i) => i.action);
    check(noImportActions.includes("append_claude_md_import"),
      "default: existing CLAUDE.md without the @AGENTS.md import plans append_claude_md_import",
      JSON.stringify(noImportActions));
    runOnboard(["--repo-root", cmDefaultTmp, "--apply", "--json"], cmDefaultHome);
    const defaultAppended = fs.readFileSync(path.join(cmDefaultTmp, "CLAUDE.md"), "utf8");
    check(defaultAppended.startsWith("# House rules"),
      "default: append preserves existing CLAUDE.md content");
    check(/^@AGENTS\.md\s*$/m.test(defaultAppended),
      "default: append adds the @AGENTS.md import");
  } finally {
    try {
      fs.rmSync(cmDefaultTmp, { recursive: true, force: true });
      fs.rmSync(cmDefaultHome, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }

  // --- 9b-no-claude-md. --no-claude-md suppresses every CLAUDE.md plan item --
  const cmOptOutTmp = fs.mkdtempSync(path.join(os.tmpdir(), "bee-claudemd-optout-test-"));
  const cmOptOutHome = makeFakeHome();
  try {
    const optOutPlan = runOnboard(["--repo-root", cmOptOutTmp, "--no-claude-md", "--json"], cmOptOutHome);
    const optOutActions = (optOutPlan.payload?.plan || []).map((i) => i.action);
    check(!optOutActions.includes("create_claude_md") &&
      !optOutActions.includes("append_claude_md_import"),
      "--no-claude-md: plan carries no CLAUDE.md items for a fresh repo",
      JSON.stringify(optOutActions));
    runOnboard(["--repo-root", cmOptOutTmp, "--apply", "--no-claude-md", "--json"], cmOptOutHome);
    check(!fs.existsSync(path.join(cmOptOutTmp, "CLAUDE.md")),
      "--no-claude-md: apply never creates CLAUDE.md");
  } finally {
    try {
      fs.rmSync(cmOptOutTmp, { recursive: true, force: true });
      fs.rmSync(cmOptOutHome, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }

  // --- 9c. statusline opt-in vendor -----------------------------------------
  // The pair templates/statusline/{statusline-command.sh,statusline-usage.mjs}
  // is synced ONLY into repos whose .claude/settings.json already points
  // statusLine at .claude/statusline-command.sh. Onboarding never creates the
  // opt-in and never mutates settings.json in this stage.
  const SL_NAMES = ["statusline-command.sh", "statusline-usage.mjs"];
  const SL_TEMPLATES_DIR = path.join(TEMPLATES_DIR, "statusline");

  // opted-in repo: settings entry present BEFORE first onboard
  const slTmp = fs.mkdtempSync(path.join(os.tmpdir(), "bee-statusline-test-"));
  const slHome = makeFakeHome();
  try {
    fs.mkdirSync(path.join(slTmp, ".claude"), { recursive: true });
    const slSettingsPath = path.join(slTmp, ".claude", "settings.json");
    const slSettingsText = `${JSON.stringify({
      statusLine: {
        type: "command",
        command: 'bash "${CLAUDE_PROJECT_DIR:-.}/.claude/statusline-command.sh"',
      },
      permissions: { allow: ["Bash(ls:*)"] },
    }, null, 2)}\n`;
    fs.writeFileSync(slSettingsPath, slSettingsText, "utf8");

    const slPlan = runOnboard(["--repo-root", slTmp, "--json"], slHome);
    const slPlanItems = (slPlan.payload?.plan || []).filter((i) => i.action === "copy_statusline");
    check(slPlanItems.length === SL_NAMES.length &&
      SL_NAMES.every((n) => slPlanItems.some((i) => i.path === `.claude/${n}`)),
      "opted-in repo: plan carries one copy_statusline item per missing pair file",
      JSON.stringify(slPlanItems));

    const slApply = runOnboard(["--repo-root", slTmp, "--apply", "--json"], slHome);
    check(slApply.payload?.status === "applied", "opted-in apply succeeds");
    check(slApply.payload?.recheck === "up_to_date", "opted-in recheck up_to_date",
      JSON.stringify(slApply.payload?.recheck_plan || []));
    for (const n of SL_NAMES) {
      const vendoredPath = path.join(slTmp, ".claude", n);
      const vendored = fs.existsSync(vendoredPath) ? fs.readFileSync(vendoredPath, "utf8") : null;
      const template = fs.readFileSync(path.join(SL_TEMPLATES_DIR, n), "utf8");
      check(vendored === template, `.claude/${n} vendored byte-identical to template`);
    }
    check(fs.readFileSync(slSettingsPath, "utf8") === slSettingsText,
      "settings.json byte-untouched by the statusline stage");
    check(!fs.existsSync(`${slSettingsPath}.bak`),
      "no settings.json.bak from the statusline stage");
    const slOnboarding = JSON.parse(
      fs.readFileSync(path.join(slTmp, ".bee", "onboarding.json"), "utf8"));
    check(SL_NAMES.every((n) => typeof slOnboarding.managed?.statusline?.[n] === "string"),
      "onboarding.json managed.statusline records a hash per pair file",
      JSON.stringify(slOnboarding.managed?.statusline || null));

    // drift exactly one file -> exactly one item, apply heals, recheck clean
    fs.appendFileSync(path.join(slTmp, ".claude", "statusline-command.sh"), "# local drift\n");
    const slDriftPlan = runOnboard(["--repo-root", slTmp, "--json"], slHome);
    const slDriftItems = (slDriftPlan.payload?.plan || []).filter((i) => i.action === "copy_statusline");
    check(slDriftItems.length === 1 && slDriftItems[0].path === ".claude/statusline-command.sh",
      "drifted pair file: exactly the drifted file is re-planned",
      JSON.stringify(slDriftItems));
    const slHeal = runOnboard(["--repo-root", slTmp, "--apply", "--json"], slHome);
    check(slHeal.payload?.recheck === "up_to_date", "drift healed: recheck up_to_date");
  } finally {
    try {
      fs.rmSync(slTmp, { recursive: true, force: true });
      fs.rmSync(slHome, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }

  // non-opted variants: user-level statusLine path, unparseable settings,
  // non-string command. None throws, none plans or writes the pair, and the
  // managed manifest never grows a statusline key.
  const slCases = [
    ["statusline points at the user-level script", JSON.stringify({
      statusLine: { type: "command", command: "bash /home/someone/.claude/statusline-command.sh" },
    })],
    ["settings.json is unparseable", "{ not json"],
    ["statusLine.command is not a string", JSON.stringify({ statusLine: { command: 42 } })],
    // review P2-1: CLAUDE_PROJECT_DIR appearing anywhere must not opt in when
    // the script path itself is user-level.
    ["CLAUDE_PROJECT_DIR present but the script path is user-level", JSON.stringify({
      statusLine: {
        type: "command",
        command: 'test -n "$CLAUDE_PROJECT_DIR" && bash ~/.claude/statusline-command.sh',
      },
    })],
  ];
  for (const [why, settingsText] of slCases) {
    const noTmp = fs.mkdtempSync(path.join(os.tmpdir(), "bee-statusline-no-"));
    const noHome = makeFakeHome();
    try {
      fs.mkdirSync(path.join(noTmp, ".claude"), { recursive: true });
      fs.writeFileSync(path.join(noTmp, ".claude", "settings.json"), settingsText, "utf8");
      const noApply = runOnboard(["--repo-root", noTmp, "--apply", "--json"], noHome);
      check(noApply.payload?.status === "applied" &&
        !(noApply.payload?.applied || []).some((i) => i.action === "copy_statusline"),
        `non-opted (${why}): apply succeeds with zero copy_statusline items`,
        JSON.stringify((noApply.payload?.applied || []).map((i) => i.action)));
      check(SL_NAMES.every((n) => !fs.existsSync(path.join(noTmp, ".claude", n))),
        `non-opted (${why}): no pair file created`);
      const noOnboarding = JSON.parse(
        fs.readFileSync(path.join(noTmp, ".bee", "onboarding.json"), "utf8"));
      check(!("statusline" in (noOnboarding.managed || {})),
        `non-opted (${why}): managed manifest carries no statusline key`);
      const noRecheck = runOnboard(["--repo-root", noTmp, "--json"], noHome);
      check(noRecheck.payload?.status === "up_to_date",
        `non-opted (${why}): recheck up_to_date`);
    } finally {
      try {
        fs.rmSync(noTmp, { recursive: true, force: true });
        fs.rmSync(noHome, { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
    }
  }

  // --- 9d. .gitignore managed block (D1, footprint-1) -------------------------
  // Mirrors the AGENTS.md marker-splice idiom (section 7 above) but with
  // '#'-comment markers and a fixed D1 pattern list. Fresh repo -> create;
  // idempotent re-apply; onboarding.json carries a gitignore_block hash;
  // tampered block detected + restored, user content preserved byte-for-byte.
  const giTmp = fs.mkdtempSync(path.join(os.tmpdir(), "bee-gitignore-test-"));
  const giHome = makeFakeHome();
  try {
    const giPlan1 = runOnboard(["--repo-root", giTmp, "--json"], giHome);
    const giPlan1Actions = (giPlan1.payload?.plan || []).map((i) => i.action);
    check(giPlan1Actions.includes("create_gitignore_block"),
      "fresh repo plans create_gitignore_block", JSON.stringify(giPlan1Actions));
    check(!fs.existsSync(path.join(giTmp, ".gitignore")), "plan mode writes no .gitignore");

    const giApply1 = runOnboard(["--repo-root", giTmp, "--apply", "--json"], giHome);
    check(giApply1.payload?.status === "applied", "apply on fresh repo succeeds");
    check(giApply1.payload?.recheck === "up_to_date", "fresh apply recheck up_to_date",
      JSON.stringify(giApply1.payload?.recheck_plan || []));

    const giText1 = fs.readFileSync(path.join(giTmp, ".gitignore"), "utf8");
    check(giText1.includes("# BEE:START") && giText1.includes("# BEE:END"),
      ".gitignore contains # BEE:START / # BEE:END markers (gitignore-comment syntax)");
    check(!giText1.includes("<!--"), ".gitignore markers are never HTML comments");
    for (const pattern of [
      ".bee/state.json",
      ".bee/reservations.json",
      ".bee/workers/",
      ".bee/logs/",
      ".bee/capture-queue.jsonl",
      ".bee/feedback-digest.json",
      ".bee/.inject-cache.json",
      ".bee/HANDOFF.json",
      ".bee/spikes/",
    ]) {
      check(giText1.includes(pattern), `.gitignore block includes ${pattern}`);
    }
    for (const teamDurable of [
      ".bee/bin",
      ".bee/config.json",
      ".bee/config-sample.json",
      ".bee/onboarding.json",
      ".bee/decisions.jsonl",
      ".bee/backlog.jsonl",
      ".bee/cells",
    ]) {
      check(!giText1.includes(teamDurable),
        `.gitignore block never ignores team-durable path ${teamDurable}`);
    }

    const giApply2 = runOnboard(["--repo-root", giTmp, "--apply", "--json"], giHome);
    const giText2 = fs.readFileSync(path.join(giTmp, ".gitignore"), "utf8");
    check(giText2 === giText1, "second apply on a clean .gitignore is byte-identical (idempotent)");
    check(giApply2.payload?.recheck === "up_to_date", "second apply recheck up_to_date");

    const giOnboarding = JSON.parse(
      fs.readFileSync(path.join(giTmp, ".bee", "onboarding.json"), "utf8"));
    check(typeof giOnboarding.managed?.gitignore_block === "string" &&
      giOnboarding.managed.gitignore_block.length === 64,
      "onboarding.json managed.gitignore_block records a sha256 hex hash",
      JSON.stringify(giOnboarding.managed?.gitignore_block || null));
    check(giOnboarding.managed?.gitignore_block !== giOnboarding.managed?.agents_block,
      "gitignore_block hash is distinct from agents_block (computed from its own template content)");

    // tamper the block body -> detected + restored, user content preserved.
    // The footer carries EXTRA trailing blank lines on purpose (review P2:
    // the old `${updated.replace(/\s*$/, "")}\n` normalized the whole file's
    // trailing whitespace, which would silently eat these) -- exact equality
    // below catches that regression, not just substring presence.
    const giUserHeader = "node_modules/\ndist/\n";
    const giUserFooter = "\n*.local\n\n\n";
    const giTampered = giText1.replace(
      /# BEE:START[\s\S]*?# BEE:END/,
      "# BEE:START\nTAMPERED\n# BEE:END",
    );
    fs.writeFileSync(path.join(giTmp, ".gitignore"), giUserHeader + giTampered + giUserFooter, "utf8");

    const giPlan3 = runOnboard(["--repo-root", giTmp, "--json"], giHome);
    check(giPlan3.payload?.status === "changes_needed",
      "tampered gitignore block detected as changes_needed");
    check((giPlan3.payload?.plan || []).some((i) => i.action === "update_gitignore_block"),
      "plan includes update_gitignore_block", JSON.stringify(giPlan3.payload?.plan || []));

    const giApply3 = runOnboard(["--repo-root", giTmp, "--apply", "--json"], giHome);
    check(giApply3.payload?.status === "applied", "re-apply after gitignore tamper succeeds");
    const giRestored = fs.readFileSync(path.join(giTmp, ".gitignore"), "utf8");
    const giExpectedRestored = giUserHeader + giText1 + giUserFooter;
    check(giRestored === giExpectedRestored,
      "user header AND footer bytes preserved EXACTLY (full equality, not substring) around the restored block -- includes extra trailing blank lines the old whole-file trim would have eaten",
      JSON.stringify({ giRestored, giExpectedRestored }));
    check(!giRestored.includes("TAMPERED"), "tampered gitignore block content restored");
    check(giRestored.indexOf("# BEE:START") === giRestored.lastIndexOf("# BEE:START"),
      "exactly one gitignore BEE block after re-apply");

    const giApply4 = runOnboard(["--repo-root", giTmp, "--apply", "--json"], giHome);
    const giAfterFourth = fs.readFileSync(path.join(giTmp, ".gitignore"), "utf8");
    check(giAfterFourth === giRestored, "next apply after restore is byte-identical (idempotent)");
    check(giApply4.payload?.recheck === "up_to_date", "post-restore recheck up_to_date");
  } finally {
    try {
      fs.rmSync(giTmp, { recursive: true, force: true });
      fs.rmSync(giHome, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }

  // --- 9e. .gitignore append case: pre-existing file WITHOUT markers and
  // WITHOUT a trailing newline - the exact corrupt-merge bug class this
  // feature fixes (D1/D3 origin: `.bee/feedback-digest.json.spikes/` merged
  // onto one line because no separator was ever inserted). -------------------
  const giAppendTmp = fs.mkdtempSync(path.join(os.tmpdir(), "bee-gitignore-append-"));
  const giAppendHome = makeFakeHome();
  try {
    fs.writeFileSync(path.join(giAppendTmp, ".gitignore"), "node_modules/\ndist/", "utf8"); // no trailing \n
    const giAppendPlan = runOnboard(["--repo-root", giAppendTmp, "--json"], giAppendHome);
    check((giAppendPlan.payload?.plan || []).some((i) => i.action === "append_gitignore_block"),
      ".gitignore without markers plans append_gitignore_block",
      JSON.stringify(giAppendPlan.payload?.plan || []));

    runOnboard(["--repo-root", giAppendTmp, "--apply", "--json"], giAppendHome);
    const giAppended = fs.readFileSync(path.join(giAppendTmp, ".gitignore"), "utf8");
    check(giAppended.includes("node_modules/\ndist/"),
      "pre-existing lines survive untouched", JSON.stringify(giAppended));
    check(!giAppended.includes("dist/#") && !giAppended.includes("dist/.bee"),
      "no trailing-newline corruption: dist/ never merges onto one line with the appended block",
      JSON.stringify(giAppended));
    check(giAppended.includes("# BEE:START") && giAppended.includes("# BEE:END"),
      "appended .gitignore contains the BEE markers");

    const giAppendRecheck = runOnboard(["--repo-root", giAppendTmp, "--json"], giAppendHome);
    check(giAppendRecheck.payload?.status === "up_to_date", "appended gitignore recheck up_to_date");
  } finally {
    try {
      fs.rmSync(giAppendTmp, { recursive: true, force: true });
      fs.rmSync(giAppendHome, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }

  // --- 9f. gitignore review fixes (footprint-4): hash tie, marker-lookalike,
  // CRLF drift, and the tracked-paths advisory --------------------------------

  function runGit(cwd, args) {
    return spawnSync("git", args, { cwd, encoding: "utf8" });
  }
  const gitAvailable = spawnSync("git", ["--version"]).status === 0;

  // (i) managed.gitignore_block ties to an INDEPENDENTLY reconstructed sha256
  // of the rendered block source, not just "any 64-char hex string" (review
  // P3 test-coverage).
  const GITIGNORE_PATTERNS_FOR_HASH = [
    ".bee/state.json",
    ".bee/reservations.json",
    ".bee/workers/",
    ".bee/logs/",
    ".bee/capture-queue.jsonl",
    ".bee/feedback-digest.json",
    ".bee/.inject-cache.json",
    ".bee/HANDOFF.json",
    ".bee/spikes/",
    ".bee/manifest-hash.json",
  ];
  const expectedGitignoreBlockSource =
    `# BEE:START\n${GITIGNORE_PATTERNS_FOR_HASH.join("\n")}\n# BEE:END\n`;
  const expectedGitignoreHash = crypto
    .createHash("sha256")
    .update(expectedGitignoreBlockSource)
    .digest("hex");

  const hashTieTmp = fs.mkdtempSync(path.join(os.tmpdir(), "bee-gitignore-hash-"));
  const hashTieHome = makeFakeHome();
  try {
    runOnboard(["--repo-root", hashTieTmp, "--apply", "--json"], hashTieHome);
    const hashTieOnboarding = JSON.parse(
      fs.readFileSync(path.join(hashTieTmp, ".bee", "onboarding.json"), "utf8"));
    check(hashTieOnboarding.managed?.gitignore_block === expectedGitignoreHash,
      "managed.gitignore_block ties to an independently-reconstructed sha256 of the true rendered block source",
      `${hashTieOnboarding.managed?.gitignore_block} !== ${expectedGitignoreHash}`);
  } finally {
    try {
      fs.rmSync(hashTieTmp, { recursive: true, force: true });
      fs.rmSync(hashTieHome, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }

  // (ii) marker-lookalike: a line containing the marker text as a substring
  // (trailing prose after START) must never be adopted as the managed block
  // -> treated as absent -> append (never update), and the user's original
  // lines are never deleted (review P2/P3 security-anchor).
  const lookalikeTmp = fs.mkdtempSync(path.join(os.tmpdir(), "bee-gitignore-lookalike-"));
  const lookalikeHome = makeFakeHome();
  try {
    const lookalikeContent = "# BEE:START custom notes\nkeep-me/\n# BEE:END\n";
    fs.writeFileSync(path.join(lookalikeTmp, ".gitignore"), lookalikeContent, "utf8");

    const lookalikePlan = runOnboard(["--repo-root", lookalikeTmp, "--json"], lookalikeHome);
    const lookalikeActions = (lookalikePlan.payload?.plan || []).map((i) => i.action);
    check(lookalikeActions.includes("append_gitignore_block"),
      "marker-lookalike (trailing prose after START) reads as absent -> append",
      JSON.stringify(lookalikeActions));
    check(!lookalikeActions.includes("update_gitignore_block"),
      "marker-lookalike is never mistaken for an already-present block to update",
      JSON.stringify(lookalikeActions));

    runOnboard(["--repo-root", lookalikeTmp, "--apply", "--json"], lookalikeHome);
    const lookalikeApplied = fs.readFileSync(path.join(lookalikeTmp, ".gitignore"), "utf8");
    check(lookalikeApplied.includes("# BEE:START custom notes"),
      "the fake marker-lookalike line is never deleted", JSON.stringify(lookalikeApplied));
    check(lookalikeApplied.includes("keep-me/"),
      "user content under the fake marker-lookalike is never deleted", JSON.stringify(lookalikeApplied));
    check(lookalikeApplied.includes("\n# BEE:START\n") && lookalikeApplied.includes("\n# BEE:END\n"),
      "a real managed block is appended alongside the untouched fake one",
      JSON.stringify(lookalikeApplied));
  } finally {
    try {
      fs.rmSync(lookalikeTmp, { recursive: true, force: true });
      fs.rmSync(lookalikeHome, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }

  // (iii) CRLF-saved block reads up_to_date: a CRLF-normalized (content-
  // identical) block must never cause a perpetual update_gitignore_block loop
  // (review P3 CRLF). Writes still stay LF -- this only relaxes the compare.
  const crlfTmp = fs.mkdtempSync(path.join(os.tmpdir(), "bee-gitignore-crlf-"));
  const crlfHome = makeFakeHome();
  try {
    runOnboard(["--repo-root", crlfTmp, "--apply", "--json"], crlfHome);
    const crlfOriginal = fs.readFileSync(path.join(crlfTmp, ".gitignore"), "utf8");
    fs.writeFileSync(path.join(crlfTmp, ".gitignore"), crlfOriginal.replace(/\n/g, "\r\n"), "utf8");

    const crlfPlan = runOnboard(["--repo-root", crlfTmp, "--json"], crlfHome);
    check(crlfPlan.payload?.status === "up_to_date",
      "a CRLF-saved (content-identical) gitignore block reads up_to_date, no perpetual update loop",
      JSON.stringify(crlfPlan.payload?.plan || []));
  } finally {
    try {
      fs.rmSync(crlfTmp, { recursive: true, force: true });
      fs.rmSync(crlfHome, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }

  // (iv) tracked-paths advisory: a git repo with a tracked managed path emits
  // the notice with the exact untrack command, in both plan mode and the
  // post-apply recheck; the advisory never actually runs git rm itself
  // (review P2 code-quality).
  if (gitAvailable) {
    const trackedTmp = fs.mkdtempSync(path.join(os.tmpdir(), "bee-gitignore-tracked-"));
    const trackedHome = makeFakeHome();
    try {
      runGit(trackedTmp, ["init", "-q"]);
      fs.mkdirSync(path.join(trackedTmp, ".bee"), { recursive: true });
      fs.writeFileSync(path.join(trackedTmp, ".bee", "state.json"), "{}\n", "utf8");
      const addResult = runGit(trackedTmp, ["add", ".bee/state.json"]);
      check(addResult.status === 0, "git add .bee/state.json succeeds in the fixture repo",
        addResult.stderr);

      const trackedPlan = runOnboard(["--repo-root", trackedTmp, "--json"], trackedHome);
      const trackedNotices = trackedPlan.payload?.notices || [];
      check(
        trackedNotices.some(
          (n) => n.includes("git-tracked") && n.includes(".bee/state.json") &&
            n.includes("git rm -r --cached"),
        ),
        "plan mode notices carry the tracked-paths advisory with the exact untrack command",
        JSON.stringify(trackedNotices),
      );

      const trackedApply = runOnboard(["--repo-root", trackedTmp, "--apply", "--json"], trackedHome);
      const trackedApplyNotices = trackedApply.payload?.notices || [];
      check(trackedApplyNotices.some((n) => n.includes("git-tracked")),
        "post-apply recheck notices also carry the tracked-paths advisory (the ignore block alone can't silence an already-tracked file)",
        JSON.stringify(trackedApplyNotices));

      const stillTracked = runGit(trackedTmp, ["show", ":.bee/state.json"]);
      check(stillTracked.status === 0,
        "the advisory never actually ran git rm -- the file is still tracked in the index",
        JSON.stringify(stillTracked));
    } finally {
      try {
        fs.rmSync(trackedTmp, { recursive: true, force: true });
        fs.rmSync(trackedHome, { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
    }
  } else {
    skip("tracked-paths advisory (git repo fixture)", "git binary not available");
  }

  // non-git dir -> no notice, no crash (graceful degradation).
  const nonGitTmp = fs.mkdtempSync(path.join(os.tmpdir(), "bee-gitignore-nongit-"));
  const nonGitHome = makeFakeHome();
  try {
    const nonGitPlan = runOnboard(["--repo-root", nonGitTmp, "--json"], nonGitHome);
    check(nonGitPlan.status === 0, "non-git repo root: onboard never crashes", nonGitPlan.stderr);
    check(!(nonGitPlan.payload?.notices || []).some((n) => n.includes("git-tracked")),
      "non-git repo root: no tracked-paths notice is ever emitted",
      JSON.stringify(nonGitPlan.payload?.notices || []));
  } finally {
    try {
      fs.rmSync(nonGitTmp, { recursive: true, force: true });
      fs.rmSync(nonGitHome, { recursive: true, force: true });
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

// --- per-target helpers (installer-hardening) --------------------------------
const REPO_TARGET_ROOTS = [".claude/skills", ".agents/skills"];

function readRepoTarget(repo, relRoot, rel) {
  const abs = path.join(repo, ...relRoot.split("/"), ...rel.split("/"));
  return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : null;
}

// Seed the two managed in-repo targets with a version-marked bee-hive so a
// per-target downgrade refusal resolves all three versions numeric (forceable)
// - without this, a fresh in-repo target reads installed_skills "absent" and a
// host_helpers-driven downgrade refusal is never forceable for that target.
function seedRepoSkillTargets(repo, version) {
  for (const relRoot of REPO_TARGET_ROOTS) {
    writeSkillFiles(path.join(repo, ...relRoot.split("/")), "bee-hive", {
      "SKILL.md": "# installed hive\n",
      "templates/lib/state.mjs": fakeStateSource(version),
    });
  }
}

function skillTarget(payload, kind) {
  return (payload?.skills?.targets || []).find((t) => t.kind === kind) || null;
}

function flatSkillItems(payload) {
  return (payload?.skills?.targets || []).flatMap((t) => t.items || []);
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

// --- 10a. fresh install: absent targets -> full per-target sync, no refusal --
// Default targets are the two in-repo roots; ~/.claude/skills participates
// only under --global-skills and is otherwise never written (D2/D3).
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
    for (const kind of ["repo-claude", "repo-agents"]) {
      const syncSkills = (plan.payload?.plan || [])
        .filter((i) => i.action === "sync_skill" && i.target === kind)
        .map((i) => i.skill).sort();
      check(JSON.stringify(syncSkills) === JSON.stringify(["bee-alpha", "bee-beta", "bee-hive"]),
        `fresh install: plan lists sync_skill for every source bee-* skill on ${kind}`,
        JSON.stringify(syncSkills));
    }
    check(!(plan.payload?.plan || []).some((i) => i.target === "global"),
      "fresh install: no global-target item without --global-skills");
    check(!fs.existsSync(path.join(home, ".claude")),
      "fresh install: plan mode writes nothing to the fake home");
    const apply = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--json"], home);
    check(apply.status === 0 && apply.payload?.status === "applied",
      "fresh install: absent targets proceed as fresh install, no refusal (D3)",
      `exit ${apply.status} status ${apply.payload?.status}`);
    check(apply.payload?.recheck === "up_to_date",
      "fresh install: recheck lands up_to_date on content-hash parity (D5)",
      JSON.stringify(apply.payload?.recheck_plan || []));
    for (const relRoot of REPO_TARGET_ROOTS) {
      check(readRepoTarget(repo, relRoot, "bee-alpha/SKILL.md") === "# alpha v1\n",
        `fresh install: bee-alpha synced byte-exact into ${relRoot}`);
      check(readRepoTarget(repo, relRoot, "bee-beta/references/notes.md") === "beta notes\n",
        `fresh install: nested skill files synced into ${relRoot}`);
    }
    check(!fs.existsSync(path.join(home, ".claude")),
      "fresh install: apply without --global-skills never writes ~/.claude/skills");

    // --global-skills adds the legacy global target (D3): repo targets are
    // already in parity, so the remaining drift is exactly the global root.
    const gPlan = runOnboardAt(launcher, ["--repo-root", repo, "--global-skills", "--json"], home);
    const gItems = (gPlan.payload?.plan || []).filter((i) => i.action === "sync_skill");
    check(gItems.length > 0 && gItems.every((i) => i.target === "global"),
      "--global-skills: remaining sync_skill items all target the global root",
      JSON.stringify(gItems));
    const gApply = runOnboardAt(launcher,
      ["--repo-root", repo, "--apply", "--global-skills", "--json"], home);
    check(gApply.status === 0 && gApply.payload?.status === "applied" &&
      gApply.payload?.recheck === "up_to_date",
      "--global-skills: apply syncs the fake home global root",
      `exit ${gApply.status} status ${gApply.payload?.status}`);
    check(readInstalled(home, "bee-alpha/SKILL.md") === "# alpha v1\n" &&
      readInstalled(home, "bee-beta/references/notes.md") === "beta notes\n",
      "--global-skills: global root synced byte-exact (old behavior restored)");
  } finally {
    try {
      fs.rmSync(base, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}

// --- 10a2. drift in ONE in-repo root -> sync_skill for that root only --------
{
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "bee-skillsync-onedrift-"));
  const home = makeFakeHome();
  try {
    const { launcher } = makeFakeSkillsRoot(path.join(base, "skills"), {
      skills: { "bee-alpha": { "SKILL.md": "# alpha v1\n" } },
    });
    const repo = path.join(base, "repo");
    fs.mkdirSync(repo, { recursive: true });
    // A host repo that merely contains its own skills/ dir never trips the
    // self-onboard skip: onboarding runs from an external source.
    fs.mkdirSync(path.join(repo, "skills", "bee-decoy"), { recursive: true });
    fs.writeFileSync(path.join(repo, "skills", "bee-decoy", "SKILL.md"), "# decoy\n", "utf8");
    runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--json"], home);
    const clean = runOnboardAt(launcher, ["--repo-root", repo, "--json"], home);
    check(clean.payload?.status === "up_to_date",
      "one-root drift: immediate re-run reports up_to_date (repo skills/ dir never trips self-skip)",
      JSON.stringify(clean.payload?.plan || []));
    fs.writeFileSync(
      path.join(repo, ".agents", "skills", "bee-alpha", "SKILL.md"), "# drifted\n", "utf8");
    const plan = runOnboardAt(launcher, ["--repo-root", repo, "--json"], home);
    const driftItems = (plan.payload?.plan || []).filter((i) => i.action === "sync_skill");
    check(plan.payload?.status === "changes_needed" &&
      driftItems.length === 1 && driftItems[0].skill === "bee-alpha" &&
      driftItems[0].target === "repo-agents",
      "drift planted in ONE root yields sync_skill for exactly that root",
      JSON.stringify(driftItems));
    const heal = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--json"], home);
    check(heal.payload?.status === "applied" && heal.payload?.recheck === "up_to_date",
      "one-root drift: apply heals it, recheck up_to_date");
    check(readRepoTarget(repo, ".agents/skills", "bee-alpha/SKILL.md") === "# alpha v1\n",
      "one-root drift: drifted file mirrored back to source bytes");
  } finally {
    try {
      fs.rmSync(base, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}

// --- 10a3. self-onboard: repo contains the running source -> per-project skip -
// beegog onboarding itself must never copy skills into its own .claude/skills
// or .agents/skills; the skip is a distinct noop, never an error, and global
// sync stays available under --global-skills.
{
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "bee-skillsync-selfonboard-"));
  const home = makeFakeHome();
  try {
    const repo = path.join(base, "repo");
    const { launcher } = makeFakeSkillsRoot(path.join(repo, "skills"), {
      skills: { "bee-alpha": { "SKILL.md": "# alpha self\n" } },
    });
    const apply = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--json"], home);
    check(apply.status === 0 && apply.payload?.status === "applied",
      "self-onboard: apply succeeds (skip is a noop, not an error)",
      `exit ${apply.status} status ${apply.payload?.status}`);
    for (const kind of ["repo-claude", "repo-agents"]) {
      check(skillTarget(apply.payload, kind)?.mode === "self_skip",
        `self-onboard: ${kind} target reports the distinct self_skip mode`,
        JSON.stringify(skillTarget(apply.payload, kind)));
    }
    for (const relRoot of REPO_TARGET_ROOTS) {
      check(readRepoTarget(repo, relRoot, "bee-alpha/SKILL.md") === null &&
        readRepoTarget(repo, relRoot, "bee-hive/SKILL.md") === null,
        `self-onboard: never copies skills into its own ${relRoot}`);
    }
    check(apply.payload?.recheck === "up_to_date",
      "self-onboard: recheck up_to_date (skipped targets carry no drift)",
      JSON.stringify(apply.payload?.recheck_plan || []));
    // Global sync behavior is unchanged there: --global-skills still syncs.
    const gApply = runOnboardAt(launcher,
      ["--repo-root", repo, "--apply", "--global-skills", "--json"], home);
    check(gApply.status === 0 && gApply.payload?.status === "applied" &&
      skillTarget(gApply.payload, "global")?.mode === "fresh" &&
      readInstalled(home, "bee-alpha/SKILL.md") === "# alpha self\n",
      "self-onboard: --global-skills still syncs the global root",
      JSON.stringify(gApply.payload?.skills?.targets || null));
    for (const relRoot of REPO_TARGET_ROOTS) {
      check(readRepoTarget(repo, relRoot, "bee-alpha/SKILL.md") === null,
        `self-onboard: --global-skills run still skips ${relRoot}`);
    }
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
    const plan = runOnboardAt(launcher, ["--repo-root", repo, "--global-skills", "--json"], home);
    check((plan.payload?.plan || []).some((i) => i.action === "sync_skill" && i.skill === "bee-alpha" && i.target === "global"),
      "equal-version byte drift produces a sync_skill item (D5)",
      JSON.stringify(plan.payload?.plan || []));
    check((plan.payload?.plan || []).some((i) => i.action === "remove_skill" && i.skill === "bee-obsolete"),
      "skill absent from the anchored source planned as remove_skill (D2/D4)");
    const apply = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--global-skills", "--json"], home);
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
    const plan = runOnboardAt(launcher, ["--repo-root", repo, "--global-skills", "--json"], home);
    check(plan.status === 0 && plan.payload?.status === "blocked_downgrade",
      "downgrade: plan mode reports blocked_downgrade with exit 0",
      `exit ${plan.status} status ${plan.payload?.status}`);
    const apply = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--global-skills", "--json"], home);
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
    const apply = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--global-skills", "--json"], home);
    check(apply.status === 1 && apply.payload?.status === "blocked_downgrade",
      "existing-but-unreadable installed tree refuses (unknown, D3)",
      `exit ${apply.status} status ${apply.payload?.status}`);
    check(apply.payload?.versions?.installed_skills === "unknown",
      "unreadable installed version reported as unknown",
      JSON.stringify(apply.payload?.versions || {}));
    const forced = runOnboardAt(launcher,
      ["--repo-root", repo, "--apply", "--global-skills", "--force-downgrade", "--json"], home);
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
    // In-repo targets must also resolve all three versions numeric, or the
    // host_helpers-driven refusal is unforceable for them (blocked-first:
    // EVERY blocked target must be forceable for --force-downgrade to apply).
    seedRepoSkillTargets(repo, "0.1.19");
    makeInstalledSkills(home, { version: "0.1.19" });
    const refused = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--global-skills", "--json"], home);
    check(refused.status === 1 && refused.payload?.status === "blocked_downgrade",
      "all-numeric downgrade still refuses by default");
    const forced = runOnboardAt(launcher,
      ["--repo-root", repo, "--apply", "--global-skills", "--force-downgrade", "--json"], home);
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
    const plan = runOnboardAt(launcher, ["--repo-root", repo, "--global-skills", "--json"], home);
    const planBlocked = (plan.payload?.plan || [])
      .filter((i) => i.action === "blocked_symlink").map((i) => i.skill).sort();
    check(["bee-alpha", "bee-beta", "bee-gone"].every((s) => planBlocked.includes(s)),
      "plan reports blocked_symlink loudly for every affected skill",
      JSON.stringify(planBlocked));
    const apply = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--global-skills", "--json"], home);
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
    const apply = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--global-skills", "--json"], home);
    check(apply.status === 1 && apply.payload?.status === "blocked_no_source",
      "ancestor overlap (source inside target) fails closed on apply",
      `exit ${apply.status} status ${apply.payload?.status}`);
    check(hashTree(home) === homeBefore && hashTree(repo) === repoBefore,
      "overlap refusal (source inside target) mutates nothing anywhere");
    const v1 = apply.payload?.versions || {};
    check(v1.source === "unknown" && v1.host_helpers === "unknown" && v1.installed_skills === "unknown",
      "overlap (source inside target) reports the version triple as unknown (review P1-8)",
      JSON.stringify(v1));
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
    const apply = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--global-skills", "--json"], innerHome);
    check(apply.status === 1 && apply.payload?.status === "blocked_no_source",
      "ancestor overlap (target inside source) fails closed on apply",
      `exit ${apply.status} status ${apply.payload?.status}`);
    check(hashTree(skillsRoot) === sourceBefore && hashTree(repo) === repoBefore,
      "overlap refusal (target inside source) mutates nothing anywhere");
    const v2 = apply.payload?.versions || {};
    check(v2.source === "unknown" && v2.host_helpers === "unknown" && v2.installed_skills === "unknown",
      "overlap (target inside source) reports the version triple as unknown (review P1-8)",
      JSON.stringify(v2));
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
    const apply = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--global-skills", "--json"], home);
    check(apply.status === 0 && apply.payload?.status === "applied",
      "installed-copy run applies host-repo onboarding normally",
      `exit ${apply.status} status ${apply.payload?.status}`);
    check(skillTarget(apply.payload, "global")?.mode === "noop",
      "source==target realpath resolves the global target to verify-only NOOP (D2)",
      JSON.stringify(apply.payload?.skills || null));
    check(!(apply.payload?.applied || []).some(
      (i) => (i.action === "sync_skill" || i.action === "remove_skill") && i.target === "global"),
      "NOOP run emits no global-target skill mutations");
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
    const planV = plan.payload?.versions || {};
    check(planV.source === "unknown" && planV.host_helpers === "unknown" &&
      planV.installed_skills === "unknown",
      "identity failure: plan mode reports the version triple as unknown (review P1-8)",
      JSON.stringify(planV));
    const apply = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--json"], home);
    check(apply.status === 1 && apply.payload?.status === "blocked_no_source",
      "identity failure aborts the whole apply with exit 1 (F2)",
      `exit ${apply.status} status ${apply.payload?.status}`);
    const applyV = apply.payload?.versions || {};
    check(applyV.source === "unknown" && applyV.host_helpers === "unknown" &&
      applyV.installed_skills === "unknown",
      "identity failure: apply reports the version triple as unknown (review P1-8)",
      JSON.stringify(applyV));
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
    seedRepoSkillTargets(repo, "0.1.17"); // numeric per-target installs keep the refusal forceable
    makeInstalledSkills(home, { version: "0.1.17" }); // installed OLDER: never triggers
    const homeBefore = hashTree(home);
    const repoBefore = hashTree(repo);
    const plan = runOnboardAt(launcher, ["--repo-root", repo, "--global-skills", "--json"], home);
    check(plan.status === 0 && plan.payload?.status === "blocked_downgrade",
      "source<helpers only: plan mode reports blocked_downgrade (F3)",
      `exit ${plan.status} status ${plan.payload?.status}`);
    const apply = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--global-skills", "--json"], home);
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
      ["--repo-root", repo, "--apply", "--global-skills", "--force-downgrade", "--json"], home);
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
    const apply = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--global-skills", "--json"], home);
    check(apply.status === 0 && apply.payload?.status === "applied",
      "source newer than both host_helpers and installed_skills proceeds without --force-downgrade",
      `exit ${apply.status} status ${apply.payload?.status}`);
    const v = skillTarget(apply.payload, "global")?.versions || {};
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
    const apply = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--global-skills", "--json"], home);
    check(apply.status === 0 && apply.payload?.status === "applied",
      "repo never onboarded (host_helpers absent) proceeds as first onboard, no refusal",
      `exit ${apply.status} status ${apply.payload?.status}`);
    const v = skillTarget(apply.payload, "global")?.versions || {};
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
    const plan = runOnboardAt(launcher, ["--repo-root", repo, "--global-skills", "--json"], home);
    const planActions = (plan.payload?.plan || []).map((i) => `${i.action}:${i.skill}`).sort();
    check(planActions.includes("sync_skill:bee-kept"),
      "deep mirror: plan syncs bee-kept (a nested file differs)", JSON.stringify(planActions));
    check(planActions.includes("sync_skill:bee-new"),
      "deep mirror: plan syncs the brand-new bee-new skill", JSON.stringify(planActions));
    check(planActions.includes("remove_skill:bee-stale"),
      "deep mirror: plan removes the stale bee-stale skill", JSON.stringify(planActions));
    const apply = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--global-skills", "--json"], home);
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
    runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--global-skills", "--json"], home);
    const plan2 = runOnboardAt(launcher, ["--repo-root", repo, "--global-skills", "--json"], home);
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
      for (const relRoot of REPO_TARGET_ROOTS) {
        check(hashTree(path.join(repo, ...relRoot.split("/"), skill)) === sourceHash,
          `idempotency: ${skill} manifest hash parity between source and ${relRoot}`);
      }
    }
    const apply2 = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--global-skills", "--json"], home);
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

// --- 10q. partial install: bee-* present without readable bee-hive = unknown ---
// (review P1-1) A target holding bee-* skills but NO readable bee-hive version
// marker must resolve installed_skills to "unknown" (refuse, never forceable) -
// never "absent": an older source would otherwise overwrite/delete newer
// foreign bee-* skills with no refusal. "absent" is earned only by a target
// with zero lstat-visible bee-* entries.
{
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "bee-skillsync-partial-"));
  const home = makeFakeHome();
  const home2 = makeFakeHome();
  try {
    const { launcher } = makeFakeSkillsRoot(path.join(base, "skills"), {
      version: "0.1.19",
      skills: {},
    });
    const repo = path.join(base, "repo");
    fs.mkdirSync(repo, { recursive: true });
    const installedRoot = makeInstalledSkills(home, {
      version: null, // NO bee-hive at all - only a foreign bee-* skill
      skills: { "bee-newer": { "SKILL.md": "# from a newer layout\n" } },
    });
    const homeBefore = hashTree(home);
    const repoBefore = hashTree(repo);
    const plan = runOnboardAt(launcher, ["--repo-root", repo, "--global-skills", "--json"], home);
    check(plan.status === 0 && plan.payload?.status === "blocked_downgrade",
      "partial install (bee-* without bee-hive) refuses as unknown, never fresh (review P1-1)",
      `exit ${plan.status} status ${plan.payload?.status}`);
    check(plan.payload?.versions?.installed_skills === "unknown",
      "partial install reports installed_skills unknown, not absent",
      JSON.stringify(plan.payload?.versions || null));
    const apply = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--global-skills", "--json"], home);
    check(apply.status === 1 && apply.payload?.status === "blocked_downgrade",
      "partial install: apply refuses with exit 1",
      `exit ${apply.status} status ${apply.payload?.status}`);
    const forced = runOnboardAt(launcher,
      ["--repo-root", repo, "--apply", "--global-skills", "--force-downgrade", "--json"], home);
    check(forced.status === 1 && forced.payload?.status === "blocked_downgrade",
      "partial-install unknown is NEVER forceable",
      `exit ${forced.status} status ${forced.payload?.status}`);
    check(fs.existsSync(path.join(installedRoot, "bee-newer")) &&
      readInstalled(home, "bee-newer/SKILL.md") === "# from a newer layout\n",
      "the foreign bee-* skill survives byte-identical (never deleted as 'fresh')");
    check(hashTree(home) === homeBefore && hashTree(repo) === repoBefore,
      "partial-install refusal mutates nothing anywhere");
    // Contrast: an EXISTING target dir with ONLY non-bee entries is still a
    // fresh install ("absent" = no lstat-visible bee-* entry at all).
    fs.mkdirSync(path.join(home2, ".claude", "skills", "agent-browser"), { recursive: true });
    fs.writeFileSync(path.join(home2, ".claude", "skills", "agent-browser", "SKILL.md"),
      "# not bee's\n", "utf8");
    const fresh = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--global-skills", "--json"], home2);
    check(fresh.status === 0 && fresh.payload?.status === "applied",
      "a target with only non-bee entries still reads absent -> fresh install proceeds",
      `exit ${fresh.status} status ${fresh.payload?.status}`);
  } finally {
    try {
      fs.rmSync(base, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
      fs.rmSync(home2, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}

// --- 10r. version reader: ONE line-anchored declaration on a regular file ----
// (review P1-2) The preflight reader must accept exactly one line-anchored
// `export const BEE_VERSION = 'x.y.z'` read from a REGULAR, non-symlinked file
// (every path component under the managed target lstat'ed; source side lstats
// the marker file itself). Comment decoys never resolve, multiple declarations
// are unknown, symlinked markers or components are unknown - and unknown
// always refuses, never forceable.
{
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "bee-skillsync-reader-"));
  try {
    const { launcher } = makeFakeSkillsRoot(path.join(base, "skills"), {
      version: "0.1.19",
      skills: {},
    });
    let repoN = 0;
    const nextRepo = () => {
      repoN += 1;
      const r = path.join(base, `repo-${repoN}`);
      fs.mkdirSync(r, { recursive: true });
      return r;
    };

    // (a) decoy comment above the real declaration -> the REAL version wins
    {
      const home = makeFakeHome();
      try {
        makeInstalledSkills(home, {
          stateText: "// BEE_VERSION = '0.1.18' decoy comment - never the version\n" +
            "export const BEE_VERSION = '0.1.20';\n",
        });
        const homeBefore = hashTree(home);
        const apply = runOnboardAt(launcher, ["--repo-root", nextRepo(), "--apply", "--global-skills", "--json"], home);
        check(apply.status === 1 && apply.payload?.status === "blocked_downgrade",
          "decoy BEE_VERSION comment never resolves: the real 0.1.20 refuses a 0.1.19 source (review P1-2)",
          `exit ${apply.status} status ${apply.payload?.status}`);
        check(apply.payload?.versions?.installed_skills === "0.1.20",
          "reader reports the real line-anchored version, never the decoy",
          JSON.stringify(apply.payload?.versions || null));
        check(hashTree(home) === homeBefore,
          "decoy-refused apply mutates nothing in the target");
      } finally {
        try {
          fs.rmSync(home, { recursive: true, force: true });
        } catch {
          // best-effort cleanup
        }
      }
    }

    // (b) multiple line-anchored declarations -> unknown, never forceable
    {
      const home = makeFakeHome();
      try {
        makeInstalledSkills(home, {
          stateText: "export const BEE_VERSION = '0.1.18';\n" +
            "export const BEE_VERSION = '0.1.20';\n",
        });
        const homeBefore = hashTree(home);
        const forced = runOnboardAt(launcher,
          ["--repo-root", nextRepo(), "--apply", "--global-skills", "--force-downgrade", "--json"], home);
        check(forced.status === 1 && forced.payload?.status === "blocked_downgrade" &&
          forced.payload?.versions?.installed_skills === "unknown",
          "multiple BEE_VERSION declarations resolve to unknown and refuse even --force-downgrade",
          `exit ${forced.status} versions ${JSON.stringify(forced.payload?.versions || null)}`);
        check(hashTree(home) === homeBefore,
          "multi-declaration refusal mutates nothing in the target");
      } finally {
        try {
          fs.rmSync(home, { recursive: true, force: true });
        } catch {
          // best-effort cleanup
        }
      }
    }

    // (c) symlinked marker FILE -> unknown (the reader lstats the marker)
    {
      const home = makeFakeHome();
      try {
        const root = makeInstalledSkills(home, {
          version: null,
          skills: { "bee-hive": { "SKILL.md": "# installed hive\n" } },
        });
        const outsideMarker = path.join(base, "outside-marker-c.mjs");
        fs.writeFileSync(outsideMarker, fakeStateSource("0.1.18"), "utf8");
        fs.mkdirSync(path.join(root, "bee-hive", "templates", "lib"), { recursive: true });
        fs.symlinkSync(outsideMarker,
          path.join(root, "bee-hive", "templates", "lib", "state.mjs"));
        const apply = runOnboardAt(launcher, ["--repo-root", nextRepo(), "--apply", "--global-skills", "--json"], home);
        check(apply.status === 1 && apply.payload?.status === "blocked_downgrade" &&
          apply.payload?.versions?.installed_skills === "unknown",
          "symlinked version marker is never followed: unknown, refused",
          `exit ${apply.status} versions ${JSON.stringify(apply.payload?.versions || null)}`);
        check(fs.readFileSync(outsideMarker, "utf8") === fakeStateSource("0.1.18"),
          "symlink target file untouched by the refused apply");
      } finally {
        try {
          fs.rmSync(home, { recursive: true, force: true });
        } catch {
          // best-effort cleanup
        }
      }
    }

    // (d) symlinked path COMPONENT (templates/) -> unknown
    {
      const home = makeFakeHome();
      try {
        const root = makeInstalledSkills(home, {
          version: null,
          skills: { "bee-hive": { "SKILL.md": "# installed hive\n" } },
        });
        const outsideTemplates = path.join(base, "outside-templates-d");
        fs.mkdirSync(path.join(outsideTemplates, "lib"), { recursive: true });
        fs.writeFileSync(path.join(outsideTemplates, "lib", "state.mjs"),
          fakeStateSource("0.1.18"), "utf8");
        fs.symlinkSync(outsideTemplates, path.join(root, "bee-hive", "templates"));
        const apply = runOnboardAt(launcher, ["--repo-root", nextRepo(), "--apply", "--global-skills", "--json"], home);
        check(apply.status === 1 && apply.payload?.status === "blocked_downgrade" &&
          apply.payload?.versions?.installed_skills === "unknown",
          "symlinked path component under the managed target is never trusted: unknown, refused",
          `exit ${apply.status} versions ${JSON.stringify(apply.payload?.versions || null)}`);
      } finally {
        try {
          fs.rmSync(home, { recursive: true, force: true });
        } catch {
          // best-effort cleanup
        }
      }
    }
  } finally {
    try {
      fs.rmSync(base, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}

// --- 10s. dir<->file transitions converge without deleting fresh output -----
// (review P1-3) The old apply materialized the source shape FIRST and ran
// stale-entry cleanup from the pre-write snapshot AFTERWARDS: on a dir->file
// transition the stale-dirs pass rm -rf'ed the freshly written file; on
// file->dir the stale-files pass hit a directory mid-apply. Both directions
// (including nested paths) must converge to full manifest parity (D5).
{
  // Direction A: installed DIRECTORY -> source FILE (top-level and nested)
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "bee-skillsync-dir2file-"));
  const home = makeFakeHome();
  try {
    const { launcher } = makeFakeSkillsRoot(path.join(base, "skills"), {
      version: "0.1.19",
      skills: {
        "bee-doc": {
          "SKILL.md": "# doc\n",
          "guide": "# guide is now a FILE\n",
          "refs/data": "# data is now a FILE\n",
        },
      },
    });
    const repo = path.join(base, "repo");
    fs.mkdirSync(repo, { recursive: true });
    makeInstalledSkills(home, {
      version: "0.1.19",
      skills: {
        "bee-doc": {
          "SKILL.md": "# doc\n",
          "guide/intro.md": "# old intro\n",
          "guide/deep/note.md": "# old nested note\n",
          "refs/data/x.md": "# old nested data\n",
        },
      },
    });
    const apply = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--global-skills", "--json"], home);
    check(apply.status === 0 && apply.payload?.status === "applied",
      "dir->file transition: apply succeeds",
      `exit ${apply.status} stdout ${apply.stdout}`);
    check(readInstalled(home, "bee-doc/guide") === "# guide is now a FILE\n",
      "dir->file: freshly materialized top-level file survives cleanup (review P1-3)",
      String(readInstalled(home, "bee-doc/guide")));
    check(readInstalled(home, "bee-doc/refs/data") === "# data is now a FILE\n",
      "dir->file: freshly materialized NESTED file survives cleanup",
      String(readInstalled(home, "bee-doc/refs/data")));
    check(apply.payload?.recheck === "up_to_date",
      "dir->file: recheck lands up_to_date (full manifest parity, D5)",
      JSON.stringify(apply.payload?.recheck_plan || []));
    check(hashTree(path.join(base, "skills", "bee-doc")) ===
      hashTree(path.join(home, ".claude", "skills", "bee-doc")),
      "dir->file: installed bee-doc byte-identical to source");
  } finally {
    try {
      fs.rmSync(base, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}
{
  // Direction B: installed FILE -> source DIRECTORY (top-level and nested)
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "bee-skillsync-file2dir-"));
  const home = makeFakeHome();
  try {
    const { launcher } = makeFakeSkillsRoot(path.join(base, "skills"), {
      version: "0.1.19",
      skills: {
        "bee-doc": {
          "SKILL.md": "# doc\n",
          "guide/intro.md": "# new intro\n",
          "guide/deep/note.md": "# new nested note\n",
          "refs/data/x.md": "# new nested data\n",
        },
      },
    });
    const repo = path.join(base, "repo");
    fs.mkdirSync(repo, { recursive: true });
    makeInstalledSkills(home, {
      version: "0.1.19",
      skills: {
        "bee-doc": {
          "SKILL.md": "# doc\n",
          "guide": "# guide was a file\n",
          "refs/data": "# data was a file\n",
        },
      },
    });
    const apply = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--global-skills", "--json"], home);
    check(apply.status === 0 && apply.payload?.status === "applied",
      "file->dir transition: apply succeeds without throwing mid-apply (review P1-3)",
      `exit ${apply.status} stdout ${apply.stdout}`);
    check(readInstalled(home, "bee-doc/guide/intro.md") === "# new intro\n" &&
      readInstalled(home, "bee-doc/guide/deep/note.md") === "# new nested note\n",
      "file->dir: directory content fully materialized");
    check(readInstalled(home, "bee-doc/refs/data/x.md") === "# new nested data\n",
      "file->dir: NESTED file->dir transition materialized");
    check(apply.payload?.recheck === "up_to_date",
      "file->dir: recheck lands up_to_date (full manifest parity, D5)",
      JSON.stringify(apply.payload?.recheck_plan || []));
    check(hashTree(path.join(base, "skills", "bee-doc")) ===
      hashTree(path.join(home, ".claude", "skills", "bee-doc")),
      "file->dir: installed bee-doc byte-identical to source");
  } finally {
    try {
      fs.rmSync(base, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}

// --- 10t. repo root and skills root overlap (either direction) refuses ------
// (review P1-4) A repo living under ~/.claude/skills must never be deletable
// by its own onboard: the remove_skill pass would erase the live checkout,
// git history included. realpath(repoRoot)<->targetRoot overlap refuses
// blocked_no_source at preflight, never forceable, zero mutations.
{
  // Direction 1: repo INSIDE the target skills root
  const home = fs.realpathSync(makeFakeHome());
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "bee-skillsync-repoingt-"));
  try {
    const { launcher } = makeFakeSkillsRoot(path.join(base, "skills"), {
      version: "0.1.19",
      skills: {},
    });
    const installedRoot = makeInstalledSkills(home, { version: "0.1.19" });
    const repo = path.join(installedRoot, "bee-local");
    fs.mkdirSync(path.join(repo, ".git"), { recursive: true });
    fs.writeFileSync(path.join(repo, ".git", "HEAD"), "ref: refs/heads/main\n", "utf8");
    fs.writeFileSync(path.join(repo, "work.md"), "irreplaceable checkout\n", "utf8");
    const homeBefore = hashTree(home);
    const plan = runOnboardAt(launcher, ["--repo-root", repo, "--global-skills", "--json"], home);
    check(plan.status === 0 && plan.payload?.status === "blocked_no_source",
      "repo inside the skills root: plan reports blocked_no_source (review P1-4)",
      `exit ${plan.status} status ${plan.payload?.status}`);
    const apply = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--global-skills", "--json"], home);
    check(apply.status === 1 && apply.payload?.status === "blocked_no_source",
      "repo inside the skills root: apply refuses pre-write with exit 1",
      `exit ${apply.status} status ${apply.payload?.status}`);
    const repoOverlapV = apply.payload?.versions || {};
    check(repoOverlapV.source === "unknown" && repoOverlapV.host_helpers === "unknown" &&
      repoOverlapV.installed_skills === "unknown",
      "repo-in-target overlap reports the version triple as unknown (review P1-8)",
      JSON.stringify(repoOverlapV));
    const forced = runOnboardAt(launcher,
      ["--repo-root", repo, "--apply", "--global-skills", "--force-downgrade", "--json"], home);
    check(forced.status === 1 && forced.payload?.status === "blocked_no_source",
      "repo-in-target refusal is NEVER forceable",
      `exit ${forced.status} status ${forced.payload?.status}`);
    check(fs.existsSync(path.join(repo, ".git", "HEAD")) &&
      fs.readFileSync(path.join(repo, "work.md"), "utf8") === "irreplaceable checkout\n",
      "the live checkout (git history included) survives untouched");
    check(hashTree(home) === homeBefore,
      "repo-in-target refusal performs zero mutations anywhere");
  } finally {
    try {
      fs.rmSync(home, { recursive: true, force: true });
      fs.rmSync(base, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}
{
  // Direction 2: target skills root INSIDE the repo
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "bee-skillsync-tgtinrepo-")));
  try {
    const { launcher } = makeFakeSkillsRoot(path.join(base, "skills"), {
      version: "0.1.19",
      skills: {},
    });
    const repo = path.join(base, "repo");
    const innerHome = path.join(repo, "nested-home");
    fs.mkdirSync(innerHome, { recursive: true });
    const repoBefore = hashTree(repo);
    const apply = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--global-skills", "--json"], innerHome);
    check(apply.status === 1 && apply.payload?.status === "blocked_no_source",
      "target skills root inside the repo refuses fail-closed (review P1-4)",
      `exit ${apply.status} status ${apply.payload?.status}`);
    check(hashTree(repo) === repoBefore,
      "target-in-repo refusal mutates nothing (no skills written into the repo)");
    const tgtOverlapV = apply.payload?.versions || {};
    check(tgtOverlapV.source === "unknown" && tgtOverlapV.host_helpers === "unknown" &&
      tgtOverlapV.installed_skills === "unknown",
      "target-in-repo overlap reports the version triple as unknown (review P1-8)",
      JSON.stringify(tgtOverlapV));
  } finally {
    try {
      fs.rmSync(base, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}

// --- 10u. case-insensitive fs: alias collision fails closed (review P1-5) ---
// Exact-case name comparison would sync via one name and delete via the other
// - one physical directory. Detection must be by canonical filesystem
// identity, simulated on the running platform (probe: does bee-Hive resolve
// to a created bee-hive?) and skipped with a named reason when the fs is
// case-sensitive. BEE_CASE_FS_DIR points the case at a case-insensitive
// mount when the default tmpdir is case-sensitive (e.g. /mnt/c on WSL).
{
  const caseBase = process.env.BEE_CASE_FS_DIR || os.tmpdir();
  let caseInsensitive = false;
  let probe = null;
  try {
    probe = fs.mkdtempSync(path.join(caseBase, "bee-caseprobe-"));
    fs.mkdirSync(path.join(probe, "bee-hive"));
    caseInsensitive = fs.existsSync(path.join(probe, "bee-Hive"));
  } catch {
    caseInsensitive = false;
  } finally {
    if (probe) {
      try {
        fs.rmSync(probe, { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
    }
  }
  if (!caseInsensitive) {
    skip("case-alias fail-closed (review P1-5)",
      `filesystem at ${caseBase} is case-sensitive - bee-Hive does not resolve to bee-hive; set BEE_CASE_FS_DIR to a case-insensitive mount to exercise`);
  } else {
    const srcBase = fs.mkdtempSync(path.join(os.tmpdir(), "bee-skillsync-aliassrc-"));
    const aliasBase = fs.mkdtempSync(path.join(caseBase, "bee-skillsync-alias-"));
    const home = path.join(aliasBase, "home");
    fs.mkdirSync(home, { recursive: true });
    try {
      const { launcher } = makeFakeSkillsRoot(path.join(srcBase, "skills"), {
        version: "0.1.19",
        skills: { "bee-alpha": { "SKILL.md": "# alpha source\n" } },
      });
      const repo = path.join(srcBase, "repo");
      fs.mkdirSync(repo, { recursive: true });
      const installedRoot = makeInstalledSkills(home, {
        version: "0.1.19",
        skills: { "bee-Alpha": { "SKILL.md": "# alpha installed, other case\n" } },
      });
      const plan = runOnboardAt(launcher, ["--repo-root", repo, "--global-skills", "--json"], home);
      // The alias lives in the GLOBAL target; the fresh in-repo targets plan
      // their own (clean) sync_skill items, so the guarantee is per-target.
      const planItems = (plan.payload?.plan || []).filter((i) => i.target === "global");
      check(!planItems.some((i) =>
        (i.action === "sync_skill" || i.action === "remove_skill") &&
        ["bee-alpha", "bee-Alpha"].includes(i.skill)),
        "alias collision: neither sync_skill nor remove_skill planned for the aliased names",
        JSON.stringify(planItems));
      check(planItems.some((i) => i.action === "blocked_alias"),
        "alias collision is reported loudly as a blocked plan item",
        JSON.stringify(planItems));
      const apply = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--global-skills", "--json"], home);
      check(apply.status === 0 && apply.payload?.status === "applied",
        "alias: apply still proceeds for unaffected skills", `exit ${apply.status}`);
      check((apply.payload?.skills?.skipped || []).some((s) =>
        ["bee-alpha", "bee-Alpha"].includes(s.skill)),
        "apply reports the alias-blocked skill as skipped (loud per-skill report)",
        JSON.stringify(apply.payload?.skills || null));
      check(fs.existsSync(path.join(installedRoot, "bee-Alpha")),
        "the physical skill directory survives (never sync-then-delete)");
      check(readInstalled(home, "bee-Alpha/SKILL.md") === "# alpha installed, other case\n",
        "aliased skill content byte-identical (never written through the alias)",
        String(readInstalled(home, "bee-Alpha/SKILL.md")));
      check(apply.payload?.recheck === "changes_needed",
        "recheck stays changes_needed while a skill is alias-blocked (parity unresolved)",
        JSON.stringify(apply.payload?.recheck_plan || []));
    } finally {
      try {
        fs.rmSync(srcBase, { recursive: true, force: true });
        fs.rmSync(aliasBase, { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
    }
  }
}

// --- 10v. forced-apply transparency: blocked-forceable dry-run and refused ---
// apply both enumerate the skills a --force-downgrade would overwrite/delete
// (review P1-6, D2). Before the fix neither the plain dry-run (`--json`, no
// --apply) nor the refused `--apply` response carried the computed items -
// a human deciding whether to pass --force-downgrade could not see which
// skills get overwritten (sync_skill) or DELETED (remove_skill) until AFTER
// authorizing it and reading the forced apply's own report.
{
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "bee-skillsync-forcedvis-"));
  const home = makeFakeHome();
  try {
    const { launcher } = makeFakeSkillsRoot(path.join(base, "skills"), {
      version: "0.1.18",
      skills: { "bee-alpha": { "SKILL.md": "# alpha v2 from older source\n" } },
    });
    const repo = path.join(base, "repo");
    fs.mkdirSync(path.join(repo, ".bee", "bin", "lib"), { recursive: true });
    fs.writeFileSync(path.join(repo, ".bee", "bin", "lib", "state.mjs"),
      fakeStateSource("0.1.19"), "utf8");
    seedRepoSkillTargets(repo, "0.1.19"); // numeric per-target installs keep the refusal forceable
    makeInstalledSkills(home, {
      version: "0.1.19",
      skills: {
        "bee-alpha": { "SKILL.md": "# alpha v1 - about to be overwritten\n" },
        "bee-doomed": { "SKILL.md": "# about to be deleted\n" },
      },
    });
    const plan = runOnboardAt(launcher, ["--repo-root", repo, "--global-skills", "--json"], home);
    check(plan.status === 0 && plan.payload?.status === "blocked_downgrade",
      "forced-vis: plan mode reports blocked_downgrade (forceable)",
      `exit ${plan.status} status ${plan.payload?.status}`);
    const planItems = flatSkillItems(plan.payload);
    check(planItems.some((i) => i.action === "sync_skill" && i.skill === "bee-alpha" && i.target === "global"),
      "forced-vis: blocked dry-run still enumerates the sync_skill a force would overwrite (P1-6)",
      JSON.stringify(planItems));
    check(planItems.some((i) => i.action === "remove_skill" && i.skill === "bee-doomed" && i.target === "global"),
      "forced-vis: blocked dry-run still enumerates the remove_skill a force would DELETE (P1-6)",
      JSON.stringify(planItems));
    const refused = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--global-skills", "--json"], home);
    check(refused.status === 1 && refused.payload?.status === "blocked_downgrade",
      "forced-vis: refused apply (no --force-downgrade) still reports blocked_downgrade");
    const refusedItems = flatSkillItems(refused.payload);
    check(refusedItems.some((i) => i.action === "sync_skill" && i.skill === "bee-alpha" && i.target === "global") &&
      refusedItems.some((i) => i.action === "remove_skill" && i.skill === "bee-doomed" && i.target === "global"),
      "forced-vis: the refused --apply response ALSO enumerates the items per target, not only the plain dry-run (P1-6)",
      JSON.stringify(refusedItems));
    const forced = runOnboardAt(launcher,
      ["--repo-root", repo, "--apply", "--global-skills", "--force-downgrade", "--json"], home);
    check(forced.status === 0 && forced.payload?.status === "applied" &&
      forced.payload?.forced_downgrade === true,
      "forced-vis: forcing actually applies", `exit ${forced.status} status ${forced.payload?.status}`);
    const previewedSkills = [...new Set(refusedItems.map((i) => i.skill))].sort();
    const appliedSkills = [...new Set((forced.payload?.applied || [])
      .filter((i) => i.action === "sync_skill" || i.action === "remove_skill")
      .map((i) => i.skill))].sort();
    check(JSON.stringify(previewedSkills.filter((s) =>
      forced.payload.applied.some((i) => i.skill === s))) === JSON.stringify(appliedSkills) ||
      appliedSkills.every((s) => previewedSkills.includes(s)),
      "forced-vis: the forced apply touches exactly the reviewed set previewed before authorization",
      JSON.stringify({ previewedSkills, appliedSkills }));
  } finally {
    try {
      fs.rmSync(base, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}

// --- 10w. recheck honesty: a blocked skill stage can never report up_to_date -
// (review P1-7, D5) The post-apply recheck previously used `plan.length`
// only, which is empty whenever computePlan() withholds skill items because
// its skillSync stage is blocked - a false parity claim. Reachable after a
// forced downgrade that leaves ONE skill mid-refusal (a nested symlink
// elsewhere in bee-hive, off the templates/lib/state.mjs path so the version
// marker itself still resolves): the whole-stage version compare sees the
// installed bee-hive skill's marker still un-synced (older source, newer
// installed) and is genuinely blocked again at recheck time, while the
// general (non-skill) plan items are all freshly up to date and contribute
// zero items - so plan.length alone reads as up_to_date. Blocked-first
// precedence must override that.
{
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "bee-skillsync-recheckhonesty-"));
  const home = makeFakeHome();
  try {
    const { launcher } = makeFakeSkillsRoot(path.join(base, "skills"), {
      version: "0.1.18",
      skills: {},
    });
    const repo = path.join(base, "repo");
    fs.mkdirSync(path.join(repo, ".bee", "bin", "lib"), { recursive: true });
    fs.writeFileSync(path.join(repo, ".bee", "bin", "lib", "state.mjs"),
      fakeStateSource("0.1.19"), "utf8");
    seedRepoSkillTargets(repo, "0.1.19"); // numeric per-target installs keep the refusal forceable
    const installedRoot = makeInstalledSkills(home, { version: "0.1.19" });
    const outside = path.join(base, "outside-rogue");
    fs.mkdirSync(outside, { recursive: true });
    fs.writeFileSync(path.join(outside, "real-work.md"), "do not touch\n", "utf8");
    // Nested symlink INSIDE installed bee-hive, off the templates/lib path -
    // version resolution still succeeds, but the whole skill is blocked_symlink
    // and never gets synced, so its marker stays stuck at the OLDER install.
    fs.symlinkSync(outside, path.join(installedRoot, "bee-hive", "rogue-link"));
    const refused = runOnboardAt(launcher, ["--repo-root", repo, "--apply", "--global-skills", "--json"], home);
    check(refused.status === 1 && refused.payload?.status === "blocked_downgrade",
      "recheck-honesty: unforced apply refuses as blocked_downgrade (setup sanity)",
      `exit ${refused.status} status ${refused.payload?.status}`);
    const forced = runOnboardAt(launcher,
      ["--repo-root", repo, "--apply", "--global-skills", "--force-downgrade", "--json"], home);
    check(forced.status === 0 && forced.payload?.status === "applied" &&
      forced.payload?.forced_downgrade === true,
      "recheck-honesty: forced apply proceeds", `exit ${forced.status} status ${forced.payload?.status}`);
    check((forced.payload?.skills?.skipped || []).some((s) => s.skill === "bee-hive"),
      "recheck-honesty: bee-hive itself is skipped (nested rogue symlink), left un-synced",
      JSON.stringify(forced.payload?.skills || null));
    check(forced.payload?.recheck !== "up_to_date",
      "recheck-honesty: a residual blocked skill stage can NEVER report recheck up_to_date (P1-7)",
      JSON.stringify({ recheck: forced.payload?.recheck, recheck_skills: forced.payload?.recheck_skills }));
    check(forced.payload?.recheck_skills?.blocked === true &&
      typeof forced.payload?.recheck_skills?.reason === "string" &&
      forced.payload?.recheck_skills?.reason.length > 0 &&
      forced.payload?.recheck_skills?.versions?.installed_skills === "0.1.19",
      "recheck-honesty: recheck exposes the blocked skill stage's status/reason/versions (P1-7)",
      JSON.stringify(forced.payload?.recheck_skills));
  } finally {
    try {
      fs.rmSync(base, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}

// --- 10z. plan-item scope discriminator (review P1-9): every skill-stage ----
// item carries scope: "installed" | "source" so a consumer never resolves a
// global deletion/overwrite against repoRoot; legacy (repo-relative) items
// carry no `scope` field at all, unchanged.
{
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "bee-skillsync-scope-"));
  const home = makeFakeHome();
  const outside = path.join(base, "outside-src-link");
  try {
    const { launcher, skillsRoot } = makeFakeSkillsRoot(path.join(base, "skills"), {
      skills: { "bee-normal": { "SKILL.md": "# normal\n" } },
    });
    fs.mkdirSync(outside, { recursive: true });
    // Source-level symlinked skill entry -> scope: "source".
    fs.symlinkSync(outside, path.join(skillsRoot, "bee-linked"));
    const repo = path.join(base, "repo");
    fs.mkdirSync(repo, { recursive: true });
    makeInstalledSkills(home, {
      version: "0.1.19",
      skills: { "bee-remove-me": { "SKILL.md": "# will be removed\n" } },
    });
    const plan = runOnboardAt(launcher, ["--repo-root", repo, "--global-skills", "--json"], home);
    check(plan.status === 0, "scope: plan mode exits 0", `exit ${plan.status}`);
    const items = plan.payload?.plan || [];
    const byKey = (action, skill) => items.find((i) => i.action === action && i.skill === skill);
    const syncNormal = byKey("sync_skill", "bee-normal");
    check(syncNormal?.scope === "installed",
      "scope: sync_skill (writes a managed install root) carries scope: installed",
      JSON.stringify(syncNormal));
    const removeMe = byKey("remove_skill", "bee-remove-me");
    check(removeMe?.scope === "installed" && removeMe?.target === "global",
      "scope: remove_skill (deletes from the global install) carries scope: installed + target: global",
      JSON.stringify(removeMe));
    const linked = byKey("blocked_symlink", "bee-linked");
    check(linked?.scope === "source",
      "scope: a source-side symlinked skill entry carries scope: source, not installed",
      JSON.stringify(linked));
    const syncHive = byKey("sync_skill", "bee-hive");
    check(syncHive?.scope === "installed",
      "scope: bee-hive's own sync_skill also carries scope: installed",
      JSON.stringify(syncHive));
    const skillStageItems = items.filter((i) =>
      ["sync_skill", "remove_skill", "blocked_symlink", "blocked_alias"].includes(i.action));
    check(skillStageItems.length > 0 && skillStageItems.every((i) =>
      ["repo-claude", "repo-agents", "global"].includes(i.target)),
      "scope: every skill-stage item carries the target-kind discriminator",
      JSON.stringify(skillStageItems));
    const legacyItem = items.find((i) => i.action === "create_agents_block");
    check(legacyItem && !("scope" in legacyItem) && !("target" in legacyItem),
      "scope: legacy repo-relative items carry no scope/target fields at all (unchanged)",
      JSON.stringify(legacyItem));
  } finally {
    try {
      fs.rmSync(base, { recursive: true, force: true });
      fs.rmSync(home, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}

// --- 11. sticky repo-hooks opt-in -------------------------------------------
// The bug this pins: --repo-hooks used to be re-consent owed on EVERY upgrade.
// A bare --apply refreshed the doctrine block, helpers, and version stamp while
// leaving first-onboard guards vendored in .bee/bin/hooks/ — and still reported
// up_to_date, because subsetManaged() ignores repo_hooks when the flag is absent.
// Eight host repos ran current doctrine against stale guards for many versions.
// The opt-in is now sticky: the recorded repo_hooks marker keeps upgrades honest.
{
  const stickyTmp = fs.mkdtempSync(path.join(os.tmpdir(), "bee-sticky-hooks-"));

  // (a) opted in once -> a BARE --apply refreshes hooks, no flag needed
  {
    const repo = path.join(stickyTmp, "opted-in");
    fs.mkdirSync(repo, { recursive: true });
    const home = makeFakeHome();

    runOnboard(["--repo-root", repo, "--apply", "--repo-hooks", "--json"], home);
    const hooksDir = path.join(repo, ".bee", "bin", "hooks");
    check(listMjs(hooksDir).length > 0, "sticky: first --repo-hooks install vendors hooks");

    // Simulate the stale state the real hosts were in: gut a vendored guard, then
    // upgrade WITHOUT the flag. Pre-fix, the corruption survived and status said up_to_date.
    const guard = path.join(hooksDir, "bee-write-guard.mjs");
    fs.writeFileSync(guard, "// stale first-onboard guard\n");
    const bare = runOnboard(["--repo-root", repo, "--apply", "--json"], home);

    const refreshed = fs.readFileSync(guard, "utf8");
    check(!refreshed.includes("stale first-onboard guard") && refreshed.length > 200,
      "sticky: a bare --apply refreshes vendored hooks once the repo has opted in",
      `guard length after: ${refreshed.length}`);
    check(bare.payload?.status === "applied", "sticky: the bare upgrade still applies cleanly",
      JSON.stringify(bare.payload?.status));
  }

  // (b) never opted in -> a bare --apply must NOT start vendoring hooks
  {
    const repo = path.join(stickyTmp, "never-opted-in");
    fs.mkdirSync(repo, { recursive: true });
    const home = makeFakeHome();

    runOnboard(["--repo-root", repo, "--apply", "--json"], home);
    runOnboard(["--repo-root", repo, "--apply", "--json"], home);

    check(listMjs(path.join(repo, ".bee", "bin", "hooks")).length === 0,
      "sticky: a repo that never opted in is never silently given vendored hooks");
  }

  // (c) a hook file ADDED to source since the last onboard is picked up on the sticky path
  //     (this is exactly how adapter.mjs and bee-model-guard.mjs went missing on all 8 hosts)
  {
    const repo = path.join(stickyTmp, "new-hook-appears");
    fs.mkdirSync(repo, { recursive: true });
    const home = makeFakeHome();

    runOnboard(["--repo-root", repo, "--apply", "--repo-hooks", "--json"], home);
    const hooksDir = path.join(repo, ".bee", "bin", "hooks");
    const before = listMjs(hooksDir);

    // Delete one, as if it had never existed in the older source the repo onboarded from.
    const victim = before.includes("bee-model-guard.mjs") ? "bee-model-guard.mjs" : before[0];
    fs.rmSync(path.join(hooksDir, victim));
    check(!listMjs(hooksDir).includes(victim), "sticky: precondition — hook removed from the repo");

    runOnboard(["--repo-root", repo, "--apply", "--json"], home);
    check(listMjs(hooksDir).includes(victim),
      "sticky: a hook missing from the repo is restored by a bare --apply (new source hooks land)",
      `missing: ${victim}`);
  }

  fs.rmSync(stickyTmp, { recursive: true, force: true });
}

// --- 12. encoding regression guard: scripts/*.ps1 must be ASCII-only --------
// Root cause (installer-hardening CONTEXT.md E2): scripts/install.ps1 was
// UTF-8 without BOM; Windows PowerShell 5.1 decodes it as cp1252, so the
// em-dash byte sequence's trailing 0x94 became a smart right-double-quote,
// which PowerShell treats as a string terminator and the file failed to
// parse. Keeping scripts/*.ps1 ASCII-only makes the file encoding-proof.
// This check is pure node fs + a byte scan, no pwsh required, so it runs on
// any platform.
{
  function findNonAsciiBytes(buf) {
    const hits = [];
    for (let i = 0; i < buf.length; i++) {
      if (buf[i] > 0x7f) hits.push({ offset: i, byte: buf[i] });
    }
    return hits;
  }

  const scriptsDir = path.join(REPO_ROOT, "scripts");
  const ps1Files = fs.existsSync(scriptsDir)
    ? fs.readdirSync(scriptsDir).filter((f) => f.endsWith(".ps1")).sort()
    : [];
  check(ps1Files.length > 0, "encoding guard: scripts/*.ps1 files found to check",
    `dir: ${scriptsDir}, files: ${JSON.stringify(ps1Files)}`);

  const violations = [];
  for (const name of ps1Files) {
    const hits = findNonAsciiBytes(fs.readFileSync(path.join(scriptsDir, name)));
    if (hits.length > 0) {
      violations.push({ file: name, count: hits.length, first: hits[0] });
    }
  }
  check(violations.length === 0,
    "encoding guard: no non-ASCII bytes in any scripts/*.ps1",
    JSON.stringify(violations));

  // Self-test the detector on a scratch file OUTSIDE the repo's scripts/ dir,
  // so a vacuously-true check (e.g. an empty glob) cannot pass silently.
  const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), "bee-encoding-guard-"));
  try {
    const scratchFile = path.join(scratchDir, "scratch.ps1");
    fs.writeFileSync(scratchFile, "Write-Host 'em dash — here'\n", "utf8");
    const scratchHits = findNonAsciiBytes(fs.readFileSync(scratchFile));
    check(scratchHits.length > 0,
      "encoding guard: detector flags a non-ASCII byte planted in a scratch .ps1",
      JSON.stringify(scratchHits));

    const cleanFile = path.join(scratchDir, "clean.ps1");
    fs.writeFileSync(cleanFile, "Write-Host 'plain ascii'\n", "utf8");
    const cleanHits = findNonAsciiBytes(fs.readFileSync(cleanFile));
    check(cleanHits.length === 0,
      "encoding guard: detector reports clean on an ASCII-only scratch .ps1",
      JSON.stringify(cleanHits));
  } finally {
    fs.rmSync(scratchDir, { recursive: true, force: true });
  }
}

// --- 13. retired helper shims (D2, shim-retire): removal pass ---------------
// bbc6bcea D2: a host with leftover bee_*.mjs shims in its own .bee/bin/ gets
// them removed on the next --apply; a second run plans nothing further; a
// brand-new host never sees them appear in the first place (listTemplateHelpers()
// already stopped copying them once shim-retire-1 deleted the source templates
// - this section only proves the explicit *removal* pass, which is the part
// that would otherwise never happen for an already-onboarded host).
const RETIRED_HELPER_NAMES = [
  "bee_status.mjs",
  "bee_cells.mjs",
  "bee_reservations.mjs",
  "bee_decisions.mjs",
  "bee_state.mjs",
  "bee_backlog.mjs",
  "bee_capture.mjs",
  "bee_reviews.mjs",
  "bee_feedback.mjs",
];

{
  const staleTmp = fs.mkdtempSync(path.join(os.tmpdir(), "bee-onboard-stale-shims-"));
  const staleHome = makeFakeHome();
  try {
    fs.mkdirSync(path.join(staleTmp, ".bee", "bin"), { recursive: true });
    for (const name of RETIRED_HELPER_NAMES) {
      fs.writeFileSync(path.join(staleTmp, ".bee", "bin", name), "// legacy shim\n", "utf8");
    }
    // A live, non-retired file in the same directory must never be touched -
    // the removal pass targets exact retired basenames only (must_haves
    // prohibition: never a generic rm of unmanaged files).
    fs.writeFileSync(path.join(staleTmp, ".bee", "bin", "bee.mjs"), "// dispatcher\n", "utf8");

    const stalePlan = runOnboard(["--repo-root", staleTmp, "--json"], staleHome);
    const stalePlanActions = (stalePlan.payload?.plan || [])
      .filter((i) => i.action === "remove_helper")
      .map((i) => i.path)
      .sort();
    check(
      JSON.stringify(stalePlanActions) ===
        JSON.stringify(RETIRED_HELPER_NAMES.map((n) => `.bee/bin/${n}`).sort()),
      "stale host: plan lists a remove_helper item for every leftover retired shim",
      JSON.stringify(stalePlanActions),
    );
    check(fs.existsSync(path.join(staleTmp, ".bee", "bin", "bee_status.mjs")),
      "stale host: plan mode writes nothing (shim still on disk before apply)");

    const staleApply = runOnboard(["--repo-root", staleTmp, "--apply", "--json"], staleHome);
    check(staleApply.payload?.status === "applied", "stale host: apply succeeds", staleApply.stderr);
    for (const name of RETIRED_HELPER_NAMES) {
      check(!fs.existsSync(path.join(staleTmp, ".bee", "bin", name)),
        `stale host: ${name} deleted from .bee/bin on --apply`);
    }
    check(fs.existsSync(path.join(staleTmp, ".bee", "bin", "bee.mjs")),
      "stale host: an unrelated .bee/bin/bee.mjs survives the removal pass untouched");

    // --- idempotence: a second run plans zero remove_helper items -----------
    const staleReplan = runOnboard(["--repo-root", staleTmp, "--json"], staleHome);
    const replanActions = (staleReplan.payload?.plan || [])
      .filter((i) => i.action === "remove_helper");
    check(replanActions.length === 0,
      "idempotence: re-running onboarding after removal plans zero remove_helper items",
      JSON.stringify(replanActions));
    check(staleReplan.payload?.status === "up_to_date",
      "idempotence: repo with shims already removed reports up_to_date (no residual drift)",
      JSON.stringify(staleReplan.payload));
  } finally {
    fs.rmSync(staleTmp, { recursive: true, force: true });
    fs.rmSync(staleHome, { recursive: true, force: true });
  }
}

// --- fresh onboard: a brand-new host never gets the retired shims ----------
{
  const freshTmp = fs.mkdtempSync(path.join(os.tmpdir(), "bee-onboard-fresh-noshims-"));
  const freshHome = makeFakeHome();
  try {
    const freshApply = runOnboard(["--repo-root", freshTmp, "--apply", "--json"], freshHome);
    check(freshApply.payload?.status === "applied", "fresh onboard: apply succeeds", freshApply.stderr);
    const binNames = listMjs(path.join(freshTmp, ".bee", "bin"));
    const leftoverShims = binNames.filter((n) => RETIRED_HELPER_NAMES.includes(n));
    check(leftoverShims.length === 0,
      "fresh onboard: a brand-new host's .bee/bin ends with no retired bee_*.mjs shims",
      JSON.stringify(binNames));
    check(binNames.includes("bee.mjs"),
      "fresh onboard: .bee/bin/bee.mjs (the sole dispatcher) is vendored");
  } finally {
    fs.rmSync(freshTmp, { recursive: true, force: true });
    fs.rmSync(freshHome, { recursive: true, force: true });
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
