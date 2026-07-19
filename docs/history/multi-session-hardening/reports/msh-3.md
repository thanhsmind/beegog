# msh-3 — reservations RMW under store lock + session auto-derive (D2+D3)

**Status:** [DONE] — capped, verified green, one commit.

**Outcome:** `reserve()`/`release()`/`sweepExpired()` (`reservations.mjs`) now
run their read-check-write body inside `withStoreLock(root, 'reservations',
fn)` (the `lock.mjs` primitive shipped by msh-1), with the conflict check
re-read fresh under the lock — two concurrent reserves can no longer both pass
the conflict check against the same snapshot and have the later write
silently drop the earlier hold. `reserve()` self-derives the session via
`resolveSessionId` (msh-2's helper) when `--session` is absent, so a
top-level-session reserve becomes cross-session-visible by default; a
genuinely absent id (no flag, no env) still writes a session-less row,
byte-identical to today's shape. A `LockBusyError` timeout surfaces through
the existing generic CLI error path, naming the holder pid/session/timestamp.

**Files touched:** see `.bee/cells/msh-3.json` `trace.files_changed` for the
full list (includes one file outside the cell's originally declared scope —
`skills/bee-hive/templates/tests/test_lib.mjs` — auto-fixed and explained in
`trace.deviations`: making the reservation verbs async required `main()` and
its handler dispatch in `bee.mjs` to await, which in turn required 19
in-process call sites in that test file to gain `await`, plus two assertion
blocks to isolate `CLAUDE_CODE_SESSION_ID` so D3's env auto-derive doesn't
leak the live worker session into a "session-less" fixture expectation).

**Verification:** full trace, verify output, and `behavior_change` evidence
(including the deliberate-red falsifiability run) live in
`.bee/cells/msh-3.json`. New permanent regression guard:
`scripts/test_reservation_race.mjs` (forked child-orchestrator: distinct-path
reserves all survive, same-path reserves produce exactly one winner plus
typed conflicts, and an unlocked proxy reproduces the pre-fix lost update).

**Deviations / design notes:** three entries in `trace.deviations` — the
async-propagation fix to `test_lib.mjs`'s 19 reservation call sites, the
`CLAUDE_CODE_SESSION_ID` isolation fix to two "session-less" test fixtures,
and a design note on making `main()`/the handler dispatch async (contained:
`main()` had exactly one caller — the direct-run guard — and no other
importer in the repo).

**Reservations:** released.
