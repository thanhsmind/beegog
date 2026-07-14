# ao-fix-1

**Status:** [DONE]

**Outcome:** Regenerated `.codex/hooks.json` from `hooks/catalog.mjs`'s codex@repo
projection (it had hand-drifted to `.bee/bin/hooks/` paths since commit 744b1bec;
catalog.mjs has always rendered `hooks/`) and removed the stray
`.codex/hooks.json.bak`. This single fix resolved all 22 red rows in
`hooks/test_hook_contracts.mjs` — both failure classes shared one root cause.
`hooks/test_write_guard.mjs` remained green throughout. No assertion was touched.

**Files touched:** `.codex/hooks.json` (regenerated), `.codex/hooks.json.bak`
(removed). `hooks/test_hook_contracts.mjs` was reserved but not modified — see
Deviation note below.

**Full trace/evidence:** `.bee/cells/ao-fix-1.json`

## Deviation

The cell's action prose for cause (1) asked to change
`hooks/test_hook_contracts.mjs`'s route fixture to stage wrappers into
`.bee/bin/hooks/`. Investigation (git history of `hooks/catalog.mjs`, and running
the suite) showed this was backwards: `catalog.mjs` has always rendered
`hooks/${script}` for the repo target, and the fixture already staged there via
`readdirSync` (no hand-kept list). The actual stale artifact was `.codex/hooks.json`
itself. Regenerating it from the catalog (the cell's own instruction for cause (2))
resolved both causes at once. Full reasoning recorded in the cell's deviation
evidence.
