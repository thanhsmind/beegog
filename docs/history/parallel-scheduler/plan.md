---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: standard
---

# parallel-scheduler — Plan

**Feature:** parallel-scheduler · **Date:** 2026-07-15 · **CONTEXT:** ./CONTEXT.md (D1–D4)

## Mode Gate

Risk flags counted mechanically: **public contracts** (new verb on the `bee.mjs` CLI
registry — manifest- and example-tested surface) + **existing covered behavior**
(`cells add`/`update` write path gains a refusal; covered today by `test_lib.mjs` /
`test_bee_cli.mjs`). No auth, no data loss, no external systems, no cross-platform
delta beyond existing path normalization. **2 flags → standard.** Smaller modes are
insufficient: 4 code/prose surfaces across lib + CLI + two skills, story-sized
behavior ("bee computes the schedule"), and a shared-module addition with mirror
discipline — beyond small's ≤3-file honesty.

## Discovery (L1 — in-repo verification only)

No external candidates: the algorithm is Kahn topological layering + greedy
overlap-packing, first-principles; every integration fact was verified in-repo
(scout digest 2026-07-15):

- `pathsOverlap` exported at `reservations.mjs:53`, trailing-`*` semantics only — the D3 primitive.
- `addCells` validate-all-first / write-after at `cells.mjs:157-170` — the D2 hook point; `updateCell` at `cells.mjs:172+` is the second dep-mutating write.
- `validateNewCell` never checks dep ids exist; `depsAllCapped` silently treats unknown deps as "not capped" (`cells.mjs:292-299`) — diagnostics must surface `unknown_deps`.
- CLI pattern: `COMMAND_REGISTRY` entry (`command-registry.mjs:53-270`) + `HANDLERS` map (`bee.mjs:1695-1754`) + hand-maintained `cellsUsageFallback` verb list (`bee.mjs:1669-1672`). `test_bee_cli.mjs` auto-executes every registry example in a temp repo.
- Mirror law: `templates/lib/` ↔ `.bee/bin/lib/` byte-identical (`scripts/test_lib_mirror.mjs`); a new `schedule.mjs` ships to both.
- Import-cycle constraint: `cells.mjs` already imports `reservations.mjs`; a new `schedule.mjs` must import only `reservations.mjs`/builtins and take cells **as data**, so `cells.mjs → schedule.mjs` stays one-directional.
- Data reality: 206 cells — 0 missing `files`, 5 empty (overlaps-nothing per D3, resolved in CONTEXT), 2 mid-path-glob entries (literal under D3 semantics).

## Approach

**Chosen path.** A pure shared module `templates/lib/schedule.mjs` exporting
`computeSchedule(cells)` and `detectCycles(cells)`: cells in as plain objects, no
disk I/O, `pathsOverlap` from `reservations.mjs` as the only lib import. **Node-set contract
(plan-checker blocker resolution):** waves contain only `open`/`claimed` cells (the
schedulable work). A dep on a `capped` cell is satisfied. A dep on an unknown id or
on a `blocked`/`dropped` cell makes the dependent cell **unschedulable**: it appears
in no wave and is reported in `diagnostics.unsatisfiable_deps` as
`{cell, dep, reason: 'missing'|'blocked'|'dropped'}` (this replaces the earlier
`unknown_deps` name). `detectCycles` runs over ALL cells regardless of status — a
cycle is structural. Waves are built by Kahn layering over the schedulable node-set,
then greedy packing: within a ready layer, a cell whose `files` overlap any cell
already placed in the current wave defers to the next wave (D2 auto-serialize,
deterministic id order). Diagnostics: `cycles` (each cycle's id list),
`unsatisfiable_deps`, `empty_files`. Consumers:

1. `cells.mjs` — `addCell`/`addCells`/`updateCell` build the union (on-disk cells + incoming batch/patch) and refuse when `detectCycles` is non-empty, with a typed error naming the cycle (D2).
2. New CLI verb **`bee cells schedule`** (`--feature`, `--json`) printing waves + diagnostics (D1) — registry entry, handler, usage-fallback list, examples.
3. Prose: `bee-swarming` SKILL.md wave-analysis step becomes "run `bee cells schedule`, dispatch wave 1, override only with a stated reason"; `bee-validating` feasibility matrix gains a schedule row (cycles/diagnostics clean); `planning-reference.md` files-authoring note (overlap is legal, costs a wave; prefer explicit paths or trailing-`*`).

**Rejected alternatives.** (a) Extending `cells.mjs` in place with the graph code —
rejected: keeps the file growing past 850 lines and loses the pure-function test
surface; (b) a full glob engine for overlap — rejected: violates D3 (one semantics
with the runtime guard); (c) scheduling inside `claimNextCell` — deferred to
planning question, current hold-skip logic already covers cross-session safety.

**Risk map.**

| Component | Risk | Proof needed |
|---|---|---|
| schedule.mjs algorithm (pure) | LOW | RED-first unit rows: chain, diamond, overlap-serialize, cycle, unknown dep, empty files, trailing-* overlap |
| cells.mjs refusal wiring | MEDIUM | existing 206-cell store must still pass `cells add` for acyclic batches; regression rows for add/update refusal + legacy-store schedule report |
| CLI verb registration | LOW | registry example auto-run by `test_bee_cli.mjs`; usage-fallback string updated |
| mirror + verify chain | LOW | `test_lib_mirror.mjs` red until both copies land |
| skill prose drift | LOW | grep-anchored verify; scribing syncs `docs/specs/workflow-state.md` at close |

**Open question for validating.** None blocking; the deferred `claim-next`
integration stays out of slice 1 (noted for a future row if stalls persist).

## Test Matrix (edge dimensions, standard depth)

- **Empty/zero:** empty batch, cell with `deps: []`, empty `files` (overlaps-nothing), feature with one cell → one wave.
- **Duplicates/collision:** two cells same file → separate waves; self-dep `a→a` → cycle refusal.
- **Ordering:** wave output deterministic (id sort) across runs.
- **Boundary:** cycle spanning on-disk + in-batch cells; dep on a capped cell (satisfied, not an edge); dep on unknown/blocked/dropped → `unsatisfiable_deps` diagnostic + cell excluded from waves, never a crash.
- **Format:** trailing-`*` overlap (`src/api/*` vs `src/api/x.mjs`) serializes; mid-path glob treated literal.
- **Compat:** full existing store (206+ cells) schedules without refusal — owned by ps-3: run `bee cells schedule --json` against this repo's real store and attach the output as cap evidence; `bee cells schedule` on a feature with zero cells.

## Slice 1 (current — the whole feature)

| Cell | What | Deps |
|---|---|---|
| parallel-scheduler-1 | `schedule.mjs` pure module + unit rows (both mirror copies) | — |
| parallel-scheduler-2 | cycle refusal in `addCell`/`addCells`/`updateCell` (D2) | ps-1 |
| parallel-scheduler-3 | `bee cells schedule` CLI verb + registry/examples | ps-1 |
| parallel-scheduler-4 | skill prose wiring (swarming, validating, planning-reference) | ps-3 |

Computed waves for this very slice: `[ps-1] → [ps-2 ∥ ps-3] → [ps-4]` — ps-2 and
ps-3 share no files and run in parallel; the feature dogfoods its own scheduler.

No future-slice cells. Deferred (backlog): P40 worktree isolation, P41 wait/queue.

### File bounds and verification (implementation-ready)

- **ps-1:** `skills/bee-hive/templates/lib/schedule.mjs`, `.bee/bin/lib/schedule.mjs`, `skills/bee-hive/templates/tests/test_lib.mjs` — verify: `node skills/bee-hive/templates/tests/test_lib.mjs && node scripts/test_lib_mirror.mjs`
- **ps-2:** `skills/bee-hive/templates/lib/cells.mjs`, `.bee/bin/lib/cells.mjs`, `skills/bee-hive/templates/tests/test_lib.mjs` — verify: same as ps-1
- **ps-3:** `skills/bee-hive/templates/lib/command-registry.mjs`, `.bee/bin/lib/command-registry.mjs`, `skills/bee-hive/templates/bee.mjs`, `.bee/bin/bee.mjs`, `skills/bee-hive/templates/tests/test_bee_cli.mjs` — verify: `node skills/bee-hive/templates/tests/test_bee_cli.mjs && node scripts/test_lib_mirror.mjs`
- **ps-4:** `skills/bee-swarming/SKILL.md`, `skills/bee-validating/SKILL.md`, `skills/bee-planning/references/planning-reference.md` — verify: `rg -q "bee cells schedule" skills/bee-swarming/SKILL.md skills/bee-validating/SKILL.md skills/bee-planning/references/planning-reference.md && node skills/bee-hive/templates/tests/test_bee_cli.mjs`
- **Feature close:** full recorded verify chain green (baseline already green this session).
