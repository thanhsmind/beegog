# Codex hook state parity — cell 4

Status: `[BLOCKED]`

The canonical onboarding payload now copies `bee-codex-subagent-audit.mjs`, and the fresh-host onboarding test proves that both generated Codex lifecycle events resolve to that copied handler. The same test also preserves Claude non-projection, while the existing plugin-first branch remains untouched.

Files changed:

- `skills/bee-hive/scripts/onboard_bee.mjs`
- `skills/bee-hive/scripts/test_onboard_bee.mjs`
- `docs/history/codex-hook-state-parity/reports/codex-hook-state-parity-4.md`

Work definition: [codex-hook-state-parity-4](../../../../.bee/cells/codex-hook-state-parity-4.json)

Verification reached the release manifest check after the focused onboarding suite and all hook-contract checks passed. The manifest check then reported SHA-256 drift for both changed onboarding scripts, so the final `git diff --check` command in the chained verification did not run.

The required correction is to regenerate `docs/history/codex-harness-hardening/release-manifest.json`. That file is outside this cell's declared and reserved scope, so this worker stopped without changing it or capping the cell. The orchestrator must add the canonical manifest to the cell before redispatch.
