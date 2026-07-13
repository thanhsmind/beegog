# shim-retire-1 — runtime retirement

[DONE]

Deleted the 9 retired `bee_*.mjs` shims from `skills/bee-hive/templates/`;
removed the `helper:` metadata field from every `COMMAND_REGISTRY` entry (D5)
and its `entry.helper` test assertion; rewrote the DA5 verb-bijection guard to
probe `bee.mjs` directly with the group token prepended; repointed every
shim-spawning check in `test_lib.mjs`/`test_bee_cli.mjs` to `bee.mjs <group>`,
deleting only the checks whose entire purpose was diffing output against a
spawned shim; swept `bee_*.mjs`-shaped hint strings in `lib/state.mjs`,
`lib/cells.mjs`, `lib/guards.mjs`, `lib/reviews.mjs`, `lib/inject.mjs` to
`bee.mjs <group> <verb>` form; synced `.bee/bin/lib/*` (this repo self-hosts).

Verify chain green: `test_lib.mjs` 292/0, `test_bee_cli.mjs` 116/0,
`test_bee_write_guard_hook.mjs` 21/0, no `bee_*.mjs` files remain under
`skills/bee-hive/templates/`.

Files touched: the 9 deleted shims, `skills/bee-hive/templates/lib/{command-registry,state,cells,guards,reviews,inject}.mjs`,
`skills/bee-hive/templates/tests/{test_bee_cli,test_lib,test_bee_write_guard_hook}.mjs`,
`.bee/bin/lib/{command-registry,state,cells,guards,reviews,inject}.mjs`.

Full trace and evidence: `.bee/cells/shim-retire-1.json`.

## Deviations

1. Auto-fixed a pre-existing, unrelated bug in `test_bee_write_guard_hook.mjs`'s
   `VENDORED_LIB_MODULES` (missing `claims.mjs`/`backlog.mjs`), confirmed via
   `git stash` to predate this cell.
2. Deleted 7 parity-vs-shim checks in `test_bee_cli.mjs` (diffed `bee.mjs`
   output against a spawned shim, now impossible); replaced the frozen-key
   and cells-ready assertions with equivalent non-parity checks.
3. Synced `.bee/bin/lib/*` to the edited templates siblings so this repo's
   standing template↔vendor byte-parity guard passes; did not touch
   `.bee/bin/bee_*.mjs` shims or `scripts/onboard_bee.mjs` (out of scope).

No outstanding questions.
