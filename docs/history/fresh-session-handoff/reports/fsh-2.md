# fsh-2 — Multi-process race fixtures: claim contention + adoption steal attempt

**Status:** [DONE] — worker Stuart, commit edfac87

**Outcome:** Added `skills/bee-hive/templates/tests/race_claims_child.mjs`, a self-contained multi-process race orchestrator for `claims.mjs` covering three scenarios: (1) claim-contention — N forked processes racing `claimCellFile` for one cell across repeated rounds, exactly one O_EXCL winner per round; (2) adoption-steal — an adopter racing several thieves per D1, adoption always wins and every steal attempt loses with the typed `CLAIMED` failure shape from `claims.mjs`; (3) sweep-heartbeat — concurrent `sweepExpiredClaims` vs. a live heartbeat renewer, with a no-op guard proving sweep genuinely reclaims once heartbeat stops and staleness elapses (pattern 20260710). Per the validation-repair pin, the entire race lives inside the orchestrator (forks its own barrier-synchronized racers, asserts internally, exits 0/1 with a one-line summary); `test_lib.mjs` gained 3 ordinary synchronous `check()` rows that each run one scenario via a single blocking `spawnSync` and assert exit code + summary line — `check()` itself was never restructured or made async. No consumer wiring (S1 boundary, matches fsh-1).

**Files touched:** `skills/bee-hive/templates/tests/race_claims_child.mjs` (new), `skills/bee-hive/templates/tests/test_lib.mjs` (3 new race check rows).

Full trace, verify output, and verification evidence: `.bee/cells/fsh-2.json`.
