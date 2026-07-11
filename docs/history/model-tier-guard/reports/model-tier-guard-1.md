# model-tier-guard-1 — bee-model-guard hook

[DONE] Added `hooks/bee-model-guard.mjs` (PreToolUse `Agent|Task` deny-only guard per plan D1/D2) and `hooks/test_model_guard.mjs` (14-row payload-table test). Bare Agent/Task dispatches (no `model` param, no `[bee-tier: <tier>]` marker) are denied with a `bee-tier` + `FIX` reason on stderr and a deny event logged to `.bee/logs/hooks.jsonl`; everything else fail-opens per decision 0023.

Files touched: `hooks/bee-model-guard.mjs`, `hooks/test_model_guard.mjs`.

Verify: `node hooks/test_model_guard.mjs && node skills/bee-hive/templates/tests/test_lib.mjs` — 14/14 payload-table rows pass, 124/124 in test_lib.mjs, exit 0.

Full trace and evidence: `.bee/cells/model-tier-guard-1.json`.

No deviations. No open questions.
