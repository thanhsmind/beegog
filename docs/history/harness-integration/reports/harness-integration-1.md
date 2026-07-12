# harness-integration-1 — Shared command registry + args validator

**Status:** DONE
**Worker:** worker-w1
**Outcome:** Built `command-registry.mjs` (21 subcommands covering all 4 existing helpers, D3-shaped JSON-Schema `parameters`), `validate-args.mjs` (`validate()` + `isValidParameterSchema()`), and `test_bee_cli.mjs` (32 checks: registry shape, validator contract, every `examples[]` entry executed against the real underlying helper inside an isolated temp repo). Zero regression: `test_lib.mjs` 124/124 still passing.

**Files touched:**
- `skills/bee-hive/templates/lib/command-registry.mjs` (new)
- `skills/bee-hive/templates/lib/validate-args.mjs` (new)
- `skills/bee-hive/templates/tests/test_bee_cli.mjs` (new)

**Verify:** `node skills/bee-hive/templates/tests/test_bee_cli.mjs` — 32 passed, 0 failed.

**Deviations:** none.

Full trace/evidence: `.bee/cells/harness-integration-1.json`.
