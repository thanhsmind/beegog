#!/usr/bin/env node
// test_run_verify_skip_marker.mjs — proves run_verify.mjs's loud-skip
// surfacing (hardening-8): a suite that self-skips (exits 0 having done
// nothing, e.g. scripts/canary_codex.mjs's no-codex-binary path) prints a
// CANARY_SKIP marker line, and run_verify's own summary loop turns that into
// a visible "[SKIPPED: ...]" note beside PASS instead of silently folding it
// into an ordinary green result. Exit codes are never affected by this —
// only the printed line changes.
//
// Two things are proven, independently:
//   (1) the general mechanism (SKIP_MARKER_RE / skipNote) against a
//       synthetic suite spawned through run_verify's OWN runOne() — real
//       integration with the runner, not just a regex unit test;
//   (2) the CONCRETE instance: scripts/canary_codex.mjs's default (P1-P5)
//       and --probe no-codex-binary paths actually print the marker and
//       still exit 0, run with a PATH that excludes codex so this is
//       deterministic regardless of whether this machine happens to have a
//       real codex binary installed.

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const CANARY_SCRIPT = path.join(REPO_ROOT, "scripts", "canary_codex.mjs");

const { SKIP_MARKER_RE, skipNote, runOne } = await import(
  pathToFileURL(path.join(REPO_ROOT, "scripts", "run_verify.mjs")).href
);

let passed = 0;
let failed = 0;
// async: several checks below spawn a real process (through run_verify's own
// runOne(), or directly). `fn` may return a promise; it is always awaited so
// a rejected assertion inside a `.then()` is caught here, never lost as an
// unhandled rejection that reports false-green.
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

// A PATH with no codex binary reachable — node's own dir plus the standard
// bins, deliberately omitting the real ~/.local/bin (mirrors
// test_installers_e2e.mjs's BASE_PATH discipline: this must be
// deterministic regardless of what happens to be installed on the machine
// actually running this suite).
const NO_CODEX_PATH = [path.dirname(process.execPath), "/usr/bin", "/bin", "/usr/local/bin"]
  .filter((dir, i, all) => all.indexOf(dir) === i)
  .join(path.delimiter);

// ── skipNote() unit behavior ─────────────────────────────────────────────
await check("skipNote returns null for ordinary stdout with no marker", () => {
  assert.equal(skipNote("all good\nPASS foo\n"), null);
});

await check("skipNote extracts the reason text from a CANARY_SKIP marker line", () => {
  assert.equal(skipNote("some preamble\nCANARY_SKIP reason=no-codex-binary mode=default\ntrailer\n"), "reason=no-codex-binary mode=default");
});

await check("SKIP_MARKER_RE only matches a line that STARTS WITH CANARY_SKIP (anchored, not a bare substring)", () => {
  assert.equal(SKIP_MARKER_RE.test("this text mentions CANARY_SKIP mid-sentence, not at line start"), false);
  assert.equal(SKIP_MARKER_RE.test("CANARY_SKIP reason=x"), true);
});

// ── integration: a synthetic self-skipping suite run through runOne() ────
await check("a synthetic suite that prints CANARY_SKIP and exits 0 is captured by runOne() with an intact exit code", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "verify-skip-marker-"));
  try {
    const script = path.join(tmp, "fake_skip_suite.mjs");
    fs.writeFileSync(
      script,
      "console.log('CANARY_SKIP reason=synthetic-test-fixture');\nconsole.log('fake suite: skipped');\nprocess.exit(0);\n",
    );
    // runOne() spawns `node <script>` relative to REPO_ROOT as cwd — pass an
    // absolute path so cwd is irrelevant here. AWAITED before the `finally`
    // cleanup below runs — a fire-and-forget `return promise` inside a
    // try/finally lets `finally` delete the tmp dir (and the script file
    // inside it) before the spawned child has finished reading it, a real
    // race caught live while writing this fixture (ENOENT under load).
    const result = await runOne([script]);
    assert.equal(result.code, 0, "a self-skipping suite must still exit 0 (never a failure)");
    const note = skipNote(result.stdout);
    assert.equal(note, "reason=synthetic-test-fixture", "run_verify must be able to recover the skip reason from the suite's stdout");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── concrete instance: canary_codex.mjs's own no-binary skip paths ───────
function runCanary(args) {
  return spawnSync(process.execPath, [CANARY_SCRIPT, ...args], {
    encoding: "utf8",
    env: { ...process.env, PATH: NO_CODEX_PATH },
    timeout: 15000,
  });
}

await check("canary_codex.mjs default mode prints CANARY_SKIP and exits 0 when no codex binary is on PATH", () => {
  const r = runCanary([]);
  assert.equal(r.status, 0, `expected exit 0, got ${r.status}; stderr: ${r.stderr}`);
  assert.match(r.stdout, SKIP_MARKER_RE, `stdout must contain a CANARY_SKIP marker line:\n${r.stdout}`);
  assert.equal(skipNote(r.stdout), "reason=no-codex-binary mode=default");
});

await check("canary_codex.mjs --probe prints CANARY_SKIP and exits 0 when no codex binary is on PATH", () => {
  const r = runCanary(["--probe"]);
  assert.equal(r.status, 0, `expected exit 0, got ${r.status}; stderr: ${r.stderr}`);
  assert.match(r.stdout, SKIP_MARKER_RE, `stdout must contain a CANARY_SKIP marker line:\n${r.stdout}`);
  assert.equal(skipNote(r.stdout), "reason=no-codex-binary mode=probe");
});

await check("canary_codex.mjs --probe-selftest is unaffected (never touches codex, no marker expected)", () => {
  const r = runCanary(["--probe-selftest"]);
  assert.equal(r.status, 0, `probe-selftest must stay green regardless of codex on PATH; stderr: ${r.stderr}`);
  assert.equal(skipNote(r.stdout), null, "probe-selftest runs its offline invariant check, not the no-binary skip path — no marker expected");
});

console.log(`\ntest_run_verify_skip_marker: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
