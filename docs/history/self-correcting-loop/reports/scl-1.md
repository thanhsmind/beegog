# scl-1 — revision ledger: trace.attempts + failure-signature normalizer (D1)

**[DONE]**

Added an append-only `trace.attempts` ledger, written by `recordVerify` (both
outcomes) and `blockCell`, plus an exported `normalizeFailureSignature`
mechanical fallback and a worker-suppliable `--signature` flag on
`cells verify`. `updateCell`'s existing wholesale `trace` freeze already
blocks any patch touching the ledger — no `UPDATE_FROZEN_HINTS` edit needed
(F1); a test now asserts that property directly.

**Files touched:** `skills/bee-hive/templates/lib/cells.mjs`,
`.bee/bin/lib/cells.mjs`, `skills/bee-hive/templates/bee.mjs`,
`.bee/bin/bee.mjs`, `skills/bee-hive/templates/lib/command-registry.mjs`,
`.bee/bin/lib/command-registry.mjs`,
`skills/bee-hive/templates/tests/test_lib.mjs`,
`skills/bee-hive/templates/tests/test_bee_cli.mjs`,
`docs/history/codex-harness-hardening/release-manifest.json`, and the
`.claude-plugin/skills` + `.codex-plugin/skills` projections of the above.

**Verify:** `node scripts/test_claim_race.mjs && node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/templates/tests/test_bee_cli.mjs && node scripts/test_lib_mirror.mjs && node scripts/release_manifest.mjs --check` — all green (test_lib 373/0, test_bee_cli 189/0). Full trace, evidence (freeze-first baseline + deliberate-red proof), and verify output live in `.bee/cells/scl-1.json`.

**Reservations:** released (10/10).

**Commit:** `028ccb3` — `feat(scl-1): append-only revision ledger (trace.attempts) + failure-signature normalizer`.
