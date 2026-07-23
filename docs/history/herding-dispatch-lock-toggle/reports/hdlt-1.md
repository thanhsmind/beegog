# hdlt-1

[DONE] Added the `bee herding enable/disable/status` CLI verb group, mirroring `dispatch-interlock.mjs`'s marker resolution exactly; RED-first test suite proves idempotency and interlock agreement.

Files touched:
- `skills/bee-hive/templates/lib/herding.mjs` (new)
- `skills/bee-hive/templates/tests/test_herding_cli.mjs` (new)
- `skills/bee-hive/templates/bee.mjs`
- `skills/bee-hive/templates/lib/command-registry.mjs`
- `skills/bee-hive/templates/tests/test_bee_cli.mjs` (deviation: fixed a pre-existing drift-guard broken by the new registry group)

Full trace/evidence: `.bee/cells/hdlt-1.json`.
