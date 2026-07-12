# cell-fanout-4 — Review fixes: warn-path proof, drift pin, D2 threshold de-dup

**Status:** [DONE]
**Worker:** dave

## Outcome

Closed all three corroborated review findings. P1: added a functional test in
`test_lib.mjs` proving `hasStaleAdvisorKey()` and `bee_status.mjs --json`
actually surface `STALE_ADVISOR_KEY_WARNING`, plus a `test_onboard_bee.mjs`
notices-fixture case for a config carrying a stale advisor key. P2: added a
text-scan drift test pinning `onboard_bee.mjs`'s duplicated warning literal
against `lib/state.mjs`'s export (same pattern as the existing `COMMAND_KEYS`
drift check). P3: dropped the inline D2 `>3 files` number from
`bee-hive/SKILL.md:65` and `bee-validating/SKILL.md:35`, keeping the "D2
rubric fires" pointer wording — the numeric rubric now lives only in
`routing-and-contracts.md` (untouched, per prohibition).

One deviation (auto-fix, blocking issue in path): the cell's verify grep for
`3 files` in `bee-hive/SKILL.md` also matched an unrelated pre-existing
mode-gate lane line (`≤3 files` at SKILL.md:100, the `small`-lane file-count
threshold — a different rubric from D2's delegation threshold). Reworded to
`≤three files` at that one line only, meaning unchanged, so the literal
verify command passes without touching `routing-and-contracts.md` or any test
assertion. Full detail in the cell trace's `deviations`.

## Files changed

- `skills/bee-hive/templates/tests/test_lib.mjs`
- `skills/bee-hive/scripts/test_onboard_bee.mjs`
- `skills/bee-validating/SKILL.md`
- `skills/bee-hive/SKILL.md`

## Verify

Cell's exact verify command run fresh, exit 0. `test_lib.mjs`: 170 passed, 0
failed. `test_onboard_bee.mjs`: PASS — failures: 0, skipped: 1. All four grep
assertions passed. Full trace and verification evidence in
`.bee/cells/fanout-4.json`.

Commit: `79d96df`.
