# Validation report — Slice 1b (downgrade preflight)

Feature: codex-harness-hardening · Slice: 1b · Lane: high-risk · Cell: codex-harness-hardening-1b-1
Date: 2026-07-15 · Verdict: **READY WITH CONSTRAINTS**

## Reality gate

| Check | Result | Evidence |
|---|---|---|
| MODE FIT | PASS | 5 flags incl. hard-gate (audit/security) → high-risk; matches plan.md mode gate. |
| REPO FIT | PASS | Exact anchors confirmed by recon: copy_lib loop `onboard_bee.mjs:1645-1651`; apply `:1977-1981`; primitives in-file `readVersionStrict:310`, `compareVersions:349`, `versionLabel:360`; existing preflight `computeSkillSyncTarget:625-780`; regression `skills/bee-hive/scripts/test_split_brain_regression.mjs` exists (280 lines). |
| ASSUMPTIONS | PASS (see matrix) | The VER-01..06 discipline is NOT new — it already exists for the skill-sync path; the fix extends it to the lib/runtime target. |
| SMALLER PATH | PASS | Already reduced to 1 cell: drift-honesty (E-02) + SRC classifier deferred to 1c/P37 (decisions 6eb8ffe5, 513f8ad4). Preflight is the primary fix (a refused downgrade leaves .bee/bin/lib intact, so drift stays honestly false). |
| PROOF SURFACE | PASS | `test_split_brain_regression.mjs` is the frozen acceptance fixture (VER-06): exit 3 = FREEZE-RED, exit 0 = blocked_downgrade for plan AND apply + zero-mutation hashTree, exit 2 = fixture bug. Not yet in commands.verify (its header forbids joining while red). |

## Feasibility matrix

| Assumption | Risk | Proof required | Evidence | Result |
|---|---|---|---|---|
| The version primitives are reusable in-file for the copy_lib path | HIGH | read the functions | `readVersionStrict(stateFile, treeExists, {componentRoot})` reads a single line-anchored `export const BEE_VERSION='x.y.z'`, returns `{state: absent\|unknown\|resolved, value}`; `compareVersions` does numeric triple compare. Both local to onboard_bee.mjs. | PASS |
| The exact preflight discipline (blocked_downgrade / unknown-fail-closed / force-only-when-all-numeric / zero-mutation) already exists | HIGH | read computeSkillSyncTarget | `:709-772` — three-version preflight (source/host_helpers/installed_skills), `unknown`→blocked non-forceable (VER-03), `source<target`→blocked_downgrade forceable iff all numeric (VER-02/05), absent target = fresh (VER-04). Verbatim match to VER-01..06. | PASS |
| A lib/runtime downgrade surfaces as top-level `status: blocked_downgrade` for plan AND apply | MED-HIGH | trace the aggregation | **Panel-resolved:** the single coherent fold is `skillSync.blocked = libBlocked` inside `computePlan` (~:1770-1777). Then plan status (:2247), applyPlan pre-loop abort (:1870/:1887), and recheck (:2310) all light up UNCHANGED. The `:2246/:2308` sites need no edit. The test reads top-level `status` (planPayload.status @test:233, applyPayload.status @test:245). | PASS |
| The regression test's exit-0 condition matches what this fix produces | MED | read the test's assertions | Panel confirmed RED baseline reproduces (`before=1.0.0 after=0.1.43` via ungated copy_lib on the self_skip route). Exit 0 = blocked_downgrade for plan+apply + whole-repo zero-mutation hashTree — met by the pre-loop abort. | PASS |
| copy_lib is the ONLY runtime-downgrade vector in step 3 | HIGH | audit step 3 | **Panel: NO.** `copy_helper` (:1629-1636, `listTemplateHelpers` globs `templates/*.mjs` incl. `bee.mjs`) is a second vector. VER-02 → the WHOLE apply must abort. The pre-loop abort at :1870 covers copy_lib AND copy_helper AND write_onboarding. This makes the whole-apply-abort design load-bearing (residual `bee.mjs` vector noted for 1c). | PASS (whole-apply abort) |
| The hole is target-independent and survives self_skip | HIGH | trace self-onboard path | **Panel finding (reshaped the fix):** ordinary hosts are ALREADY protected — `computeSkillSyncTarget:741` blocks source-vs-`host_helpers` (= `.bee/bin/lib/state.mjs`). The hole is ONLY the self-onboard/self_skip path (:869-880) where targets skip that check before it runs, yet copy_lib/copy_helper still run. Fix = hoist the target-independent host-vs-source check so it fires under self_skip too. | PASS |

## Plan-checker / persona panel (review tier, background)

Verdict: **READY-WITH-CONSTRAINTS.** Coherence + feasibility + security/integrity + scope-guardian.

- **BLOCKER (resolved in cell):** the gate must be a whole-apply abort at `:1870` via `skillSync.blocked`, NOT a guard inside `case "copy_lib"` (:1977) — the latter lets the loop + `write_onboarding` run → `apply_status="applied"` + onboarding.json mutates → fixture stays red. Cell action + prohibitions rewritten to require the pre-loop abort.
- **WARNING (resolved):** the fold point is `skillSync.blocked` in `computePlan` (~:1770-1777), not the `:2246/:2308` status sites. Cell corrected; those sites are now explicitly prohibited from edits.
- **WARNING (scope, encoded):** scope the lib gate to the self_skip/self-onboard path (or hoist the target-independent host-vs-source check), merge blocked-first with `forceable=allNumeric` — an unconditional add would be a redundant parallel path since `:741` already covers ordinary hosts. Cell action names the hoist.
- **WARNING (residual, → 1c):** `copy_helper` downgrades `.bee/bin/bee.mjs` ungated; safe here only via the whole-apply abort + the release-tuple/mirror invariant keeping `bee.mjs` in lockstep with `state.mjs`. Noted for 1c.
- **WARNING (scope, accepted):** E-02 drift-honesty stays live after 1b (fixture never asserts `drift`); deferral to 1c/P37 is honest — the false-green persists but is no longer weaponizable into a silent write.

## Cell review (cold pickup)

After the rewrite, cell `codex-harness-hardening-1b-1` names the single fold point, the pre-loop abort,
the two prohibited sites, the reused primitives, the residual `copy_helper` vector, and a runnable
verify. No CRITICAL flags remain. Cold-pickup ready.

## Approval block

- **Verdict:** READY WITH CONSTRAINTS (all constraints encoded into the cell's action/truths/prohibitions).
- **Gate 3 (execution):** high-risk lane. Under gate_bypass=`total` (decision 0010 lifts the high-risk
  floor; user authorization dcf01d7b — total autopilot, zero stops) the recommendation is recorded and
  auto-approved with a one-line audit decision rather than stopped. At `normal` this gate WOULD stop.
