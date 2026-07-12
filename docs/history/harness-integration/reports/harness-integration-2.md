# harness-integration-2 — `bee.mjs` unified dispatcher

**Status:** DONE
**Worker:** worker-w2
**Outcome:** Built `skills/bee-hive/templates/bee.mjs`, a thin dispatcher that imports the same `lib/*.mjs` functions the 4 existing entrypoints already import (D5) — parses `bee <group> [<action>] [--flags]`, validates via `validate-args.mjs` against the harness-integration-1 registry, and on a valid call reimplements each existing CLI's own output-formatting logic against those lib functions (byte-identical parity, verified by diffing stdout against `bee_status.mjs`, `bee_cells.mjs ready`, `bee_reservations.mjs list`, `bee_decisions.mjs active`). Adds `--help` / `--help --json` (D3 tool-schema manifest, `helper` field stripped), a Levenshtein nearest-match suggestion for an unrecognized command, sha256 manifest content-hash drift tracking (`.bee/manifest-hash.json`, `manifest_changed` only appears in the response when true), and the deprecated/`use_instead` redirect dispatch logic. Extended `tests/test_bee_cli.mjs` with 35 new checks (12 pure-logic unit tests + 23 end-to-end dispatcher checks in a second isolated temp repo). 67/67 passing; zero regression (`test_lib.mjs` 124/124, `test_onboard_bee.mjs` unaffected).

**Files touched:**
- `skills/bee-hive/templates/bee.mjs` (new)
- `skills/bee-hive/templates/tests/test_bee_cli.mjs` (extended — cell harness-integration-1's file)

**Verify:** `node skills/bee-hive/templates/tests/test_bee_cli.mjs` — 67 passed, 0 failed.

**Deviations:** none required. One documented note: `command-registry.mjs`'s own header comment (written under cell harness-integration-1) describes an earlier "spawnSync the helper script" delegation idea that predates the CORRECTED MECHANISM both CONTEXT.md's D5 and this cell's own action text lock in ("import lib functions directly"). That comment is stale documentation inside an already-capped cell, out of this cell's file scope to fix — flagged here so a future reader isn't misled by it (friction: stale/contradictory doc).

Full trace/evidence: `.bee/cells/harness-integration-2.json`.
