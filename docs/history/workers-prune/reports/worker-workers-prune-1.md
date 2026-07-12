# workers-prune-1 — bee_state.mjs `worker prune`

Solo execution (small lane), worker: kevin (in-session).

## What shipped

- `node .bee/bin/bee_state.mjs worker prune [--dry-run] [--json]` — deletes stale dispatch
  transients from `.bee/workers/`. Prunable = filename matches the transient suffix set
  (`.prompt.md`, `.result.md`, `.result.json`, `.out*.log`, `.log`) AND stem is no active
  worker's cell AND the cell (`.bee/cells/<stem>.json`), when present, is `capped`.
  Everything else — evidence snapshots, cell payloads, subdirectories — is never touched.
- Safety: `readStateStrict` before any `rm` (corrupt state = loud fail, zero deletions);
  prune never writes `state.json`; missing `.bee/workers/` is success with 0 pruned;
  an unreadable cell file counts as not-capped (keep, don't guess).
- `parseArgs` fix ridden along: `--dry-run` is a boolean flag — before the fix it consumed
  the next flag as its value (`--dry-run --json` silently ate `--json`); the new dry-run
  test caught it red before it shipped.
- Wiring: swarming-reference.md "Transient hygiene" — at feature close (after review
  acceptance, before the closing commit) the orchestrator runs `worker prune`.

## Evidence

- Suite: `node skills/bee-hive/templates/tests/test_lib.mjs` → **153 passed, 0 failed**
  (4 new prune checks; standing template↔vendor byte-equality sweep green after re-vendor).
- RED proof: stashing the two `bee_state.mjs` copies (tests kept) → **150 passed, 3 failed**,
  all three the new prune checks; pop → green.
- Live proof on this repo: `--dry-run` listed 64 candidates / 0 kept-active; real run
  `Pruned 64 worker transient(s)`; survivors exactly `mtg-settings-pre.json` +
  `release-0120-cell.json`; `.bee/workers/` 2.8M → 12K.

Full verification evidence lives in the cell trace (`.bee/cells/workers-prune-1.json`), the single source.
