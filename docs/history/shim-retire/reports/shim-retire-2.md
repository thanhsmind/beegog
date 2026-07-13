# shim-retire-2 — onboarding RETIRED_HELPERS removal pass + installer verify swap

[DONE]

Added a `RETIRED_HELPERS` constant (the 9 shim basenames) to `onboard_bee.mjs`;
`computePlan` now emits `remove_helper` for any of them still present in a
host's `.bee/bin/`, and `applyPlan` gains a `remove_helper` case (guarded to
only ever unlink an exact retired basename under `.bee/bin/`). Added three new
test cases to `test_onboard_bee.mjs`: stale-host removal (plan lists all 9,
apply deletes them, an unrelated `.bee/bin/bee.mjs` survives), idempotence
(second run plans zero `remove_helper` items, reports `up_to_date`), and fresh
onboard (a brand-new host's `.bee/bin` never carries a retired shim). Swapped
`scripts/install.sh` (verify step + help text) and `scripts/install.ps1`
(verify step + help text, backslash path preserved, ASCII-only preserved) from
`bee_status.mjs` to `node .bee/bin/bee.mjs status --json`.

Verify chain green: `test_onboard_bee.mjs` full suite (0 failures, 1
pre-existing unrelated skip), `bash -n scripts/install.sh` clean, zero
remaining references to any of the 9 retired shim basenames in either
installer script.

Files touched: `skills/bee-hive/scripts/onboard_bee.mjs`,
`skills/bee-hive/scripts/test_onboard_bee.mjs`, `scripts/install.sh`,
`scripts/install.ps1`.

Full trace and evidence: `.bee/cells/shim-retire-2.json`.

No deviations. No outstanding questions.
