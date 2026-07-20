---
date: 2026-07-20
feature: gh-issue-fixes-172
categories: [process, concurrency, correctness, installer]
severity: medium
tags: [external-review-intake, heartbeat, immutable-identity, store-lock, audit-ordering, enum-citation, sparse-checkout, render-regen-recurrence]
---

# gh-issue-fixes-172 — GH #23/#26/#27 fixes

## What Happened

An external reviewer's audit of v1.7.2 (GH #27) made five correctness claims about the
self-correcting loop; a gather worker verified every claim against the code with file:line
anchors before any planning — all five held (one partially). Together with two concrete bug
reports (#23 group `--help` error, #26 Windows installer `blocked_no_source`), the slice shipped
six cells: group-scoped help, complete Windows source staging, heartbeat-invariant claim
counting, per-cell locked ledger writes, budget hard clamps + guarded audit-first reset, and a
judge NEEDS_REVISION cap-guard. All six capped green with red-first evidence, judged PASS
(confirmed model independence), full 33-suite verify green.

## Root Cause (of the bugs fixed)

- **Heartbeat double-count:** Δ1 keyed claim counting on `(claim_session, claimed_at)` while a
  different subsystem (heartbeat renewal) mutated `claimed_at` — a cross-feature invariant
  nobody owned. One real claim + N heartbeats counted as N+1 claims.
- **Lost ledger entries:** cells.mjs was the one store whose mutators never adopted
  `withStoreLock` while its siblings (state/reservations/claims) all had; atomic-write ≠
  atomic read-modify-write.
- **Unguarded reset / log-only judge:** guards were shipped as data (audit trail, verdict
  records) without teeth (refusals) — the record existed but nothing consumed it.
- **#26:** install.ps1's Windows sparse-checkout pattern list predates `.codex-plugin`'s
  addition to the release tuple; the bash installer (full clone) never had the gap, so no test
  caught the divergence.

## Recommendation

1. **When a field is both an identity and a clock, split it.** Any counting/pairing key must be
   an immutable field stamped once at creation (`acquired_at` pattern); a field any other
   subsystem refreshes (TTL clocks, heartbeats) is never a pairing key. When adding a mutator to
   a timestamped record, grep for consumers that key on the mutated field first.
2. **A store with read-modify-write mutators takes the per-entity lock from day one**
   (`withStoreLock(root, '<store>:<id>')`); readers stay lock-free. If sibling stores are
   locked and yours is not, that is the bug, not the convention.
3. **Audit-before-write, inside the lock:** when an operation both logs a decision and rewrites
   a record, the decision lands first so a crash cannot leave an unaudited mutation (proved by
   a chmod-555 write-failure test).
4. **A guard that pattern-matches another subsystem's enum cites the enum's definition site in
   the cell action.** The planned `'FAIL'` key would have shipped a guard that never fires —
   the enum is `NEEDS_REVISION` (judge.mjs:16). Plan-check's feasibility rows caught it; keep
   funding them.
5. **When cross-platform installers stage differently (sparse vs full clone), every file the
   downstream validation requires must appear in the sparse pattern list** — and any future
   addition to the release tuple must update install.ps1's sparse list in the same change.
6. **Render-regen recurrence (4th documented instance):** template-touching cells again omitted
   `render_plugin_skill_trees.mjs` + `release_manifest.mjs --write` from cell verify; the chore
   commit 4d9be71 patched it post-hoc. Prose in critical-patterns is demonstrably not holding —
   the open P2 backlog mechanization (derive required verify fragments from the files list)
   should be promoted to the next slice rather than re-documented.
7. **External reviews are a gather-then-verify intake, not a to-do list:** each claim was
   confirmed against code with anchors before planning; the one over-claim ("workers can raise
   their own budgets") was correctly narrowed to an authoring-time gap. Verify before you fix,
   and fix what is actually true.
8. **`dispatch prepare --kind cell` currently emits a read-only agent type** — until the P2
   friction lands, execution dispatches are hand-rolled with the model param as tier transport;
   check the emitted agent type before trusting the payload.
