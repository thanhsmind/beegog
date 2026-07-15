# parallel-scheduler-3

**Status:** [DONE]

**Outcome:** Added the `bee cells schedule` CLI verb (D1) — registry entry
in both `command-registry.mjs` mirror copies, `handleCellsSchedule` handler
in both dispatcher copies (`skills/bee-hive/templates/bee.mjs` /
`.bee/bin/bee.mjs`), HANDLERS map entry, and `schedule` appended to the
hand-maintained `cellsUsageFallback` verb list. The handler is a thin
read-only pass-through of `computeSchedule`'s `waves`/`diagnostics` — no
CLI-side re-sorting or filtering — with feature resolution matching
`handleCellsReady` exactly (`flags.feature ? String(flags.feature) : null`,
no `state.json` fallback). 2 new rows added to `test_bee_cli.mjs` (registry
example + empty-store exit-0 check); all 132 test_bee_cli.mjs checks pass,
mirror check green, dispatcher-diff clause green. Compat proof (cell-owned):
`node .bee/bin/bee.mjs cells schedule --json` against this repo's real
206+ cell store exits 0 with zero cycles, zero unsatisfiable deps, 5 empty
files (matching CONTEXT.md's independently recorded fact), and waves
`[[ps-2, ps-3], [ps-4]]` — exactly plan.md's predicted slice-1 schedule.

**Files touched:**
- `skills/bee-hive/templates/lib/command-registry.mjs`
- `.bee/bin/lib/command-registry.mjs`
- `skills/bee-hive/templates/bee.mjs`
- `.bee/bin/bee.mjs`
- `skills/bee-hive/templates/tests/test_bee_cli.mjs`

Full trace/evidence: `.bee/cells/parallel-scheduler-3.json`
