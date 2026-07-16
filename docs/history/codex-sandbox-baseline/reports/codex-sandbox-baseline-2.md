# codex-sandbox-baseline-2

[BLOCKED]

Centralized all declared Node-only test entrypoints on one serialized Worker transport while preserving their existing assertions and process-result contracts.

The implementation is capped and verified, but the required commit could not be created because the sandbox exposes `.git/index.lock` as read-only.

Files touched:

- `scripts/lib/run-module-worker.mjs`
- `hooks/test_model_guard.mjs`
- `hooks/test_write_guard.mjs`
- `skills/bee-hive/templates/tests/test_bee_cli.mjs`
- `skills/bee-hive/scripts/test_onboard_bee.mjs`
- `skills/bee-hive/scripts/test_split_brain_regression.mjs`

Full trace and verification output: [cell record](../../../../.bee/cells/codex-sandbox-baseline-2.json).
