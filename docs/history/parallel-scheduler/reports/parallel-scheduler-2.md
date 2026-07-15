# parallel-scheduler-2 — report

**Status:** [DONE]

**Outcome:** D2 cycle refusal wired into `addCell`/`addCells`/`updateCell` (when a
patch changes `deps`): the union of on-disk cells + the incoming set is checked
via `schedule.mjs`'s `detectCycles` before any write; a cycle refuses with a
message naming the cycle ids, all-or-nothing (nothing written on refusal). File
overlap is untouched and stays legal per D2.

**Files touched:**
- `skills/bee-hive/templates/lib/cells.mjs`
- `.bee/bin/lib/cells.mjs` (mirror — byte-identical, confirmed via `scripts/test_lib_mirror.mjs`)
- `skills/bee-hive/templates/tests/test_lib.mjs` (6 new regression rows)

**Full trace/evidence:** `.bee/cells/parallel-scheduler-2.json`
