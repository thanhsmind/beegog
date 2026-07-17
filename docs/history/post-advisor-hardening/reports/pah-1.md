# pah-1 — H1 onboarding-generator drift check

**Status:** [DONE]

**Outcome:** Added a drift-check row to `test_onboard_bee.mjs` that derives per-runtime hook script sets from `hooks/catalog.mjs`'s `renderProjection()` and asserts three onboarding generators (the vendored-hook list `HOOK_FILENAMES`, the Claude settings template `renderRepoHookEntries`, and the Codex repo-projection template `renderCodexHookEntries`) each cover their runtime's catalog set — read from a fresh onboarding fixture, never parsed from source text.

**Files touched:**
- `skills/bee-hive/scripts/test_onboard_bee.mjs`
- `.claude/skills/bee-hive/scripts/test_onboard_bee.mjs` (mirror)
- `.agents/skills/bee-hive/scripts/test_onboard_bee.mjs` (mirror)
- `docs/history/codex-harness-hardening/release-manifest.json` (via `--write`)

**Falsifiability:** temporarily removed `bee-chain-nudge.mjs` from `renderCodexHookEntries` in `onboard_bee.mjs`, reran the suite (RED — new row failed naming `missingFromCodexGenerator: ["bee-chain-nudge.mjs"]`, plus two pre-existing Codex-projection checks also went RED), then restored via `git checkout` and reran green. Never committed the red state.

Full trace/evidence: `.bee/cells/pah-1.json`.

**Commit:** `b97dad2` — "test(post-advisor-hardening): pah-1 onboarding-generator drift check [pah-1]"
