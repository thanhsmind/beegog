# backlog-auto-commit-2

[DONE] — `bee backlog add`'s auto-commit is now scoped to `--queue-submit` (D1), and a merge-in-progress skip is surfaced as `commit_skipped_reason: "merge_in_progress"` with a visible text-output warning (D2).

**Files touched:** `skills/bee-hive/templates/bee.mjs`, `skills/bee-hive/templates/lib/command-registry.mjs`, `skills/bee-hive/templates/tests/test_cli_cells.mjs`, plus the established mirrors (`.bee/bin/bee.mjs`, `.bee/bin/lib/command-registry.mjs`, `.claude/skills/**`, `.agents/skills/**`, `.claude-plugin/skills/**`, `.codex-plugin/skills/**`) synced via `onboard_bee.mjs --apply` and `render_plugin_skill_trees.mjs`, and `docs/history/codex-harness-hardening/release-manifest.json` refreshed via `release_manifest.mjs --write` so the full verify chain's manifest/plugin-distribution checks pass.

Full trace and verification evidence: `.bee/cells/backlog-auto-commit-2.json`.
