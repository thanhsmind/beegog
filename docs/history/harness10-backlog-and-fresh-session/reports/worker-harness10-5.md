# Worker Report — harness10-5

**Status:** [DONE]
**Cell:** harness10-5 — Session preamble gains a Project map section (pointers or warning)
**Worker:** forager-5
**Lane:** small (behavior_change: true)
**Decisions applied:** D5
**Commit:** one commit, subject "harness10-5: session preamble Project map section — pointers/count or bootstrap warning (D5)" (report included in the same commit)

## What changed

- `skills/bee-hive/templates/lib/inject.mjs` — new `projectMapLines(root)` helper + call in `buildSessionPreamble`, inserted after the Standard commands section and before the Critical patterns digest:
  - `### Project map` heading always present.
  - When `docs/specs/system-overview.md` and/or `docs/specs/reading-map.md` exist: one pointer line per existing map, plus a specced-area count on its own line (top-level `docs/specs/*.md` files excluding the two map files; `visuals/` never mentioned).
  - When both map files are missing: exactly one warning line — `Project map missing (Q1/Q2 unanswerable from repo) — bee-scribing bootstrap available.` Area specs alone do not suppress the warning.
  - Section is 2–4 lines including the heading (max case = heading + 2 pointers + count = exactly 4). Pointers only, never content. No PBI counts (slice 4, D10). `buildPromptReminder` and inject cache logic untouched.
- `skills/bee-hive/templates/tests/test_lib.mjs` — 4 new tests under a "project map preamble section (harness10-5, D5)" section:
  - single warning line when neither map exists (names Q1/Q2 and bee-scribing bootstrap)
  - warning still fires with area specs present but no maps
  - single pointer + count line when only one map exists
  - both pointers + count within exactly 4 lines when both maps exist; asserts no `PBI` and no `visuals` text in the whole preamble
  - Every fixture writes under the shared test root's `docs/specs/` and removes it in `try/finally` (order-safe cleanup per validation constraint).

## Verify

Command (recorded via `bee_cells.mjs verify --output-file`):

```
node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/scripts/test_onboard_bee.mjs
```

Output tail:

```
51 passed, 0 failed
...
PASS - failures: 0, skipped: 0
```

Red evidence (change stashed): the 4 new tests fail with "Project map heading always present" — `47 passed, 4 failed`; restored → `51 passed, 0 failed`.

## Files changed

- skills/bee-hive/templates/lib/inject.mjs
- skills/bee-hive/templates/tests/test_lib.mjs

## Deviations

None.

## Notes

- The repo's vendored copy `.bee/bin/lib/inject.mjs` intentionally NOT touched — per established convention (harness10-1..4 also changed templates only; vendored sync happens via a re-onboard cell like harness09-4).
- Reservations released; one commit with cell id.
