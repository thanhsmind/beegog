# Test-Coverage Review — codex-runtime-parity (088fcd8..HEAD)

Scope: git range `088fcd8..HEAD`, CONTEXT.md, plan.md Test Matrix. Read-only.
Suites reviewed:
- `hooks/test_hook_contracts.mjs` (NEW, 1108 lines) — 7-wrapper malformed-input table + catalog + adapter rows
- `hooks/test_write_guard.mjs` (MODIFIED, +267/-0) — apply_patch matrix rows 8–26 appended to pre-existing rows 1–7
- `skills/bee-hive/templates/tests/test_lib.mjs` (MODIFIED) — startFeature rows appended
- `skills/bee-hive/scripts/test_onboard_bee.mjs` (MODIFIED) — 9b retarget + 9b2 catalog-parity added

Findings: **5** — **P1: 1 · P2: 2 · P3: 2**

---

## Verified-clean (checked, no finding)

- **Q1 universal malformed rows**: `universalRows()` (empty / junk / top-level-null / json-array / object-cwd / missing-cwd / huge-payload-2MB) is applied to **all seven** wrappers via `buildRowsForWrapper` → the loop in `main()` (test_hook_contracts.mjs:1040-1058). huge-payload and object-cwd are on every wrapper, not just one. Assertions are exit-code (`expectNoCrash` → `status===0`) and parsed-output-shape (`expectAdvisoryJsonOrSilent` parses JSON, checks `systemMessage` is a string, checks `decision!=="block"`), never string-presence. This half of the matrix is solid.
- **Q4 regression safety**: no pre-existing assertion was weakened or deleted. `test_write_guard.mjs` numstat is `267 0` (rows 1–7 byte-untouched, matrix appended). `test_lib.mjs` "four verbs"→"five verbs" ADDS `/start-feature/` to the conjunction (strengthen). `test_onboard_bee.mjs` 9b retarget from `hooks/hooks.json`→`hooks/claude-hooks.json` is *necessary and correct* (hooks.json became the Codex projection which omits model-guard; comparing it to Claude repo settings would false-fail), and it additionally ADDS 9b2 asserting the two projections differ only by `catalog.mjs` `ALLOWED_DIFFERENCES`. Net strengthening. **No weakening found.**

---

## F1 — apply_patch "partial-unprovable → whole deny" branch is never exercised

- **severity:** P1
- **autofix_class:** add-fixture-row (mechanical)
- **summary:** Every deny-on-unprovable row uses an *all-unprovable* patch. The distinguishing branch — a patch mixing one **provable, otherwise-allowed** target with one unprovable target, which `bee-write-guard.mjs:176` (`relPaths.length < targets.length`) denies wholesale — has no dedicated test.
- **today-behavior:** rows 21 (`../../outside-repo.txt`) and 22 (`/etc/passwd`) each carry a *single* unprovable target; hook_contracts `g5` mixes `/etc/outside` + `.bee/state.json` but **both** targets deny independently (outside-repo + direct-edit). No row has a genuinely safe/pass-worthy target co-located with an unprovable one.
- **failure scenario:** a future edit that changes line 176 from `relPaths.length < targets.length` to only evaluating the resolved subset (`for (const rel of relPaths) ...`) would silently ALLOW a patch like `*** Add File: src/ok.txt` + `*** Add File: /etc/passwd` — writing the safe target while ignoring the escaping one. The entire codex-parity-4 P1 repair regresses and the full suite stays green. On a write/privacy guard this is the highest-value gap.
- **file:line:** hooks/test_write_guard.mjs (no row) vs guard at hooks/bee-write-guard.mjs:176
- **smallest fix:** add one row: `*** Begin Patch / *** Add File: src/safe.txt / *** Add File: ../../outside.txt / *** End Patch` → assert `status===2` (whole patch denied, safe target NOT written — optionally assert `fs.existsSync(src/safe.txt)===false`).

## F2 — context-event output shape (SessionStart / UserPromptSubmit) is unasserted

- **severity:** P2
- **autofix_class:** add-fixture-row + assertion
- **summary:** No wrapper-level test asserts that `bee-session-init` (SessionStart) and `bee-prompt-context` (UserPromptSubmit) actually emit non-empty **plain-text** developer context and stay **unwrapped** (not JSON `systemMessage`). The two wrappers write `process.stdout.write(String(...))` directly (bee-session-init.mjs:35, bee-prompt-context.mjs:38); `adapter.mjs` `emitHookOutput`'s plain-stdout else-branch (adapter.mjs:250-252) is likewise never hit by any test.
- **today-behavior:** `universalRows` exercise these two wrappers only through `expectNoCrash` (exit 0). A wrapper that emitted nothing, or emitted `{"systemMessage":...}` on SessionStart, passes every row.
- **failure scenario:** a regression routing SessionStart/UserPromptSubmit through `emitHookOutput` on a mis-wired `defaultEvent`, or an early-return that skips injection, ships context-blindness to Codex/Claude with zero test signal. `buildSessionPreamble`/`buildPromptReminder` are unit-tested in test_lib.mjs, but the wrapper→stdout integration is not.
- **file:line:** hooks/test_hook_contracts.mjs (no context-output row for bee-session-init / bee-prompt-context)
- **smallest fix:** add two rows feeding `{hook_event_name:"SessionStart",cwd:fixture}` / `{hook_event_name:"UserPromptSubmit",...}` and assert `status===0`, `stdout.trim().length>0`, and `JSON.parse(stdout)` either throws or lacks a `systemMessage` key (i.e. output is plain, not an advisory envelope).

## F3 — two startFeature refusal rows skip the zero-mutation assert the file promises

- **severity:** P2
- **autofix_class:** assertion-tighten
- **summary:** The section header states "**Every** refusal test asserts BOTH non-zero exit AND byte-identical state.json before/after". Two refusal rows do not: "start-feature requires --feature" and "start-feature rejects --dry-run" assert only `status!==0`, with no `before===after` comparison.
- **today-behavior:** `requires --feature` runs against a fixture with **no** state.json (`makeStateRepo` writes only onboarding.json) and never asserts state.json stays absent; `--dry-run` writes a `phase:idle` state.json but never re-reads it. A refusal path that partially wrote/clobbered state before erroring would still pass.
- **failure scenario:** `startFeature` validating `--feature` *after* opening the state file for write, or `--dry-run` rejection leaving a half-initialized state.json, mutates on a refusal — undetected, and contradicting the stated contract that the other 6 refusal rows enforce.
- **file:line:** skills/bee-hive/templates/tests/test_lib.mjs — "start-feature requires --feature" and "start-feature rejects --dry-run" rows (added block after :3035)
- **smallest fix:** capture `before = fs.existsSync(statePath) ? fs.readFileSync(statePath) : null` and assert unchanged after the refusal (for the --feature row, assert state.json is still absent).

## F4 — apply_patch verb×edge coverage is asymmetric (Delete / Move under-covered)

- **severity:** P3
- **autofix_class:** add-fixture-row
- **summary:** The matrix is billed as "Add/Update/Delete/Move × multi-target/Unicode/space/escape/malformed" but coverage is lopsided. Delete is tested only for direct-edit deny (row10) — no safe-pass, no reservation, no gate row. Move is tested for safe (row11) and direct-edit dest (row12) only — no reservation on source or destination, no Unicode/space dest. Unicode (row15/Add), space (row16/Update), escape (row17/Add) are each on exactly one verb, never cross-verb. (The deny-on-unprovable family itself — blank path row20, traversal row21, absolute-outside row22, zero-target rows18/19 — **is** complete.)
- **today-behavior:** a Delete-verb-specific extraction bug, or a `Move to:` destination that bypasses the reservation check, would not be caught.
- **failure scenario:** `extractApplyPatchTargets` (regex `PATCH_TARGET_RE`, bee-write-guard.mjs:82) mishandling a Delete or Move-dest path (e.g. reserved-by-another-agent move destination) allows a conflicting write with no red test.
- **file:line:** hooks/test_write_guard.mjs rows 8–26 (verb coverage gaps)
- **smallest fix:** add a Delete-of-reserved-path deny row and a `Move to:` destination-reserved-by-another-agent deny row (reuse `buildReservationFixture`).

## F5 — unprovable-deny rows 19–22 assert exit code only, not the corrective reason

- **severity:** P3
- **autofix_class:** assertion-tighten
- **summary:** The contract is "denies (exit 2) **with a corrective stderr**" (guard emits a FIX-bearing reason, bee-write-guard.mjs:193-196). Row18 asserts `stderr.trim().length>0`, but rows 19 (unknown verb), 20 (whitespace path), 21 (traversal), 22 (absolute-outside) assert `status===2` only — the "visible corrective message" half of D2 is unchecked on four of the six unprovable rows.
- **today-behavior:** a deny that exits 2 with empty/garbled stderr passes rows 19–22.
- **failure scenario:** a refactor that denies but drops the FIX text (or writes it to stdout) leaves the user with an opaque exit-2 and no guidance; only row18 would catch it.
- **file:line:** hooks/test_write_guard.mjs rows 19–22
- **smallest fix:** add `check(rN.stderr.includes("FIX"), ...)` (or `.trim().length>0`) to rows 19–22, matching row18.

---

## startFeature checklist verdict (Q3)

- **13 dedicated start-feature checks** added (2 lib + 11 CLI), plus the strengthened noverb row. (Prompt said 15; actual is 13 dedicated.)
- **Zero-mutation on refusal:** 6 of 8 refusal rows assert `before===after` (bad-phase, mid-flight, HANDOFF, worker, reservation, claimed-cell, nonterminal — all good). Two miss it → **F3**.
- **Valid-transition coverage:** idle→exploring covered (lib row 1, CLI defaults row); compounding-complete→new feature covered (lib row 2, CLI capped row, CLI nonterminal-then-drop row). Adequate.
- **Gate-reset on all four gates:** asserted explicitly (lib row 1 names all four false; lib row 2 `Object.values(...).every(false)`). Adequate.
