# fsh-7 — Session-owned holds + cross-session write deny in the guard lib

[DONE] — `reservations.mjs` gained an optional `session` field (omitted when
absent, byte-identical rows unchanged) and an exported `findSessionConflicts`;
`guards.mjs` `checkWrite` now denies a write into another live session's held
path, phase-independently (before terminal/gated/swarming branches), naming
the holder session/agent/expiry, and fails closed with a typed
`{allow:false, kind:'holds-unreadable'}` verdict on a corrupt reservation
store (never throws). The `reservations.reserve` CLI verb exposes `--session`
with an exercised `examples[1]` row. RED-first proven: reverting only the two
lib files while the new tests stayed in place made `test_lib.mjs` fail to
even load (missing export) before the implementation restored it green.

Files touched: `skills/bee-hive/templates/lib/reservations.mjs`,
`skills/bee-hive/templates/lib/guards.mjs`,
`skills/bee-hive/templates/lib/command-registry.mjs`,
`skills/bee-hive/templates/bee.mjs`,
`skills/bee-hive/templates/tests/test_lib.mjs`,
`skills/bee-hive/templates/tests/test_bee_cli.mjs`, and their `.bee/bin/`
vendored siblings.

Full trace/evidence: `.bee/cells/fsh-7.json`.
