# Validation Report — parallel-scheduler, slice 1

**Date:** 2026-07-15 · **Mode:** standard · **Cells:** parallel-scheduler-1..4
**Verdict:** READY

## Reality Gate

| Check | Result | Evidence |
|---|---|---|
| MODE FIT | PASS | 2 flags (public contracts: CLI registry verb; existing covered behavior: cells add/update write path) → standard; 4 surfaces, story-sized. |
| REPO FIT | PASS | `pathsOverlap` exported (`reservations.mjs:53`); `addCells` validate-all-first/write-after (`cells.mjs:157-170`); `updateCell` patch signature compatible (`cells.mjs:244-289`); CLI pattern = registry entry + HANDLERS + `cellsUsageFallback` (checker-confirmed no other touchpoints — `validate-args`, write-guard, verify-manifest all derive from the registry generically). |
| ASSUMPTIONS | PASS | Runtime probe (this session): `pathsOverlap('src/api/*','src/api/x.mjs')=true`, mid-path glob literal `=false`, empty `=false`, same-file `=true`. No other dep-mutating path exists (`claimCell`/`capCell`/`blockCell`/`dropCell`/`setTier` never touch `.deps` — checker grep). `test_lib_mirror.mjs` auto-discovers new lib files (readdir-based). |
| SMALLER PATH | PASS | Small is dishonest: 10 declared files across lib+CLI+3 skills, plus mirror discipline. Graph code inside cells.mjs rejected in plan (Approach, rejected alternatives). |
| PROOF SURFACE | PASS | Baseline verify chain green this session (all 14 suites, exit 0). Each cell has a runnable verify; ps-3 verify additionally proves dispatcher parity (`diff -q`). |

## Feasibility Matrix

| Assumption | Risk | Proof required | Evidence | Result |
|---|---|---|---|---|
| Overlap semantics identical to runtime guard | LOW | runtime probe | node -e import probe, 4 cases (above) | PROVEN |
| Cycle-refusal hook point exists pre-write | LOW | code inspection | `cells.mjs:157-170` validate-all-first, write at :169 | PROVEN |
| `updateCell` can host the deps-change check | LOW | code inspection | `cells.mjs:244-289`, `deps` mergeable field | PROVEN |
| No hidden verb-registration touchpoints | MED | adversarial sweep | checker extraction worker: registry-generic everywhere except `cellsUsageFallback` (declared in ps-3) | PROVEN |
| Real store schedules clean (no legacy refusal) | MED | live query | checker live query: 0 cycles in 206-cell store; compat proof owned by ps-3 cap evidence | PROVEN (recheck at cap) |
| schedule.mjs import direction acyclic | LOW | import graph | `cells.mjs → schedule.mjs → reservations.mjs` one-directional | PROVEN |

No spikes needed — no assumption survived as unproven.

## Plan-checker (adversarial, review slot)

Run 1 (opus) died mid-pass on session limit (partial: store clean, 0 cycles). Run 2
(sonnet fallback, full pass): **1 BLOCKER + 6 WARNINGS**, all repaired same turn
(iteration 2, textual fixes mirroring the checker's own one-line fixes):

1. **BLOCKER — node-set ambiguity (plan vs ps-1; blocked/dropped deps undefined).** Fixed: node-set contract written into plan.md Approach and both ps-1/ps-2 actions — waves = open/claimed only; capped dep satisfied; unknown/blocked/dropped dep ⇒ cell unschedulable + `diagnostics.unsatisfiable_deps {cell, dep, reason}`; `detectCycles` structural over all statuses.
2. W — compat row unowned → owned by ps-3 (real-store run as cap evidence).
3. W — ps-3 pattern-vs-fallback contradiction → cells.ready resolution exactly, no state fallback (prohibition added).
4. W — ps-3 read_first missing schedule.mjs → added.
5. W — ps-4 read_first covered 1/3 files → all three added.
6. W — mid-path-glob-literal edge untested → explicit ps-1 test row.
7. W — dispatcher parity unproven → `diff -q templates/bee.mjs .bee/bin/bee.mjs` added to ps-3 verify.

## Cell review (cold pickup, review slot — opus)

ps-1 CLEAN (1 minor note: RED-first enforced by cap-evidence requirement, not the
verify command — acceptable, noted). ps-2 CLEAN. ps-3 CLEAN. ps-4 **CRITICAL**:
verify grep string could not match the prose the action dictated — fixed same turn
(`rg -q "cells schedule"`, matches both command forms). All anchors/paths/tools
independently confirmed present; baseline green (test_lib 302/0, test_bee_cli 130/0,
mirror 16 files identical).

## Approval block

- Verdict: **READY**
- Gate 3: auto-approved under `gate_bypass: total` (standard lane, no hard-gate
  flags: no auth/data-loss/security/external-provider/validation-removal surface).
  Audit decision logged.
- Approval covers slice 1 (parallel-scheduler-1..4) only.
- Computed dispatch order: `[ps-1] → [ps-2 ∥ ps-3] → [ps-4]` (ps-2/ps-3 share no files).
