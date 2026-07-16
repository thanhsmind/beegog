# Review Walkthrough — parallel-scheduler

**Date:** 2026-07-16
**Review session:** `unreviewed-batch-20260716`
**Scope range:** `0847310..beb75c9`

## What shipped

Computed-wave parallel scheduling for bee cells: cycle refusal on write
(locked decision D2), Tarjan cycle detection, the new `bee cells schedule`
verb, and skill prose wired to the computed schedule.

## Review findings for this feature

**P1 — FIXED.** Store-global cycle refusal contradicted locked decision D2
(api-contract + architecture, corroborated — architecture reproduced it
empirically). `lib/cells.mjs` `assertNoCycle` unioned the *entire* on-disk
store, so one legacy cycle in feature A froze `cells add`/`update --deps`
for every unrelated feature.
**Fix cell `parallel-scheduler-5`:** refusal now scoped to cycles the write
introduces or participates in; pre-existing cycles stay `cells schedule`
diagnostics only. New regression test added (legacy on-disk cycle: unrelated
add + unrelated deps patch succeed; a patch keeping a cycle member inside the
cycle is refused; a cycle-breaking patch is allowed). `test_lib` 334/0;
mirrors byte-identical.

**P2 — open, backlog.** Cycle-refusal guard has a cross-session TOCTOU:
`assertNoCycle` is read-check-write without a lock, so two concurrent
sessions can each pass the check and co-commit a cycle (reliability).
Backstop: `cells schedule` diagnostics report it after the fact; writes stay
atomic. Autofix class: advisory.

**P3 — open, backlog (3 items):**
- `cells.schedule` was added to the manifest without a `SCHEMA_VERSION`
  bump — additive and defensible, but noted (api-contract).
- `addCells`'s "all-or-nothing" comment overpromises the write phase
  (reliability).
- `cells schedule --feature X` mislabels cross-feature dependencies as
  unsatisfiable (code-quality).

## What was verified safe

Delta re-review confirms the P1 fix is proven complete: every
write-introduced cycle intersects the incoming ids; the regression test
fails against the old code; mirrors are byte-identical; `test_lib` 334/0.
Class-1 defect sweep (overly-global write guards) came back clean elsewhere
in the range.

## Fix cells

- `parallel-scheduler-5` — cycle-refusal scoping fix (P1, closed).

## Full report

- `docs/history/codex-harness-hardening/reports/review-unreviewed-batch-20260716.md`
- Session record: `.bee/reviews/unreviewed-batch-20260716.json` (id
  `unreviewed-batch-20260716`)
