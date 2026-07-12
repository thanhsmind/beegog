---
date: 2026-07-12
feature: review-on-demand
categories: [process, planning, verification, architecture]
severity: mixed
tags: [review, cross-cell-contracts, census, derived-status, verify-authoring, migration]
---

# Learnings — review-on-demand (user-invoked independent review)

## What Happened

A 2-slice standard feature separated verification (mandatory, per-cell) from independent review
(user-invoked session over an immutable scope). Slice 1 shipped the runtime substrate — `.bee/reviews/`
session store with frozen scope, append-only candidates ledger, derived statuses
(unreviewed/in review/reviewed/review stale) from git + session records, `bee_status` review block.
Slice 2 re-wired every workflow prose surface (reviewing/swarming/scribing/compounding/hive/AGENTS/docs)
plus a removal census and an A1–A12 evidence map. 7/7 cells capped clean, suites 208/0 + onboard PASS,
zero reservation leaks; validation caught 4 BLOCKERs + 4 CRITICALs pre-execution, all closed
mechanically with prescribed fixes.

## Root Causes (of the near-misses)

1. **Cross-cell contract drift recurred in both slices in different shapes.** Slice 1: cell 3 read a
   ledger field (`mode`) cell 1 never wrote. Slice 2: cell 5's whole-token verify ban
   (`! grep bee-reviewing`) collided with a line the same cell's action declared protected
   (frozen-judge escalation). Plan authoring drafted each cell locally; nothing cross-checked a cell's
   reads against sibling writes, or a token ban against lines promised untouched elsewhere in the plan.
   Both were caught only by two independent validation reviewers converging.
2. **Census scoped as an abstract "sweep" instead of a grep-derived carrier list.** The exact retired
   phrase sat in `docs/04-skills-spec.md:72` outside every cell's file list; repo `AGENTS.md`'s stale
   arrow was invisible to the onboard suite (it fixtures tmp repos, never the live repo file).
3. **A recorded critical pattern (20260712 self-match negative-grep) was not consulted at authoring** —
   the checker rediscovered it. An indexed pattern is not self-enforcing.
4. **Structured trace diverged from prose narrative:** review-od-6's report documented a deviation
   (auto-fixed stray in docs/03) but `trace.deviations` stayed `[]`.

## Recommendations

- **When a multi-cell plan has any cell read a value another cell writes, or any verify carries a
  whole-token negative grep: run the cross-cell pass at PLAN-AUTHORING time** — grep the downstream
  read against the upstream write verbatim, and grep every token ban against every line the plan
  declares protected. Two validation reviewers catching it is the backstop, not the mechanism; this
  class recurred twice in one feature.
- **When a cell is a text-removal census: derive the carrier list with the actual repo-root grep at
  plan time and write file:line carriers into the cell**, never a generic "sweep" clause. And when the
  artifact under test is self-referential (the repo's own AGENTS.md, anything the test suite only
  fixtures), the verify greps the LIVE file directly — a fixture-based suite can never prove it.
- **Before locking any negative-grep/census verify, keyword-grep `critical-patterns.md`**
  ("negative-grep", "census", "self-match") and apply the matched mitigation up front.
- **When a worker's report carries a "Deviation:" line, the same cap writes it into
  `trace.deviations`** — auditors read the structured field, not prose (filed as friction).
- Reusable substrate patterns proven here (cite this feature): derived-status-never-stored over git
  facts; one-file-per-entity store + strict-read write verbs + append-only JSONL ledger; runtime-verbs
  slice before prose slice; migration rule "retire the path, not the enum value, until in-flight cases
  drain"; and "when a spec's backward-compat clause implies preserving state, verify the structured
  state actually exists before building around it — never fabricate history to satisfy wording."
