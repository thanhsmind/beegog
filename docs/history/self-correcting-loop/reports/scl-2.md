# scl-2 report

**Status:** [DONE]

**Outcome:** Cell-lifetime budgets (max_claims/max_failed_attempts/max_same_signature) now enforced inside `claimCellCrossSession`'s O_EXCL critical section, with typed `CELL_BUDGET_EXHAUSTED`/`REPEATED_FAILURE` refusals that unwind the just-acquired claim file. `claimNextCell` selection skips exhausted/repeated candidates. New `cells reset-budget --id --reason` verb is the sole audited reopening door. `gate_bypass=total` never bypasses either refusal (structural — the check never reads bypass config). `test_claim_race.mjs` gained scenario (d) proving the unwind holds under real concurrency.

**Files touched:** `skills/bee-hive/templates/lib/cells.mjs`, `.bee/bin/lib/cells.mjs`, `skills/bee-hive/templates/bee.mjs`, `.bee/bin/bee.mjs`, `skills/bee-hive/templates/lib/command-registry.mjs`, `.bee/bin/lib/command-registry.mjs`, `skills/bee-hive/templates/tests/test_lib.mjs`, `skills/bee-hive/templates/tests/test_bee_cli.mjs`, `scripts/test_claim_race.mjs`, `docs/history/codex-harness-hardening/release-manifest.json`, `.claude-plugin/skills/*`, `.codex-plugin/skills/*`.

Full trace/evidence: `.bee/cells/scl-2.json`.
