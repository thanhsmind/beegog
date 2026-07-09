#!/usr/bin/env node
// onboard_bee.mjs - install/update bee in a target repo.
//
//   node onboard_bee.mjs --repo-root <path> [--apply] [--json] [--repo-hooks] [--claude-md]
//
// Plan mode (default) reports {status: 'up_to_date'|'changes_needed', plan:[...]}.
// --apply applies the plan and writes .bee/onboarding.json with managed versions.
// --repo-hooks additionally vendors the plugin hooks into <repo>/.bee/bin/hooks/
// and merges the 6 hook entries into <repo>/.claude/settings.json (with a .bak
// backup) for environments that do not load plugin hooks.
//
// Never overwrites existing .bee/state.json, .bee/decisions.jsonl, or .bee/cells/.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { detectCommands } from "../templates/lib/commands_detect.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPTS_DIR = path.dirname(SCRIPT_PATH);
const HIVE_DIR = path.dirname(SCRIPTS_DIR);
const TEMPLATES_DIR = path.join(HIVE_DIR, "templates");
const TEMPLATES_LIB_DIR = path.join(TEMPLATES_DIR, "lib");
const AGENTS_BLOCK_TEMPLATE = path.join(TEMPLATES_DIR, "AGENTS.block.md");
const PLUGIN_ROOT = path.dirname(path.dirname(HIVE_DIR));
const PLUGIN_HOOKS_DIR = path.join(PLUGIN_ROOT, "hooks");

const ONBOARDING_SCHEMA_VERSION = "1.0";
const FALLBACK_BEE_VERSION = "0.1.0";
const MIN_NODE_MAJOR = 18;
const MARKER_START = "<!-- BEE:START -->";
const MARKER_END = "<!-- BEE:END -->";

const HOOK_FILENAMES = [
  "bee-session-init.mjs",
  "bee-prompt-context.mjs",
  "bee-write-guard.mjs",
  "bee-state-sync.mjs",
  "bee-chain-nudge.mjs",
  "bee-session-close.mjs",
];

const DEFAULT_STATE = {
  schema_version: "1.0",
  phase: "idle",
  feature: null,
  mode: null,
  approved_gates: { context: false, shape: false, execution: false, review: false },
  workers: [],
  summary: "",
  next_action: "Invoke bee-hive.",
};

const DEFAULT_CONFIG = {
  hooks: {
    "session-init": true,
    "prompt-context": true,
    "write-guard": true,
    "state-sync": true,
    "chain-nudge": true,
    "session-close": true,
  },
  lanes: {},
  capabilities: {},
  // Opt-in autopilot (decision 0010): when true, the agent auto-approves
  // Gates 1-3 for tiny/small/standard non-hard-gate work instead of stopping
  // for the human. High-risk/hard-gate work, secret reads, and Gate 4 UAT are
  // never bypassed. Toggle with the bee-bypass-gate skill. Default off.
  gate_bypass: false,
};

const CRITICAL_PATTERNS_STUB = `# Critical Patterns

Mandatory pre-planning / pre-execution context for this repository.
bee-compounding appends hard-won patterns here; keep it short and current.

(none captured yet)
`;

// CLAUDE.md @import fallback: Claude Code auto-loads CLAUDE.md but not
// AGENTS.md; a bare @AGENTS.md line imports the BEE block at context-load
// time (repository-harness pattern). Third belt when plugin hooks are absent.
const CLAUDE_MD_IMPORT_SECTION = `## bee

This repo uses bee. The bare import below loads the BEE operating block from
AGENTS.md at context-load time. Never wrap it in backticks; that disables it.

@AGENTS.md
`;

const CLAUDE_MD_TEMPLATE = `# Project Rules

${CLAUDE_MD_IMPORT_SECTION}`;

// ---------- small utilities ----------

function utcNow() {
  return new Date().toISOString();
}

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function readTextIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function writeFileAtomic(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, content, "utf8");
  fs.renameSync(tmp, filePath);
}

function readJsonIfExists(filePath) {
  const text = readTextIfExists(filePath);
  if (!text.trim()) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function nodeRuntimeStatus() {
  const major = Number.parseInt(String(process.versions.node).split(".")[0] || "0", 10);
  return {
    version: process.versions.node,
    minimum_major: MIN_NODE_MAJOR,
    supported: Number.isFinite(major) && major >= MIN_NODE_MAJOR,
  };
}

function readBeeVersion() {
  const stateSource = readTextIfExists(path.join(TEMPLATES_LIB_DIR, "state.mjs"));
  const match = stateSource.match(/BEE_VERSION\s*=\s*['"]([^'"]+)['"]/);
  return match ? match[1] : FALLBACK_BEE_VERSION;
}

// ---------- template sources ----------

function listTemplateHelpers() {
  if (!fs.existsSync(TEMPLATES_DIR)) {
    return [];
  }
  return fs
    .readdirSync(TEMPLATES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mjs"))
    .map((entry) => entry.name)
    .sort();
}

function listTemplateLibModules() {
  if (!fs.existsSync(TEMPLATES_LIB_DIR)) {
    return [];
  }
  return fs
    .readdirSync(TEMPLATES_LIB_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mjs"))
    .map((entry) => entry.name)
    .sort();
}

function listPluginHooks() {
  if (!fs.existsSync(PLUGIN_HOOKS_DIR)) {
    return [];
  }
  return HOOK_FILENAMES.filter((name) => fs.existsSync(path.join(PLUGIN_HOOKS_DIR, name)));
}

function renderAgentsBlock() {
  const body = readTextIfExists(AGENTS_BLOCK_TEMPLATE).replace(/\s*$/, "");
  return `${MARKER_START}\n${body}\n${MARKER_END}\n`;
}

// ---------- AGENTS.md merging ----------

function agentsBlockPresent(text) {
  return text.includes(MARKER_START) && text.includes(MARKER_END);
}

function extractAgentsBlock(text) {
  const start = text.indexOf(MARKER_START);
  const end = text.indexOf(MARKER_END);
  if (start === -1 || end === -1 || end < start) {
    return null;
  }
  return `${text.slice(start, end + MARKER_END.length)}\n`;
}

function mergeAgentsContent(existing, renderedBlock) {
  if (!existing.trim()) {
    return { text: renderedBlock, status: "created" };
  }
  if (agentsBlockPresent(existing)) {
    const start = existing.indexOf(MARKER_START);
    let end = existing.indexOf(MARKER_END) + MARKER_END.length;
    if (existing[end] === "\n") {
      end += 1;
    }
    const updated = existing.slice(0, start) + renderedBlock + existing.slice(end);
    return { text: `${updated.replace(/\s*$/, "")}\n`, status: "updated" };
  }
  return {
    text: `${existing.replace(/\s*$/, "")}\n\n${renderedBlock}`,
    status: "appended",
  };
}

// ---------- AGENTS.md minimal header (decision D4) ----------
//
// Propose-only Q1 upgrade: when the region outside the BEE markers carries no
// prose, onboarding proposes a minimal header. The any-prose test is the
// mechanical stand-in for the semantic "does this answer what is this
// project?" check - conservative, it never fires on existing prose, and
// whitespace-only or comment-only lines (including lines inside a multi-line
// HTML comment) never count as prose. Existing user content is never touched.

const HEADER_POINTER_CANDIDATES = [
  "README.md",
  "docs/specs/system-overview.md",
  "docs/specs/reading-map.md",
];

function hasProseOutsideBlock(text) {
  let outside = text;
  const start = outside.indexOf(MARKER_START);
  const end = outside.indexOf(MARKER_END);
  if (start !== -1 && end !== -1 && end >= start) {
    outside = outside.slice(0, start) + outside.slice(end + MARKER_END.length);
  }
  // Strip closed HTML comments (multi-line aware). An unclosed comment stays
  // in place and counts as prose - conservative: never propose over content.
  const stripped = outside.replace(/<!--[\s\S]*?-->/g, "");
  return stripped.split("\n").some((line) => line.trim() !== "");
}

function composeAgentsHeader(repoRoot) {
  // Mechanically provable parts only (never-invent): the repo folder name as
  // title, one loud fill-me gap for the project one-liner, and pointer lines
  // only to files that actually exist at plan time.
  const lines = [
    `# ${path.basename(repoRoot)}`,
    "",
    "<!-- [unknown] one-line project description - replace me -->",
  ];
  const pointers = HEADER_POINTER_CANDIDATES.filter((rel) =>
    fs.existsSync(path.join(repoRoot, ...rel.split("/"))),
  );
  if (pointers.length > 0) {
    lines.push("");
    for (const rel of pointers) {
      lines.push(`- ${rel}`);
    }
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

// ---------- repo hooks (.claude/settings.json) ----------

function repoHookCommand(fileName) {
  return `node "$CLAUDE_PROJECT_DIR"/.bee/bin/hooks/${fileName}`;
}

function renderRepoHookEntries() {
  const entry = (fileName) => ({ type: "command", command: repoHookCommand(fileName) });
  return {
    SessionStart: [
      { matcher: "startup|resume|clear|compact", hooks: [entry("bee-session-init.mjs")] },
    ],
    UserPromptSubmit: [{ hooks: [entry("bee-prompt-context.mjs")] }],
    PreToolUse: [
      { matcher: "Edit|Write|MultiEdit|Bash|Read|Glob|Grep", hooks: [entry("bee-write-guard.mjs")] },
    ],
    PostToolUse: [
      { matcher: "TaskCreate|TaskUpdate|TodoWrite", hooks: [entry("bee-state-sync.mjs")] },
    ],
    SubagentStop: [{ hooks: [entry("bee-state-sync.mjs"), entry("bee-chain-nudge.mjs")] }],
    Stop: [{ hooks: [entry("bee-state-sync.mjs"), entry("bee-session-close.mjs")] }],
  };
}

function isBeeHookEntry(entry) {
  for (const hook of entry?.hooks || []) {
    if (String(hook?.command || "").includes(".bee/bin/hooks/bee-")) {
      return true;
    }
  }
  return false;
}

function mergeRepoSettings(settingsPath) {
  const existing = readJsonIfExists(settingsPath) || {};
  const hooks = existing.hooks && typeof existing.hooks === "object" ? existing.hooks : {};
  const merged = { ...hooks };
  let changed = false;

  for (const [eventName, entries] of Object.entries(renderRepoHookEntries())) {
    const current = Array.isArray(merged[eventName]) ? merged[eventName] : [];
    const next = [...current.filter((e) => !isBeeHookEntry(e)), ...entries];
    if (JSON.stringify(current) !== JSON.stringify(next)) {
      changed = true;
    }
    merged[eventName] = next;
  }

  return {
    text: `${JSON.stringify({ ...existing, hooks: merged }, null, 2)}\n`,
    changed,
  };
}

// ---------- standard commands notice (docs/09 item 1, decision D4) ----------

const COMMAND_KEYS = ["setup", "start", "test", "verify"];

function commandsNotices(repoRoot) {
  const config = readJsonIfExists(path.join(repoRoot, ".bee", "config.json")) || {};
  const raw = config.commands && typeof config.commands === "object" ? config.commands : {};
  const recorded = COMMAND_KEYS.filter(
    (key) => typeof raw[key] === "string" && raw[key].trim(),
  );
  if (recorded.length > 0) {
    return [];
  }
  // Detection is propose-only (decision D3): candidates ride the notice for
  // the agent to present as one confirmation question. This script never
  // writes detected values to .bee/config.json — only user-confirmed values
  // are written, by the agent.
  let candidates = [];
  try {
    candidates = detectCommands(repoRoot);
  } catch {
    candidates = [];
  }
  if (candidates.length > 0) {
    const proposals = candidates.map((c) => `${c.key}: ${c.value} — ${c.source}`).join("; ");
    return [
      `No standard commands recorded. Detected candidates: ${proposals}. Present them to the user as one pre-filled confirmation question (skippable) and write only confirmed values to .bee/config.json \`commands\` — never write unconfirmed values (D3). They power the session baseline gate.`,
    ];
  }
  return [
    "No standard commands recorded. Ask the user for the host project's setup/start/test/verify commands and write them to .bee/config.json `commands` (skippable — never invent values). They power the session baseline gate.",
  ];
}

// ---------- plan computation ----------

function computePlan(repoRoot, { repoHooks = false, claudeMd = false } = {}) {
  const plan = [];
  const beeVersion = readBeeVersion();
  const renderedBlock = renderAgentsBlock();

  // 1. AGENTS.md BEE block
  const agentsPath = path.join(repoRoot, "AGENTS.md");
  const agentsText = readTextIfExists(agentsPath);
  if (!agentsText.trim()) {
    plan.push({ action: "create_agents_block", path: "AGENTS.md" });
  } else if (!agentsBlockPresent(agentsText)) {
    plan.push({ action: "append_agents_block", path: "AGENTS.md" });
  } else if (extractAgentsBlock(agentsText) !== renderedBlock) {
    plan.push({ action: "update_agents_block", path: "AGENTS.md" });
  }

  // 1b. minimal header proposal (decision D4, propose-only): fires only when
  // no prose line exists outside the BEE markers - so fresh repos get the
  // header alongside create_agents_block (ordered after it), block-only
  // AGENTS.md files flip up_to_date -> changes_needed (intended upgrade),
  // and any existing prose suppresses the item entirely.
  if (!hasProseOutsideBlock(agentsText)) {
    plan.push({ action: "propose_agents_header", path: "AGENTS.md" });
  }

  // 2. runtime files (create-if-missing only; never overwrite state/decisions/cells)
  const runtimeFiles = [
    [".bee/state.json", () => `${JSON.stringify(DEFAULT_STATE, null, 2)}\n`],
    [".bee/config.json", () => `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`],
    [".bee/reservations.json", () => `${JSON.stringify({ reservations: [] }, null, 2)}\n`],
    [".bee/decisions.jsonl", () => ""],
    [".bee/backlog.jsonl", () => ""],
  ];
  for (const [rel] of runtimeFiles) {
    if (!fs.existsSync(path.join(repoRoot, rel))) {
      plan.push({ action: "create_runtime_file", path: rel });
    }
  }
  for (const relDir of [".bee/cells", ".bee/logs"]) {
    if (!fs.existsSync(path.join(repoRoot, relDir))) {
      plan.push({ action: "create_dir", path: relDir });
    }
  }

  // 3. vendored helpers + lib (copy when missing or drifted)
  for (const name of listTemplateHelpers()) {
    const source = fs.readFileSync(path.join(TEMPLATES_DIR, name), "utf8");
    const target = path.join(repoRoot, ".bee", "bin", name);
    if (readTextIfExists(target) !== source) {
      plan.push({ action: "copy_helper", path: `.bee/bin/${name}` });
    }
  }
  for (const name of listTemplateLibModules()) {
    const source = fs.readFileSync(path.join(TEMPLATES_LIB_DIR, name), "utf8");
    const target = path.join(repoRoot, ".bee", "bin", "lib", name);
    if (readTextIfExists(target) !== source) {
      plan.push({ action: "copy_lib", path: `.bee/bin/lib/${name}` });
    }
  }

  // 4. learnings stub
  if (!fs.existsSync(path.join(repoRoot, "docs", "history", "learnings", "critical-patterns.md"))) {
    plan.push({ action: "create_stub", path: "docs/history/learnings/critical-patterns.md" });
  }

  // 5. repo hooks fallback (--repo-hooks only)
  if (repoHooks) {
    for (const name of listPluginHooks()) {
      const source = fs.readFileSync(path.join(PLUGIN_HOOKS_DIR, name), "utf8");
      const target = path.join(repoRoot, ".bee", "bin", "hooks", name);
      if (readTextIfExists(target) !== source) {
        plan.push({ action: "copy_repo_hook", path: `.bee/bin/hooks/${name}` });
      }
    }
    const settingsPath = path.join(repoRoot, ".claude", "settings.json");
    try {
      if (mergeRepoSettings(settingsPath).changed) {
        plan.push({ action: "merge_repo_hook_settings", path: ".claude/settings.json" });
      }
    } catch {
      plan.push({ action: "merge_repo_hook_settings", path: ".claude/settings.json" });
    }
  }

  // 5b. CLAUDE.md @import fallback (--claude-md only): auto-load the BEE
  // block on Claude Code even when plugin hooks are unavailable. Never
  // touches an existing CLAUDE.md that already imports AGENTS.md.
  if (claudeMd) {
    const claudeMdPath = path.join(repoRoot, "CLAUDE.md");
    if (!fs.existsSync(claudeMdPath)) {
      plan.push({ action: "create_claude_md", path: "CLAUDE.md" });
    } else if (!/^@AGENTS\.md\s*$/m.test(readTextIfExists(claudeMdPath))) {
      plan.push({ action: "append_claude_md_import", path: "CLAUDE.md" });
    }
  }

  // 6. onboarding.json drift (managed versions)
  const desiredManaged = buildManagedVersions(renderedBlock, repoHooks);
  const onboarding = readJsonIfExists(path.join(repoRoot, ".bee", "onboarding.json"));
  const onboardingCurrent =
    onboarding &&
    onboarding.schema_version === ONBOARDING_SCHEMA_VERSION &&
    onboarding.bee_version === beeVersion &&
    JSON.stringify(subsetManaged(onboarding.managed, repoHooks)) ===
      JSON.stringify(subsetManaged(desiredManaged, repoHooks));
  if (!onboardingCurrent) {
    plan.push({ action: "write_onboarding", path: ".bee/onboarding.json" });
  }

  return { plan, beeVersion, renderedBlock, desiredManaged };
}

function buildManagedVersions(renderedBlock, repoHooks) {
  const helpers = {};
  for (const name of listTemplateHelpers()) {
    helpers[name] = sha256(fs.readFileSync(path.join(TEMPLATES_DIR, name), "utf8"));
  }
  const lib = {};
  for (const name of listTemplateLibModules()) {
    lib[name] = sha256(fs.readFileSync(path.join(TEMPLATES_LIB_DIR, name), "utf8"));
  }
  const managed = { agents_block: sha256(renderedBlock), helpers, lib };
  if (repoHooks) {
    const hooks = {};
    for (const name of listPluginHooks()) {
      hooks[name] = sha256(fs.readFileSync(path.join(PLUGIN_HOOKS_DIR, name), "utf8"));
    }
    managed.repo_hooks = hooks;
  }
  return managed;
}

// Compare only the parts we manage in this run: without --repo-hooks, ignore
// any repo_hooks entry recorded by a previous --repo-hooks run.
function subsetManaged(managed, repoHooks) {
  const src = managed && typeof managed === "object" ? managed : {};
  const out = {
    agents_block: src.agents_block || null,
    helpers: src.helpers || {},
    lib: src.lib || {},
  };
  if (repoHooks) {
    out.repo_hooks = src.repo_hooks || {};
  }
  return out;
}

// ---------- apply ----------

function applyPlan(repoRoot, { repoHooks = false, claudeMd = false } = {}) {
  const { plan, beeVersion, renderedBlock, desiredManaged } = computePlan(repoRoot, {
    repoHooks,
    claudeMd,
  });
  const applied = [];

  // Compose the header BEFORE any mergeAgentsContent call (decision D4): it
  // rides the existing-content input of the same merge - one write mechanism,
  // no new merge helper parameter.
  const proposeHeader = plan.some((item) => item.action === "propose_agents_header");
  const headerText = proposeHeader ? composeAgentsHeader(repoRoot) : "";
  let headerApplied = false;

  for (const item of plan) {
    const target = path.join(repoRoot, ...item.path.split("/"));
    switch (item.action) {
      case "create_agents_block":
      case "append_agents_block":
      case "update_agents_block": {
        const merged = mergeAgentsContent(headerText + readTextIfExists(target), renderedBlock);
        writeFileAtomic(target, merged.text);
        headerApplied = proposeHeader;
        break;
      }
      case "propose_agents_header": {
        if (headerApplied) {
          break; // header already rode the block write above
        }
        // Block-only file (already onboarded, block current): prepend the
        // header through the same merge path - the in-place block replace
        // keeps everything outside the markers untouched.
        const merged = mergeAgentsContent(headerText + readTextIfExists(target), renderedBlock);
        writeFileAtomic(target, merged.text);
        headerApplied = true;
        break;
      }
      case "create_runtime_file": {
        if (!fs.existsSync(target)) {
          const rel = item.path;
          let content = "";
          if (rel.endsWith("state.json")) {
            content = `${JSON.stringify(DEFAULT_STATE, null, 2)}\n`;
          } else if (rel.endsWith("config.json")) {
            content = `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`;
          } else if (rel.endsWith("reservations.json")) {
            content = `${JSON.stringify({ reservations: [] }, null, 2)}\n`;
          }
          writeFileAtomic(target, content);
        }
        break;
      }
      case "create_dir": {
        fs.mkdirSync(target, { recursive: true });
        break;
      }
      case "copy_helper": {
        const name = path.basename(item.path);
        writeFileAtomic(target, fs.readFileSync(path.join(TEMPLATES_DIR, name), "utf8"));
        break;
      }
      case "copy_lib": {
        const name = path.basename(item.path);
        writeFileAtomic(target, fs.readFileSync(path.join(TEMPLATES_LIB_DIR, name), "utf8"));
        break;
      }
      case "copy_repo_hook": {
        const name = path.basename(item.path);
        writeFileAtomic(target, fs.readFileSync(path.join(PLUGIN_HOOKS_DIR, name), "utf8"));
        break;
      }
      case "create_stub": {
        writeFileAtomic(target, CRITICAL_PATTERNS_STUB);
        break;
      }
      case "create_claude_md": {
        writeFileAtomic(target, CLAUDE_MD_TEMPLATE);
        break;
      }
      case "append_claude_md_import": {
        const existing = readTextIfExists(target) || "";
        const separator = existing.endsWith("\n") ? "\n" : "\n\n";
        writeFileAtomic(target, `${existing}${separator}${CLAUDE_MD_IMPORT_SECTION}`);
        break;
      }
      case "merge_repo_hook_settings": {
        const merged = mergeRepoSettings(target);
        if (fs.existsSync(target)) {
          fs.copyFileSync(target, `${target}.bak`);
        }
        writeFileAtomic(target, merged.text);
        break;
      }
      case "write_onboarding": {
        // handled after the loop so managed versions reflect the final state
        break;
      }
      default:
        break;
    }
    applied.push(item);
  }

  // Always (re)write onboarding.json on apply so managed versions are current.
  const onboardingPath = path.join(repoRoot, ".bee", "onboarding.json");
  const previous = readJsonIfExists(onboardingPath) || {};
  const managed = { ...desiredManaged };
  if (!repoHooks && previous.managed && previous.managed.repo_hooks) {
    // preserve the record of a prior --repo-hooks install
    managed.repo_hooks = previous.managed.repo_hooks;
  }
  const onboardingPayload = {
    schema_version: ONBOARDING_SCHEMA_VERSION,
    bee_version: beeVersion,
    managed,
    created_at: previous.created_at || utcNow(),
    updated_at: utcNow(),
  };
  writeFileAtomic(onboardingPath, `${JSON.stringify(onboardingPayload, null, 2)}\n`);

  return { applied, onboarding: onboardingPayload, beeVersion };
}

// ---------- CLI ----------

function parseArgs(argv) {
  const args = { repoRoot: null, apply: false, json: false, repoHooks: false, claudeMd: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--repo-root") {
      args.repoRoot = argv[i + 1];
      i += 1;
    } else if (arg.startsWith("--repo-root=")) {
      args.repoRoot = arg.slice("--repo-root=".length);
    } else if (arg === "--apply") {
      args.apply = true;
    } else if (arg === "--json") {
      args.json = true;
    } else if (arg === "--repo-hooks") {
      args.repoHooks = true;
    } else if (arg === "--claude-md") {
      args.claudeMd = true;
    } else if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        "Usage: onboard_bee.mjs --repo-root <path> [--apply] [--json] [--repo-hooks] [--claude-md]\n",
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function emit(payload, asJson) {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }
  process.stdout.write(`bee onboarding - repo: ${payload.repo_root}\n`);
  process.stdout.write(`status: ${payload.status}\n`);
  const items = payload.plan || payload.applied || [];
  for (const item of items) {
    process.stdout.write(`  ${item.action}  ${item.path}\n`);
  }
  if (items.length === 0) {
    process.stdout.write("  (nothing to do)\n");
  }
  for (const notice of payload.notices || []) {
    process.stdout.write(`notice: ${notice}\n`);
  }
}

export function main(argv = process.argv.slice(2)) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ error: String(error.message || error) })}\n`);
    return 1;
  }

  const runtime = nodeRuntimeStatus();
  if (!runtime.supported) {
    emit(
      {
        repo_root: args.repoRoot || process.cwd(),
        status: "missing_runtime",
        error: `bee requires Node.js ${MIN_NODE_MAJOR}+ (found ${runtime.version}).`,
      },
      args.json,
    );
    return 1;
  }

  const repoRoot = path.resolve(args.repoRoot || process.cwd());

  try {
    const options = { repoHooks: args.repoHooks, claudeMd: args.claudeMd };
    if (!args.apply) {
      const { plan, beeVersion } = computePlan(repoRoot, options);
      emit(
        {
          repo_root: repoRoot,
          status: plan.length === 0 ? "up_to_date" : "changes_needed",
          bee_version: beeVersion,
          plan,
          notices: commandsNotices(repoRoot),
        },
        args.json,
      );
      return 0;
    }

    const result = applyPlan(repoRoot, options);
    const recheck = computePlan(repoRoot, options);
    emit(
      {
        repo_root: repoRoot,
        status: "applied",
        bee_version: result.beeVersion,
        applied: result.applied,
        recheck: recheck.plan.length === 0 ? "up_to_date" : "changes_needed",
        recheck_plan: recheck.plan,
        onboarding: result.onboarding,
        notices: commandsNotices(repoRoot),
      },
      args.json,
    );
    return 0;
  } catch (error) {
    process.stdout.write(
      `${JSON.stringify({ error: String((error && error.message) || error) })}\n`,
    );
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === SCRIPT_PATH) {
  process.exitCode = main();
}
