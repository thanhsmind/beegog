# ag-2

**Status:** DONE — capped, verify green.

**Outcome:** Hook context (`BEE_HOOK_CONTEXT`, set once in `hooks/adapter.mjs`'s `readHookContext` before any lib import) suppresses `normalizeDogfoodRepos`'s `console.warn` for dead/unreadable `dogfood_repos` entries during hook runs — the entry is still skipped identically. Plain CLI runs (status, onboarding) keep the warning verbatim.

**Files touched:**
- `hooks/adapter.mjs`
- `skills/bee-hive/templates/lib/state.mjs`
- `skills/bee-hive/templates/tests/test_state.mjs`
- `.bee/bin/hooks/adapter.mjs` (mirror)
- `.bee/bin/lib/state.mjs` (mirror)
- `docs/history/codex-harness-hardening/release-manifest.json` (regenerated)
- `.bee/onboarding.json` (regenerated hash)
- rendered plugin skill trees (`.claude-plugin/`, `.codex-plugin/`, `.claude/`, `.agents/`) via `render_plugin_skill_trees.mjs`

Full trace/evidence: `.bee/cells/ag-2.json`.
