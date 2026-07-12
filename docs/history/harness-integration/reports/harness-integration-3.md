# harness-integration-3 — worker-w3

**Status:** [DONE]

**Outcome:** Ran the onboarding-vendoring prerequisite (`node skills/bee-hive/scripts/onboard_bee.mjs --repo-root . --apply`) to populate `.bee/bin/lib/validate-args.mjs` + `command-registry.mjs`, then added an additive 4th check to `hooks/bee-write-guard.mjs` (CLI-shape validation, D4): a Bash call shaped like a `bee.mjs`/`bee_*.mjs` invocation is parsed and validated against the vendored registry/validator, denying malformed calls with a structured correction before the shell executes them. The check runs unconditionally for Bash calls but can only assign `denial` when none is already set, and its own logic runs in a separate inner try/catch — so it can never overwrite or discard a denial already computed by the gate/reservation/privacy checks, even when forced to throw. Wrote `test_bee_write_guard_hook.mjs`, a new 15-case end-to-end integration test that spawns the real hook script with crafted stdin payloads.

**Files touched:** `hooks/bee-write-guard.mjs`, `skills/bee-hive/templates/tests/test_bee_write_guard_hook.mjs`, `.bee/bin/lib/validate-args.mjs`, `.bee/bin/lib/command-registry.mjs`, `.bee/onboarding.json` (last three are vendoring side-effects, disclosed per the cell's own note).

**Verification:** `node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/templates/tests/test_bee_write_guard_hook.mjs` — 124 passed / 15 passed, 0 failed. `test_bee_cli.mjs` (harness-integration-1 regression) re-run standalone: 32 passed / 0 failed.

**Reservations:** released (5).

**Commit:** `0da2910` — one commit, cell id in the message.

Full trace, verify output, and evidence: `.bee/cells/harness-integration-3.json`.
