# Cell fanout-1 Report

**Status:** [DONE]

**Outcome:** Removed advisor mode wholesale from `lib/state.mjs`, `lib/inject.mjs`, `bee_status.mjs` (templates + `.bee/bin` twins), `onboard_bee.mjs` `DEFAULT_CONFIG`, and `.bee/config-sample.json` (D1). `readConfig` now destructures a stale `advisor` key out of the spread instead of normalizing it, so it is tolerated (never thrown) but never surfaces in the parsed result. `bee_status.mjs` and `onboard_bee.mjs` each warn once, never error, via matching `STALE_ADVISOR_KEY_WARNING` text when a repo's raw `.bee/config.json` still carries the key. `test_lib.mjs`'s advisor test block was replaced RED-first with a stale-key test.

**Files touched:**
- skills/bee-hive/templates/lib/state.mjs (advisor block/comment/function removed; readConfig destructures out a stale `advisor` key; new `hasStaleAdvisorKey`/`STALE_ADVISOR_KEY_WARNING`)
- .bee/bin/lib/state.mjs (byte-identical twin)
- skills/bee-hive/templates/lib/inject.mjs (ADVISOR MODE preamble block removed)
- .bee/bin/lib/inject.mjs (byte-identical twin)
- skills/bee-hive/templates/bee_status.mjs (advisor field/render removed; stale-key staleness warning added)
- .bee/bin/bee_status.mjs (byte-identical twin)
- skills/bee-hive/scripts/onboard_bee.mjs (DEFAULT_CONFIG.advisor removed; local stale-key notice added — deliberately not imported from lib/state.mjs, see deviation note in the cell trace)
- skills/bee-hive/templates/tests/test_lib.mjs (advisorModel/ADVISOR_POINTS imports + test block removed; RED-first stale-key test added)
- .bee/config-sample.json (advisor block removed)

**Verify:** cell's `verify` command (`test_lib.mjs` && `test_onboard_bee.mjs` && two grep negative-assertions for removed advisor symbols/preamble text) — PASSED, exit 0. 169/169 passed in test_lib.mjs, test_onboard_bee.mjs green (0 failures, 1 pre-existing unrelated skip).

**Full trace and evidence:** [.bee/cells/fanout-1.json](../../../../.bee/cells/fanout-1.json)
