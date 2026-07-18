# cnr2-2 report

[DONE]

Outcome: extended the state-sync PostToolUse matcher to the D4 superset
`update_plan|TaskCreate|TaskUpdate|TodoWrite` in both generator layers
(`hooks/catalog.mjs` and `onboard_bee.mjs`'s two host renderers), regenerated
the plugin projections byte-for-byte from the catalog, hand-patched the same
single matcher line in `.codex/hooks.json` (its unrelated pre-existing drift
from the full catalog render was left untouched per the scope guard), synced
the stale header comment + mirror in `bee-state-sync.mjs`, and added a
catalog-side matcher-text assertion plus a real update_plan behavior row to
`hooks/test_hook_contracts.mjs`, and exact structural matcher assertions for
both host renderers to `test_onboard_bee.mjs`. Regenerated the release
manifest for the 7 manifest-tracked files that changed.

Files touched: `hooks/catalog.mjs`, `hooks/bee-state-sync.mjs`,
`.bee/bin/hooks/bee-state-sync.mjs`, `.codex/hooks.json`, `hooks/hooks.json`,
`hooks/claude-hooks.json`, `hooks/test_hook_contracts.mjs`,
`skills/bee-hive/scripts/onboard_bee.mjs`,
`skills/bee-hive/scripts/test_onboard_bee.mjs`,
`docs/history/codex-harness-hardening/release-manifest.json`.

Full trace and verification evidence: `.bee/cells/cnr2-2.json`.

Friction: discovered mid-verify that `guards.mjs:267` falls back to
`process.env.BEE_AGENT_NAME` when a write-guard payload carries no
`agentName`, which leaks the invoking shell's `BEE_AGENT_NAME` into three of
`hooks/test_hook_contracts.mjs`'s isolated write-guard-hold fixture rows
(`own-session-hold-never-blocks`, `legacy-session-less-row-never-blocks`,
`no-session-id-is-zero-difference-even-with-a-hold`), making them flip red
whenever the test is run with `BEE_AGENT_NAME` set — reproduced on unmodified
HEAD too, so it predates this cell and is unrelated to the state-sync matcher
change. Filed as friction, not fixed here (out of scope).
