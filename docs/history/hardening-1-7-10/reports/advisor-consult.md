# Advisor consult — hardening-1-7-10 Gate 3 precondition

Adviser: fable (config `models.claude.advisor`), review-class read-only dispatch, 2026-07-21.
Evidence bundle: CONTEXT.md D1-D9 summary, risk map, validation findings (no session history).

## Advice head

No hard veto. Three required amendments before execution opens:

1. **D2 (lock takeover):** HARD_STALE_MS must be gated on liveness — a provably-alive pid is
   never stolen below the ceiling, and the ceiling must sit far above worst-case verify duration
   (accepted: 1 h). Confirmed from code that the timer-heartbeat rejection is correct:
   `worktree-store.mjs:966` wraps the merge (verify `spawnSync` at `:936` scope) inside
   `withStoreLock`, so the event loop is blocked. EPERM=alive needs an explicit unit case.
2. **D4 (archive txn):** `writeCell` is synchronous (`cells.mjs:689`) and `withStoreLock` is
   async — the planned boundary lock must NOT cascade writeCell to async (call-site
   `cells.mjs:859` maps it synchronously). Accepted: sync single-attempt O_EXCL acquire with
   typed `CELLS_ARCHIVE_BUSY` on contention. Confirmed archive/unarchive never call writeCell
   (`cells.mjs:594-602`, `655-661`) — no re-entrancy.
3. **D7 (judge reopen):** capped→open must also clear/reconcile the claims-store claim
   (orphaned cross-session-lock hazard documented at `cells.mjs:1911-1921`); verdict matrix
   confirmed deadlock-free for post-rework re-cap (`cells.mjs:1185`, `:1191`, append-only ledger
   at `:1884`).

Missing coverage added to cells: merge-level no-steal-during-long-verify regression (1710-2),
different-session re-claim after reopen (1710-7), EPERM=alive unit (1710-2).

Riskiest cell: 1710-4 (sync/async boundary of writeCell; lock non-reentrancy; batch-path cost).

All three amendments were accepted and folded into cells 1710-2/1710-4/1710-7 and decision log
before Gate 3 approval.
