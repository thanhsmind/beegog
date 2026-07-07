#!/usr/bin/env node
// onboard_bee.mjs - install/update bee in a target repo.
//
//   node onboard_bee.mjs --repo-root <path> [--apply] [--json] [--repo-hooks]
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
  next_action: "Invoke bee:hive.",
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
};

const CRITICAL_PATTERNS_STUB = `# Critical Patterns

Mandatory pre-planning / pre-execution context for this repository.
bee:compounding appends hard-won patterns here; keep it short and current.

(none captured yet)
`;

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

// ---------- plan computation ----------

function computePlan(repoRoot, { repoHooks = false } = {}) {
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
  if (!fs.existsSync(path.join(repoRoot, "history", "learnings", "critical-patterns.md"))) {
    plan.push({ action: "create_stub", path: "history/learnings/critical-patterns.md" });
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

function applyPlan(repoRoot, { repoHooks = false } = {}) {
  const { plan, beeVersion, renderedBlock, desiredManaged } = computePlan(repoRoot, { repoHooks });
  const applied = [];

  for (const item of plan) {
    const target = path.join(repoRoot, ...item.path.split("/"));
    switch (item.action) {
      case "create_agents_block":
      case "append_agents_block":
      case "update_agents_block": {
        const merged = mergeAgentsContent(readTextIfExists(target), renderedBlock);
        writeFileAtomic(target, merged.text);
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
  const args = { repoRoot: null, apply: false, json: false, repoHooks: false };
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
    } else if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        "Usage: onboard_bee.mjs --repo-root <path> [--apply] [--json] [--repo-hooks]\n",
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
    if (!args.apply) {
      const { plan, beeVersion } = computePlan(repoRoot, { repoHooks: args.repoHooks });
      emit(
        {
          repo_root: repoRoot,
          status: plan.length === 0 ? "up_to_date" : "changes_needed",
          bee_version: beeVersion,
          plan,
        },
        args.json,
      );
      return 0;
    }

    const result = applyPlan(repoRoot, { repoHooks: args.repoHooks });
    const recheck = computePlan(repoRoot, { repoHooks: args.repoHooks });
    emit(
      {
        repo_root: repoRoot,
        status: "applied",
        bee_version: result.beeVersion,
        applied: result.applied,
        recheck: recheck.plan.length === 0 ? "up_to_date" : "changes_needed",
        recheck_plan: recheck.plan,
        onboarding: result.onboarding,
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
