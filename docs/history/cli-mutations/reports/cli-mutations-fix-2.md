# cli-mutations-fix-2

**Status:** [DONE]

**Outcome:** Added a readdir-driven standing test to `skills/bee-hive/templates/tests/test_lib.mjs` that byte-compares every `templates/*.mjs` and `templates/lib/*.mjs` against its `.bee/bin` sibling, closing review finding P1-2 (no standing guard proved template↔vendor equality after the one-time `cmp` at cell-verify time).

**Files touched:** `skills/bee-hive/templates/tests/test_lib.mjs`

**Verification:** `node skills/bee-hive/templates/tests/test_lib.mjs` → 149 passed, 0 failed. Full trace and evidence (including the red-failure proof: pre-change suite passed 148/148 with injected drift, new suite caught it at 148/149) in `.bee/cells/cli-mutations-fix-2.json`.

**Commit:** `cb12ce3` — one commit, cell id in message.

**Reservations:** released.
