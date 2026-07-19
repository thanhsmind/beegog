# CONTEXT — self-correcting-loop

Close the four gaps from the Builder–Judge–Manager assessment (2026-07-20,
backlog rows feature=self-correcting-loop): the goal is ONE trustworthy small
loop — 1 cell → 1 builder → 1 grounded judge → 1 finite manager loop → hard
stop — before any further scaling.

Mode: high-risk (touches claim/cap machinery and the goal-check contract;
every future feature's safety rides these paths).

## Problem

1. Budgets reset per claim by design (rescue rung 1 grants a fresh consult
   budget), so claim→block→re-dispatch can loop indefinitely at cell
   lifetime. No max-claims, no same-failure detection, no wall-clock ceiling.
2. Trace records the final outcome only — no attempt-by-attempt ledger, so a
   Manager cannot tell progress from a blind repeat.
3. Verify must be runnable but nothing checks it is SUFFICIENT for the change
   class ("npm run lint" passes while behavior is wrong). red_failure_evidence
   for behavior_change is declared by the worker, not mechanically shaped.
4. The default chain ends verified-but-unreviewed for every lane; the semantic
   judge exists only inside user-invoked review sessions (deliberate — decision
   565e68d0 — but between "mechanical verify" and "full review session" there
   is an empty tier that should scale with risk automatically).

## Locked decisions

**D1 — Revision ledger: `trace.attempts` is an append-only per-cell attempt
history.** An attempt entry is appended by recordVerify (both outcomes) and
blockCell: `{n, at, claim_session, worker, verdict: pass|fail|blocked,
failure_signature, note}`. `failure_signature` is worker-suppliable
(`--signature`) with a mechanical fallback: normalize the recorded verify
output (strip timestamps/paths/hex, first failing line, sha256 → 12 hex).
Append-only like `trace.ownership_overrides` (survives capCell's trace spread;
NEVER inside trace.deviations). No entry is ever rewritten or removed.

**D2 — Cell-lifetime budgets with typed exhaustion, enforced at the claim
door.** New optional cell field `budgets` with defaults applied at claim time
when absent: `{max_claims: 3, max_failed_attempts: 4, max_same_signature: 2}`.
`claimCellCrossSession` (the sole claim door post-msh) counts prior claims
(ledger `claim_session` transitions + existing trace) and refuses with typed
`CELL_BUDGET_EXHAUSTED` naming the exhausted budget, the attempt history
summary, and the sanctioned door. Same-signature: two ledger fails with an
identical signature refuse the NEXT claim with `REPEATED_FAILURE` (the
Manager must change approach or escalate, not re-run). **gate_bypass NEVER
auto-overrides budget exhaustion** — these are loop-safety stops, not
approval gates; the only door is `cells reset-budget --id --reason` which
logs a decision and appends a ledger entry. No wall-clock budget in v1
(no reliable telemetry; attempts are the clock). Existing cells without
`budgets` get the defaults — old stores behave identically until a cell
actually loops.

**D3 — Judge-standard sufficiency: advisory at authoring, mechanical at cap.**
New optional cell field `change_class`:
`formatting|bugfix|behavior|api|security|migration` (absent ⇒ derived:
behavior_change:true ⇒ `behavior`, else unclassified ⇒ no matrix check).
Minimum-verify matrix (advisory warning `JUDGE_STANDARD_INSUFFICIENT` at
cells add/update, manifest-lint style, never a refusal at authoring):
formatting ⇒ lint/typecheck present; bugfix ⇒ verify names a test path;
behavior ⇒ red_failure_evidence required; api ⇒ a contract/integration test
named; security ⇒ a negative-path test named; migration ⇒ forward + rollback
checks named. Mechanical teeth at cap, additive to today's rules: a
`behavior` cell's `verification_evidence.red_failure_evidence` must be a
non-empty string of ≥80 chars that is not byte-equal to any other cell's
(anti-boilerplate); insufficient ⇒ cap refuses naming the missing minimum.
Only the `behavior` row gets hard cap-teeth in v1 — the other classes stay
advisory until field data justifies more (promote sparingly).

**D4 — Semantic judge scales with risk at goal-check time, distinct from
user-invoked review.** The swarming goal-check (P12/0018) gains a judge tier
by lane: tiny/small ⇒ mechanical only (unchanged); standard ⇒ the
orchestrator dispatches ONE checklist judge (review tier, read-only) per
capped behavior_change cell — checks must_haves truths vs diff, CONTEXT
decision citations, task-to-diff alignment; high-risk ⇒ same judge but the
model must differ from the builder's resolved model (independence), falling
back to review tier config; if judge model == builder model, the record says
`model_independence: "same-model"` honestly and the judge still runs.
The judge returns the D5 schema; verdict `NEEDS_REVISION` with fixability
`automatic` ⇒ the cell is NOT done (re-dispatch with the exact issue, a
ledger fail entry with the judge's failure_signature); fixability
`authority` ⇒ escalate to the user. This is doctrine + a verdict validator
lib + a trace record — NOT a new phase, NOT a review session, Gate 4 and the
candidates ledger untouched (565e68d0 stands: full review remains
user-invoked).

**D5 — One structured verdict schema for every judge, validated by lib.**
`{schema: "judge-verdict/1", verdict: PASS|NEEDS_REVISION, checks: [{id,
status: PASS|FAIL, evidence}], failure_signature?, fixability:
automatic|authority, confidence: low|medium|high, builder_model?,
judge_model?, model_independence: confirmed|same-model|unverified}` —
`model_independence` derives from the dispatch economics vocabulary (a
pinned judge dispatch with a model param differing from the builder's
recorded model ⇒ confirmed; anything else honest). Validator
`validateJudgeVerdict` in lib (typed errors, never throws to guards); the
verdict is stored at `trace.semantic_judge` (append-only array). Free-prose
judge output is a failed judge run, re-dispatched once, then recorded
`unverified`.

**D6 — Compatibility floor.** All additive: new optional cell fields
(`budgets`, `change_class`), new trace keys (`attempts`,
`semantic_judge`), new typed refusals (`CELL_BUDGET_EXHAUSTED`,
`REPEATED_FAILURE`, `JUDGE_STANDARD_INSUFFICIENT` advisory). No store format
breaks, no new dependencies, updateCell's frozen-key list gains the new trace
keys as frozen. Single-cell single-attempt flows behave byte-identically
except where they previously looped silently.

## Validating amendments (advisor Δ1-Δ6 + plan-check F1-F7, folded pre-Gate-3)

- **D1+Δ1:** every attempt entry also carries the live claim's `claimed_at`;
  claim counting = distinct `(claim_session, claimed_at)` pairs (+1 for the
  current acquisition) — a solo session re-claiming counts correctly, multiple
  verifies inside one claim never double-count. Legacy no-ledger cells count 0
  (defaults never bite — D6 preserved). F2: swept/dropped acquisitions may
  undercount — conservative-safe, reset-budget is the escape; stated in tests.
- **D2+Δ2 (over plan-check's pre-acquire alternative, recorded):** the budget
  check runs INSIDE the O_EXCL critical section — after `claimCellFile`
  succeeds, refusal releases the just-acquired claim (unwind precedent
  cells.mjs:951). Outside-the-door checks are TOCTOU vs concurrent
  claim-fail-release and order-nondeterministic. Enforcement therefore lands
  at the NEXT claim; overrun is bounded at one attempt (stated in tests).
- **D2+Δ3/F3:** `claim-next` SELECTION skips budget-exhausted/
  repeated-failure cells (rule-14 consistency — a bricked top candidate must
  not brick the pool); only direct `cells claim --id` surfaces the typed
  refusal.
- **D3+F4:** authoring advisories go to STDERR via the bee.mjs handler layer
  (pah-2 emitManifestLintWarnings precedent) — never folded into the
  machine-parseable JSON result.
- **D3+Δ5:** the cap-time duplicate scan tolerant-parses (skips unparseable
  sibling files, never throws — a guard must not be held hostage by unrelated
  corruption); comparison = sha256 of trimmed evidence, only against entries
  ≥80 chars; refusal names the colliding cell id.
- **D3+F5:** the behavior-class teeth apply to the `red_failure_evidence`
  door only; a cell riding the existing `deliberate_exceptions` door keeps
  today's contract, with a STDERR advisory noting the class rode the
  exception door.
- **D1+F1:** `trace` is already frozen wholesale for updateCell
  (UPDATE_FROZEN_HINTS top-level) — no hint-map edit; the test asserts the
  real property (a `{trace:{...}}` patch refuses).
- **D5+Δ6:** `builder_model` is orchestrator-supplied at judge-record time
  from its own pinned dispatch param; the fail-open dispatch log
  (.bee/logs/dispatch.jsonl) is corroboration only — absent log ⇒
  `model_independence: "unverified"`, never a refusal (a fail-open log never
  feeds a fail-closed guard).
- **D4+Δ6:** the judge-tier table lives in ONE place
  (routing-and-contracts.md); the seven 565e68d0-adjacent surfaces
  (bee-swarming SKILL + reference, bee-hive SKILL, routing-and-contracts,
  go-mode, AGENTS.md + AGENTS.block.md template, bee-scribing SKILL) each get
  a one-line scoping clause (goal-check judge ≠ review session; Gate 4 and
  candidates untouched) referencing it — never a duplicated table.
  AGENTS.md edits respect the 20KiB budget guard.

## Success criteria

1. Ledger test: two failed verifies append two attempts entries; entries
   survive cap; updateCell refuses to touch them.
2. Budget test: 3 claims exhaust ⇒ 4th claim typed CELL_BUDGET_EXHAUSTED;
   two same-signature fails ⇒ next claim typed REPEATED_FAILURE;
   reset-budget logs a decision and reopens the door; gate_bypass=total does
   NOT bypass either refusal (explicit test row).
3. Matrix test: behavior cell with missing/short/duplicate red evidence
   refuses cap naming the minimum; formatting/api/security classes warn at
   add/update, never refuse.
4. Verdict test: validateJudgeVerdict accepts the schema, rejects free prose
   and unknown verdicts with typed errors; model_independence derives
   correctly from pinned/unpinned dispatch shapes.
5. Existing suites green: full configured chain (33 suites), freeze-first on
   cells.mjs/claims.mjs rows (critical-patterns 20260716).
6. Doctrine: bee-swarming goal-check text carries the judge tier table;
   census/conformance green; every lib-touch cell regenerates mirror +
   rendered trees + manifest in-cell (critical-patterns 20260715, 3rd
   recurrence rule).

## Non-goals

- No new phase, no auto review sessions, Gate 4 untouched.
- No token/cost ceilings (no telemetry); attempts are the budget unit.
- No auto-derivation of change_class beyond the behavior_change mapping.
- No planning-level judge changes (spike/advisor machinery unchanged).
- Wall-clock budgets deferred until a reliable clock source is chosen.
