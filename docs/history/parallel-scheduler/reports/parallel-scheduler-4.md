# parallel-scheduler-4

**Status:** [DONE]

**Outcome:** Wired skill prose to the computed schedule (D1/D2/D3). `bee-swarming`'s
Wave analysis step (§Operating Contract, item 1) now names `bee cells schedule --json`
as the default dispatch order, states the override-with-a-reason rule, and refuses
to dispatch on reported cycles, while keeping the existing doctrine sentence that two
file-overlapping cells are never spawned together (now noting the schedule
auto-serializes that overlap into a later wave). `bee-validating`'s feasibility
matrix bullet gains a required schedule row for multi-cell slices (`bee cells
schedule` reports zero cycles and the expected wave shape). `bee-planning`'s
`planning-reference.md` "Bounded files" cell-quality rule gains a sentence: file
overlap across cells is legal and only costs a wave (D2), and `files` entries should
prefer explicit paths or trailing-`*` patterns since overlap detection reuses
`pathsOverlap` semantics (mid-path globs are literals, per D3). All three edits are
minimal, in-place, and in each file's existing voice — no unrelated sections touched.

**Verify:** all three anchored greps pass (`cells schedule` in both SKILL.md files,
`costs a wave` in planning-reference.md) and `test_bee_cli.mjs` is green (132 passed,
0 failed).

**Files touched:**
- `skills/bee-swarming/SKILL.md`
- `skills/bee-validating/SKILL.md`
- `skills/bee-planning/references/planning-reference.md`

Full trace/evidence: `.bee/cells/parallel-scheduler-4.json`
