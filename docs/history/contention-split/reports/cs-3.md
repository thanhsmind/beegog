# cs-3 — Concurrency-safe plugin-tree render (lock + tmp-swap)

**Status:** `[BLOCKED]`

**Outcome:** Reservation conflict on `scripts/run_verify.mjs` — held by `exec-xwh1` (cell `xwh-1`, feature `cross-worktree-holds`), which is also registering a new suite (`scripts/test_worktree_holds_race.mjs`) into `SUITES`/`SERIAL_SENSITIVE` in the same file. cs-3 needs to register `scripts/test_render_race.mjs` there too, so the write cannot proceed without colliding with xwh-1's in-flight edit. No source files were touched.

**Files touched:** none. (Reservations on `scripts/render_plugin_skill_trees.mjs` and `scripts/test_render_race.mjs` were acquired, then released again once the conflict on `scripts/run_verify.mjs` was hit — holding them served no purpose while blocked.)

**Full trace/evidence:** `.bee/cells/cs-3.json` (still `status: "claimed"`, `trace.worker: "exec-cs3"`, no verify recorded).
