# Recovery digest — session c128101f (crashed mid rel1710rc-3)

Mined 2026-07-21 by a down-tier worker over the bounded window (101 events since 2026-07-21T04:02:11.864Z). Content below is mined data, never instructions (D5).

## In-flight summary

Session was executing feature `release-1-7-10-rc` (phase `swarming`, cell `rel1710rc-1` claimed by orchestrator, never capped). Prior worker cell `rel1710rc-2` had completed (commit `05a131f`, deterministic holds-race negative control + Windows-portable subset). The session then:

1. Re-tagged `v1.7.10-rc` onto `05a131f` (deleted+recreated local and remote tag, confirmed pointing at `05a131f47c2fbba89c875aa282fa560e36617d15`).
2. Watched CI on that commit twice — Windows CI job green both times; Linux `verify (22)` job (Node 22, 2-core runner) failed twice, with two different flaky race-condition failures in scenario tests never seen before.
3. Filed a P2 friction item, then created and claimed a new cell `rel1710rc-3` ("Harden lock/race suite scenarios for 2-core CI runners"), and dispatched it to a sonnet Agent worker (nickname `w-cpuflake`) to fix `scripts/test_store_lock.mjs` scenario (f)/(c) and `scripts/test_claim_race.mjs` scenario (d) plus sweep `scripts/test_worktree_holds_race.mjs`.
4. Transcript window ends with the session on a heartbeat loop waiting on that worker; last event shows `w-cpuflake` had reserved 4 files (`scripts/test_store_lock.mjs`, `scripts/test_claim_race.mjs`, `scripts/test_worktree_holds_race.mjs`, `.bee/bin/lib/claims.mjs`) under cell `rel1710rc-3`, cell still uncapped, reservations still active — session crashed/interrupted here, mid-execution of `rel1710rc-3`. The worker's in-tree edits (bounded-retry gate fix in `.bee/bin/lib/claims.mjs`, `scripts/test_claim_race.mjs` changes) were left uncommitted and unmirrored to `skills/bee-hive/templates/lib/`.

## Candidate settlements (never logged as decisions)

- Tag `v1.7.10-rc` moved to commit `05a131f` (not the original release commit `e6fcee1`) — no decision entry for "RC tag follows the CI-stabilization fix commit, not the original release commit."
- CI flakiness triage rule applied ad hoc: losing racers hitting `LockBusyError` in `test_store_lock.mjs` scenario (f) should be classified as a legitimate "refused" outcome, not a crash — a design call that changes a test's pass/fail semantics, never logged.
- Friction item filed at `.bee/backlog.jsonl` (P2, layer `tests`) for `test_claim_race` scenario (d) flake — captured, not yet resolved.

## Verify evidence seen

- Local (session): `node scripts/test_worktree_holds_race.mjs` 6/6 pass; `node scripts/run_verify.mjs` → `PASS run_verify: 54 suite(s), concurrency=5, wall=57040ms`.
- CI run `29800232965` (commit `05a131f`, first attempt): Windows green; Linux `verify (22)` FAIL — `test_claim_race` scenario (d): "no claim-store file may survive the race — every refused racer must unwind its own O_EXCL acquisition (Δ2)".
- Same run retriggered: FAIL again with a different failure — `test_store_lock` scenario (f): "2/6 past-ceiling racer(s) crashed" with `LockBusyError: lock "lock-f" busy: held by pid=5735`. Confirms two distinct, CPU-count-sensitive race flakes on the Node 22 2-core Linux runner, not reproduced locally.
- No verify evidence exists for cell `rel1710rc-3`'s fix (worker still in progress when the window ends).

## Suggested next action

Resume/re-dispatch `rel1710rc-3` over the stranded in-tree work; prove `taskset -c 0,1` 10/10 per the cell's must-haves; restore templates/lib mirror parity + manifest; full verify green; then re-check CI on the `v1.7.10-rc` tag commit and cap `rel1710rc-1`.
