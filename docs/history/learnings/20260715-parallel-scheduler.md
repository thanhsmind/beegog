---
date: 2026-07-15
feature: parallel-scheduler
categories: [pattern, process, failure]
severity: mixed
tags: [scheduling, graph, import-cycles, shared-semantics, verify-authoring, release-manifest, review-infra]
---

# Learnings — parallel-scheduler

## What Happened

User report: swarm cells "politely wait on each other" — planning partitions work
by declared files but nothing computes the consequences, so mis-partitioned plans
serialize at execution via write-guard denies. Shipped in one slice (4 cells): pure
`schedule.mjs` (Kahn layering + `pathsOverlap` packing into waves, cycle/unsatisfiable
diagnostics), cycle refusal at every dep-mutating write, `bee cells schedule` verb,
and swarming/validating/planning prose now consuming the computed schedule. The
feature dogfooded itself: the live verb predicted its own slice's waves
(`[ps-1] → [ps-2 ∥ ps-3] → [ps-4]`) and wave 2 genuinely ran two workers in parallel.

## Root Cause (of the original friction)

Overlap between cells was discoverable only at write time (hard deny, no queue),
wave grouping was manual judgment, and no plan-time pass looked at the dep graph —
the declared data (`files`, `deps`) always sufficed to compute the schedule, nobody
computed it.

## Recommendations

1. **When prediction and enforcement need the same predicate, share one
   implementation.** `schedule.mjs` imports `pathsOverlap` from `reservations.mjs`
   verbatim (D3); any richer overlap semantics must land in `reservations.mjs`
   first, never in the scheduler alone — two definitions recreate the
   plan-says-safe/guard-says-deny bug class this feature killed.
2. **When a shared module needs data a higher module owns, take the data as plain
   arguments.** `schedule.mjs` takes cell objects and never imports `cells.mjs`,
   so `cells.mjs → schedule.mjs` stays one-directional. Reuse for any
   graph/algorithm module.
3. **When a plan computes over a field with a closed status enum, enumerate every
   state's handling in the plan text before validation.** The open/claimed vs
   capped vs blocked/dropped/unknown node-set contract was invisible to planning
   and cold-read review; only the adversarial plan-checker caught it (BLOCKER).
   Adversarial checking stays standard for graph-shaped features.
4. **When a write-time guard protects a field invariant, grep every writer of that
   field before calling the guard done.** Cycle refusal originally covered `add`
   only; `updateCell` could reintroduce a cycle (fresh-eyes catch, D2 clarified).
5. **When a cell's action dictates literal text, derive the verify grep from that
   text — never author it as a separate guess.** ps-4's verify could not match its
   own dictated prose (`bee cells schedule` vs `bee.mjs cells schedule`); caught as
   a cold-pickup CRITICAL, fixed pre-dispatch.
6. **When a slice adds or renames any `templates/lib`/`.bee/bin/lib` file, the
   release manifest regen (`release_manifest.mjs --write`) belongs to the feature
   — assign it to the last cell or the close step.** No cell owned it here; the
   full verify chain went red at close and the fix landed out-of-band (friction
   filed to mechanize).
7. **When a review-slot model dies mid-pass (provider/session limit), log the
   partial result + failure as friction before falling back.** Opus died mid
   plan-check; the sonnet fallback re-ran the full pass — worked, but the incident
   is telemetry worth tracking (friction filed).
8. **When patching a proof gap, wire the cell to an existing standing test rather
   than adding an ad-hoc clause.** `test_lib.mjs` already sweeps vendored-source
   byte-parity including `bee.mjs`; the plan-checker's `diff -q` clause was a
   third, duplicative parity mechanism (grooming candidate filed).
