# fsh-11 — claim-next selection: own lane first, approved lanes only, hold-skip, typed stop

**Status:** [DONE]

**Outcome:** Shipped `claimNextCell` + `claimCellCrossSession` in `cells.mjs`: cross-session selection (own bound lane first, then execution-approved other lanes only — an unapproved lane is never touched even as the only ready one — hold-skip via `findSessionConflicts`, backlog-rank-then-created_at cross-lane ordering) that runs `sweepExpiredClaims` in-pass as its production trigger (previously zero production callers), plus a throw-safe two-store claim (`claimCellFile` then cells.mjs's own `claimCell`, unwound via `releaseClaim` on any throw). New `backlog.mjs` helper `featureBacklogRank` maps feature slug → rank position from the Feature column (`rankBacklog` itself only reads Status/ID). New CLI verb `cells.claim-next` through the unified registry with an exercised `runExample` row.

**Files touched:**
- `skills/bee-hive/templates/lib/cells.mjs` / `.bee/bin/lib/cells.mjs`
- `skills/bee-hive/templates/lib/backlog.mjs` / `.bee/bin/lib/backlog.mjs`
- `skills/bee-hive/templates/lib/command-registry.mjs` / `.bee/bin/lib/command-registry.mjs`
- `skills/bee-hive/templates/bee.mjs` / `.bee/bin/bee.mjs`
- `skills/bee-hive/templates/tests/test_lib.mjs`
- `skills/bee-hive/templates/tests/test_bee_cli.mjs`

Full trace/evidence: `.bee/cells/fsh-11.json`.
