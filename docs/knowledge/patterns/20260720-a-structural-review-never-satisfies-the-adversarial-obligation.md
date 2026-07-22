---
type: bee.pattern
title: A structural review never satisfies the adversarial obligation for an abuse-stopping rule
description: A structural review never satisfies the adversarial obligation for an abuse-stopping rule
tags: [process, validation, counting-rules, adversarial-review, budgets]
timestamp: 2026-07-20
bee:
  id: pattern-20260720-a-structural-review-never-satisfies-the-adversarial-obligation
  lifecycle: active
  sources: ["docs/history/learnings/critical-patterns.md#PAT40", "original feature: self-correcting-loop"]
  polarity: pitfall
  critical: true
---

# A structural review never satisfies the adversarial obligation for an abuse-stopping rule

A claim-counting rule whose entire purpose was stopping a named abuse (a solo session
re-claiming the same cell in a loop) passed CONTEXT lock AND a thorough structural plan-check —
and still missed that exact abuse: counting "session transitions" can never see a
same-session re-claim. It was caught pre-code only by a fresh-context adversarial pass that ran
the abuse scenario against the rule (fix: distinct (claim_session, claimed_at) pairs).
**Rule:** when validating any counting/budget/limit invariant that exists to stop a named
pattern, the validating pass must include "run the exact abuse scenario against the rule as
written" as its own step — schema/consistency/freeze review does not substitute, regardless of
reviewer strength. Corollary: when two validators propose different fixes for one critical
path, CONTEXT records both and why one lost (the Δ2 inside-critical-section-vs-pre-acquire
record is the template) — an unrecorded resolution is a future re-litigation.
