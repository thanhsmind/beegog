# Codex hook state parity — cell 5

Status: `[DONE]`

Fresh-host repository onboarding now ships every handler referenced by generated Codex hooks, including the bounded subagent audit handler on both lifecycle events, while preserving plugin-first suppression and Claude behavior. The canonical release identity was regenerated for the final onboarding source and tests.

Files changed:

- `skills/bee-hive/scripts/onboard_bee.mjs`
- `skills/bee-hive/scripts/test_onboard_bee.mjs`
- `docs/history/codex-harness-hardening/release-manifest.json`
- `docs/history/codex-hook-state-parity/reports/codex-hook-state-parity-5.md`

Work definition and full verification trace: [codex-hook-state-parity-5](../../../../.bee/cells/codex-hook-state-parity-5.json)
