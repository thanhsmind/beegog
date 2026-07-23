# hdlt-1

[DONE] Added the `bee herding enable/disable/status` CLI verb group, mirroring `dispatch-interlock.mjs`'s marker resolution exactly; RED-first test suite proves idempotency and interlock agreement.

Files touched:
- `skills/bee-hive/templates/lib/herding.mjs` (new)
- `skills/bee-hive/templates/tests/test_herding_cli.mjs` (new)
- `skills/bee-hive/templates/bee.mjs`
- `skills/bee-hive/templates/lib/command-registry.mjs`
- `skills/bee-hive/templates/tests/test_bee_cli.mjs` (deviation: fixed a pre-existing drift-guard broken by the new registry group)

Full trace/evidence: `.bee/cells/hdlt-1.json`.

## Orchestrator done-report (goal-check, AO14/D5)

- **Frozen judge** (`cells judge --id hdlt-1`): flagged `test_bee_cli.mjs` under the "test sources" rule (undeclared file). Inspected the actual diff (`git show 747f7e7 -- skills/bee-hive/templates/tests/test_bee_cli.mjs`): purely additive — adds `herding` to two existing group-allowlist `Set`s and adds one new `check(...)` exercising the new registry examples end-to-end against a real git repo. No existing assertion weakened or deleted. `command-registry.mjs` was also undeclared in the cell's `files` list — that was a planning gap (COMMAND_REGISTRY actually lives in that lib file, not inline in `bee.mjs`), not a worker overreach; confirmed `dispatch-interlock.mjs` untouched and no automation call site invokes the new verbs (per D4).
- **Independent fresh verify** (own shell, not the worker's word): `env -u CLAUDE_CODE_SESSION_ID -u BEE_SESSION_ID node skills/bee-hive/templates/tests/test_herding_cli.mjs` → 6/6 passed.
- **Wave-close full chain** (`node scripts/run_verify.mjs`, run once): first pass surfaced 4 pre-existing-pattern regen misses (P75's exact problem — canonical `skills/bee-hive/templates/**` edited without regenerating the derived copies): `test_lib_mirror` (`.bee/bin/lib` drift), `test_plugin_distribution`/release inventory (`.claude-plugin`/`.codex-plugin` skill-route trees + manifest), `test_misc` (vendored-source byte-identity). Fixed by running `node skills/bee-hive/scripts/onboard_bee.mjs --repo-root . --apply` (recheck: `up_to_date`), `node scripts/render_plugin_skill_trees.mjs`, and `node scripts/release_manifest.mjs --write`. Re-ran the full chain: **88/88 suites green**. Committed as a separate fixup: `chore(herding): regenerate synced skill trees and release manifest [hdlt-1]`.
- **Reservations**: `reservations list --active-only` empty. **Workers**: cleared from `.bee/state.json`.

Cell capped, goal-checked, wave clean.
