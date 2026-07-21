---
artifact_contract: bee-plan/v1
mode: standard
approved_gate2: 2026-07-21 (auto-approved, gate bypass total)
---

# plan — cli-performance

Source: `docs/history/cli-performance/CONTEXT.md` (D1-D5).

## Mode-gate record

Flags: changes behavior an existing test asserts (status internals covered by test_state/test_misc paths — refactor must keep them green), multi-domain (lib code + skill prose + ops). = 2 flags → **standard**. Not small: two lib hot paths + doctrine amendments across three prose sites + close-out ops.

## Discovery (L0 — measured in-repo, profiling digest in CONTEXT)

All anchors verified by the profiler: recovery.mjs:171-190/:352, reviews.mjs:400-423, swarming:125, executing:65, AGENTS baseline/finish sites.

## Approach

1. **cp-1 (D1):** refactor `detectCrashCandidates` to compute `activeDecisions(root)`, capture-queue, `listCells(root)` once and pass down into `lastDurableSettlement` (new signature with injected inputs; old signature kept as a thin wrapper for other callers). Fixture test: N stale sessions → the decisions store is parsed exactly once (assert via a fs-read counting probe on a temp store, or by injecting a counting reader); candidates output deep-equals the pre-change function on the same fixture.
2. **cp-2 (D2):** pass-local `Map` memo for `headCoveredBy(head, ref)` and `commitsSince(ref)` inside the candidates derivation loop; spawn-count assertion on a fixture with repeated heads (count via injected runner or PATH-shim git counting invocations); derived statuses unchanged.
3. **cp-3 (D4):** prose — bee-swarming:125 (orchestrator re-runs the CELL's targeted verify per behavior-change cell + ONE full chain at wave close, replacing per-cell full re-runs), bee-executing:65 note (cell verify = targeted suite; full chain belongs to milestones), bee-hive routing reference verify-ladder note. AGENTS baseline/finish/merge sites untouched.
4. **Close-out ops (D5, rides the close):** `cells archive` for decision-propagation + release-1-7-10-rc; `decisions archive --before 2026-07-01`; re-render index; record before/after status timing in the close report.

Mirror law applies to cp-1/cp-2 (templates ↔ .bee/bin); render+manifest after prose/lib changes.

**Risk map:** recovery refactor touches crash-detection correctness — MEDIUM → fixture equality test vs pre-change behavior; review memo staleness — LOW (pass-local only); prose change weakening proof — LOW (wave-close full chain preserves independent verification; red-first per cell untouched).

## Slices

- **Slice 1 (current): cp-1, cp-2, cp-3** — serial (cp-1/cp-2 share bee.mjs mirrors; cp-3 independent prose but same render pipeline).

## Test matrix sketch

Empty sessions dir · zero stale candidates (fast path) · many stale sessions sharing one lane · candidates with shared heads (memo hits) · unresolved ancestry (degrades to stale, unchanged) · status --json shape byte-compatible on a fixture · D3 budget: advisory wall print + structural call/spawn-count assertions.
