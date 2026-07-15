# Parallel Scheduler — Context

**Feature slug:** parallel-scheduler
**Date:** 2026-07-15
**Exploring session:** complete (gate_bypass=total — recommended options locked, audit-logged)
**Scope:** Standard
**Domain types:** CALL | RUN | ORGANIZE

## Feature Boundary

Bee computes a swarm schedule mechanically — an overlap matrix + dependency graph over
a feature's declared cells produces numbered waves, cycles are refused at `cells add`
time, and validating/swarming consume the computed schedule — replacing the manual
per-wave judgment walk that today serializes mis-partitioned plans at execution time.
It ends before any change to git plumbing (worktrees) or hook conflict semantics
(deny stays deny).

## Origin

User report (2026-07-15, via owner): swarm cells "politely wait on each other" more
than they work — suspected design limit, confirmed by code walk (see Existing Code
Context). Backlog row P39; friction entry in `.bee/backlog.jsonl` same day (P2,
layer swarming). Comparison points from the report: a task-intake harness whose store
refuses cyclic/invalid writes immediately ("plan knows right away, workers run
light"), and bead_rust_viewer's plan-splitting algorithm.

## Locked Decisions

These are fixed. Planning must implement them exactly — cited, never reinterpreted.

| ID | Decision | Rationale (only if it changes implementation) |
|----|----------|-----------------------------------------------|
| D1 | Bee computes the schedule: overlap matrix (cell.files × cell.files) + dep graph over a feature's declared cells → numbered waves. Swarming consumes the computed waves as its **default** dispatch order (orchestrator may override with a stated reason); validating runs the same computation as a feasibility check. | The data (`files`, `deps`) already exists on every cell; today overlap is discovered at write-time deny instead of plan-time. Decision a648ea2a. |
| D2 | Overlap between two ready cells is **legal and auto-serializes** (later wave) — never a refusal, never "spawn both". Dependency **cycles are illegal and refused fail-fast at every dep-mutating write** — `cells add` AND `cells update` when it changes `deps` (and reported by the schedule computation for pre-existing stores). The runtime write-guard deny stays unchanged as the safety net. | Mirrors the intake-harness insight (refuse invalid structure at write time) without weakening bee's deny-first runtime guarantee. `update` included per fresh-eyes finding 2 — a cycle reintroduced post-add would otherwise bypass the refusal. Decision b4740f68, clarified 2026-07-15. |
| D3 | One overlap semantics: the plan-time matrix reuses the exact `pathsOverlap` logic the reservation/hold runtime uses (`lib/reservations.mjs`). | Two definitions would recreate the bug class this feature kills: a plan that says parallel-safe while the hook says deny. Decision ecc8862d. |
| D4 | Scope boundary: plan-time computation only — schedule CLI verb + cycle refusal in `cells add` + wiring into bee-validating (check) and bee-swarming (default wave order). Per-worker git worktree isolation and a wait/queue primitive are OUT (deferred, own backlog rows). | Worktree isolation touches git plumbing + the executing contract (high-risk surface); queue-instead-of-deny changes hook semantics. Both independent of the scheduler. Decision eec223d9. |

### Agent's Discretion

CLI verb name and output shape (`cells waves` / `cells schedule`, JSON structure),
graph algorithm choice, where the shared module lives in `templates/lib/` (+ mirror
rules), how swarming's SKILL.md prose changes to point at the computed schedule, and
what a "stated reason" override looks like in the swarm report. Constraint: no new
top-level command group — this belongs under `cells`.

## Terms

| Term | Meaning in this feature |
|------|-------------------------|
| wave | A numbered set of cells safe to dispatch concurrently: every dep capped or in an earlier wave, and no two cells in the wave have overlapping `files` (per D3 semantics). |
| overlap | `pathsOverlap` from `lib/reservations.mjs` returns true for any pair drawn from the two cells' `files` lists — same semantics the write guard enforces at runtime. |
| auto-serialize | Placing a file-overlapping ready cell into a later wave instead of refusing it or dispatching it concurrently. |
| computed schedule | The full output: waves in order, plus diagnostics (cycles, unknown dep ids, cells with empty `files`). Advisory-but-default for swarming; a check for validating. |

## Specific Ideas And References

- Van's task-intake harness (user chat, 2026-07-15): store guarantees an acyclic work
  graph by refusing bad writes immediately — bee adopts the *refusal at write time*
  idea for cycles (D2) while keeping file overlap legal-but-serialized.
- bead_rust_viewer: has a plan-splitting algorithm — spiritual ancestor of computed
  waves; no code is imported, the idea is "the plan is derivable from the declared
  structure".

## Existing Code Context

From the scout digest (Explore worker, 2026-07-15). Downstream agents read these before planning.

### Reusable Assets

- `skills/bee-hive/templates/lib/reservations.mjs:53-69` — `pathsOverlap` + `findConflicts`: the overlap semantics D3 mandates reusing.
- `skills/bee-hive/templates/lib/cells.mjs:157-170` — `addCells` (validate-all-first, write-after at :169): the graph-aware cycle refusal (D2) hooks in here (and in `addCell`/`updateCell`) — `validateNewCell` is per-cell and cannot see the dep graph.
- `skills/bee-hive/templates/lib/cells.mjs:292-305` — `depsAllCapped`/`readyCells`: existing readiness primitive the wave computation builds on.
- `skills/bee-hive/templates/lib/cells.mjs:751-831` — `claimNextCell`: existing cross-session skip logic (holds, deps) the schedule must stay consistent with.

### Established Patterns

- Shared logic lives in `skills/bee-hive/templates/lib/*.mjs` with a mirror test (`scripts/test_lib_mirror.mjs`) — any new module follows the template+mirror discipline.
- CLI verbs are registered in `bee.mjs` groups with JSON schemas; the write-guard hook validates call shape against the manifest (`scripts/test_verify_manifest.mjs` covers registry drift).
- RED-first tests per behavior change (`templates/tests/test_bee_cli.mjs`, `test_lib.mjs`).

### Integration Points

- `skills/bee-swarming/SKILL.md:32` — the manual wave-analysis walk this feature replaces with "run the schedule verb, dispatch wave 1".
- `skills/bee-validating/SKILL.md` — gains the schedule check (cycles/overlap diagnostics) as part of feasibility evidence.
- `skills/bee-planning/references/planning-reference.md:106` — `files` authoring guidance; may gain one line: "overlapping files across cells is legal; it costs a wave".
- `docs/specs/workflow-state.md` — spec sync target for the new scheduling behavior (scribing, post-execution).

## Canonical References

- `docs/backlog.md` P39 — product intent (in-flight, this feature).
- `.bee/backlog.jsonl` 2026-07-15 friction entry "Parallelism ceiling by design…" — root-cause inventory with file anchors.
- `docs/02-architecture.md:127-156` — canonical cell schema (`files`, `deps`).

## Outstanding Questions

### Resolve Before Planning

- (none — all gray areas locked D1–D4 under gate_bypass=total)

### Deferred To Planning

- [ ] Whether `claim-next` (cross-session) should also consult the computed schedule or keep its current hold-skip logic only.

### Resolved During Exploring (fresh-eyes review, 2026-07-15)

- **Empty `files` ⇒ overlaps-nothing.** Forced by D3, not a choice: `pathsOverlap` yields no pairs for an empty list, and `claimNextCell` already treats `files.length === 0` as never-conflicting (`cells.mjs:774-776`). Choosing "overlaps-everything" would make the plan say serialize where the hook says parallel-safe — the exact divergence D3 kills. Data: 5 of 206 cells in this repo have empty `files`.
- **Glob semantics are in-hand, not an investigation.** `pathsOverlap` handles only a trailing-`*` suffix (plus bare `*` = everything); mid-path globs are treated as literals (`reservations.mjs:53-69`). Two historical entries use mid-path globs (`shim-retire-5.json`) — under D3 the schedule treats them exactly as the write guard does (literal), and planning adds an authoring note: prefer explicit paths or trailing-`*` in `files`.

## Deferred Ideas

Out-of-scope ideas captured during exploring. Not lost, not planned.

- Per-worker git worktree isolation (kills index.lock contention between concurrent workers) — deferred per D4; backlog row to add as proposed.
- Wait/queue primitive replacing pure write-time deny — deferred per D4; only worth revisiting if computed waves still leave real stalls; backlog row to add as proposed.

## Handoff Note

CONTEXT.md is the source of truth. Decision IDs are stable. Planning reads locked
decisions, code context, canonical references, and deferred-to-planning questions.
Validating and reviewing use locked decisions for coverage and UAT.
