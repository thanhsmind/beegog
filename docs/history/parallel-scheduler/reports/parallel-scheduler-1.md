# parallel-scheduler-1

**Status:** [DONE]

**Outcome:** Added pure `schedule.mjs` (`computeSchedule`/`detectCycles`) to both
`skills/bee-hive/templates/lib/` and `.bee/bin/lib/` (byte-identical mirror) —
Kahn topological layering + greedy `pathsOverlap` packing per D1/D2/D3, with the
node-set contract from plan.md (open/claimed waves, capped deps satisfied,
missing/blocked/dropped deps unsatisfiable + excluded, transitive exclusion
propagation, structural cycle detection over all statuses via Tarjan SCC).
15 RED-first rows added to `test_lib.mjs`, confirmed red (import failure with
`schedule.mjs` removed from both copies), then green (315/315 pass, mirror
check green).

**Files touched:**
- `skills/bee-hive/templates/lib/schedule.mjs` (new)
- `.bee/bin/lib/schedule.mjs` (new, byte-identical mirror)
- `skills/bee-hive/templates/tests/test_lib.mjs` (15 new test rows + import)

Full trace/evidence: `.bee/cells/parallel-scheduler-1.json`
