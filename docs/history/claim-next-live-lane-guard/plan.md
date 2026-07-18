# claim-next-live-lane-guard — plan (small lane)

GitHub issue #20: "Bắt đầu có hiện tượng xọ phiên."

## Problem

`claimNextCell` (canonical `skills/bee-hive/templates/lib/cells.mjs`, cross-lane
fallback at ~`:899-933`) pools ready cells from **every** execution-approved
pipeline when the acting session's own lane has nothing ready. The pool filter
checks gate approval and file holds only — it never asks whether another **live
session is bound to that lane**. Result: session B finishes/blocks on its own
lane and immediately claims the cells session A just planned in A's lane, while
A is still live and about to execute them (the reported P48/P49 steal).

## Shape (locked)

- In the cross-lane fallback pool only: **skip any lane that has at least one
  live bound session other than the acting session.** Live = session record
  `lane === feature` and `!heartbeatStale(record)` (same
  `DEFAULT_HEARTBEAT_STALE_SECONDS` staleness rule as claim sweep — reuse the
  exported helper, no new threshold).
- Stale-owner lanes stay poolable (a dead session never fences its lane
  forever).
- Own-lane-first branch untouched. Direct `cells claim --id` untouched
  (explicit orchestrator assignment stays possible).
- Default `state.json` pipeline stays poolable: it has no binding concept;
  lanes-only ownership. Boundary recorded in the decision log; revisit only if
  it bites.
- Zero-session/zero-lane parity (D4) preserved: with no session records or no
  lanes there is nothing to skip.

## Files

- `skills/bee-hive/templates/lib/cells.mjs` (guard in `claimNextCell`)
- `skills/bee-hive/templates/lib/claims.mjs` (only if a small list-sessions
  helper is missing; prefer reusing existing exports)
- `skills/bee-hive/templates/tests/test_lib.mjs` (fsh-11 section: new rows)
- Byte mirrors: `.bee/bin/lib/*`, `.claude/skills/bee-hive/templates/lib/*`,
  `.agents/skills/bee-hive/templates/lib/*`
- **Deferred finishing step (paths held by another live session until ~09:30Z):**
  `.claude-plugin/skills/...`/`.codex-plugin/skills/...` lib copies +
  `docs/history/codex-harness-hardening/release-manifest.json` regeneration.

## Verify

Cell-scoped: `node skills/bee-hive/templates/tests/test_lib.mjs && node scripts/test_lib_mirror.mjs`
Close-out: full configured `commands.verify` after the deferred plugin/manifest sync.

## Reality check (inline, 2 min)

- `heartbeatStale` exported in `claims.mjs:122-128`; sweep already trusts it.
- Session records carry optional `lane` (`bindSessionLane`, `claims.mjs:137-147`).
- fsh-11 test section already builds lane/session fixtures — new rows slot in.
- The existing test "own bound lane's ready cell wins over a backlog-favored
  other approved lane" proves fixtures for cross-lane pools exist and pass.
