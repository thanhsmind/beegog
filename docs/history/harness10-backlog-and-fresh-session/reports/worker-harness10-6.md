# Worker report — harness10-6

Status: [DONE]

## Cell
harness10-6 — Backlog parser + PBI counts in bee_status and preamble + optional pbi field on cells (lane: small, behavior_change: true; decisions D6, D9, D10; also honors D7).

## Files changed
- `skills/bee-hive/templates/lib/backlog.mjs` (new) — `readBacklogCounts(root)` and the exported `BACKLOG_STATUSES` enum.
- `skills/bee-hive/templates/bee_status.mjs` — `pbi` field in `--json`, one human `PBI:` line in text output.
- `skills/bee-hive/templates/lib/inject.mjs` — imports `readBacklogCounts`; project-map section appends one PBI line (both branches) when `docs/backlog.md` exists; cap comment updated to 2–5 lines.
- `skills/bee-hive/templates/lib/cells.mjs` — `addCell` accepts an optional `pbi` string, rejects non-string, no validation coupling.
- `skills/bee-hive/templates/tests/test_lib.mjs` — repurposed the two existing project-map assertions (~540 → 5-line max case; ~544 → PBI absent when backlog missing) and added the backlog-parser, cells-pbi, and drift-guard tests.

## What was built
1. **Parser (D6, D7):** `readBacklogCounts` reads only the Status column, located by header name (case-insensitive) so extra/reordered columns survive; strips bold/italic/code markup preserving the `in-flight` hyphen; skips rows with unknown status or missing the Status cell without throwing; counts duplicate IDs honestly (row-by-row). Returns `{proposed, inFlight, done, total}`, or `null` only when the file is absent. Read-only — never writes backlog (D7). The count-object keys are derived from `BACKLOG_STATUSES`, so the enum is the single source of truth.
2. **Surfacing (D10):** `bee_status` JSON gains `pbi: {proposed, in_flight, done}` (or null) plus a text `PBI: N done / N in-flight / N proposed` line; the preamble appends the same line inside the Project map section (both the pointer and warning branches) only when `docs/backlog.md` exists.
3. **Optional cell field (D9):** `addCell` persists `pbi` verbatim and rejects only non-string values — no new cap/claim refusal path; cap ignores it entirely.

## Verify
Command: `node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/scripts/test_onboard_bee.mjs`
Output tail:
```
59 passed, 0 failed
PASS - failures: 0, skipped: 0
```
Both exit 0 (test_lib.mjs went 51→59 passing with the 8 new/repurposed cases).

End-to-end drive (template code, real fixture):
- No `docs/backlog.md` → `bee_status --json` `pbi: null`, no PBI text/preamble line.
- Backlog with 1 done / 1 in-flight / 2 proposed → JSON `{"proposed":2,"in_flight":1,"done":1}`, text `PBI: 1 done / 1 in-flight / 2 proposed`, preamble line identical (verified in both the warning and pointer branches).

## Deviations
None. Implemented within locked bounds; the two existing assertions were repurposed (not deleted) per the validation constraint.

## Notes
- Vendored `.bee/bin` still runs the pre-change templates; picking up these template changes in this repo is harness10-8's dogfood-sync job (not in scope here).
