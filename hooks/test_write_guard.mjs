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

// A working fixture pre-seeded with one active reservation, written directly
// to .bee/reservations.json (schema: reservations.mjs's own store shape) so
// the apply_patch reservation rows below can prove a real conflict/no-conflict
// decision instead of asserting on string presence alone.
function buildReservationFixture(prefix, reservedPath, holderAgent) {
  const root = buildFixture(prefix);
  const store = {
    reservations: [
      {
        agent: holderAgent,
        cell: "other-cell",
        path: reservedPath,
        ttl_seconds: 3600,
        reserved_at: new Date().toISOString(),
        released_at: null,
      },
    ],
  };
  fs.writeFileSync(
    path.join(root, ".bee", "reservations.json"),
    `${JSON.stringify(store, null, 2)}\n`,
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

  // ======================================================================
  // 8+. apply_patch matrix (cell codex-parity-4, plan-review third bullet):
  // Add/Update/Delete/Move x multi-target/Unicode/space/escape/malformed
  // rows, gate-policy rows, reservation rows, and the unknown-target deny
  // row. Every row spawns the real hook process and asserts exit code +
  // stderr shape — no string-presence-only assertions.
  // ======================================================================

  // --- 8. Add File, single safe target -> passes
  const patchAdd = "*** Begin Patch\n*** Add File: src/new-file.txt\n+hello world\n*** End Patch";
  const r8 = runHookPayload({ tool_name: "apply_patch", tool_input: { input: patchAdd } }, root);
  check(r8.status === 0, "row8: apply_patch Add File to a safe path passes", `status=${r8.status} stderr=${r8.stderr}`);

  // --- 9. Update File, single target denied via direct-edit (.bee/state.json)
  const patchUpdateDenied =
    "*** Begin Patch\n*** Update File: .bee/state.json\n@@\n-old\n+new\n*** End Patch";
  const r9 = runHookPayload(
    { tool_name: "apply_patch", tool_input: { input: patchUpdateDenied } },
    root,
  );
  check(r9.status === 2, "row9: apply_patch Update File .bee/state.json is denied (exit 2)",
    `status=${r9.status} stderr=${r9.stderr}`);
  check(r9.stderr.includes("bee_state.mjs"), "row9: stderr names bee_state.mjs", r9.stderr);

  // --- 10. Delete File, single target denied via direct-edit (.bee/backlog.jsonl)
  const patchDeleteDenied = "*** Begin Patch\n*** Delete File: .bee/backlog.jsonl\n*** End Patch";
  const r10 = runHookPayload(
    { tool_name: "apply_patch", tool_input: { input: patchDeleteDenied } },
    root,
  );
  check(r10.status === 2, "row10: apply_patch Delete File .bee/backlog.jsonl is denied (exit 2)",
    `status=${r10.status} stderr=${r10.stderr}`);
  check(r10.stderr.includes("bee_backlog.mjs add"), "row10: stderr names bee_backlog.mjs add", r10.stderr);

  // --- 11. Move (Update File + Move to), both targets safe -> passes
  const patchMoveSafe =
    "*** Begin Patch\n*** Update File: src/old-name.txt\n*** Move to: src/new-name.txt\n@@\n-old\n+new\n*** End Patch";
  const r11 = runHookPayload(
    { tool_name: "apply_patch", tool_input: { input: patchMoveSafe } },
    root,
  );
  check(r11.status === 0, "row11: apply_patch Move (Update File + Move to) with safe paths passes",
    `status=${r11.status} stderr=${r11.stderr}`);

  // --- 12. Move destination is the direct-edit-denied file -> whole patch denied
  const patchMoveDenied =
    "*** Begin Patch\n*** Update File: src/old-name.txt\n*** Move to: .bee/state.json\n@@\n-old\n+new\n*** End Patch";
  const r12 = runHookPayload(
    { tool_name: "apply_patch", tool_input: { input: patchMoveDenied } },
    root,
  );
  check(r12.status === 2, "row12: apply_patch Move destination .bee/state.json is denied (exit 2)",
    `status=${r12.status} stderr=${r12.stderr}`);
  check(r12.stderr.includes("bee_state.mjs"), "row12: stderr names bee_state.mjs", r12.stderr);

  // --- 13. Multi-target (Add + Update + Delete), one target denied -> whole patch denied
  const patchMultiOneDenied =
    "*** Begin Patch\n" +
    "*** Add File: src/a.txt\n+content\n" +
    "*** Update File: src/b.txt\n@@\n-x\n+y\n" +
    "*** Delete File: .bee/state.json\n" +
    "*** End Patch";
  const r13 = runHookPayload(
    { tool_name: "apply_patch", tool_input: { input: patchMultiOneDenied } },
    root,
  );
  check(r13.status === 2,
    "row13: multi-target apply_patch denies when any target hits a policy deny (.bee/state.json)",
    `status=${r13.status} stderr=${r13.stderr}`);
  check(r13.stderr.includes("bee_state.mjs"), "row13: stderr names bee_state.mjs", r13.stderr);

  // --- 14. Multi-target, every target safe -> passes
  const patchMultiSafe =
    "*** Begin Patch\n" +
    "*** Add File: src/a.txt\n+content\n" +
    "*** Update File: src/b.txt\n@@\n-x\n+y\n" +
    "*** Delete File: src/c.txt\n" +
    "*** End Patch";
  const r14 = runHookPayload(
    { tool_name: "apply_patch", tool_input: { input: patchMultiSafe } },
    root,
  );
  check(r14.status === 0, "row14: multi-target apply_patch with every target safe passes",
    `status=${r14.status} stderr=${r14.stderr}`);

  // --- 15. Unicode path, reserved by another agent -> denied naming the
  // exact resolved path (proves Unicode target extraction/resolution is
  // correct, not merely "didn't crash").
  const unicodePath = "café/résumé.md";
  const uniRoot = buildReservationFixture("bee-write-guard-applypatch-unicode-", unicodePath, "otto");
  const patchUnicode = `*** Begin Patch\n*** Add File: ${unicodePath}\n+hello\n*** End Patch`;
  const r15 = runHookPayload(
    { tool_name: "apply_patch", tool_input: { input: patchUnicode }, agent_name: "mel" },
    uniRoot,
  );
  check(r15.status === 2,
    "row15: apply_patch Add File to a Unicode path reserved by another agent is denied (exit 2)",
    `status=${r15.status} stderr=${r15.stderr}`);
  check(r15.stderr.includes(unicodePath), "row15: stderr names the exact Unicode path", r15.stderr);
  check(r15.stderr.includes("otto"), "row15: stderr names the reservation holder", r15.stderr);

  // --- 16. Path with spaces, reserved by another agent -> denied naming the
  // exact resolved path.
  const spacedPath = "my folder/file name.txt";
  const spaceRoot = buildReservationFixture("bee-write-guard-applypatch-space-", spacedPath, "otto");
  const patchSpace = `*** Begin Patch\n*** Update File: ${spacedPath}\n@@\n-a\n+b\n*** End Patch`;
  const r16 = runHookPayload(
    { tool_name: "apply_patch", tool_input: { input: patchSpace }, agent_name: "mel" },
    spaceRoot,
  );
  check(r16.status === 2,
    "row16: apply_patch Update File to a space-containing path reserved by another agent is denied",
    `status=${r16.status} stderr=${r16.stderr}`);
  check(r16.stderr.includes(spacedPath), "row16: stderr names the exact space-containing path", r16.stderr);

  // --- 17. Escape-sequence path (literal backslash-escaped space in the
  // target line) reserved by another agent -> still resolved to a concrete
  // target and denied (proves the parser doesn't silently drop/mangle an
  // escaped-looking path into a false "unprovable" pass-through).
  const escapedPath = "my\\ folder/escaped.txt";
  const escRoot = buildReservationFixture("bee-write-guard-applypatch-escape-", escapedPath, "otto");
  const patchEscaped = `*** Begin Patch\n*** Add File: ${escapedPath}\n+hi\n*** End Patch`;
  const r17 = runHookPayload(
    { tool_name: "apply_patch", tool_input: { input: patchEscaped }, agent_name: "mel" },
    escRoot,
  );
  check(r17.status === 2,
    "row17: apply_patch Add File with a backslash-escaped-space path resolves to a concrete target and is denied",
    `status=${r17.status} stderr=${r17.stderr}`);
  check(r17.stderr.includes("otto"), "row17: stderr names the reservation holder", r17.stderr);

  // --- 18. Malformed patch body: a verb line with no colon/path at all ->
  // zero targets extracted -> denied (P1 repair: unprovable target set).
  const patchMalformedNoColon = "*** Begin Patch\n*** Add File\n+content\n*** End Patch";
  const r18 = runHookPayload(
    { tool_name: "apply_patch", tool_input: { input: patchMalformedNoColon } },
    root,
  );
  check(r18.status === 2,
    "row18: apply_patch with a malformed verb line (no colon/path) denies (unprovable target set)",
    `status=${r18.status} stderr=${r18.stderr}`);
  check(r18.stderr.trim().length > 0, "row18: stderr carries a corrective reason", r18.stderr);

  // --- 19. Unknown-target deny row: an unrecognized verb (not Add/Update/
  // Delete/Move) parses to zero targets -> denied, never silently allowed
  // through an unexamined operation.
  const patchUnknownVerb = "*** Begin Patch\n*** Rename File: src/a.txt -> src/b.txt\n*** End Patch";
  const r19 = runHookPayload(
    { tool_name: "apply_patch", tool_input: { input: patchUnknownVerb } },
    root,
  );
  check(r19.status === 2,
    "row19: apply_patch with an unrecognized verb line denies rather than silently allowing an unexamined operation",
    `status=${r19.status} stderr=${r19.stderr}`);
  check(r19.stderr.includes("FIX"), "row19: stderr carries the corrective FIX guidance", r19.stderr);

  // --- 20. Empty/whitespace-only path after the verb colon -> denied (the
  // extraction bug fix: a lone leftover whitespace char must not count as a
  // proved target).
  const patchEmptyPath = "*** Begin Patch\n*** Add File:    \n+content\n*** End Patch";
  const r20 = runHookPayload(
    { tool_name: "apply_patch", tool_input: { input: patchEmptyPath } },
    root,
  );
  check(r20.status === 2,
    "row20: apply_patch Add File with a whitespace-only path denies (empty target is never proved)",
    `status=${r20.status} stderr=${r20.stderr}`);
  check(r20.stderr.includes("FIX"), "row20: stderr carries the corrective FIX guidance", r20.stderr);

  // --- 21. Path traversal escape (relative .. outside the repo) -> denied
  // (unprovable target: toRelPath returns null for an escaping path).
  const patchTraversal = "*** Begin Patch\n*** Add File: ../../outside-repo.txt\n+x\n*** End Patch";
  const r21 = runHookPayload(
    { tool_name: "apply_patch", tool_input: { input: patchTraversal } },
    root,
  );
  check(r21.status === 2,
    "row21: apply_patch Add File escaping the repo via .. traversal denies (unprovable target)",
    `status=${r21.status} stderr=${r21.stderr}`);
  check(r21.stderr.includes("FIX"), "row21: stderr carries the corrective FIX guidance", r21.stderr);

  // --- 22. Absolute path outside the repo -> denied (unprovable target).
  const patchAbsoluteOutside = "*** Begin Patch\n*** Add File: /etc/passwd\n+x\n*** End Patch";
  const r22 = runHookPayload(
    { tool_name: "apply_patch", tool_input: { input: patchAbsoluteOutside } },
    root,
  );
  check(r22.status === 2,
    "row22: apply_patch Add File to an absolute path outside the repo denies (unprovable target)",
    `status=${r22.status} stderr=${r22.stderr}`);
  check(r22.stderr.includes("FIX"), "row22: stderr carries the corrective FIX guidance", r22.stderr);

  // --- 23. Malformed OUTER payload: apply_patch tool_input carries no
  // canonical "*** Begin Patch" envelope at all -> stays D2's visible
  // fail-open (this class is explicitly NOT the deny-on-unprovable P1
  // repair -- nothing was genuinely intercepted).
  const r23 = runHookPayload(
    { tool_name: "apply_patch", tool_input: { input: "not a patch at all" } },
    root,
  );
  check(r23.status === 0,
    "row23: apply_patch with no canonical patch envelope in tool_input stays fail-open (malformed OUTER payload, D2)",
    `status=${r23.status} stderr=${r23.stderr}`);

  // --- 24. Gate-policy row: apply_patch write to a source path during a
  // gated phase with execution unapproved is denied by the gate guard (not
  // direct-edit, not reservation) -- proves apply_patch runs the SAME gate
  // decision as Edit/Write/Bash.
  const gateRoot = buildFixture("bee-write-guard-applypatch-gate-", {
    phase: "validating",
    executionApproved: false,
  });
  const patchGateSrc = "*** Begin Patch\n*** Add File: src/feature.txt\n+new code\n*** End Patch";
  const r24 = runHookPayload(
    { tool_name: "apply_patch", tool_input: { input: patchGateSrc } },
    gateRoot,
  );
  check(r24.status === 2,
    "row24: apply_patch Add File to a source path during a gated phase (execution unapproved) is denied by the gate guard",
    `status=${r24.status} stderr=${r24.stderr}`);
  check(r24.stderr.includes("bee gate"), "row24: stderr identifies the gate guard", r24.stderr);

  // --- 25. Gate-allowed-prefix control: the same gated phase still allows a
  // docs/ target, proving row24 denied on gate policy, not a broad apply_patch
  // block.
  const patchGateDocs = "*** Begin Patch\n*** Add File: docs/notes.md\n+notes\n*** End Patch";
  const r25 = runHookPayload(
    { tool_name: "apply_patch", tool_input: { input: patchGateDocs } },
    gateRoot,
  );
  check(r25.status === 0,
    "row25: apply_patch Add File under docs/ (gate-allowed prefix) passes even in the gated phase",
    `status=${r25.status} stderr=${r25.stderr}`);

  // --- 26. Reservation-row control: a target reserved by the SAME requesting
  // agent has no self-conflict and passes.
  const selfRoot = buildReservationFixture("bee-write-guard-applypatch-self-", "src/mine.txt", "mel");
  const patchSelf = "*** Begin Patch\n*** Update File: src/mine.txt\n@@\n-a\n+b\n*** End Patch";
  const r26 = runHookPayload(
    { tool_name: "apply_patch", tool_input: { input: patchSelf }, agent_name: "mel" },
    selfRoot,
  );
  check(r26.status === 0,
    "row26: apply_patch Update File to a path reserved by the SAME agent passes (no self-conflict)",
    `status=${r26.status} stderr=${r26.stderr}`);

  // --- 27+. Partial-unprovable matrix (review finding F1, P1): an
  // apply_patch envelope that mixes a PROVABLE target (a normal, otherwise-
  // allowed path) with an UNPROVABLE target must deny the WHOLE request,
  // never allow the safe half through. This pins bee-write-guard.mjs's
  // `relPaths.length < targets.length` branch (line 176) specifically for
  // the *mixed* case -- rows 18-22 above only ever exercise all-unprovable
  // patches, so a regression that started evaluating just the resolved
  // subset of targets (dropping the escaping one silently) would still pass
  // every existing row while allowing an unchecked write.

  // --- 27. Ordering A: provable target FIRST, unprovable target SECOND
  // (safe Add File, then a blank/whitespace-only-path Update File).
  const patchPartialProvableFirst =
    "*** Begin Patch\n" +
    "*** Add File: src/safe-first.txt\n+hello\n" +
    "*** Update File:    \n@@\n-old\n+new\n" +
    "*** End Patch";
  const r27 = runHookPayload(
    { tool_name: "apply_patch", tool_input: { input: patchPartialProvableFirst } },
    root,
  );
  check(r27.status === 2,
    "row27: apply_patch mixing a safe Add (provable, FIRST) with a blank-path Update (unprovable, SECOND) denies the WHOLE patch",
    `status=${r27.status} stderr=${r27.stderr}`);
  check(r27.stderr.includes("FIX"), "row27: stderr carries the corrective FIX guidance", r27.stderr);

  // --- 28. Ordering B: unprovable target FIRST, provable target SECOND --
  // proves the whole-patch deny does not depend on scan order (guards
  // against a future short-circuit that stops once a proved target is
  // already recorded).
  const patchPartialUnprovableFirst =
    "*** Begin Patch\n" +
    "*** Update File:    \n@@\n-old\n+new\n" +
    "*** Add File: src/safe-second.txt\n+hello\n" +
    "*** End Patch";
  const r28 = runHookPayload(
    { tool_name: "apply_patch", tool_input: { input: patchPartialUnprovableFirst } },
    root,
  );
  check(r28.status === 2,
    "row28: apply_patch mixing a blank-path Update (unprovable, FIRST) with a safe Add (provable, SECOND) still denies the WHOLE patch",
    `status=${r28.status} stderr=${r28.stderr}`);
  check(r28.stderr.includes("FIX"), "row28: stderr carries the corrective FIX guidance", r28.stderr);

  // --- 29. Second mixed combo named in the review finding: one valid Update
  // (provable) plus a second operation whose Move destination escapes the
  // repo outright (unprovable via path traversal, not a blank path) -- proves
  // the whole-deny rule generalizes across unprovable *kinds*, not just the
  // blank-path extraction bug.
  const patchPartialMoveOutside =
    "*** Begin Patch\n" +
    "*** Update File: src/valid.txt\n@@\n-old\n+new\n" +
    "*** Update File: src/other.txt\n*** Move to: ../../outside-repo.txt\n@@\n-a\n+b\n" +
    "*** End Patch";
  const r29 = runHookPayload(
    { tool_name: "apply_patch", tool_input: { input: patchPartialMoveOutside } },
    root,
  );
  check(r29.status === 2,
    "row29: apply_patch mixing a valid Update (provable) with a second operation's outside-repo Move destination (unprovable) denies the WHOLE patch",
    `status=${r29.status} stderr=${r29.stderr}`);
  check(r29.stderr.includes("FIX"), "row29: stderr carries the corrective FIX guidance", r29.stderr);

  process.stdout.write(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}\n`);
  process.exitCode = failures === 0 ? 0 : 1;
}

await main();
