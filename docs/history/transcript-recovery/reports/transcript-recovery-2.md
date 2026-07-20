# transcript-recovery-2

**Status:** [DONE]
**Worker:** stuart

## Outcome

Wired `recovery.mjs` into the CLI: `recovery scan`/`recovery window` verbs + `HANDLERS` entries in `bee.mjs`, matching schemas in `command-registry.mjs` (no `recovery.mjs` import there, per perf-import discipline), and a fail-open `status.recovery` block modeled exactly on `buildReviewBlock`. `recovery window` only emits the down-tier miner's prompt ({transcript, since_ts, event_count, window_truncated, prompt}) — no LLM call happens in the CLI (D4). `templates/bee.mjs` / `.bee/bin/bee.mjs` and `templates/lib/command-registry.mjs` / `.bee/bin/lib/command-registry.mjs` confirmed byte-identical via `cmp` after every edit.

RED-first (behavior_change): stashed only the implementation files, ran `test_bee_cli.mjs` with just the new tests present — 211 passed, 7 failed (missing registry entries, missing status.recovery block, DA5 bijection gap for the new group). Restored the implementation, reran: 218 passed, 0 failed. Full verify chain (`test_bee_cli.mjs && test_recovery.mjs && test_lib_mirror.mjs`) green.

## Files

- `skills/bee-hive/templates/bee.mjs`
- `.bee/bin/bee.mjs` (mirror)
- `skills/bee-hive/templates/lib/command-registry.mjs`
- `.bee/bin/lib/command-registry.mjs` (mirror)
- `skills/bee-hive/templates/tests/test_bee_cli.mjs`

## Consults

None (advisor not engaged — no verify failure occurred during implementation).

Full trace/evidence: `.bee/cells/transcript-recovery-2.json`.
