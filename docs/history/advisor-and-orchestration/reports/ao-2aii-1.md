# ao-2aii-1

**Status:** DONE — capped, verify green, committed `f2dd91b`.

**Outcome:** `resolveTier` gained an optional 4th `purpose` param (`{for:'gather'|'cell'}`, default `'cell'`, fail-safe). A cli-shaped slot resolved for cell-execution (default, explicit, or malformed purpose) now returns a typed refusal `{type:'refused', reason:'cli_tier_gather_only', slot, fix}` instead of `{type:'cli', command}` — never a throw. Only explicit `{for:'gather'}` still returns the cli dispatch. Applies to every slot including `review`. `modelForTier` and non-cli tiers stay byte-unchanged.

**Files touched:** `skills/bee-hive/templates/lib/state.mjs`, `.bee/bin/lib/state.mjs` (byte-identical mirror), `skills/bee-hive/templates/tests/test_lib.mjs`, `docs/history/codex-harness-hardening/release-manifest.json`.

Deviations: none.

Full trace/evidence: `.bee/cells/ao-2aii-1.json`.
