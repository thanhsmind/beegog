# Plan — multi-session-hardening (high-risk)

CONTEXT.md D1-D7 are the authority. Six cells, dependency-ordered. Every cell
touching `templates/lib/` syncs `.bee/bin/lib/` byte-identical AND runs
`release_manifest.mjs --check` in its own verify (critical-patterns 20260715 +
20260719 recurrence — the manifest regen ships inside the cell, wave-safe:
regen only in msh-6, earlier cells assert check-red documented OR regen+check
when they are the last lib-touching cell of their wave; simplest honest rule:
each lib-touching cell runs `release_manifest.mjs --write` then `--check` so
the tree it commits is always manifest-green).

Freeze-first (critical-patterns 20260716): before editing `claims.mjs`,
`reservations.mjs`, `cells.mjs`, or `state.mjs`, the touching cell runs the
relevant existing suites green and records the output.

## Cells

- **msh-1 (D2 primitive)** — `withStoreLock(root, name, fn)` in a new
  `templates/lib/lock.mjs` (+ mirror): O_EXCL acquire, bounded retry/backoff,
  30s stale takeover, holder metadata, typed `LOCK_BUSY`, always-release.
  Forked-racer selftest (child-orchestrator pattern, single spawnSync row) in
  `templates/tests/test_lib.mjs` or a dedicated `scripts/test_store_lock.mjs`
  added to the verify chain. `.bee/locks/` gitignored (runtime tier).
- **msh-2 (D1+D3 claims)** — `cells claim --id` re-backed by `claimCellFile`
  (wx) + typed CLAIMED refusal naming owner/expiry; session-id resolution
  helper (flag → `CLAUDE_CODE_SESSION_ID` → payload → absent) exported for
  all verbs; forked-racer claim test (N racers, 1 winner). deps: msh-1.
- **msh-3 (D2+D3 reservations)** — `reserve`/`release`/`sweep` RMW inside
  `withStoreLock('reservations')`; session auto-derive on reserve; racer test
  (no lost update; overlap single-winner). deps: msh-1, msh-2 (shares the
  session helper).
- **msh-4 (D4 mutator ownership)** — verify/cap/block/unclaim/reopen (+update
  on claimed cells) check live-claim session vs caller (D3); expired/no-claim
  proceeds; `--force-ownership` audited into trace. Test rows for all three
  branches. deps: msh-2.
- **msh-5 (D5+D6 heartbeat/lease + state lock)** — `heartbeatTouch` (60s
  throttle) called from `bee-prompt-context.mjs` + `bee-state-sync.mjs`,
  renewing session heartbeat + live claim/hold TTLs, fail-open preserved;
  state logical-RMW verbs wrapped in `withStoreLock('state')`. Tests: throttle
  no-op, refresh+renew, hook-green-on-throw; existing
  test_state_write_concurrency stays green. deps: msh-1, msh-2, msh-3.
- **msh-6 (D1/D3 doctrine + close)** — skill text updates (`bee-executing`
  SKILL.md + worker-details, `bee-swarming` SKILL.md + swarming-reference):
  orchestrator claims before spawn, workers validate, ids self-derived;
  render projections + final `release_manifest.mjs --write`; conformance/
  census suites green. deps: msh-2, msh-3, msh-4, msh-5.

## Verify (per cell + close)

Cell verifies name their exact suites (see cell records). Close = full
configured verify chain green.

## Risks

- A lock bug can wedge every CLI verb → stale takeover + LOCK_BUSY naming the
  holder + the lock guards CLI verbs only (hooks never take it).
- A false ownership refusal can strand a cell → expired-claim pass-through +
  `--force-ownership` door.
- Hook edits are fail-open-critical → touch wrapped in its own try/catch;
  hook-contract tests must stay green (test_hook_contracts).
