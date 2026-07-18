#!/usr/bin/env node
// canary_codex.mjs — real-codex canary for the installed bee hook chain
// (GH #22 P1-7, decision D9, advisor R7).
//
// Proves, against a *live* codex-cli invocation plus the *installed* hook
// files (not the source `hooks/` tree), that:
//   P1 — SessionStart fires bee-session-init.mjs                (real codex exec)
//   P2 — an unmarked Codex spawn_agent is denied                (synthetic, through the installed hook)
//   P3 — a [bee-tier: ...]-marked spawn is allowed               (synthetic, through the installed hook)
//   P4 — update_plan reaches bee-state-sync.mjs                  (synthetic, through the installed hook)
//   P5 — a pre-Gate-3 source write is blocked                    (synthetic, through the installed hook)
//
// Why P2-P5 are synthetic-through-installed-hook rather than driving a real
// model turn: getting codex's own model to (a) call spawn_agent with an
// exact marker/no-marker message, (b) call update_plan, and (c) attempt a
// source write, on demand and deterministically, is not controllable from
// the outside — the model decides whether/when to call a tool. Piping a
// synthetic PreToolUse/PostToolUse envelope on stdin into the EXACT hook
// file codex would invoke (`.bee/bin/hooks/<name>.mjs --source=repo`, read
// from the fixture's *installed* .codex/hooks.json, cwd = fixture root)
// proves the installed chain's allow/deny decision without needing a live
// model call to cooperate. P1 is a real `codex exec` run because the
// SessionStart observable (a session record written to disk) needs no tool
// call from the model at all — it fires at session bootstrap.
//
// Fixture install path (cheaper-reliable-path decision): this canary calls
// skills/bee-hive/scripts/onboard_bee.mjs directly (--apply --repo-hooks)
// rather than scripts/install.sh. install.sh's repo-copy mode also probes
// and (for a real `codex`/`claude` on PATH) *mutates* the runtime's plugin
// list (`codex plugin remove bee@bee`) as part of its transition step —
// exactly the kind of touch this canary must never risk against a real
// developer machine's ~/.codex. onboard_bee.mjs alone reproduces the exact
// artifact set a repo-copy install leaves behind (.codex/hooks.json,
// .bee/bin/hooks/*, .bee/bin/lib/*, a fresh .bee store) with zero plugin
// CLI calls of any kind.
//
// Isolation (advisor R7 — BINDING): every codex invocation below runs with
// a per-run `mktemp -d` CODEX_HOME (env override, never the real one) and
// a per-run temp fixture repo (unique per run — concurrent-safe). Both are
// removed in a `finally`, whether the probes pass or fail.
//
// A subtlety proven live while building this canary and worth pinning here:
// `--dangerously-bypass-hook-trust` bypasses per-HOOK review trust only. It
// does NOT bypass per-PROJECT trust (the `[projects."<path>"] trust_level =
// "trusted"` entries codex's own config.toml tracks) — a project codex has
// never trusted still runs the requested turn, but the installed hook chain
// never fires and leaves no crash log (a silent, fail-safe no-op, not an
// error). This canary's throwaway CODEX_HOME therefore always seeds a
// `config.toml` trusting the fixture path before invoking codex, and always
// passes `-C <fixture>` explicitly (never relies on process cwd) so the
// trusted path and the path codex actually treats as its project are the
// exact same string.
//
// Skip guard: no `codex` binary on PATH -> print the message below and
// exit 0 (this is what keeps the nightly workflow green on a runner with no
// codex install).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const ONBOARD_SCRIPT = path.join(REPO_ROOT, "skills", "bee-hive", "scripts", "onboard_bee.mjs");

// codex exec's own auth-retry loop (observed live: ~5 reconnect attempts
// against the Responses API before giving up) can run ~15-20s even when the
// turn ultimately fails — P1's observable (the session record) is written
// well before that, at session bootstrap, but the timeout still has to
// outlast a slow/CI runner.
const CODEX_TIMEOUT_MS = 60_000;
const HOOK_TIMEOUT_MS = 15_000;

function codexOnPath() {
  const probe = spawnSync("codex", ["--version"], { stdio: "ignore" });
  return !(probe.error && probe.error.code === "ENOENT");
}

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: "utf8", ...opts });
}

function mkTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

// Build one throwaway fixture repo: `git init`, then the repo-copy hook
// projection via onboard_bee.mjs --apply --repo-hooks (see file header for
// why this, not install.sh). Returns the fixture's realpath (codex resolves
// project trust against the canonical path, not a possibly-symlinked one).
function buildFixture() {
  const fixture = mkTempDir("bee-canary-fixture-");
  const init = run("git", ["init", "--quiet"], { cwd: fixture });
  if (init.status !== 0) {
    throw new Error(`git init failed in fixture: ${init.stderr || init.stdout}`);
  }
  run("git", ["config", "user.email", "canary@bee.local"], { cwd: fixture });
  run("git", ["config", "user.name", "bee canary"], { cwd: fixture });

  const onboard = run(
    process.execPath,
    [ONBOARD_SCRIPT, "--repo-root", fixture, "--apply", "--repo-hooks", "--runtime", "codex", "--no-claude-md"],
    { cwd: REPO_ROOT },
  );
  if (onboard.status !== 0) {
    throw new Error(
      `onboard_bee.mjs --apply --repo-hooks failed (exit ${onboard.status}):\n${onboard.stdout}\n${onboard.stderr}`,
    );
  }
  if (!fs.existsSync(path.join(fixture, ".codex", "hooks.json"))) {
    throw new Error("onboard_bee.mjs reported success but .codex/hooks.json is missing from the fixture");
  }
  return fs.realpathSync(fixture);
}

// Seed a throwaway CODEX_HOME: best-effort real auth (so P1 can complete a
// real turn when this machine has codex credentials — never required, see
// header note: the SessionStart observable fires even on an auth failure)
// plus mandatory project trust for the fixture path.
function seedCodexHome(codexHome, fixtureRealPath) {
  const realCodexHome = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
  const realAuth = path.join(realCodexHome, "auth.json");
  try {
    if (fs.existsSync(realAuth)) {
      fs.copyFileSync(realAuth, path.join(codexHome, "auth.json"));
    }
  } catch {
    // best-effort only: a missing/unreadable auth.json just means P1's turn
    // will fail on auth — the SessionStart observable is unaffected.
  }
  const config = `[projects."${fixtureRealPath}"]\ntrust_level = "trusted"\n`;
  fs.writeFileSync(path.join(codexHome, "config.toml"), config);
}

// Invoke the fixture's OWN installed hook file (not this repo's hooks/
// source tree) exactly as .codex/hooks.json's rendered command does:
// `node <fixture>/.bee/bin/hooks/<name>.mjs --source=repo`, payload on
// stdin, cwd = fixture root.
function invokeInstalledHook(fixtureRoot, hookFile, payload) {
  const hookPath = path.join(fixtureRoot, ".bee", "bin", "hooks", hookFile);
  return run(process.execPath, [hookPath, "--source=repo"], {
    cwd: fixtureRoot,
    input: JSON.stringify(payload),
    timeout: HOOK_TIMEOUT_MS,
  });
}

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${detail}`);
}

async function runProbes() {
  const fixtureRoot = buildFixture();
  const codexHome = mkTempDir("bee-canary-codex-home-");
  try {
    seedCodexHome(codexHome, fixtureRoot);
    const codexEnv = { ...process.env, CODEX_HOME: codexHome };

    // ---- P1 (real codex exec): SessionStart fires bee-session-init.mjs ----
    const sessionsDir = path.join(fixtureRoot, ".bee", "sessions");
    const before = fs.existsSync(sessionsDir) ? new Set(fs.readdirSync(sessionsDir)) : new Set();
    const p1 = run(
      "codex",
      ["exec", "-C", fixtureRoot, "--json", "--dangerously-bypass-hook-trust", "reply with the single word: canary"],
      { cwd: fixtureRoot, env: codexEnv, timeout: CODEX_TIMEOUT_MS },
    );
    const after = fs.existsSync(sessionsDir) ? fs.readdirSync(sessionsDir) : [];
    const newSessions = after.filter((f) => !before.has(f));
    record(
      "P1 SessionStart hook fired [real codex exec]",
      newSessions.length > 0,
      newSessions.length > 0
        ? `.bee/sessions/${newSessions[0]} created by the installed bee-session-init.mjs (codex exec exit ${p1.status})`
        : `no new .bee/sessions/*.json after codex exec (exit ${p1.status}); stderr: ${String(p1.stderr || "").slice(0, 300)}`,
    );

    // ---- P2 (synthetic-through-installed-hook): unmarked spawn_agent denied ----
    const p2 = invokeInstalledHook(fixtureRoot, "bee-model-guard.mjs", {
      hook_event_name: "PreToolUse",
      cwd: fixtureRoot,
      session_id: "canary-p2",
      tool_name: "spawn_agent",
      tool_input: { agent_type: "worker", message: "do the thing without a tier marker" },
    });
    record(
      "P2 unmarked spawn_agent denied [synthetic-through-installed-hook]",
      p2.status === 2,
      `bee-model-guard.mjs exit ${p2.status} (expected 2); stderr: ${String(p2.stderr || "").slice(0, 200)}`,
    );

    // ---- P3 (synthetic-through-installed-hook): marker-anchored spawn allowed ----
    const p3 = invokeInstalledHook(fixtureRoot, "bee-model-guard.mjs", {
      hook_event_name: "PreToolUse",
      cwd: fixtureRoot,
      session_id: "canary-p3",
      tool_name: "spawn_agent",
      tool_input: { agent_type: "worker", message: "[bee-tier: generation] do the thing" },
    });
    record(
      "P3 marker-anchored spawn allowed [synthetic-through-installed-hook]",
      p3.status === 0,
      `bee-model-guard.mjs exit ${p3.status} (expected 0); stderr: ${String(p3.stderr || "").slice(0, 200)}`,
    );

    // ---- P4 (synthetic-through-installed-hook): update_plan triggers state-sync ----
    const statePath = path.join(fixtureRoot, ".bee", "state.json");
    const stateBefore = JSON.parse(fs.readFileSync(statePath, "utf8"));
    const p4 = invokeInstalledHook(fixtureRoot, "bee-state-sync.mjs", {
      hook_event_name: "PostToolUse",
      cwd: fixtureRoot,
      tool_name: "update_plan",
      tool_input: { plan: [{ step: "canary probe", status: "in_progress" }] },
    });
    const stateAfter = JSON.parse(fs.readFileSync(statePath, "utf8"));
    const synced =
      typeof stateAfter.last_activity === "string" &&
      stateAfter.last_activity !== stateBefore.last_activity &&
      !Number.isNaN(Date.parse(stateAfter.last_activity)) &&
      stateAfter.cells &&
      typeof stateAfter.cells.open === "number";
    record(
      "P4 update_plan triggers state-sync [synthetic-through-installed-hook]",
      p4.status === 0 && synced,
      synced
        ? `.bee/state.json last_activity -> ${stateAfter.last_activity}, cells -> ${JSON.stringify(stateAfter.cells)}`
        : `bee-state-sync.mjs exit ${p4.status}; last_activity before=${stateBefore.last_activity} after=${stateAfter.last_activity}`,
    );

    // ---- P5 (synthetic-through-installed-hook): pre-Gate-3 source write blocked ----
    const p5 = invokeInstalledHook(fixtureRoot, "bee-write-guard.mjs", {
      hook_event_name: "PreToolUse",
      cwd: fixtureRoot,
      tool_name: "Write",
      tool_input: { file_path: path.join(fixtureRoot, "src", "example.js"), content: "// canary" },
    });
    record(
      "P5 pre-Gate-3 source write blocked [synthetic-through-installed-hook]",
      p5.status === 2,
      `bee-write-guard.mjs exit ${p5.status} (expected 2; fixture phase idle, execution gate unapproved); stderr: ${String(
        p5.stderr || "",
      ).slice(0, 200)}`,
    );
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
    fs.rmSync(codexHome, { recursive: true, force: true });
  }
}

async function main() {
  if (!codexOnPath()) {
    console.log("canary: skipped (no codex binary)");
    return 0;
  }

  await runProbes();

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error(`canary: FAIL — ${failed.map((f) => f.name).join("; ")}`);
    return 1;
  }
  console.log("canary: all probes green");
  return 0;
}

process.exitCode = await main();
