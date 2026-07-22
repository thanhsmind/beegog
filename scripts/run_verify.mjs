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
  // lpsp-1: guards the third copy relationship — .bee/bin/** vs the
  // .bee/onboarding.json managed-hash ledger — so a release can never tag a
  // commit whose ledger was not refreshed by self-onboard (the drift:true
  // false-lead shipped in 1.9.0, hand-fixed in 6412017). Same idiom as
  // release_manifest.mjs --check just above.
  ["scripts/ledger_parity.mjs", "--check"],
  ["scripts/census_stale_spawn_syntax.mjs"],
  ["scripts/test_installers_e2e.mjs", "--installer", "bash"],
  // okf-3: joins the chain as a chain-failing suite per D22/D34. Plain check
  // (NEVER --strict here — D8-graduation keeps profile warnings as warnings
  // until F2): docs/knowledge/ OKF errors fail the chain (exit 1), profile
  // warnings do not (exit 0, D13).
  [".bee/bin/bee.mjs", "knowledge", "check"],
  // okf-4: index freshness joins the chain per D21/D4 (stale generated
  // index). Read-only re-render + byte-diff against disk — the same idiom as
  // `bee decisions render --check`; a stale or missing generated index under
  // docs/knowledge/ fails the chain naming the file. No --strict here either.
  [".bee/bin/bee.mjs", "knowledge", "index", "--check"],
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

// Skip-marker convention (hardening-8, loud canary skip): a suite that
// self-skips its real work (e.g. scripts/canary_codex.mjs's no-codex-binary
// path) still exits 0 — the correct exit code, since an absent optional
// binary is an environment fact, never a failure — but that makes it read as
// an ORDINARY PASS once buried among dozens of other suites in this
// runner's summary: "ran and proved something" and "ran nothing" become
// indistinguishable. A suite opts in by printing one line matching this
// pattern to stdout; the summary loop below then annotates that suite's PASS
// line with the skip reason instead of silently folding it in. Exit codes
// are NEVER touched by this — only the printed line gains a note.
export const SKIP_MARKER_RE = /^CANARY_SKIP\s+(.*)$/m;

export function skipNote(stdout) {
  const m = SKIP_MARKER_RE.exec(stdout || "");
  return m ? m[1].trim() : null;
}

// Hermeticity (hardening-1-7-10 D1): a suite must never inherit the calling
// harness's own session identity. When run_verify.mjs is invoked from inside
// a live Claude Code or bee session, CLAUDE_CODE_SESSION_ID / BEE_SESSION_ID
// are set in THIS process's env and would otherwise leak into every spawned
// child — silently changing sessionless-path behavior (resolveSessionId's
// env fallback) between "run locally from a live session" and "run in CI
// with no such env at all". Every child suite gets a scrubbed copy so local
// runs match CI byte-for-byte, regardless of the parent's own session state.
function childEnv() {
  const env = { ...process.env };
  delete env.CLAUDE_CODE_SESSION_ID;
  delete env.BEE_SESSION_ID;
  return env;
}

// Windows CI (hardening-1-7-10 D1): rather than hand-maintain a second suite
// list in .github/workflows/windows.yml, that job reuses THIS file's own
// discovery, restricted to one root via BEE_VERIFY_ROOT_FILTER — a suite
// added under that root is picked up here automatically, same as it already
// is for the unfiltered run. Unset (the default, every non-Windows caller):
// zero behavior change, byte-identical to before this existed.
function filterSuitesByRoot(suites) {
  const rootFilter = process.env.BEE_VERIFY_ROOT_FILTER;
  if (!rootFilter) return suites;
  const prefix = rootFilter.endsWith('/') ? rootFilter : `${rootFilter}/`;
  return suites.filter((entry) => entry[0].startsWith(prefix));
}

// Per-run exclusion (rel1710rc-2): a small, comma-separated list of exact
// repo-relative suite paths to drop from THIS invocation's active run,
// without touching the discovered SUITES export or the global (compile-time)
// EXCLUDE set above — those stay the single source every platform/caller
// sees, so a suite excluded here for one CI lane never silently vanishes
// from test_verify_manifest.mjs's mandatory/floor checks (which read the raw
// SUITES export, unaffected by this env var) or from any other caller's
// unfiltered run. Exists so .github/workflows/windows.yml can drop suites
// with a genuine, named, honestly-documented Windows-only failure (see that
// file's own loud comment block) without hand-maintaining a second suite
// list there — new suites under the discovery roots are still picked up
// automatically; only the named exclusions are ever skipped, and only in the
// job that sets this env var. Unset (the default, every non-Windows caller):
// zero behavior change, byte-identical to before this existed.
function filterExcludedSuites(suites) {
  const raw = process.env.BEE_VERIFY_EXCLUDE;
  if (!raw) return suites;
  const excluded = new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
  if (excluded.size === 0) return suites;
  return suites.filter((entry) => !excluded.has(entry[0]));
}

export function runOne(entry) {
  const [script, ...args] = entry;
  const start = Date.now();
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: REPO_ROOT,
      env: childEnv(),
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

  const rootFilteredSuites = filterSuitesByRoot(SUITES);
  if (process.env.BEE_VERIFY_ROOT_FILTER && rootFilteredSuites.length === 0) {
    console.error(
      `run_verify: BEE_VERIFY_ROOT_FILTER="${process.env.BEE_VERIFY_ROOT_FILTER}" matched zero suites — refusing a silent trivial-green run. FIX: check the root prefix.`,
    );
    process.exit(1);
  }

  const activeSuites = filterExcludedSuites(rootFilteredSuites);
  if (process.env.BEE_VERIFY_EXCLUDE && activeSuites.length === 0) {
    console.error(
      `run_verify: BEE_VERIFY_EXCLUDE="${process.env.BEE_VERIFY_EXCLUDE}" excluded every remaining suite — refusing a silent trivial-green run. FIX: check the excluded paths.`,
    );
    process.exit(1);
  }

  const serialEntries = activeSuites.filter((entry) => SERIAL_SENSITIVE.has(entry[0]));
  const parallelEntries = activeSuites.filter((entry) => !SERIAL_SENSITIVE.has(entry[0]));

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
    const note = status === "PASS" ? skipNote(r.stdout) : null;
    console.log(`${status}  ${String(r.ms).padStart(6)}ms  ${r.label}${note ? `  [SKIPPED: ${note}]` : ""}`);
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
