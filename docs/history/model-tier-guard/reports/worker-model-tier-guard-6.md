# worker report — model-tier-guard-6

[DONE] — Fixed P1-4 in `skills/bee-hive/scripts/test_onboard_bee.mjs` only.

## Outcome

Replaced the weak string-containment check on the serialized `.claude/settings.json`
with structural parsing of `settings.hooks.PreToolUse` after `--repo-hooks apply`:
exactly one entry with matcher `Agent|Task` wired to `bee-model-guard.mjs`, exactly
one entry with the byte-identical write-guard matcher wired to `bee-write-guard.mjs`,
and a full-tree scan proving `bee-model-guard.mjs` appears nowhere else. Extended the
second-apply idempotence check to also count the `Agent|Task` entry (not just a
`bee-session-init.mjs` substring count). Added a plugin↔repo parity check comparing
`hooks/hooks.json` against `renderRepoHookEntries()`'s applied output as normalized
`(event, matcher, filename)` triples — parity holds, no mismatch found (no
`onboard_bee.mjs` or `hooks/hooks.json` changes were needed or made).

Proved the new/extended assertions bite: temporarily broke all three (wrong matcher
`'Agent'`, wrong idempotence count `2`, an injected bogus parity triple), reran the
suite → red (`failures: 3, skipped: 1`, 3 named FAIL lines), then restored the exact
original edit (diff-verified byte-identical) and reran green.

## Files touched

- `skills/bee-hive/scripts/test_onboard_bee.mjs`

## Verification

`node skills/bee-hive/scripts/test_onboard_bee.mjs && node skills/bee-hive/templates/tests/test_lib.mjs`
→ passed (test_onboard_bee.mjs: 0 failures, 1 pre-existing skip; test_lib.mjs: 124
passed, 0 failed). Full trace, verify output, and `verification_evidence`
(red-failure proof + before/after characterization) recorded on the cell:
`.bee/cells/model-tier-guard-6.json`.

## Commit

`d98a730` — `fix(model-tier-guard-6): structural PreToolUse wiring + parity assertions in test_onboard_bee.mjs`
