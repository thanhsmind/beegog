#!/usr/bin/env node
// test_write_guard.mjs - fixture test for the checkWrite direct-edit deny
// rule (cell cli-mutations-4, plan.md §Approach step 4): .bee/state.json and
// .bee/backlog.jsonl must never be hand-edited — bee_state.mjs / bee_backlog.mjs
// own them. Spawns hooks/bee-write-guard.mjs as a child process (same pattern
// as hooks/test_model_guard.mjs), feeds it a JSON payload on stdin, and
// asserts exit code + stderr for each row. Builds isolated fixture repos so no
// test run ever touches this project's real .bee/state.json or hooks.jsonl.
// Exits 1 on any failure.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const HOOKS_DIR = path.dirname(SCRIPT_PATH);
const REPO_ROOT = path.dirname(HOOKS_DIR);
const HOOK_PATH = path.join(HOOKS_DIR, "bee-write-guard.mjs");
const REAL_LIB_DIR = path.join(REPO_ROOT, ".bee", "bin", "lib");

let failures = 0;

function check(condition, label, extra = "") {
  if (condition) {
    process.stdout.write(`ok    - ${label}\n`);
  } else {
    failures += 1;
    process.stdout.write(`FAIL  - ${label}${extra ? ` :: ${extra}` : ""}\n`);
  }
}

// --- fixture builders --------------------------------------------------

function mkFixture(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

// guards.mjs pulls in reservations.mjs (findConflicts) and state.mjs
// (readConfig); reservations.mjs pulls in fsutil.mjs. Copy the full set so
// the fixture's dynamic imports resolve exactly like the real repo's.
function copyLib(fixtureRoot) {
  const libDir = path.join(fixtureRoot, ".bee", "bin", "lib");
  fs.mkdirSync(libDir, { recursive: true });
  for (const name of ["state.mjs", "fsutil.mjs", "reservations.mjs", "guards.mjs"]) {
    fs.copyFileSync(path.join(REAL_LIB_DIR, name), path.join(libDir, name));
  }
}

function writeState(root, state) {
  fs.writeFileSync(path.join(root, ".bee", "state.json"), `${JSON.stringify(state, null, 2)}\n`);
}

// A working fixture at a given phase (default: swarming with execution
// approved — the most permissive phase, so a deny proves the first-hit rule
// fires regardless of phase logic, not because the phase itself would deny).
function buildFixture(prefix, { phase = "swarming", executionApproved = true } = {}) {
  const root = mkFixture(prefix);
  fs.mkdirSync(path.join(root, ".bee"), { recursive: true });
  fs.writeFileSync(path.join(root, ".bee", "onboarding.json"), "{}\n");
  copyLib(root);
  writeState(root, {
    phase,
    mode: "standard",
    feature: "demo",
    approved_gates: { context: true, shape: true, execution: executionApproved, review: false },
  });
  return root;
}

// A fixture whose vendored guards.mjs (the file this cell modified) throws on
// import — exercising the hook's own try/catch fail-open path, independent of
// the pure checkWrite rule. Proves the new deny rule doesn't turn a broken
// import into a session-breaking hook crash.
function buildThrowingGuardsFixture() {
  const root = buildFixture("bee-write-guard-throwguards-", { phase: "swarming" });
  fs.writeFileSync(
    path.join(root, ".bee", "bin", "lib", "guards.mjs"),
    "throw new Error('boom: fixture guards.mjs deliberately throws on import');\n",
  );
  return root;
}

// --- hook invocation -----------------------------------------------------

function runHookPayload(payload, cwd) {
  const body = { ...payload, cwd };
  const input = JSON.stringify(body);
  const result = spawnSync(process.execPath, [HOOK_PATH], { input, encoding: "utf8", cwd });
  return result;
}

function readLastJsonl(file) {
  if (!fs.existsSync(file)) return null;
  const lines = fs
    .readFileSync(file, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim());
  if (lines.length === 0) return null;
  try {
    return JSON.parse(lines[lines.length - 1]);
  } catch {
    return null;
  }
}

async function main() {
  const root = buildFixture("bee-write-guard-swarming-");
  process.stdout.write(`fixture: ${root}\n`);

  // --- 1. Edit .bee/state.json -> denied (exit 2), message names the CLI verb
  const r1 = runHookPayload(
    { tool_name: "Edit", tool_input: { file_path: ".bee/state.json" } },
    root,
  );
  check(r1.status === 2, "row1: Edit .bee/state.json is denied (exit 2)", `status=${r1.status} stderr=${r1.stderr}`);
  check(r1.stderr.includes("bee_state.mjs"), "row1: stderr names bee_state.mjs", r1.stderr);
  check(r1.stderr.includes("FIX"), "row1: stderr has a FIX element", r1.stderr);
  check(r1.stderr.includes("direct-edit"), "row1: stderr identifies the direct-edit guard", r1.stderr);

  // --- 2. Write .bee/backlog.jsonl -> denied (exit 2), message names bee_backlog.mjs add
  const r2 = runHookPayload(
    { tool_name: "Write", tool_input: { file_path: ".bee/backlog.jsonl", content: "{}\n" } },
    root,
  );
  check(r2.status === 2, "row2: Write .bee/backlog.jsonl is denied (exit 2)", `status=${r2.status} stderr=${r2.stderr}`);
  check(r2.stderr.includes("bee_backlog.mjs add"), "row2: stderr names bee_backlog.mjs add", r2.stderr);

  // --- 3. bash-redirect row: `cat foo.txt >> .bee/backlog.jsonl` -> denied,
  // proving the deny reaches Bash-extracted targets, not just Edit/Write.
  const r3 = runHookPayload(
    { tool_name: "Bash", tool_input: { command: "cat notes.txt >> .bee/backlog.jsonl" } },
    root,
  );
  check(r3.status === 2, "row3: bash redirect into .bee/backlog.jsonl is denied (exit 2)",
    `status=${r3.status} stderr=${r3.stderr}`);
  check(r3.stderr.includes("bee_backlog.mjs add"), "row3: stderr names bee_backlog.mjs add", r3.stderr);

  // --- 3b. bash-redirect row for state.json (sed -i) -> denied
  const r3b = runHookPayload(
    { tool_name: "Bash", tool_input: { command: 'sed -i "s/idle/swarming/" .bee/state.json' } },
    root,
  );
  check(r3b.status === 2, "row3b: sed -i on .bee/state.json is denied (exit 2)",
    `status=${r3b.status} stderr=${r3b.stderr}`);
  check(r3b.stderr.includes("bee_state.mjs"), "row3b: stderr names bee_state.mjs", r3b.stderr);

  // --- 4. pass row: Edit .bee/cells/x.json still passes (untouched verdict)
  const r4 = runHookPayload(
    { tool_name: "Edit", tool_input: { file_path: ".bee/cells/demo-1.json" } },
    root,
  );
  check(r4.status === 0, "row4: Edit .bee/cells/demo-1.json still passes", `status=${r4.status} stderr=${r4.stderr}`);

  // --- 5. pass row: a plain bee CLI invocation extracts no bash target and
  // passes untouched (extractBashTargets behavior validated in validation-1.md)
  const r5 = runHookPayload(
    { tool_name: "Bash", tool_input: { command: "node .bee/bin/bee_state.mjs set --phase swarming" } },
    root,
  );
  check(r5.status === 0, "row5: plain bee_state.mjs CLI invocation still passes",
    `status=${r5.status} stderr=${r5.stderr}`);

  // --- 5b. same for bee_backlog.mjs add
  const r5b = runHookPayload(
    {
      tool_name: "Bash",
      tool_input: { command: 'node .bee/bin/bee_backlog.mjs add --type bug --title "x" --severity P2' },
    },
    root,
  );
  check(r5b.status === 0, "row5b: plain bee_backlog.mjs add CLI invocation still passes",
    `status=${r5b.status} stderr=${r5b.stderr}`);

  // --- 6. deny rule fires in every phase, not only swarming: idle phase too
  // (idle is otherwise the most permissive phase for .bee/ writes — this
  // proves the deny rule really runs before GATE_ALLOWED_PREFIXES / phase logic)
  const idleRoot = buildFixture("bee-write-guard-idle-", { phase: "idle" });
  const r6 = runHookPayload(
    { tool_name: "Edit", tool_input: { file_path: ".bee/state.json" } },
    idleRoot,
  );
  check(r6.status === 2, "row6: Edit .bee/state.json is denied even while idle (.bee/ is normally allowed)",
    `status=${r6.status} stderr=${r6.stderr}`);
  check(r6.stderr.includes("bee_state.mjs"), "row6: idle-phase denial still names bee_state.mjs", r6.stderr);
  // control: an unrelated .bee/ path keeps its current (allowed) idle verdict
  const r6b = runHookPayload(
    { tool_name: "Edit", tool_input: { file_path: ".bee/cells/demo-1.json" } },
    idleRoot,
  );
  check(r6b.status === 0, "row6b: unrelated .bee/ path keeps its current allowed-at-idle verdict",
    `status=${r6b.status} stderr=${r6b.stderr}`);

  // --- 7. fail-open row: guards.mjs itself throws on import -> hook still
  // exits 0 with empty stderr, and a crash line lands in that fixture's
  // hooks.jsonl (HOOK-level try/catch, not the pure checkWrite rule).
  const throwRoot = buildThrowingGuardsFixture();
  const r7 = runHookPayload(
    { tool_name: "Edit", tool_input: { file_path: ".bee/state.json" } },
    throwRoot,
  );
  check(r7.status === 0, "row7: guards.mjs import throwing still fails open (exit 0)",
    `status=${r7.status} stderr=${r7.stderr}`);
  check(r7.stderr === "", "row7: fail-open path produces empty stderr", JSON.stringify(r7.stderr));
  const crashLog = path.join(throwRoot, ".bee", "logs", "hooks.jsonl");
  const crashEvent = readLastJsonl(crashLog);
  check(!!crashEvent, "row7: a crash line was appended to that fixture's hooks.jsonl", String(crashEvent));
  check(crashEvent && crashEvent.hook === "write-guard", "row7: crash line's hook is write-guard",
    JSON.stringify(crashEvent));
  check(
    crashEvent && typeof crashEvent.error === "string" && crashEvent.error.includes("boom"),
    "row7: crash line carries the underlying error",
    JSON.stringify(crashEvent),
  );

  process.stdout.write(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}\n`);
  process.exitCode = failures === 0 ? 0 : 1;
}

await main();
