# Cell report — backlog-submit-command-1

**Status:** [DONE]
**Outcome:** Added `bee backlog propose --story --cos [--feature] [--json]`: `proposePbiRow` (lib/backlog.mjs) scans the whole `docs/backlog.md` table for the highest existing `P<n>` id and appends a new `proposed` row at max+1 (never backfilling a gap); `handleBacklogPropose` (bee.mjs) validates `--story`/`--cos` before any write and defaults `--feature` to `—`; registered as `backlog.propose` in `command-registry.mjs` and `HANDLERS`; mirrored to `.bee/bin/**`, `.claude-plugin/**`, `.codex-plugin/**`, `.claude/**`, `.agents/**` and byte-verified.

**Files touched:**
- `skills/bee-hive/templates/lib/backlog.mjs` — `proposePbiRow`
- `skills/bee-hive/templates/lib/command-registry.mjs` — `backlog.propose` entry
- `skills/bee-hive/templates/bee.mjs` — `handleBacklogPropose`, `BACKLOG_MAX_STORY`/`BACKLOG_MAX_COS`, HANDLERS registration, `backlogUsageFallback` verb list
- `skills/bee-hive/templates/tests/test_cli_cells.mjs` — 8 new/updated tests (in cell scope)
- `skills/bee-hive/templates/tests/test_bee_cli.mjs` — 1 new registry-example-coverage test (deviation, not in the cell's declared `files`; see trace)

**Reservations:** released (5 reservations + 5 cross-worktree holds).
**Verification:** `node scripts/run_verify.mjs` — passed=true, recorded on the cell; full 88-suite chain run green twice in a row.

Full trace, deviations, and verification evidence: `.bee/cells/backlog-submit-command-1.json`.
