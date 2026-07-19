---
date: 2026-07-20
feature: self-correcting-loop
categories: [loop-safety, judge-design, validation-process]
severity: high
tags: [budgets, revision-ledger, failure-signature, semantic-judge, model-independence, adversarial-validation]
---

# Learnings — self-correcting-loop (scl-1..scl-5)

## What Happened

The four Builder–Judge–Manager gaps closed as one feature: every work item now
carries an append-only attempt ledger with normalized failure signatures
(scl-1); cell-lifetime budgets enforce at the claim door inside the O_EXCL
critical section — typed CELL_BUDGET_EXHAUSTED / REPEATED_FAILURE, structurally
immune to gate_bypass, audited reset as the only reopening door, claim-next
skips exhausted items (scl-2); a judge-standard matrix warns at authoring and
bites at cap for the behavior class (scl-3); one validated judge-verdict schema
with honest builder/judge model-independence stamping (scl-4); and the
goal-check gained a risk-scaled semantic judge, single-homed table, seven
doctrine surfaces scoped so it never collides with user-invoked review
(scl-5). The full 33-suite chain stayed green throughout, and the new loop was
exercised live before close: an opus checklist judge reviewed the sonnet-built
scl-2 diff and its PASS verdict (8 anchored checks) is recorded in
`trace.semantic_judge` with `model_independence: "confirmed"` — the first
real judge-record in the store, run on the feature that shipped it.

## Root Cause / What Made It Work

- **The adversarial pass earns its seat.** The original claim-counting rule
  (session transitions) passed CONTEXT lock AND a structural plan-check, yet
  missed the feature's PRIMARY named threat — a solo session re-claiming the
  same cell never transitions. Only the fresh-context advisor running the
  exact abuse scenario caught it (Δ1 → distinct (claim_session, claimed_at)
  pairs). Structural review checks shape; abuse review checks purpose.
- **Two validators disagreed once (budget check placement) and the
  resolution was recorded, not silent:** CONTEXT names both alternatives, why
  the advisor's inside-critical-section won (TOCTOU), and the accepted
  bounded overrun. That record is what makes the choice auditable later.
- **A fail-open log must never feed a fail-closed guard** (Δ6): judge
  independence is stamped from caller-supplied pinned dispatch params; the
  fail-open dispatch log is corroboration only — absent ⇒ `unverified`,
  never a false `confirmed`, never a refusal.
- **Honest coverage caveat (from compounding's own analyst):** under
  gate_bypass=total, authoring advisories are read by no one — real teeth
  exist only for the behavior class today. The feature closes gap #3
  narrower than the headline; widening is a data-driven follow-up, not an
  oversight.

## Recommendation

1. **When validating a counting/budget/limit rule whose purpose is stopping a
   named abuse, the validating pass must run the exact abuse scenario against
   the rule** — a structural/schema review never satisfies that obligation,
   whoever performs it.
2. **When two validators propose different fixes for the same critical path,
   CONTEXT records both alternatives and why one lost — every time.** The
   Δ2-vs-plan-check record is the template.
3. **When a doctrine ships, exercise it once for real before the feature
   closes** (proof-of-life): the first judge-record existing because
   compounding's failure analyst demanded it is the pattern — a shipped verb
   with zero production calls is a gap wearing green tests.
4. **Treat an all-clean friction record across a high-risk lane as a
   spot-check prompt, not a green flag** — the trace must distinguish "asked
   and found nothing" from "never asked".
5. Loop-safety stops (budgets, repeated-failure) belong structurally outside
   the bypass config's reach — the check never reads it, so no future bypass
   level can silently widen over them.

## Deferred / Open

- Advisory-only classes (formatting/bugfix/api/security/migration) gain teeth
  only when field data justifies (D3 promote-sparingly).
- Wall-clock budgets await a reliable clock/telemetry source (D6 non-goal).
- The goal-check judge fires by doctrine (orchestrator-run), not by hook —
  mechanizing the dispatch is a candidate once a few features exercise it.
