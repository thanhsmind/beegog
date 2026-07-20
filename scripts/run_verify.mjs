#!/usr/bin/env node
// Parallel verify runner. Replaces the old sequential `&&`-chain in
// .bee/config.json `commands.verify` with a concurrency-capped promise pool,
// cutting wall-time (~90s sequential -> ~30s) without introducing flaky
// failures.
//
// Why not just run everything at unbounded concurrency: measured (see
// verify-parallel-runner-1 report) that unbounded -P16 concurrency is fast
// (~29s) but flaky — test_onboard_bee and test_claim_race intermittently
// fail under CPU/timing contention (the working tree stays clean after, so
// it is contention, not shared-state corruption). A handful of suites are
// timing/lock/fork-racer sensitive and must never be starved by unrelated
// concurrent suites; they are scheduled as ONE serial sub-chain so they
// never contend with each other, while still running in parallel with
// everything else (they hide under the long pole, test_onboard_bee).
//
// Each suite is spawned directly (no shell), stdout/stderr is buffered and
// only printed when a suite fails, so a green run stays quiet.

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");

// ─── suite discovery (cs-4, contention-split) ──────────────────────────────
// This array used to be a manually maintained list: every feature adding a
// test suite had to edit these exact lines, making it a per-feature
// contention point (observed live: exec-xwh1 vs exec-cs3 collided here,
// 2026-07-20). Suites are now DISCOVERED by convention — glob a fixed set of
// directory roots for `test_*.mjs` files — so adding a new suite under one
// of these roots requires ZERO edits to this file.
//
// Roots are exactly the directories the old hand-written array drew suites
// from; nothing is lost (docs/history/contention-split/reports/cs-4.md
// records the old-vs-discovered set diff captured at flip time).
const DISCOVERY_ROOTS = [
  "scripts",
  "skills/bee-hive/templates/tests",
  "skills/bee-hive/scripts",
  "hooks",
];

// `test_*.mjs` files under a discovery root that are NOT independent,
// standalone suites. Every entry needs a reason in its comment — an
// unexplained exclusion is a suite silently not run again, exactly the bug
// this discovery mechanism replaces the hand-written array to prevent.
const EXCLUDE = new Set([]);

// A handful of small scripts predate the `test_*.mjs` naming convention and
// were already part of commands.verify by hand; not worth renaming just to
// fit the glob, so they stay explicit extra entries alongside discovery.
const EXTRA_SUITES = [
  ["scripts/release_manifest.mjs", "--selftest"],
  ["scripts/release_manifest.mjs", "--check"],
  ["scripts/census_stale_spawn_syntax.mjs"],
  ["scripts/test_installers_e2e.mjs", "--installer", "bash"],
];

// scripts/test_installers_e2e.mjs is discovered by the glob too (it matches
// `test_*.mjs`); its args variant is supplied via EXTRA_SUITES above, so the
// bare no-args discovery hit for this one path is dropped to avoid running
// it twice.
const ARGS_OVERRIDE = new Set(["scripts/test_installers_e2e.mjs"]);

function discoverSuites() {
  const found = [];
  for (const root of DISCOVERY_ROOTS) {
    const dir = path.join(REPO_ROOT, root);
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.startsWith("test_") || !entry.name.endsWith(".mjs")) continue;
      const rel = `${root}/${entry.name}`;
      if (EXCLUDE.has(rel) || ARGS_OVERRIDE.has(rel)) continue;
      found.push([rel]);
    }
  }
  found.sort((a, b) => a[0].localeCompare(b[0]));
  return [...found, ...EXTRA_SUITES];
}

export const SUITES = discoverSuites();

// Timing/lock/fork-racer suites: measured flaky under concurrent CPU
// contention with other suites (not with each other). Run as ONE sequential
// scheduling unit so they never overlap each other, while that unit still
// runs concurrently with everything else in the pool.
//
// Membership is convention-based: a suite whose filename ends in `_race.mjs`,
// `_lock.mjs`, or `_concurrency.mjs` is serial-sensitive by construction. A
// small number of pre-existing serial suites don't match that naming
// convention; they are listed explicitly below.
const SERIAL_NAME_PATTERN = /_(race|lock|concurrency)\.mjs$/;
const SERIAL_EXCEPTIONS = new Set([
  "scripts/test_heartbeat_touch.mjs",
]);

const SERIAL_SENSITIVE = new Set(
  SUITES.map((entry) => entry[0]).filter(
    (p) => SERIAL_NAME_PATTERN.test(p) || SERIAL_EXCEPTIONS.has(p),
  ),
);

function suiteLabel(entry) {
  return [entry[0], ...entry.slice(1)].join(" ");
}

function runOne(entry) {
  const [script, ...args] = entry;
  const start = Date.now();
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: REPO_ROOT,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d;
    });
    child.stderr.on("data", (d) => {
      stderr += d;
    });
    child.on("close", (code) => {
      resolve({
        label: suiteLabel(entry),
        code,
        ms: Date.now() - start,
        stdout,
        stderr,
      });
    });
  });
}

// Run a group of suite entries strictly one after another; return their
// individual results. Used for the SERIAL_SENSITIVE unit so those suites
// never overlap each other, even though the group as a whole runs
// concurrently with other pool units.
async function runSerialGroup(entries) {
  const results = [];
  for (const entry of entries) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await runOne(entry));
  }
  return results;
}

// Concurrency-capped promise pool. `units` is an array of functions, each
// returning a Promise<result[]> (a single suite wraps its one result in an
// array so serial and parallel units share the same shape).
async function runPool(units, concurrency) {
  const results = [];
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next;
      next += 1;
      if (i >= units.length) return;
      // eslint-disable-next-line no-await-in-loop
      const unitResults = await units[i]();
      results.push(...unitResults);
    }
  }
  const workers = [];
  const workerCount = Math.min(concurrency, units.length);
  for (let w = 0; w < workerCount; w += 1) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

// Default concurrency: validated empirically on this repo's suite mix.
// Math.min(6, cpus) was the original target but produced a real flake in
// validation (test_onboard_bee starved to 56s when it landed alongside 4-5
// other 30s+ suites at once); Math.min(5, cpus) removed that clustering and
// passed 8/8 consecutive runs at ~32s wall-time. Still fully overridable via
// BEE_VERIFY_CONCURRENCY for machines with a different core/load profile.
async function main() {
  const concurrency = Math.max(
    1,
    Number(process.env.BEE_VERIFY_CONCURRENCY) || Math.min(5, os.cpus().length),
  );

  const serialEntries = SUITES.filter((entry) => SERIAL_SENSITIVE.has(entry[0]));
  const parallelEntries = SUITES.filter((entry) => !SERIAL_SENSITIVE.has(entry[0]));

  const units = [];
  if (serialEntries.length > 0) {
    units.push(() => runSerialGroup(serialEntries));
  }
  for (const entry of parallelEntries) {
    units.push(() => runOne(entry).then((r) => [r]));
  }

  const wallStart = Date.now();
  const results = await runPool(units, concurrency);
  const wallMs = Date.now() - wallStart;

  results.sort((a, b) => a.label.localeCompare(b.label));

  let anyFail = false;
  for (const r of results) {
    const status = r.code === 0 ? "PASS" : "FAIL";
    if (r.code !== 0) anyFail = true;
    console.log(`${status}  ${String(r.ms).padStart(6)}ms  ${r.label}`);
  }

  const failed = results.filter((r) => r.code !== 0);
  if (failed.length > 0) {
    console.error("");
    console.error(`FAILED SUITES (${failed.length}):`);
    for (const r of failed) {
      console.error(`\n--- ${r.label} (exit ${r.code}) ---`);
      if (r.stdout.trim()) {
        console.error("stdout:");
        console.error(r.stdout);
      }
      if (r.stderr.trim()) {
        console.error("stderr:");
        console.error(r.stderr);
      }
    }
  }

  console.log("");
  console.log(
    `${anyFail ? "FAIL" : "PASS"} run_verify: ${results.length} suite(s), concurrency=${concurrency}, wall=${wallMs}ms`,
  );

  process.exit(anyFail ? 1 : 0);
}

// Only run the suite pool when this file is executed directly (`node
// scripts/run_verify.mjs`) — NOT when imported, e.g. by
// scripts/test_verify_manifest.mjs pulling in the exported SUITES list. An
// unconditional call here would spawn the entire suite as a side effect of
// a plain `import`.
const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  main();
}
