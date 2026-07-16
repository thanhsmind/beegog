# codex-hook-state-parity-2

[DONE]

Codex plugin and generated repository projections now install one bounded,
audit-only handler for both `SubagentStart` and `SubagentStop`. The start record
explicitly identifies its post-start timing and neither lifecycle path can deny,
block, or emit sensitive payload fields. Claude's existing projection is
unchanged.

The catalog declares all three directional runtime differences: Claude-only
pre-spawn model guarding and Codex-only start/stop auditing. Contract tests
prove the checked-in plugin projection, generated repository projection, paired
fixture execution, bounded allowlist, fail-open behavior, and canonical/vendored
handler equality. The root `.codex/hooks.json` remains a read-only development
fallback snapshot and is not used as release byte-equality proof.

Verification passed:

`node hooks/test_hook_contracts.mjs && node hooks/test_model_guard.mjs && node scripts/test_lib_mirror.mjs && git diff --check`

- Hook contracts: 145 rows across 17 groups, 0 skipped, 0 failing.
- Model guard: all rows passed.
- Library mirror: all 17 files byte-identical.
- Diff whitespace check: passed.
