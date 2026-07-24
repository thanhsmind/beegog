# wv-1 done-report — CLI self-timing (orchestrator-authored)

Cell: `wv-1` — every `bee.mjs` run logs its wall time and prints one stderr
summary line. Capped by worker `wv1-worker`, commit `c17fa44`
(18 files changed, 599 insertions(+), 20 deletions(-) — template + byte-identical
twins/mirrors, 4 new red-first tests, regen chain).

## Worker's evidence (verbatim from its report)

- Red-first: implementation stashed, 4 new tests run against unmodified
  template → 3 failed as expected (empty stderr, ENOENT on missing log);
  restored, reran green. Recorded as `red_failure_evidence` on the cap.
- Real timing line produced during its own run:
  `{"ts":"2026-07-24T02:15:11.139Z","cmd":"reservations release","ms":19,"ok":true}`

## Orchestrator's independent verification (fresh run, this session, NOT the worker's word)

Live behavior observed on a real command:

```
$ node .bee/bin/bee.mjs cells show --id wv-1 --json > /dev/null
[bee] cells show 5ms            # stderr — stdout untouched, exit=0
$ tail -1 .bee/logs/timings.jsonl
{"ts":"2026-07-24T02:15:54.854Z","cmd":"cells show","ms":5,"ok":true}
```

Full verify chain re-run by the orchestrator:

```
271 passed, 0 failed                                    (test_bee_cli.mjs, incl. timing a-d)
PASS test_lib_mirror: templates/lib and .bee/bin/lib are byte-identical (29 files)
PASS test_lib_mirror: runtime-derived hook inventory is byte-identical (11 files)
release_manifest --check: 503 file(s) match stored manifest
ledger_parity --check: .bee/bin/** matches the .bee/onboarding.json managed-hash ledger
```

## Notes

- stdout is byte-identical for every verb (asserted by timing test a); the
  summary line is stderr-only, so every `--json` consumer is untouched.
- Log append is fail-open (timing test d): an unwritable logs dir never breaks
  a command.
- Deferred follow-up filed as PBI p-10caed3f: `timings report` verb to rank
  slowest commands from the log.
