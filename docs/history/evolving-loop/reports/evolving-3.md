# evolving-3 — dogfood_repos config + mergeDigests consumer-side revalidation (D2b)

**[DONE]**

Outcome: `readConfig` normalizes `dogfood_repos` (string|`{path,label}` → `{path,label}`, realpath-resolved, dead repo warned+skipped, absent→[]); `mergeDigests(root,{now})` folds each dogfood repo's already-written `feedback-digest.json` into the local digest with realpath containment, re-scan of both pattern sets on foreign titles, `datamark()` of survivors, allowlist enforcement via imported `ENTRY_FIELDS`, and attributed drops. `bee_feedback.mjs` `collect` redirected to `mergeDigests`. No clustering/ranking (slice B).

Files touched:
- `skills/bee-hive/templates/lib/state.mjs`
- `skills/bee-hive/templates/lib/feedback.mjs`
- `skills/bee-hive/templates/bee_feedback.mjs`
- `skills/bee-hive/templates/tests/test_lib.mjs`

Verify: `node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/scripts/test_onboard_bee.mjs` → 93 passed, 0 failed + onboard PASS (failures:0). 85 frozen assertions untouched, 8 added.

Full trace, evidence, and verify output: [`.bee/cells/evolving-3.json`](../../../../.bee/cells/evolving-3.json).
