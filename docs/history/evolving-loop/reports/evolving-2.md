# evolving-2 — bee_feedback.mjs CLI helper (digest / count / local collect)

**[DONE]** — capped, verify green.

Outcome: `bee_feedback.mjs` — thin CLI wrapper over `lib/feedback.mjs`, mirroring `bee_capture.mjs`'s
structure exactly (`parseArgs`/`requireFlag`/`run`/`main`, `--json`, `findRepoRoot` guard). `digest`
calls `buildDigest(root, {now})` and writes it atomically (default `.bee/feedback-digest.json`, or
`--out`), printing an entry/dropped-by-reason summary; `count` prints the same counts without
writing; `collect` returns the LOCAL digest only, through a single `buildDigest` call site that
`evolving-3` will redirect to `mergeDigests`. No collection/redaction/pain logic in the CLI.

Files changed:
- `skills/bee-hive/templates/bee_feedback.mjs` (new CLI, only file in cell scope)

Verify: `node --check skills/bee-hive/templates/bee_feedback.mjs && node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/scripts/test_onboard_bee.mjs` → node --check OK; 85 passed / 0 failed; PASS failures:0 skipped:0 (includes `.bee/bin/bee_feedback.mjs copied verbatim`, auto-covered by the existing directory-scan copied-verbatim loop — no test edits needed).

Full trace, evidence, deviations, and friction: [`.bee/cells/evolving-2.json`](../../../../.bee/cells/evolving-2.json).
