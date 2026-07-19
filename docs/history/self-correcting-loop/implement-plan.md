---
artifact_contract: bee-implement-plan/v1
feature: self-correcting-loop
lane: high-risk
status: Ready for Review
updated: 2026-07-20
sources: [CONTEXT.md, plan.md, .bee/cells/scl-1.json, .bee/cells/scl-2.json, .bee/cells/scl-3.json, .bee/cells/scl-4.json, .bee/cells/scl-5.json]
decisions: [D1, D2, D3, D4, D5, D6]
---

# Implementation Plan: self-correcting-loop

> Human-layer projection of the truth artifacts. Truth lives in CONTEXT.md
> (decisions), plan.md + cells (work). Feedback on this document flows back
> to those artifacts, then this re-renders.

## Intent

The Builder–Judge–Manager assessment of 2026-07-20 surfaced four gaps: claim
budgets reset per claim with no ceiling, so a claim→block→re-dispatch cycle
can loop indefinitely at cell lifetime; the trace records only the final
outcome, giving a Manager no way to tell progress from a blind repeat;
`verify` is checked for being runnable but never for being *sufficient* for
the class of change it certifies; and the gap between "mechanical verify"
and a full user-invoked review session has no automatic scaling by risk.
This feature closes all four with one trustworthy small loop — one cell,
one builder, one grounded judge, one finite manager loop, hard stop — before
any further scaling is considered. Mode is `high-risk`: the work touches the
claim/cap machinery and the goal-check contract that every future feature's
safety rides on.

## D1–D6

| Decision | One-line | Guarantee |
|---|---|---|
| D1 — Revision ledger | `trace.attempts` is an append-only per-cell attempt history, written by `recordVerify` (pass and fail) and `blockCell`, with a worker-suppliable or mechanically normalized `failure_signature`. | Every attempt is recorded and never rewritten or removed, so a Manager can distinguish progress from a blind repeat. |
| D2 — Cell-lifetime budgets | Optional cell field `budgets` (default `{max_claims:3, max_failed_attempts:4, max_same_signature:2}`), enforced at the claim door in `claimCellCrossSession`. | Typed `CELL_BUDGET_EXHAUSTED` / `REPEATED_FAILURE` refusals stop unbounded looping; the only reopening door is `cells reset-budget --id --reason` (logs a decision, appends an audit entry); `gate_bypass` never overrides either refusal. |
| D3 — Judge-standard sufficiency | Optional `change_class` field (`formatting\|bugfix\|behavior\|api\|security\|migration`) drives an advisory minimum-verify matrix at authoring, with mechanical teeth only for `behavior`. | Authoring never hard-refuses; a `behavior` cell cannot cap without `red_failure_evidence` ≥80 chars and not byte-equal to another cell's — the only class with cap-teeth in v1. |
| D4 — Risk-scaled semantic judge | The swarming goal-check gains a judge tier by lane: tiny/small unchanged (mechanical only); standard dispatches one checklist judge (review tier, read-only) per capped `behavior_change` cell; high-risk prefers a judge model differing from the builder's. | `NEEDS_REVISION` + `automatic` fixability re-dispatches with the exact issue and a ledger entry; `authority` escalates to the user; this stays goal-check verification, never a new phase or auto review session — Gate 4 and the review-candidates ledger are untouched (decision 565e68d0). |
| D5 — One verdict schema | Every judge returns `judge-verdict/1`, validated by `validateJudgeVerdict` (typed errors, never throws) and stored append-only at `trace.semantic_judge`. | Free-prose or unknown-verdict judge output is rejected and re-dispatched once, then recorded `unverified`; `model_independence` only claims `confirmed` when both dispatches are pinned to differing models. |
| D6 — Compatibility floor | All additive: new optional cell fields (`budgets`, `change_class`), new trace keys (`attempts`, `semantic_judge`, `budget_resets`), new typed refusals. | No store format breaks, no new dependencies; `updateCell`'s frozen-key list gains the new trace keys; single-cell single-attempt flows behave byte-identically except where they previously looped silently. |

## Cells

### scl-1 — revision ledger: `trace.attempts` + failure-signature normalizer (D1)

- **Goal:** append-only per-cell attempt ledger, written on every `recordVerify` outcome and every `blockCell`, plus a deterministic `failure_signature` normalizer.
- **Files:** `skills/bee-hive/templates/lib/cells.mjs`, `.bee/bin/lib/cells.mjs`, `skills/bee-hive/templates/bee.mjs`, `.bee/bin/bee.mjs`, `skills/bee-hive/templates/lib/command-registry.mjs`, `.bee/bin/lib/command-registry.mjs`, `skills/bee-hive/templates/tests/test_lib.mjs`, `docs/history/codex-harness-hardening/release-manifest.json`, `.claude-plugin/skills`, `.codex-plugin/skills`.
- **Approach:** freeze-first (test_lib + test_bee_cli green recorded), then add `appendAttempt` inside `recordVerify` (both outcomes) and `blockCell`, appending `{n, at, claim_session, worker, verdict: pass|fail|blocked, failure_signature, note}` to `trace.attempts` (array created when absent). `failure_signature` prefers an explicit `--signature` flag on `cells verify` (threaded through both `bee.mjs` copies), else `normalizeFailureSignature(output)`: strip ISO timestamps/absolute paths/hex runs, take the first line matching `/FAIL|Error|refus|denied/i` (else first non-empty line), sha256 → first 12 hex. `updateCell`'s frozen-key list gains `attempts`, `semantic_judge`, `budget_resets`. Regen inside the cell: mirror sync + `render_plugin_skill_trees.mjs` + `release_manifest.mjs --write` then `--check`.
- **Verify:** `node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/templates/tests/test_bee_cli.mjs && node scripts/test_lib_mirror.mjs && node scripts/release_manifest.mjs --check`
- **Deps:** none.
- **Truths:** ledger is append-only — no path rewrites or removed entries; normalizer is deterministic for equal logical failures; existing verify/cap flows are byte-compatible when the ledger is absent.
- **Prohibitions:** no writes into `trace.deviations`; no signature computed from unredacted absolute paths.

### scl-2 — cell-lifetime budgets at the claim door + audited reset (D2)

- **Goal:** enforce `max_claims`/`max_failed_attempts`/`max_same_signature` at the claim door with typed refusals, plus an audited reset door.
- **Files:** `skills/bee-hive/templates/lib/cells.mjs`, `.bee/bin/lib/cells.mjs`, `skills/bee-hive/templates/bee.mjs`, `.bee/bin/bee.mjs`, `skills/bee-hive/templates/lib/command-registry.mjs`, `.bee/bin/lib/command-registry.mjs`, `skills/bee-hive/templates/tests/test_lib.mjs`, `scripts/test_claim_race.mjs`, `docs/history/codex-harness-hardening/release-manifest.json`, `.claude-plugin/skills`, `.codex-plugin/skills`.
- **Approach:** freeze-first (test_claim_race + test_lib green recorded). In `claimCellCrossSession`, before `claimCellFile`, compute `claims_used`, `failed_attempts`, and the max same-signature run from `trace.attempts` (counters restart after the latest `budget_resets` marker). `budgets` defaults to `{max_claims:3, max_failed_attempts:4, max_same_signature:2}` when the cell field is absent. Exceeding `max_claims`/`max_failed_attempts` returns typed `{ok:false, code:CELL_BUDGET_EXHAUSTED, budget, used, history_summary, fix}`; two attempts sharing a signature return `{code:REPEATED_FAILURE, signature, fix}` on the next claim. New verb `cells reset-budget --id --reason` requires a reason, logs a decision, and appends `{reset_at, reason, by_session}` to an append-only `trace.budget_resets` — never rewrites `attempts`. Explicit test row: `gate_bypass=total` does NOT bypass either refusal. `test_claim_race.mjs` gains a budget-exhaustion racer case. Regen inside the cell: mirror + render + manifest.
- **Verify:** `node scripts/test_claim_race.mjs && node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/templates/tests/test_bee_cli.mjs && node scripts/test_lib_mirror.mjs && node scripts/release_manifest.mjs --check`
- **Deps:** scl-1.
- **Truths:** a fresh cell with no history claims exactly as today; refusals name the exhausted budget and the sanctioned door; reset never rewrites or deletes ledger history.
- **Prohibitions:** no `gate_bypass` branch may skip these refusals; no wall-clock budget in this cell.

### scl-3 — judge-standard matrix: authoring advisory + behavior-class cap teeth (D3)

- **Goal:** advisory `JUDGE_STANDARD_INSUFFICIENT` warnings at authoring across all classes, with hard cap-teeth for `behavior` only.
- **Files:** `skills/bee-hive/templates/lib/cells.mjs`, `.bee/bin/lib/cells.mjs`, `skills/bee-hive/templates/tests/test_lib.mjs`, `skills/bee-hive/templates/bee.mjs`, `.bee/bin/bee.mjs`, `docs/history/codex-harness-hardening/release-manifest.json`, `.claude-plugin/skills`, `.codex-plugin/skills`.
- **Approach:** freeze-first. Add optional `change_class` validation (enum `formatting|bugfix|behavior|api|security|migration`; absent + `behavior_change:true` derives `behavior`). Advisory at add/update (manifest-lint pattern, pah-2): a `JUDGE_STANDARD_INSUFFICIENT` warning in the JSON result naming the missing minimum per the CONTEXT matrix — never a refusal at authoring. Cap teeth apply only to `behavior`: `capCell` refuses when `verification_evidence.red_failure_evidence` is absent, under 80 chars, or byte-equal to another cell's recorded red evidence (scanning `.bee/cells/*.json`), naming the failed minimum. Already-capped `behavior_change` cells are untouched (the check runs at cap time only). Regen inside the cell: mirror + render + manifest.
- **Verify:** `node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/templates/tests/test_bee_cli.mjs && node scripts/test_lib_mirror.mjs && node scripts/release_manifest.mjs --check`
- **Deps:** scl-2 (cells.mjs serialization).
- **Truths:** authoring never hard-refuses on the matrix; only the `behavior` class has cap teeth in v1; refusals name the missing minimum verbatim.
- **Prohibitions:** no auto-derivation beyond `behavior_change` ⇒ `behavior`; no changes to existing cap evidence requirements beyond the behavior teeth.

### scl-4 — judge verdict schema validator + `trace.semantic_judge` + independence derivation (D5)

- **Goal:** a typed, never-throwing verdict validator and an append-only `trace.semantic_judge`, plus honest model-independence derivation.
- **Files:** `skills/bee-hive/templates/lib/cells.mjs`, `.bee/bin/lib/cells.mjs`, `skills/bee-hive/templates/lib/dispatch-guard.mjs`, `.bee/bin/lib/dispatch-guard.mjs`, `skills/bee-hive/templates/bee.mjs`, `.bee/bin/bee.mjs`, `skills/bee-hive/templates/lib/command-registry.mjs`, `.bee/bin/lib/command-registry.mjs`, `skills/bee-hive/templates/tests/test_lib.mjs`, `docs/history/codex-harness-hardening/release-manifest.json`, `.claude-plugin/skills`, `.codex-plugin/skills`.
- **Approach:** freeze-first. `validateJudgeVerdict(obj)` (in `cells.mjs`, or a small `judge.mjs` lib if cleaner — added to the mirror/manifest sets either way) returns typed `{ok, errors[]}` against schema `judge-verdict/1`: `verdict` PASS|NEEDS_REVISION, `checks[]` `{id, status PASS|FAIL, evidence non-empty}`, `fixability` automatic|authority, `confidence` low|medium|high; `failure_signature` required when any check FAILs; never throws. `deriveModelIndependence(builderDispatch, judgeDispatch)` reuses the dispatch-economics vocabulary: both pinned and differing model names ⇒ `confirmed`; equal ⇒ `same-model`; anything else ⇒ `unverified`. New verb `cells judge-record --id --file <verdict.json>` validates, stamps model fields, appends to append-only `trace.semantic_judge`, and refuses invalid input with the typed errors. Regen inside the cell: mirror + render + manifest.
- **Verify:** `node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/templates/tests/test_bee_cli.mjs && node scripts/test_lib_mirror.mjs && node scripts/release_manifest.mjs --check`
- **Deps:** scl-1.
- **Truths:** the validator never throws into guard paths; independence never claims `confirmed` without two pinned, differing models; `semantic_judge` entries survive cap and resist `updateCell`.
- **Prohibitions:** no review-candidates/Gate-4 changes; no dispatching logic in lib (validation only).

### scl-5 — doctrine: risk-scaled semantic judge in the goal-check + close regen (D4)

- **Goal:** land the judge-tier table and verdict handling in the swarming goal-check doctrine, with an explicit boundary against user-invoked review.
- **Files:** `skills/bee-swarming/SKILL.md`, `skills/bee-swarming/references/swarming-reference.md`, `skills/bee-hive/references/routing-and-contracts.md`, `docs/history/codex-harness-hardening/release-manifest.json`, `.claude-plugin/skills`, `.codex-plugin/skills`.
- **Approach:** extend the swarming Goal-check step with the judge tier table — tiny/small: mechanical only (unchanged); standard: dispatch one checklist judge (`bee-review` pinned type, review tier, read-only) per capped `behavior_change` cell, checking `must_haves` truths against the diff, CONTEXT decision citations, and task-to-diff alignment, recording `judge-verdict/1` via `cells judge-record`; high-risk: same judge, model independence preferred (differing resolved model; equal recorded honestly as `same-model`). Verdict handling: PASS ⇒ cell counts; NEEDS_REVISION + `automatic` ⇒ cell not done, re-dispatch with the exact failing checks plus a ledger entry; `authority` ⇒ escalate to the user. States explicitly that this is goal-check verification, not independent review — Gate 4, review sessions, and the candidates ledger stay user-invoked (decision 565e68d0). Updates the routing-and-contracts Delegation contract with the judge dispatch class. Docs/skill-text only — no lib edits. Final `render_plugin_skill_trees` + `release_manifest.mjs --write`; conformance + census + skill_render green.
- **Verify:** `node scripts/test_skill_render.mjs && node scripts/test_conformance.mjs && node scripts/census_stale_spawn_syntax.mjs && node skills/bee-hive/scripts/test_plugin_distribution.mjs && node scripts/release_manifest.mjs --check`
- **Deps:** scl-2, scl-3, scl-4.
- **Truths:** tiny/small goal-check text is unchanged; the boundary to user-invoked review is stated explicitly; the judge dispatch uses the pinned review type, read-only.
- **Prohibitions:** no new phase; no auto review-session creation; no lib edits.

## Cross-cutting patterns

- **Freeze-first (critical-patterns 20260716).** Every cell that touches `cells.mjs`/`claims.mjs` records a green baseline (the relevant existing suites, e.g. `test_lib`, `test_bee_cli`, `test_claim_race`) *before* editing, per scl-1 through scl-4's "FREEZE FIRST" action lines. This is serialized work — all five cells share the same files — so each cell's freeze must reflect the prior cell's capped state, not a stale baseline.
- **In-cell mirror + render + manifest regen (critical-patterns 20260715, 3rd recurrence).** Every lib-touching cell (scl-1 through scl-4) runs its own mirror sync check, `render_plugin_skill_trees.mjs`, and `release_manifest.mjs --write` then `--check` inside its own verify — never deferred to a later cell. scl-5 (docs/doctrine only, no lib edits) runs the equivalent render + manifest write/check for skill-text projections instead.

## Risks

Sourced from plan.md; impact levels are not classified in the source, so none are stated here rather than invented.

| Risk | Mitigation |
|---|---|
| Claim-door changes can lock sessions out (false `CELL_BUDGET_EXHAUSTED`) | Defaults only bite from the 4th claim; `reset-budget` door exists; freeze-first plus the racer suite stays green. |
| Cap-teeth can strand legitimate `behavior` cells | 80-char floor only, a named refusal, and only the `behavior` class is affected. |
| Judge doctrine could recreate auto-review | Explicitly scoped to goal-check only; Gate 4 and the candidates ledger are untouched (D4 non-goal). |

## Open Questions

No blocking open questions beyond what CONTEXT.md's own Non-goals section already defers (wall-clock budgets, auto-derivation of `change_class` beyond `behavior_change`, planning-level judge changes). Ready for review.
