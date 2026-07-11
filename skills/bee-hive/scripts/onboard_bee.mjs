#!/usr/bin/env node
// onboard_bee.mjs - install/update bee in a target repo.
//
//   node onboard_bee.mjs --repo-root <path> [--apply] [--json] [--repo-hooks]
//                        [--claude-md] [--force-downgrade]
//
// Plan mode (default) reports {status: 'up_to_date'|'changes_needed'|
// 'blocked_downgrade'|'blocked_no_source', plan:[...]}.
// --apply applies the plan and writes .bee/onboarding.json with managed versions.
// Every apply also mirrors the bee-* skill set into the user's global
// ~/.claude/skills (D1-D5): drift shows up as sync_skill/remove_skill plan
// items, an older source refuses with zero mutations (--force-downgrade
// overrides only a fully-resolved version refusal), and non-bee skills are
// structurally untouchable.
// --repo-hooks additionally vendors the plugin hooks into <repo>/.bee/bin/hooks/
// and merges the 6 hook entries into <repo>/.claude/settings.json (with a .bak
// backup) for environments that do not load plugin hooks.
//
// Never overwrites existing .bee/state.json, .bee/decisions.jsonl, or .bee/cells/.

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
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
  // Model tiers, runtime-keyed (decision 0012). swarming resolves tier → model
  // per dispatch so the strongest model stays scarce (ceiling) and cheap models
  // run the loops (extraction/generation). Edit per repo. null = the runtime
  // cannot switch per-agent model → tier enforced via read budget + output cap.
  // Only the cheaper tiers are configured; the ceiling is always the session
  // model (decision 0015), so it has no entry here.
  models: {
    claude: { extraction: "haiku", generation: "sonnet" },
    codex: { extraction: null, generation: null },
  },
  // Advisor mode (decisions 0013/0015): run the session on the generation tier
  // and consult a STRONGER model (advisor.model) only at the listed hard calls.
  // Off by default.
  advisor: { enabled: false, at: ["shape", "execution", "blocked"], model: "fable" },
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

// Legacy reporting-only reader: silently falls back to 0.1.0. NEVER used for
// skill-sync preflight decisions (D3) - see readVersionStrict below.
function readBeeVersion() {
  const stateSource = readTextIfExists(path.join(TEMPLATES_LIB_DIR, "state.mjs"));
  const match = stateSource.match(/BEE_VERSION\s*=\s*['"]([^'"]+)['"]/);
  return match ? match[1] : FALLBACK_BEE_VERSION;
}

// ---------- global skill sync (D1-D5) ----------
//
// Source = the skill tree the RUNNING script belongs to (D2), proven by a
// realpath identity with its own bee-hive dir (F2: a misplaced launcher never
// adopts a sibling tree). Target = the user's global skills dir - there is
// deliberately NO override of any kind, env or CLI (D1/F5: an override would
// widen the deletion root to arbitrary paths). Tests isolate by redirecting
// HOME/USERPROFILE for the spawned process, which os.homedir() honors.

const SKILL_DIR_RE = /^bee-/;

function skillsTargetRoot() {
  return path.join(os.homedir(), ".claude", "skills");
}

function lstatIfExists(p) {
  try {
    return fs.lstatSync(p);
  } catch {
    return null;
  }
}

// Review P1-8: every blocked_no_source return happens BEFORE the three-version
// preflight ever runs (identity/overlap are structural checks, independent of
// file content) - so none of the three versions were, or could be, resolved.
// D3's letter requires all three reported on every blocked return; "unknown"
// is the honest label for "resolution was impossible", distinct from the
// version-preflight's own "absent" state (a tree that provably does not exist).
function unknownVersionsTriple() {
  return { source: "unknown", host_helpers: "unknown", installed_skills: "unknown" };
}

// Fallback-free version reader (D3, hardened per review P1-1/P1-2). The
// legacy readBeeVersion() silently returns 0.1.0 on a missing/unparsable
// state.mjs, which would let a resolution failure masquerade as an old version
// and become force-able. Here: treeExists=false -> "absent" (fresh install /
// first onboard, proceed); an EXISTING tree whose version cannot be read ->
// "unknown" (refuse, never forceable). "Read" is strict: the marker must be a
// REGULAR, non-symlinked file - when componentRoot is given, every path
// component from that root down to the marker is lstat'ed (a symlinked
// directory on the way is as untrusted as a symlinked marker); without it the
// marker file itself is lstat'ed - and the content must carry exactly ONE
// line-anchored `export const BEE_VERSION = 'x.y.z'` declaration. Substring
// matches (comment decoys) never resolve; multiple declarations are unknown.
const BEE_VERSION_LINE_RE = /^export const BEE_VERSION = ['"]([^'"]*)['"];?[ \t]*\r?$/gm;

function readVersionStrict(stateFile, treeExists, { componentRoot = null } = {}) {
  if (!treeExists) {
    return { state: "absent", value: null };
  }
  const unknown = { state: "unknown", value: null };
  const components = [];
  if (componentRoot) {
    const rel = path.relative(componentRoot, stateFile);
    if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
      return unknown; // marker escaped the managed root: never trusted
    }
    let current = componentRoot;
    for (const part of rel.split(path.sep)) {
      current = path.join(current, part);
      components.push(current);
    }
  } else {
    components.push(stateFile);
  }
  for (let i = 0; i < components.length; i += 1) {
    const st = lstatIfExists(components[i]);
    const isMarker = i === components.length - 1;
    if (!st || st.isSymbolicLink() || (isMarker ? !st.isFile() : !st.isDirectory())) {
      return unknown;
    }
  }
  let text = null;
  try {
    text = fs.readFileSync(stateFile, "utf8");
  } catch {
    return unknown;
  }
  const matches = [...text.matchAll(BEE_VERSION_LINE_RE)];
  if (matches.length !== 1 || !/^\d+\.\d+\.\d+$/.test(matches[0][1])) {
    return unknown;
  }
  return { state: "resolved", value: matches[0][1] };
}

function compareVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) {
      return pa[i] - pb[i];
    }
  }
  return 0;
}

function versionLabel(v) {
  return v.state === "resolved" ? v.value : v.state;
}

// lstat-only walk of one skill dir: symlinks are never followed. The first
// symlink (or other non-file/dir entry) found blocks the WHOLE skill (F6 - a
// symlinked skill dir is plausibly a developer's live checkout; writing
// through or unlinking it would destroy real work).
function walkSkillTree(rootDir) {
  const files = new Map(); // rel path ("/"-joined) -> sha256
  const dirs = [];
  let blocked = null;
  const walk = (dir, relPrefix) => {
    const entries = fs
      .readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      if (blocked) {
        return;
      }
      const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
      const abs = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        blocked = { path: rel, reason: "symlink" };
        return;
      }
      if (entry.isDirectory()) {
        dirs.push(rel);
        walk(abs, rel);
      } else if (entry.isFile()) {
        files.set(rel, sha256(fs.readFileSync(abs)));
      } else {
        blocked = { path: rel, reason: "unsupported entry type" };
        return;
      }
    }
  };
  walk(rootDir, "");
  return { files, dirs, blocked };
}

function manifestFingerprint(files) {
  return JSON.stringify([...files.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)));
}

// The deletion domain is constructed here: only /^bee-/ entries are ever
// enumerated, so non-bee skills are structurally unreachable - the fence is
// the iteration domain, not a guard clause (D4).
function listBeeSkillEntries(root) {
  if (!fs.existsSync(root)) {
    return [];
  }
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => SKILL_DIR_RE.test(entry.name))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

// Canonical filesystem identity for case-alias detection (review P1-5): on a
// case-insensitive filesystem, `bee-hive` and `bee-Hive` are two NAMES for one
// physical entry - exact-case string comparison would let the sync pass write
// it and the removal pass then delete it. Identity is dev:ino via lstat (never
// follows links); any two bee-* names resolving to one identity block those
// skills loudly - never sync-then-delete.
function entryIdentity(p) {
  const st = lstatIfExists(p);
  return st ? `${st.dev}:${st.ino}` : null;
}

// Probe every candidate name (source names + installed entries) under the
// target root; two DIFFERENT names on one physical identity collide - all
// names involved are returned as blocked.
function detectAliasCollisions(sourceNames, targetRoot) {
  const names = new Set(sourceNames);
  for (const entry of listBeeSkillEntries(targetRoot)) {
    names.add(entry.name);
  }
  const byIdentity = new Map();
  for (const name of names) {
    const id = entryIdentity(path.join(targetRoot, name));
    if (!id) {
      continue;
    }
    if (!byIdentity.has(id)) {
      byIdentity.set(id, []);
    }
    byIdentity.get(id).push(name);
  }
  const collided = new Set();
  for (const aliasNames of byIdentity.values()) {
    if (aliasNames.length > 1) {
      for (const n of aliasNames) {
        collided.add(n);
      }
    }
  }
  return collided;
}

// Nested variant of the same check inside ONE skill: every source and target
// rel path is probed under the installed skill dir; two different rels
// resolving to one physical entry (e.g. references/ vs References/ on a
// case-insensitive fs) block the whole skill.
function detectNestedAlias(targetDir, sourceWalk, targetWalk) {
  const rels = new Set([
    ...sourceWalk.files.keys(),
    ...sourceWalk.dirs,
    ...targetWalk.files.keys(),
    ...targetWalk.dirs,
  ]);
  const byIdentity = new Map();
  for (const rel of rels) {
    const id = entryIdentity(path.join(targetDir, ...rel.split("/")));
    if (!id) {
      continue;
    }
    if (byIdentity.has(id) && byIdentity.get(id) !== rel) {
      return { a: byIdentity.get(id), b: rel };
    }
    byIdentity.set(id, rel);
  }
  return null;
}

// Review P1-9: every plan item's `path` is root-relative, but legacy items
// (repo files) and skill-stage items (global ~/.claude/skills entries) are
// relative to TWO DIFFERENT roots - an approval surface reading `path` alone
// could render a global deletion against repoRoot. `scope` disambiguates:
// "installed" = target_root-relative (skillsTargetRoot()), "source" =
// source_root-relative (the running script's own tree). Legacy items carry no
// `scope` at all (unchanged) - their root is always repoRoot, documented in
// SKILL.md alongside this field.
function aliasBlockedItem(name, detail) {
  return {
    action: "blocked_alias",
    skill: name,
    path: name,
    scope: "installed", // alias identity is always probed under targetRoot
    reason: `installed ${name} ${detail} - blocked, never sync-then-delete`,
  };
}

// D4/D5 drift plan items. Content difference IS drift, at any version (D5);
// a bee-* skill absent from the anchored source IS an intentional removal (D2).
function computeSkillItems(sourceRoot, targetRoot) {
  const items = [];
  const sourceEntries = listBeeSkillEntries(sourceRoot);
  const sourceNames = new Set(sourceEntries.map((entry) => entry.name));
  const aliasCollisions = detectAliasCollisions(sourceNames, targetRoot);

  for (const entry of sourceEntries) {
    const name = entry.name;
    if (aliasCollisions.has(name)) {
      items.push(aliasBlockedItem(name,
        "shares one physical entry with a differently-named bee-* entry (case-insensitive alias)"));
      continue;
    }
    if (entry.isSymbolicLink()) {
      items.push({
        action: "blocked_symlink",
        skill: name,
        path: name,
        scope: "source",
        reason: `source ${name} is a symlink - skipped, never followed`,
      });
      continue;
    }
    if (!entry.isDirectory()) {
      continue; // stray bee-* file in source: not a skill dir
    }
    const sourceWalk = walkSkillTree(path.join(sourceRoot, name));
    if (sourceWalk.blocked) {
      items.push({
        action: "blocked_symlink",
        skill: name,
        path: `${name}/${sourceWalk.blocked.path}`,
        scope: "source",
        reason: `source ${name} contains a ${sourceWalk.blocked.reason} at ${sourceWalk.blocked.path} - skipped`,
      });
      continue;
    }
    const targetDir = path.join(targetRoot, name);
    const targetStat = lstatIfExists(targetDir);
    if (targetStat && targetStat.isSymbolicLink()) {
      items.push({
        action: "blocked_symlink",
        skill: name,
        path: name,
        scope: "installed",
        reason: `installed ${name} is a symlink (plausibly a live checkout) - skipped, never written through or unlinked`,
      });
      continue;
    }
    if (!targetStat || !targetStat.isDirectory()) {
      // absent, or a non-link type collision (remove entry, write source shape)
      items.push({ action: "sync_skill", skill: name, path: name, scope: "installed" });
      continue;
    }
    const targetWalk = walkSkillTree(targetDir);
    if (targetWalk.blocked) {
      items.push({
        action: "blocked_symlink",
        skill: name,
        path: `${name}/${targetWalk.blocked.path}`,
        scope: "installed",
        reason: `installed ${name} contains a ${targetWalk.blocked.reason} at ${targetWalk.blocked.path} - skipped, nothing inside it written or deleted`,
      });
      continue;
    }
    const nestedAlias = detectNestedAlias(targetDir, sourceWalk, targetWalk);
    if (nestedAlias) {
      items.push(aliasBlockedItem(name,
        `has nested entries ${nestedAlias.a} and ${nestedAlias.b} resolving to one physical entry (case-insensitive alias)`));
      continue;
    }
    if (manifestFingerprint(sourceWalk.files) !== manifestFingerprint(targetWalk.files)) {
      items.push({ action: "sync_skill", skill: name, path: name, scope: "installed" });
    }
  }

  for (const entry of listBeeSkillEntries(targetRoot)) {
    const name = entry.name;
    if (sourceNames.has(name)) {
      continue;
    }
    if (aliasCollisions.has(name)) {
      items.push(aliasBlockedItem(name,
        "shares one physical entry with a differently-named bee-* entry (case-insensitive alias)"));
      continue;
    }
    if (entry.isSymbolicLink()) {
      items.push({
        action: "blocked_symlink",
        skill: name,
        path: name,
        scope: "installed",
        reason: `installed ${name} is a symlink (plausibly a live checkout) - skipped, never unlinked`,
      });
      continue;
    }
    if (!entry.isDirectory()) {
      continue; // deletion domain is /^bee-/ DIRECTORY entries only (D4)
    }
    const targetWalk = walkSkillTree(path.join(targetRoot, name));
    if (targetWalk.blocked) {
      items.push({
        action: "blocked_symlink",
        skill: name,
        path: `${name}/${targetWalk.blocked.path}`,
        scope: "installed",
        reason: `installed ${name} contains a ${targetWalk.blocked.reason} at ${targetWalk.blocked.path} - skipped, nothing deleted`,
      });
      continue;
    }
    items.push({ action: "remove_skill", skill: name, path: name, scope: "installed" });
  }

  return items;
}

// D2 resolution + D3 three-version preflight. Fully read-only.
function computeSkillSync(repoRoot) {
  const sourceRoot = path.dirname(HIVE_DIR);
  const targetRoot = skillsTargetRoot();
  const result = {
    mode: null, // "sync" | "fresh" | "noop" | null (blocked before resolution)
    source_root: sourceRoot,
    target_root: targetRoot,
    versions: null,
    blocked: null, // { status, reason, forceable }
    items: [],
  };

  // Identity anchor (F2): the source is authoritative only if the running
  // script's own skill dir IS <sourceRoot>/bee-hive by realpath.
  let identityOk = false;
  try {
    identityOk =
      fs.realpathSync(HIVE_DIR) === fs.realpathSync(path.join(sourceRoot, "bee-hive"));
  } catch {
    identityOk = false;
  }
  if (!identityOk) {
    result.versions = unknownVersionsTriple();
    result.blocked = {
      status: "blocked_no_source",
      reason:
        "no authoritative skill source: the running script's tree failed the bee-hive realpath identity check",
      forceable: false,
    };
    return result;
  }

  // Source/target relationship. Never realpath a nonexistent target (absent
  // target = fresh install); ancestor overlap fails closed (F6).
  const realSource = fs.realpathSync(sourceRoot);
  const targetExists = fs.existsSync(targetRoot);
  const realTarget = targetExists ? fs.realpathSync(targetRoot) : path.resolve(targetRoot);

  // Repo<->target overlap (review P1-4): a repo living under the skills root
  // (or containing it) must never be mutable or deletable by its own onboard -
  // the remove_skill pass could erase the live checkout, git history included.
  // Refused at preflight, never forceable, zero mutations.
  let realRepo;
  try {
    realRepo = fs.realpathSync(repoRoot);
  } catch {
    realRepo = path.resolve(repoRoot);
  }
  if (
    realRepo === realTarget ||
    realRepo.startsWith(realTarget + path.sep) ||
    realTarget.startsWith(realRepo + path.sep)
  ) {
    result.versions = unknownVersionsTriple();
    result.blocked = {
      status: "blocked_no_source",
      reason:
        "repo root and the global skills root overlap (one contains the other) - a repo inside the managed skill target must never be touched by its own onboard, refusing fail-closed",
      forceable: false,
    };
    return result;
  }

  if (targetExists && realSource === realTarget) {
    result.mode = "noop"; // running the installed copy itself (D2)
  } else if (
    realTarget.startsWith(realSource + path.sep) ||
    realSource.startsWith(realTarget + path.sep)
  ) {
    result.versions = unknownVersionsTriple();
    result.blocked = {
      status: "blocked_no_source",
      reason:
        "source and target skill roots overlap (one contains the other) - refusing fail-closed",
      forceable: false,
    };
    return result;
  } else {
    result.mode = targetExists ? "sync" : "fresh";
  }

  // Three-version preflight (D3): source, host vendored helpers (the physical
  // bytes - onboarding.json can lie), installed skills (the installed tree
  // carries its own version; no separate marker file).
  const sourceVersion = readVersionStrict(
    path.join(HIVE_DIR, "templates", "lib", "state.mjs"),
    true, // the running script's tree exists by definition
  );
  const hostStateFile = path.join(repoRoot, ".bee", "bin", "lib", "state.mjs");
  const hostVersion = readVersionStrict(hostStateFile, fs.existsSync(hostStateFile));
  // Review P1-1: "absent" is earned only by a target with NO lstat-visible
  // bee-* entry at all (a true fresh install). ANY bee-* presence without a
  // readable bee-hive version marker is "unknown" - refuse, never forceable:
  // a target holding newer bee-* skills but no readable bee-hive must never
  // read as fresh and get overwritten/deleted by an older source.
  const installedHive = path.join(targetRoot, "bee-hive");
  let installedTreeExists = false;
  if (targetExists) {
    try {
      installedTreeExists = fs
        .readdirSync(targetRoot, { withFileTypes: true })
        .some((entry) => SKILL_DIR_RE.test(entry.name));
    } catch {
      installedTreeExists = true; // unreadable target: fail closed -> unknown
    }
  }
  const installedVersion =
    result.mode === "noop"
      ? sourceVersion
      : readVersionStrict(
          path.join(installedHive, "templates", "lib", "state.mjs"),
          installedTreeExists,
          { componentRoot: targetRoot }, // lstat every component inside the managed target (review P1-2)
        );
  result.versions = {
    source: versionLabel(sourceVersion),
    host_helpers: versionLabel(hostVersion),
    installed_skills: versionLabel(installedVersion),
  };

  const unknowns = [
    ["source", sourceVersion],
    ["host_helpers", hostVersion],
    ["installed_skills", installedVersion],
  ]
    .filter(([, v]) => v.state === "unknown")
    .map(([name]) => name);
  if (unknowns.length > 0) {
    result.blocked = {
      status: "blocked_downgrade",
      reason: `version unresolvable for ${unknowns.join(", ")}: tree exists but its version cannot be read - refusing (never forceable)`,
      forceable: false,
    };
    return result;
  }
  const older = [];
  if (hostVersion.state === "resolved" && compareVersions(sourceVersion.value, hostVersion.value) < 0) {
    older.push(`host_helpers ${hostVersion.value}`);
  }
  if (
    installedVersion.state === "resolved" &&
    compareVersions(sourceVersion.value, installedVersion.value) < 0
  ) {
    older.push(`installed_skills ${installedVersion.value}`);
  }
  if (older.length > 0) {
    // --force-downgrade may override ONLY when all three versions resolved
    // numeric (D3): absent/unknown trees are resolution states, not versions.
    const allNumeric = [sourceVersion, hostVersion, installedVersion].every(
      (v) => v.state === "resolved",
    );
    result.blocked = {
      status: "blocked_downgrade",
      reason: `source ${sourceVersion.value} is older than ${older.join(" and ")}${
        allNumeric ? " - refusing (--force-downgrade overrides after review)" : " - refusing (not forceable: not all versions resolved numeric)"
      }`,
      forceable: allNumeric,
    };
  }

  if (result.mode === "sync" || result.mode === "fresh") {
    if (!result.blocked || result.blocked.forceable) {
      result.items = computeSkillItems(sourceRoot, targetRoot);
    }
  }
  return result;
}

// Unpredictable temp names inside the managed namespace (F6): a predictable
// <file>.tmp under ~/.claude/skills would be a symlink-swap target.
function writeFileAtomicRandom(filePath, buffer) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${crypto.randomBytes(8).toString("hex")}.tmp`;
  fs.writeFileSync(tmp, buffer);
  fs.renameSync(tmp, filePath);
}

// Mirror one bee-* skill dir into the target (D4/D5). Re-verifies the symlink
// policy at apply time so plan-to-apply races fail closed.
function applySyncSkill(sourceRoot, targetRoot, name) {
  const sourceDir = path.join(sourceRoot, name);
  const sourceStat = lstatIfExists(sourceDir);
  if (!sourceStat || sourceStat.isSymbolicLink() || !sourceStat.isDirectory()) {
    return { blocked: `source ${name} is not a plain directory - skipped` };
  }
  const sourceWalk = walkSkillTree(sourceDir);
  if (sourceWalk.blocked) {
    return {
      blocked: `source ${name} contains a ${sourceWalk.blocked.reason} at ${sourceWalk.blocked.path} - skipped`,
    };
  }
  // Apply-time alias recheck (review P1-5): plan-to-apply races fail closed.
  if (detectAliasCollisions(new Set([name]), targetRoot).has(name)) {
    return {
      blocked: `installed ${name} shares one physical entry with a differently-named bee-* entry (case-insensitive alias) - skipped, never sync-then-delete`,
    };
  }
  const targetDir = path.join(targetRoot, name);
  let targetStat = lstatIfExists(targetDir);
  if (targetStat && targetStat.isSymbolicLink()) {
    return {
      blocked: `installed ${name} is a symlink (plausibly a live checkout) - skipped, never written through or unlinked`,
    };
  }
  let targetWalk = { files: new Map(), dirs: [] };
  if (targetStat && targetStat.isDirectory()) {
    const walked = walkSkillTree(targetDir);
    if (walked.blocked) {
      return {
        blocked: `installed ${name} contains a ${walked.blocked.reason} at ${walked.blocked.path} - skipped, nothing inside it written or deleted`,
      };
    }
    targetWalk = walked;
  } else if (targetStat) {
    // non-link type collision: remove the entry, write the source shape
    fs.rmSync(targetDir, { force: true });
    targetStat = null;
  }
  const nestedAlias = detectNestedAlias(targetDir, sourceWalk, targetWalk);
  if (nestedAlias) {
    return {
      blocked: `installed ${name} has nested entries ${nestedAlias.a} and ${nestedAlias.b} resolving to one physical entry (case-insensitive alias) - skipped, never sync-then-delete`,
    };
  }
  fs.mkdirSync(targetDir, { recursive: true });
  const sourceDirSet = new Set(sourceWalk.dirs);
  // Phase 1 - cleanup, deepest-first, BEFORE materializing anything (review
  // P1-3: the old order ran cleanup from the stale target snapshot AFTER
  // writing the source shape, deleting freshly written content on dir<->file
  // transitions). Every removal below targets a pre-write snapshot entry that
  // is stale or of the opposite type; source-shaped paths are never touched
  // (a source file's ancestors are all source dirs, so no stale dir can
  // contain a kept file).
  const staleEntries = [
    ...[...targetWalk.files.keys()]
      .filter((rel) => !sourceWalk.files.has(rel))
      .map((rel) => ({ rel, recursive: false })),
    ...targetWalk.dirs
      .filter((rel) => !sourceDirSet.has(rel))
      .map((rel) => ({ rel, recursive: true })),
  ].sort((a, b) => b.rel.split("/").length - a.rel.split("/").length);
  for (const { rel, recursive } of staleEntries) {
    fs.rmSync(path.join(targetDir, ...rel.split("/")), { recursive, force: true });
  }
  // Phase 2 - materialize the source shape onto the cleaned target: every
  // remaining target entry now matches its source type, so a plain mkdir +
  // atomic write per path suffices.
  for (const rel of sourceWalk.dirs) {
    fs.mkdirSync(path.join(targetDir, ...rel.split("/")), { recursive: true });
  }
  for (const [rel, hash] of sourceWalk.files) {
    if (targetWalk.files.get(rel) === hash) {
      continue; // already byte-identical; cleanup above never touches source-shaped rels
    }
    writeFileAtomicRandom(
      path.join(targetDir, ...rel.split("/")),
      fs.readFileSync(path.join(sourceDir, ...rel.split("/"))),
    );
  }
  return { blocked: null };
}

// Remove one bee-* skill dir from the target (D4). The /^bee-/ recheck is a
// structural backstop; the iteration domain already guarantees it.
function applyRemoveSkill(targetRoot, name) {
  if (!SKILL_DIR_RE.test(name)) {
    return { blocked: `refusing to remove ${name}: outside the bee-* namespace` };
  }
  const targetDir = path.join(targetRoot, name);
  const st = lstatIfExists(targetDir);
  if (!st) {
    return { blocked: null }; // already gone
  }
  if (st.isSymbolicLink()) {
    return {
      blocked: `installed ${name} is a symlink (plausibly a live checkout) - skipped, never unlinked`,
    };
  }
  if (!st.isDirectory()) {
    return { blocked: `installed ${name} is not a directory - outside the deletion domain, skipped` };
  }
  // Apply-time alias recheck (review P1-5): never delete a physical entry that
  // another bee-* name (e.g. the sync pass's fresh output) also resolves to.
  if (detectAliasCollisions(new Set([name]), targetRoot).has(name)) {
    return {
      blocked: `installed ${name} shares one physical entry with a differently-named bee-* entry (case-insensitive alias) - skipped, never sync-then-delete`,
    };
  }
  const walked = walkSkillTree(targetDir);
  if (walked.blocked) {
    return {
      blocked: `installed ${name} contains a ${walked.blocked.reason} at ${walked.blocked.path} - skipped, nothing deleted`,
    };
  }
  fs.rmSync(targetDir, { recursive: true, force: true });
  return { blocked: null };
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
    // PreCompact mirrors the plugin hooks.json (decision 0017): an unflushed
    // capture queue must warn LOUDLY before compaction buries its context.
    PreCompact: [{ hooks: [entry("bee-session-close.mjs")] }],
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

function commandsNotices(repoRoot, { firstOnboard = false } = {}) {
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
  const notices = [
    "No standard commands recorded. Ask the user for the host project's setup/start/test/verify commands and write them to .bee/config.json `commands` (skippable — never invent values). They power the session baseline gate.",
  ];
  // P1 / docs/09 item 6: first onboard of a repo without any detectable build →
  // offer the init lane. Planning convention, not a new skill: the first slice
  // is one init cell whose must_haves are the initialization checklist.
  if (firstOnboard) {
    notices.push(
      "Greenfield init lane (docs/09 item 6): this is the first onboard and no build was detected. Offer the init lane before any feature work — the first planning slice is one init cell whose must_haves are exactly: setup succeeds from scratch, one passing test exists, standard commands are recorded in .bee/config.json, and the repo has a clean first commit.",
    );
  }
  return notices;
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

  // 7. global skill sync (D1-D5): drift between the running tree and the
  // installed ~/.claude/skills/bee-* set appears as plan items. Read-only.
  const skillSync = computeSkillSync(repoRoot);
  if (!skillSync.blocked) {
    plan.push(...skillSync.items);
  }

  return { plan, beeVersion, renderedBlock, desiredManaged, skillSync };
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

function applyPlan(repoRoot, { repoHooks = false, claudeMd = false, forceDowngrade = false } = {}) {
  const { plan, beeVersion, renderedBlock, desiredManaged, skillSync } = computePlan(repoRoot, {
    repoHooks,
    claudeMd,
  });

  // D3 preflight: refusal aborts the ENTIRE apply BEFORE any write - the item
  // loop below and the unconditional onboarding.json rewrite after it are
  // unreachable on refusal, so a refused apply mutates nothing anywhere
  // (repo or global). --force-downgrade overrides only a version refusal in
  // which all three versions resolved numeric; unknown and blocked_no_source
  // are resolution failures and are never forceable.
  let forcedDowngrade = false;
  if (skillSync.blocked) {
    if (forceDowngrade && skillSync.blocked.forceable) {
      forcedDowngrade = true;
      plan.push(...skillSync.items); // computePlan withholds items while blocked
    } else {
      // Review P1-6: computeSkillSync() already computed skillSync.items
      // whenever the refusal is forceable (empty [] otherwise) - a human
      // deciding whether to pass --force-downgrade must see exactly what it
      // will overwrite/delete BEFORE authorizing it, not only after the fact
      // in a forced apply's own report. Surfaced here so the refused-apply
      // response (the response most users actually see first) carries it.
      return {
        blocked: skillSync.blocked,
        versions: skillSync.versions,
        items: skillSync.items,
        mode: skillSync.mode,
        source_root: skillSync.source_root,
        target_root: skillSync.target_root,
        beeVersion,
      };
    }
  }

  const applied = [];
  const skippedSkills = [];

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
      case "sync_skill": {
        const result = applySyncSkill(skillSync.source_root, skillSync.target_root, item.skill);
        if (result.blocked) {
          skippedSkills.push({ skill: item.skill, reason: result.blocked });
          continue; // skipped loudly, not applied
        }
        break;
      }
      case "remove_skill": {
        const result = applyRemoveSkill(skillSync.target_root, item.skill);
        if (result.blocked) {
          skippedSkills.push({ skill: item.skill, reason: result.blocked });
          continue; // skipped loudly, not applied
        }
        break;
      }
      case "blocked_symlink":
      case "blocked_alias": {
        // Loud per-skill report (F6 / review P1-5): never written through,
        // unlinked, deleted, or sync-then-deleted.
        skippedSkills.push({ skill: item.skill, reason: item.reason });
        continue;
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

  return {
    applied,
    onboarding: onboardingPayload,
    beeVersion,
    forcedDowngrade,
    skills: {
      mode: skillSync.mode,
      source_root: skillSync.source_root,
      target_root: skillSync.target_root,
      versions: skillSync.versions,
      skipped: skippedSkills,
    },
  };
}

// ---------- CLI ----------

function parseArgs(argv) {
  const args = {
    repoRoot: null,
    apply: false,
    json: false,
    repoHooks: false,
    claudeMd: false,
    forceDowngrade: false,
  };
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
    } else if (arg === "--force-downgrade") {
      args.forceDowngrade = true;
    } else if (arg === "--help" || arg === "-h") {
      process.stdout.write(
        "Usage: onboard_bee.mjs --repo-root <path> [--apply] [--json] [--repo-hooks] [--claude-md] [--force-downgrade]\n",
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
  if (payload.reason) {
    process.stdout.write(`reason: ${payload.reason}\n`);
  }
  if (payload.versions) {
    process.stdout.write(
      `versions: source=${payload.versions.source} host_helpers=${payload.versions.host_helpers} installed_skills=${payload.versions.installed_skills}\n`,
    );
  }
  for (const skipped of payload.skills?.skipped || []) {
    process.stdout.write(`skipped skill: ${skipped.skill} - ${skipped.reason}\n`);
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
  // Captured before any apply: "first onboard" means no onboarding marker yet.
  const firstOnboard = !fs.existsSync(path.join(repoRoot, ".bee", "onboarding.json"));

  try {
    const options = {
      repoHooks: args.repoHooks,
      claudeMd: args.claudeMd,
      forceDowngrade: args.forceDowngrade,
    };
    if (!args.apply) {
      const { plan, beeVersion, skillSync } = computePlan(repoRoot, options);
      const payload = {
        repo_root: repoRoot,
        status: skillSync.blocked
          ? skillSync.blocked.status
          : plan.length === 0
            ? "up_to_date"
            : "changes_needed",
        bee_version: beeVersion,
        plan,
        skills: {
          mode: skillSync.mode,
          source_root: skillSync.source_root,
          target_root: skillSync.target_root,
          versions: skillSync.versions,
          // Review P1-6: computeSkillSync() already computes these whenever
          // the refusal is forceable (empty [] otherwise) - a blocked dry-run
          // must still show exactly which skills a --force-downgrade would
          // overwrite/delete, not just the general-item plan.
          items: skillSync.items,
        },
        notices: commandsNotices(repoRoot, { firstOnboard }),
      };
      if (skillSync.blocked) {
        // Reporting is not failing: plan mode exits 0 with the blocked status.
        payload.reason = skillSync.blocked.reason;
        payload.versions = skillSync.versions;
      }
      emit(payload, args.json);
      return 0;
    }

    const result = applyPlan(repoRoot, options);
    if (result.blocked) {
      // Refused apply: zero mutations happened; exit nonzero (D3).
      emit(
        {
          repo_root: repoRoot,
          status: result.blocked.status,
          bee_version: result.beeVersion,
          reason: result.blocked.reason,
          versions: result.versions,
          // Review P1-6: same forced-apply-transparency payload as plan mode
          // - this refused response is what most users see BEFORE deciding
          // whether to pass --force-downgrade, so it must carry the items too.
          skills: {
            mode: result.mode,
            source_root: result.source_root,
            target_root: result.target_root,
            versions: result.versions,
            items: result.items,
          },
        },
        args.json,
      );
      return 1;
    }
    const recheck = computePlan(repoRoot, options);
    // Review P1-7: computePlan() withholds skill items from `plan` while its
    // skillSync stage is blocked (see step 7 above), so `recheck.plan.length`
    // alone can go to zero - and falsely report up_to_date - while the skill
    // stage itself is still genuinely blocked (reachable after a forced
    // downgrade that left one skill mid-refusal, e.g. a residual per-skill
    // symlink/alias block that keeps its version marker un-synced). Blocked-
    // first precedence: a blocked skill stage can NEVER yield "up_to_date".
    const recheckBlocked = recheck.skillSync.blocked;
    const payload = {
      repo_root: repoRoot,
      status: "applied",
      bee_version: result.beeVersion,
      applied: result.applied,
      recheck: recheckBlocked
        ? recheckBlocked.status
        : recheck.plan.length === 0
          ? "up_to_date"
          : "changes_needed",
      recheck_plan: recheck.plan,
      recheck_skills: recheckBlocked
        ? { blocked: true, reason: recheckBlocked.reason, versions: recheck.skillSync.versions }
        : null,
      skills: result.skills,
      onboarding: result.onboarding,
      notices: commandsNotices(repoRoot, { firstOnboard }),
    };
    if (result.forcedDowngrade) {
      // F9: a forced apply reports the fact machine-readably, with versions.
      payload.forced_downgrade = true;
      payload.versions = result.skills.versions;
    }
    emit(payload, args.json);
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
