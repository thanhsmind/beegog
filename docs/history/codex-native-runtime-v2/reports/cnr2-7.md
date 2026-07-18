# cnr2-7 report

[DONE]

Outcome: regenerated `.codex/hooks.json` through the sanctioned catalog
repo-target render (`renderProjectionText(CODEX, {target: REPO})`, piped via
`node --input-type=module`), fixing cnr2-2's flagged drift — the PreToolUse
matcher was missing `AskUserQuestion` and the SubagentStart/SubagentStop audit
entries were absent entirely. Added a `codex-repo-target-byte-identical` drift
row to `hooks/test_hook_contracts.mjs` that renders the catalog at test time
and compares to the checked-in file byte-for-byte (no stored snapshot, no
allowed-difference mask), and registered it in `REQUIRED_CATALOG_ROW_IDS` so it
cannot be silently skipped. Preserved the cnr2-2 superset matcher
(`update_plan|TaskCreate|TaskUpdate|TodoWrite`). Fixed one pre-existing
hardcoded route-row assertion (`route-config-ten-commands` → 12) that had gone
green against the stale 10-command file.

Files touched: `.codex/hooks.json`, `hooks/test_hook_contracts.mjs`.

Full trace and verification evidence: `.bee/cells/cnr2-7.json`.

Note for live Codex: the changed hook file may need one `/hooks`
review-and-retrust; live-firing proof needs a fresh Codex session (this cell's
proof is the synthetic contract rows: 173 rows, 0 failing, `ALL PASS`,
`REGEN-OK`).

Friction: none new. Verify must run with `BEE_AGENT_NAME` unset in the shell
env — the pre-existing `guards.mjs:267` `process.env.BEE_AGENT_NAME` fallback
(filed as friction in cnr2-2's report) leaks the ambient var into 3 unrelated
write-guard-hold fixture rows and flips them red, reproducible on unmodified
HEAD; out of scope here.
