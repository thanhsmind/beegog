# Fan-out Delegation — Walkthrough

Reconstructed from `CONTEXT.md`, `plan.md`, `reports/validation-slice1.md`, `reports/review.md`, `reports/cell-fanout-{1,2,3,4}.md`, `.bee/cells/fanout-{1,2,3,4}.json`, and `git log 91e374c..HEAD`.

## What Shipped

The feature removed the advisor-mode orchestration pattern from the bee harness wholesale and replaced it with a single fan-out delegation pattern: the session model always orchestrates, and mechanical gather-altitude steps (multi-file reads, log/report mining, doc rendering from artifacts, repo scans) dispatch down-tier as I/O workers that return digests, governed by a default rubric (needs reading >3 files OR content only needed as a digest) rather than a new enforcement hook. Delivery ran as one slice of three disjoint-file cells in a single wave (fanout-1 code removal, fanout-2 contract prose, fanout-3 docs/ledger), followed by a five-reviewer review wave that promoted three corroborated findings, closed by a fourth cell (fanout-4) that added the missing warn-path tests, pinned a duplicated literal against drift, and de-duplicated an inline threshold restatement.

## Decisions Honored

**D1 — Advisor mode removed in full.** Landed in cell fanout-1 (commit `0056eda`): the `ADVISOR_POINTS`/`DEFAULT_ADVISOR`/`normalizeAdvisor` block and the `advisorModel` function were deleted from `skills/bee-hive/templates/lib/state.mjs` and its byte-identical twin `.bee/bin/lib/state.mjs`; the `ADVISOR MODE` preamble block was deleted from `templates/lib/inject.mjs` (+ twin); the advisor field/render was deleted from `templates/bee_status.mjs` (+ twin); `DEFAULT_CONFIG.advisor` was deleted from `onboard_bee.mjs`; the advisor block was deleted from `.bee/config-sample.json`; the advisor test block in `test_lib.mjs` (imports + the ~1099–1132 block) was replaced with a RED-first stale-key test. Per D1's "warn, never error" clause, `readConfig` now destructures a stale `advisor` key out of its `...config` spread (so it never leaks into the parsed result but never throws), and `bee_status.mjs`/`onboard_bee.mjs` each emit one `STALE_ADVISOR_KEY_WARNING` line when a repo's raw `.bee/config.json` still carries the key. Doc-side, D1 landed in cell fanout-3 (commit `587ab80`): README.md's three advisor mentions removed (one replaced with a fan-out delegation description), `docs/config-reference.md`'s advisor section removed with a "Removed keys" note added, `docs/model-presets.md`'s advisor-independence sentence removed, backlog P13 closed with a "killed 2026-07-12" note (P8 marked superseded), and decision `0013-advisor-mode.md` marked reversed citing this feature's D1; decision `0015-ceiling-is-the-session-model.md` annotated that its advisor-model-naming clause is obsolete while its core principle is preserved.

**D2 — Delegation trigger as a default rubric, not a hook.** Landed in cell fanout-2 (commit `e4e3c9c`) as the "Delegation contract" section in `skills/bee-hive/references/routing-and-contracts.md`, replacing the advisor section: gather-altitude steps dispatch down-tier as I/O workers "when the step needs reading >3 files OR content the main model only needs as a digest," with the orchestrator free to override either way, "same spirit as decision 0016." No new hook was added — the existing model-guard and P22 dispatch log were reused unchanged (validation confirmed this in the REPO FIT check). Review later found (F4) the numeric ">3 files" threshold had also been restated inline in `bee-hive/SKILL.md:65` and `bee-validating/SKILL.md:35`; fanout-4 (commit `79d96df`) dropped both inline numbers, leaving the rubric's only numeric home in `routing-and-contracts.md`.

**D3 — Rubric applies in every lane/phase; lane scaling v2 amended, not repealed.** Landed in cell fanout-2: the tiny/small lane-table "0 subagents" cells in `skills/bee-hive/SKILL.md` were reworded to "0 ceremony subagents (I/O-offload workers exempt)," and a one-line delegation pointer (naming gather-altitude steps and tier, per plan.md's per-skill table) was added to all 11 SKILL.md files — hive plus the 10 phase skills (exploring, planning, validating, swarming, reviewing, scribing, compounding, grooming, briefing, xia). The swarming rescue-ladder rung 2 was reworded to remove the advisor-mode reference, and the "called-only advisor" clause was deleted from `skills/bee-swarming/references/swarming-reference.md`.

## How It Was Executed

**Wave 1 — three cells, one wave, disjoint files (no dependencies):**

| Cell | Worker | Tier | Scope |
|---|---|---|---|
| fanout-1 | kevin | generation | lib/twin code removal, stale-key tolerance + warning, test_lib.mjs RED-first test |
| fanout-2 | stuart | generation | Delegation contract prose in routing-and-contracts.md, 11 SKILL.md pointer lines, lane-table amendment, rescue-ladder reword |
| fanout-3 | bob | extraction | README/docs/backlog/decisions cleanup |

Plan.md's mode gate counted 3 flags (data-model change, existing covered behavior, multi-domain) and landed the feature at `standard` lane. `validation-slice1.md` ran a Reality Gate (5/5 PASS), a plan-checker pass (8 findings, all closed — the most consequential being a fourth missed README advisor mention at line 407, and a fanout-2 verify command initially touching a file owned by parallel fanout-1), and a cold-pickup cell review that found and fixed two CRITICALs (the `readConfig` spread leaking a stale key past a token test, and the README:407 miss). Gate 3 was auto-approved under `gate_bypass` (standard lane, no hard-gate flag).

**The review wave** ran after wave 1 landed, diffing `91e374c..HEAD` (commits `587ab80`, `e4e3c9c`, `ff9e8ed`, `0056eda`) with four core reviewers plus a conditional api-contract reviewer, all opus, each with isolated context (diff + CONTEXT.md + plan.md): security (CLEAN), code-quality (1 P2, 2 P3), architecture (2 P3), test-coverage (1 P2, 1 P3), api-contract (3 P3, zero broken consumers, host-upgrade transition proven crash-free in both directions via probes A/B/C).

**The P1 fix cell (fanout-4, worker dave, generation tier)** closed three corroborated findings from the review synthesis: F1 (promoted P1) added functional tests proving `hasStaleAdvisorKey()` and `bee_status.mjs --json` actually surface `STALE_ADVISOR_KEY_WARNING`, plus an onboarding notices-fixture case; F2 (promoted P2) added a text-scan drift test pinning `onboard_bee.mjs`'s duplicated warning literal against `lib/state.mjs`'s export (same pattern as the existing `COMMAND_KEYS` drift check); F4 (P3) dropped the duplicated inline D2 threshold number. Commit `79d96df`. One deviation was recorded: fanout-4's verify grep for `3 files` in `bee-hive/SKILL.md` also matched an unrelated pre-existing mode-gate lane line (`<=3 files` at SKILL.md:100, the small-lane file-count threshold — a different rubric from D2's). It was reworded to `<=three files` at that one line, meaning unchanged, so the verify command passes without touching `routing-and-contracts.md` or any test assertion.

## Evidence Trail

**fanout-1** (`0056eda`) — verify: `node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/scripts/test_onboard_bee.mjs && ! grep -rn 'advisorModel\|ADVISOR_POINTS\|normalizeAdvisor\|DEFAULT_ADVISOR' skills/bee-hive/templates .bee/bin --include='*.mjs' && ! grep -rn 'ADVISOR MODE' skills/bee-hive/templates .bee/bin --include='*.mjs'`. Output: `test_lib.mjs: 169 passed, 0 failed`; `test_onboard_bee.mjs: PASS — failures: 0, skipped: 1` (pre-existing case-alias skip, unrelated); both grep checks zero matches; exit 0. RED-first: the new stale-key check was added and run before the lib edit, failing with `168 passed, 1 failed` because `readConfig` still normalized/injected an advisor key via `normalizeAdvisor`; re-verified RED directly against `git show HEAD:skills/bee-hive/templates/lib/state.mjs`, diffing its exports against `EXPECTED_STATE_EXPORTS` → `MATCH: false` (had `ADVISOR_POINTS`/`advisorModel`, missing `STALE_ADVISOR_KEY_WARNING`/`hasStaleAdvisorKey`).

**fanout-2** (`e4e3c9c`) — verify: `grep -q 'Delegation contract' ... && ! grep -qi 'advisor mode' ... && for f in hive exploring planning validating swarming reviewing scribing compounding grooming briefing xia; do grep -qil 'delegat' skills/bee-$f/SKILL.md || { echo missing:$f; exit 1; }; done && ! grep -qi 'called-only advisor' ...`. Output: exit 0, no output — all checks passed. RED-first: pre-change `routing-and-contracts.md:172-186` still carried the "Advisor mode ... decision 0013" heading (verify would have exited 1); none of the 11 SKILL.md files matched `/delegat/i` pre-change (loop would have printed `missing:<skill>` for every one).

**fanout-3** (`587ab80`) — verify: `! grep -qi 'advisor' README.md docs/model-presets.md && grep -qi 'removed' docs/config-reference.md && grep -q 'killed 2026-07-12' docs/backlog.md && grep -q 'fanout-delegation' docs/decisions/0013-advisor-mode.md`. Output: `VERIFY PASSED`. (`behavior_change: false` — doc-only cell; no RED-first evidence recorded, consistent with a prose-only change.)

**fanout-4** (`79d96df`) — verify: `node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/scripts/test_onboard_bee.mjs && grep -c '3 files' skills/bee-hive/references/routing-and-contracts.md >/dev/null && ! grep -q '3 files' skills/bee-validating/SKILL.md && ! grep -q '3 files' skills/bee-hive/SKILL.md && grep -q 'hasStaleAdvisorKey' skills/bee-hive/templates/tests/test_lib.mjs`. Output: `test_lib.mjs: 170 passed, 0 failed`; `test_onboard_bee.mjs: PASS — failures: 0, skipped: 1`; `3 files` count in routing-and-contracts.md = 1 (sole home retained); no match in the two SKILL.md files; `hasStaleAdvisorKey` match found; exit 0. RED-first: pre-cell, `grep -n 'hasStaleAdvisorKey(' test_lib.mjs` returned zero matches (function only named in the export allowlist, never invoked/asserted); `grep -n 'STALE_ADVISOR_KEY_WARNING'`/`'advisor'` in `test_onboard_bee.mjs` returned zero matches (no drift-scan test, no stale-key notices test); `git show HEAD` confirmed the D2 threshold duplicated in `bee-hive/SKILL.md:65` and `bee-validating/SKILL.md:35` on top of the canonical text in `routing-and-contracts.md`.

Review synthesis's verification-evidence gate: **PASS** — both behavior-change cells (fanout-1, fanout-2) carry specific RED-first evidence in their traces (advisor-strip FAIL pre-edit at a 168-passed baseline; pre-change verify exit 1 confirmed via `git show`).

## Findings and Residuals (from review.md)

| ID | Severity (as promoted) | Finding | Resolution |
|---|---|---|---|
| F1 | P1 (promoted from P2/P2/P3 by corroboration) | Stale-key WARNING shipped unproven on both surfaces — `hasStaleAdvisorKey` never invoked by any test; neither `bee_status.mjs:70` nor `onboard_bee.mjs:1097` emit path exercised | **Fixed** — cell fanout-4 (`79d96df`): warn-path assertions added; suites re-run 170/170 and PASS. Deviation recorded: unrelated `<=3 files` lane-sizing line reworded to `<=three files` to satisfy the verify grep literally. |
| F2 | P2 (promoted from 3× P3) | Duplicated `STALE_ADVISOR_KEY_WARNING` constant (onboard_bee.mjs local copy vs. lib/state.mjs export) has no drift guard | **Fixed** — fanout-4: text-scan equality test added (COMMAND_KEYS drift-test precedent) |
| F3 | P2 (promoted from code-quality + api-contract) | "removed in 0.1.23" forward-reference while `BEE_VERSION = 0.1.22` | **Filed** — not a code defect; release-coordination requirement. This feature's close must cut v0.1.23 per the standing release flow; noted for Gate 4. |
| F4 | P3 | D2 numeric threshold (">3 files") restated inline in `bee-validating/SKILL.md:35` and `bee-hive/SKILL.md:65`, a drift seam against the single-source contract | **Fixed** — fanout-4: number dropped, pointer wording kept, canonical number stays only in `routing-and-contracts.md` |
| F5 | P3 (advisory) | Partial-sync window during `onboard --apply`: a NEW `bee_status.mjs` importing new exports from an as-yet-OLD `state.mjs` can hard-error mid-apply; self-heals on next apply; inherent to every cross-file export addition in the vendored twin set, not feature-specific | **Filed** — backlog note, no code change |

Other gates from review.md: **Frozen judge** intact on all three wave-1 cells (test-file edits were declared cell scope); **Artifact verification** — Delegation contract section EXISTS/SUBSTANTIVE/WIRED (11 pointer lines + both lane-table rows), stale-key warn path EXISTS/SUBSTANTIVE with WIRED-proof completed by fanout-4; **Deviation review** — kevin's local warning constant in `onboard_bee.mjs` (not imported from `lib/state.mjs`) accepted, architecture judged it the correct boundary call, drift risk bounded by F2's fix.

## Files Touched

**Code (lib/twins + onboarding + config, fanout-1, commit `0056eda`):**
- `skills/bee-hive/templates/lib/state.mjs` / `.bee/bin/lib/state.mjs` (twins)
- `skills/bee-hive/templates/lib/inject.mjs` / `.bee/bin/lib/inject.mjs` (twins)
- `skills/bee-hive/templates/bee_status.mjs` / `.bee/bin/bee_status.mjs` (twins)
- `skills/bee-hive/scripts/onboard_bee.mjs`
- `skills/bee-hive/templates/tests/test_lib.mjs`
- `.bee/config-sample.json`

**Prose contract (fanout-2, commit `e4e3c9c`, report commit `ff9e8ed`):**
- `skills/bee-hive/references/routing-and-contracts.md`
- `skills/bee-hive/SKILL.md`
- `skills/bee-exploring/SKILL.md`, `skills/bee-planning/SKILL.md`, `skills/bee-validating/SKILL.md`, `skills/bee-swarming/SKILL.md`, `skills/bee-reviewing/SKILL.md`, `skills/bee-scribing/SKILL.md`, `skills/bee-compounding/SKILL.md`, `skills/bee-grooming/SKILL.md`, `skills/bee-briefing/SKILL.md`, `skills/bee-xia/SKILL.md`
- `skills/bee-swarming/references/swarming-reference.md`

**Docs/ledger (fanout-3, commit `587ab80`):**
- `README.md`
- `docs/config-reference.md`
- `docs/model-presets.md`
- `docs/backlog.md`
- `docs/decisions/0013-advisor-mode.md`
- `docs/decisions/0015-ceiling-is-the-session-model.md`

**Review fix (fanout-4, commit `79d96df`):**
- `skills/bee-hive/templates/tests/test_lib.mjs`
- `skills/bee-hive/scripts/test_onboard_bee.mjs`
- `skills/bee-validating/SKILL.md`
- `skills/bee-hive/SKILL.md`

## Notes on Missing/Unused Sources

All requested sources were found and used: `CONTEXT.md`, `plan.md`, `reports/validation-slice1.md`, `reports/review.md`, and all four `reports/cell-fanout-{1,2,3,4}.md` plus their matching `.bee/cells/fanout-{1,2,3,4}.json` traces. No source was missing.
