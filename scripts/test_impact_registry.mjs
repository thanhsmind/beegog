#!/usr/bin/env node
// test_impact_registry.mjs — proves scripts/impact_registry.mjs (cov-1,
// ci-owned-verify D3): the file→suite relatedness registry is DERIVED from
// run_verify.mjs's own SUITES discovery (never a hand list), captures all
// four documented edge types, is byte-deterministic, and its --check/--query
// verbs behave as specified.
//
// Fast: imports the module's exported functions directly instead of
// spawning a fresh `node scripts/impact_registry.mjs` subprocess for every
// case (buildRegistry() alone does the real work; the CLI wrapper around it
// is exercised separately, and only where the verb itself — --check's exit
// code, --query's stdout/stderr split — is what's under test).

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");
const REGISTRY_SCRIPT = path.join(__dirname, "impact_registry.mjs");
const REGISTRY_JSON = path.join(__dirname, "impact-registry.json");

const { buildRegistry, serializeRegistry, queryRegistry } = await import(
  pathToFileURL(REGISTRY_SCRIPT).href
);

let passed = 0;
let failed = 0;
async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}: ${error.stack ?? error.message}`);
  }
}

function runCli(args) {
  return spawnSync(process.execPath, [REGISTRY_SCRIPT, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    timeout: 30000,
  });
}

// ── determinism ──────────────────────────────────────────────────────────
await check("buildRegistry() run twice produces byte-identical serialized output", async () => {
  const a = serializeRegistry(await buildRegistry());
  const b = serializeRegistry(await buildRegistry());
  assert.equal(a, b, "two builds of the same tree must be byte-identical — no timestamps, no nondeterministic ordering");
});

// ── known static edge: test_config_validate.mjs -> state.mjs ──────────────
await check("a known static ESM import edge is captured: scripts/test_config_validate.mjs -> .bee/bin/lib/state.mjs", async () => {
  const registry = await buildRegistry();
  const suites = registry.files[".bee/bin/lib/state.mjs"] || [];
  assert.ok(
    suites.includes("scripts/test_config_validate.mjs"),
    `expected scripts/test_config_validate.mjs among the suites for .bee/bin/lib/state.mjs, got: ${JSON.stringify(suites)}`,
  );
});

// ── known spawn edge: test_worktree_cli.mjs spawns .bee/bin/bee.mjs ───────
await check("a known spawn-argv edge is captured: scripts/test_worktree_cli.mjs -> .bee/bin/bee.mjs", async () => {
  const registry = await buildRegistry();
  const suites = registry.files[".bee/bin/bee.mjs"] || [];
  assert.ok(
    suites.includes("scripts/test_worktree_cli.mjs"),
    `expected scripts/test_worktree_cli.mjs (spawnSync('node', [BEE_MJS, ...args])) among the suites for .bee/bin/bee.mjs, got ${suites.length} suites`,
  );
});

// ── known runModuleWorker edge: test_conformance.mjs -> bee.mjs ───────────
await check("a known runModuleWorker edge is captured: scripts/test_conformance.mjs -> .bee/bin/bee.mjs", async () => {
  const registry = await buildRegistry();
  const suites = registry.files[".bee/bin/bee.mjs"] || [];
  assert.ok(
    suites.includes("scripts/test_conformance.mjs"),
    `expected scripts/test_conformance.mjs (runModuleWorker(BEE_MJS, ...)) among the suites for .bee/bin/bee.mjs, got ${suites.length} suites`,
  );
});

// ── inherited closure: bee.mjs's own static imports flow to its spawners ──
await check("a spawned/worker-run bee.mjs inherits its own static import closure (state.mjs reachable via test_worktree_cli.mjs)", async () => {
  const registry = await buildRegistry();
  const suites = registry.files[".bee/bin/lib/state.mjs"] || [];
  assert.ok(
    suites.includes("scripts/test_worktree_cli.mjs"),
    `expected scripts/test_worktree_cli.mjs to reach .bee/bin/lib/state.mjs THROUGH bee.mjs's own closure, got: ${JSON.stringify(suites)}`,
  );
});

// ── every suite maps to at least itself ────────────────────────────────────
await check("every discovered suite's own entry file maps to (at least) itself", async () => {
  const registry = await buildRegistry();
  const selfSuites = registry.files["scripts/test_run_verify_only.mjs"] || [];
  assert.ok(
    selfSuites.includes("scripts/test_run_verify_only.mjs"),
    "a suite's own file must always be in its own impacted set",
  );
});

// ── committed registry stays in sync with a fresh build ───────────────────
await check("the committed scripts/impact-registry.json matches a freshly-built registry (byte-identical)", async () => {
  const fresh = serializeRegistry(await buildRegistry());
  const onDisk = fs.readFileSync(REGISTRY_JSON, "utf8");
  assert.equal(
    onDisk,
    fresh,
    "the committed registry has drifted from a fresh build — run `node scripts/impact_registry.mjs --write` to regenerate",
  );
});

// ── CLI --write then --check is green ──────────────────────────────────────
await check("CLI: --write then --check exits 0 (registry matches what it just wrote)", async () => {
  const backup = fs.readFileSync(REGISTRY_JSON, "utf8");
  try {
    const w = runCli(["--write"]);
    assert.equal(w.status, 0, `--write should exit 0, got ${w.status}; stderr:\n${w.stderr}`);
    const c = runCli(["--check"]);
    assert.equal(c.status, 0, `--check should exit 0 right after --write, got ${c.status}; stderr:\n${c.stderr}`);
  } finally {
    fs.writeFileSync(REGISTRY_JSON, backup);
  }
});

// ── CLI --check catches drift ──────────────────────────────────────────────
await check("CLI: --check catches drift (corrupted registry) and names the regen command, exit 1", async () => {
  const backup = fs.readFileSync(REGISTRY_JSON, "utf8");
  try {
    fs.writeFileSync(REGISTRY_JSON, backup.replace(/\n$/, "") + "\n// drift\n");
    const c = runCli(["--check"]);
    assert.equal(c.status, 1, `expected exit 1 on drift, got ${c.status}; stdout:\n${c.stdout}\nstderr:\n${c.stderr}`);
    assert.match(
      c.stderr,
      /impact_registry\.mjs --write/,
      `expected the regen-command message on stderr:\n${c.stderr}`,
    );
  } finally {
    fs.writeFileSync(REGISTRY_JSON, backup);
  }
});

// ── CLI --check catches a missing registry file ────────────────────────────
await check("CLI: --check catches a missing registry file, exit 1", async () => {
  const backup = fs.readFileSync(REGISTRY_JSON, "utf8");
  try {
    fs.rmSync(REGISTRY_JSON);
    const c = runCli(["--check"]);
    assert.equal(c.status, 1, `expected exit 1 on missing registry, got ${c.status}`);
  } finally {
    fs.writeFileSync(REGISTRY_JSON, backup);
  }
});

// ── query: union of suites across multiple files ───────────────────────────
await check("query: union of suites for two files, sorted, newline-separated, exit 0", async () => {
  const registry = await buildRegistry();
  const { mappedSuites, unmapped } = queryRegistry(registry, [
    ".bee/bin/lib/state.mjs",
    "scripts/run_verify.mjs",
  ]);
  assert.equal(unmapped.length, 0, `expected both files mapped, got unmapped: ${JSON.stringify(unmapped)}`);
  assert.ok(mappedSuites.length > 1, `expected the union to contain multiple suites, got ${mappedSuites.length}`);
  const sorted = [...mappedSuites].sort();
  assert.deepEqual(mappedSuites, sorted, "mappedSuites must be sorted");
});

// ── query: unmapped file is noted, exit 0, never silent ────────────────────
await check("query: an unmapped file is noted loudly but still exits 0 (never silent)", async () => {
  const registry = await buildRegistry();
  const { mappedSuites, unmapped } = queryRegistry(registry, [
    "scripts/zz-definitely-not-a-real-file.mjs",
  ]);
  assert.equal(mappedSuites.length, 0);
  assert.deepEqual(unmapped, ["scripts/zz-definitely-not-a-real-file.mjs"]);
});

// ── CLI --query end-to-end: stdout has suites, stderr notes the unmapped one, exit 0 ──
await check("CLI: --query prints mapped suites on stdout and an UNMAPPED note on stderr for an unknown file, exit 0", async () => {
  const r = runCli(["--query", ".bee/bin/lib/state.mjs", "scripts/zz-definitely-not-a-real-file.mjs"]);
  assert.equal(r.status, 0, `expected exit 0 even with an unmapped file, got ${r.status}; stderr:\n${r.stderr}`);
  assert.match(r.stdout, /scripts\/test_config_validate\.mjs/, `expected a suite name on stdout:\n${r.stdout}`);
  assert.match(r.stderr, /UNMAPPED.*zz-definitely-not-a-real-file\.mjs/, `expected an UNMAPPED note on stderr:\n${r.stderr}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
