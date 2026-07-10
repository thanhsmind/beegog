---
date: 2026-07-11
feature: learnings-pair-relocation
categories: [process, verification, review]
severity: medium
tags: [removal-census, derived-constants, skill-reference-drift, review-wave]
---

# Learnings — learnings-pair-relocation

## What Happened

A small-lane, 2-cell prose feature removed the `learnings-researcher`/`learnings-synthesizer`
pair from bee-reviewing's wave (standard = 4 core reviewers; precedent stays owned by
planning's bootstrap and reaches reviewers inside plan.md; synthesis is now the orchestrator's
inline duty). The lean lane held — one external correctness reviewer — but that single
reviewer caught 2 P1s and 1 P3 in a "0 risk flags" feature, and the advisor consult at shape
had already returned OBJECT on the plan's census. All were fixed and grep-verified
(commits 320c7eb, 8f33577).

## Root Cause

Both P1-class misses share one root: **verification was built from the names being removed,
not from the invariants the removal must preserve.**

1. The mention census grepped only the directories the orchestrator guessed (`skills/`,
   `docs/`, `.bee/`) — README.md at repo root still advertised the pair; and it searched full
   identifiers only, missing a bare-token `synthesizer` red flag.
2. The wave cap ("cap the wave at 7") was a numeric constant *derived from the old roster
   size* (5 parallel + 2 conditionals). Deleting roster rows did not shrink capacity — the
   freed slots silently refilled with a 3rd conditional, eroding the promised −2 dispatches
   exactly on the high-risk lane. Nothing in the plan, must_haves, or verify touched a number.
3. Independent of this diff, reviewing-reference.md still said "same generation tier" while
   decision 0021 had moved SKILL.md to the review slot — a missed-propagation drift of the
   exact class this feature was fixing, preserved by the cell's own "semantically unchanged"
   must-have and surfaced only under review.
4. A plan rationale ("same model, so the subagent added a hop, not a mind") was strengthened
   during implementation into a falsifiable superlative ("strongest model in the wave").

## Recommendation

- When removing a named entity, verify the invariants, not the names: grep from **repo root**
  (excluding only declared archaeology), include **bare-token variants** of every removed
  name, and re-derive **every numeric constant computed from the removed thing's size**
  (caps, counts, "N reviewers", table totals) — put the recomputed number in the positive
  verify grep. (Promoted to critical-patterns.)
- Before editing a SKILL.md that has a `references/` companion, diff the overlapping sections
  (rosters, tiers, caps, red flags) for contradictions; "unchanged" must never mean
  "known-contradictory preserved". Fix or log any drift found.
- Copy rationale claims into skill prose verbatim from the plan's evidenced wording; never
  strengthen a claim unless the stronger version is itself provable from config.
- Accepted trade-off to remember: precedent is now searched by planned keywords (planning),
  not by diff-touched modules (the old researcher) — precedent for unanticipated modules is
  mildly weaker; the synthesizing orchestrator, which reads critical-patterns every session,
  is the backstop.
