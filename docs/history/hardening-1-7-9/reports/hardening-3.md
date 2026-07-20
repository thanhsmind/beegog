# hardening-3

**[DONE]** — Judge: cross-check verdict vs checks + NEEDS_REVISION reopens a capped cell.

- `validateJudgeVerdict` (judge.mjs) now rejects a `PASS` verdict carrying a `FAIL` check, and a `NEEDS_REVISION` verdict with zero `FAIL` checks — the verdict must agree with the checks it summarizes.
- `recordJudgeVerdict` (cells.mjs) now reopens a `capped` cell to `claimed` (rework) when a `NEEDS_REVISION` verdict is recorded against it, logged in `trace.reopened_for_rework` and audited via `logDecision`. Reuses the existing `claimed` status — no new `CELL_STATUSES` value. PASS verdicts, and NEEDS_REVISION on a non-capped cell, are unchanged.
- `recordJudgeVerdict` is now `withStoreLock`-wrapped (async) so the status flip is a safe read-check-write; its sole CLI caller (`handleCellsJudgeRecord` in both `skills/bee-hive/templates/bee.mjs` and its `.bee/bin/bee.mjs` mirror) and every `test_lib.mjs` call site were updated to `await` it.
- Regression net added to `test_lib.mjs`, confirmed RED against the pre-fix implementation (420 passed / 2 failed — exactly the two new tests) then GREEN after (422 passed / 0 failed) by temporarily `git stash`-reverting the six implementation files and re-running.

Files touched: `skills/bee-hive/templates/lib/judge.mjs`, `.bee/bin/lib/judge.mjs`, `skills/bee-hive/templates/lib/cells.mjs`, `.bee/bin/lib/cells.mjs`, `skills/bee-hive/templates/bee.mjs`, `.bee/bin/bee.mjs`, `skills/bee-hive/templates/tests/test_lib.mjs`. Plugin skill trees re-rendered (`scripts/render_plugin_skill_trees.mjs`) and the release manifest regenerated (`scripts/release_manifest.mjs --write`) to pick up the `test_lib.mjs` change.

Full trace/evidence: `.bee/cells/hardening-3.json`.
