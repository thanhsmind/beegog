# fsh-13 — Release prep: version bump + beegog self-onboard + backlog/README refresh

**Status:** [DONE]

**Outcome:** Bumped bee to v0.1.33 (`.claude-plugin/plugin.json` + `BEE_VERSION` in both
`skills/bee-hive/templates/lib/state.mjs` and `.bee/bin/lib/state.mjs`), then ran
`onboard_bee.mjs --repo-root . --apply` to self-onboard this repo. The apply's immediate
recheck reported `up_to_date` with an empty drift plan — the parity evidence required by
the cell's must_haves. Confirmed no test pins the real `BEE_VERSION` value (only the
export name is asserted in `test_lib.mjs`), so no test edit was made. `bee_backlog rank`
reported no drift (skipped write); `bee_backlog badges --write` refreshed the README
shields.io block (README carries the badge block). `docs/backlog.md`'s P28 row was left
untouched (in-flight, as instructed — scribing owns the done-flip at feature close).
`AGENTS.md` required no edit (fsh-12 already rendered it byte-identical to the template).
No git tag, no push, no other-repo onboarding.

**Files touched:** `.claude-plugin/plugin.json`, `skills/bee-hive/templates/lib/state.mjs`,
`.bee/bin/lib/state.mjs`, `.bee/onboarding.json`, `README.md`.

**Verify:** `node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/templates/tests/test_bee_cli.mjs && node hooks/test_hook_contracts.mjs && node skills/bee-hive/scripts/test_onboard_bee.mjs` — all four green (292/121/141-rows/0-failing).

Full trace/evidence: `.bee/cells/fsh-13.json`.
