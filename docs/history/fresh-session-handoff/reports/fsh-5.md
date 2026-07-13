# fsh-5 — Enforcement readers resolve through the session's lane

**Status:** [DONE]
**Worker:** Jerry (generation tier)

**Outcome:** claimCell's execution gate now resolves from the cell's own feature lane (a lane record for `cell.feature` authorizes or refuses the claim; no lane record = today's default gate, D4 zero-lane byte-parity; a corrupt lane record refuses loudly instead of falling back to the default gate), and checkWrite gained an optional `sessionId` parameter — when provided, phase/gates come from `resolvePipeline(root, { sessionId })` (bound session governed by its lane; absent/unbound = today's exact behavior; an unresolvable binding is a typed `lane` deny, never a silent default). Lib capability only — hooks and `hooks/test_hook_contracts.mjs` untouched (S3/S4 own the threading).

**Files touched:**
- `skills/bee-hive/templates/lib/cells.mjs` (claimCell lane-gate resolution + `laneRecordForFeature`)
- `skills/bee-hive/templates/lib/guards.mjs` (optional-sessionId pipeline resolution in checkWrite)
- `skills/bee-hive/templates/tests/test_lib.mjs` (3 new rows, RED-first; existing rows extended, never modified)
- `.bee/bin/lib/cells.mjs`, `.bee/bin/lib/guards.mjs` (vendored byte-identical)

**Verify:** `node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/scripts/test_onboard_bee.mjs` — 253 passed / 0 failed, onboard PASS (baseline before first edit: 250 passed / 0 failed, onboard PASS).

Full trace and verification evidence: `.bee/cells/fsh-5.json`.
