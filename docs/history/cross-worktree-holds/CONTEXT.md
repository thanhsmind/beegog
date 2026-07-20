# cross-worktree-holds — CONTEXT

Locked decisions for making granted worktrees "wait for each other" at write
time instead of discovering conflicts at merge time.

## Problem

`resolveRoots` (state.mjs:750) gives a GRANTED worktree its own isolated
`.bee/` store. From that moment its claims, reservations, and locks are
invisible to main and to every other granted worktree. The only remaining
coordination is the merge verify-gate — conflict detection at the END of
execution, not at write time. Ungranted worktrees and same-checkout sessions
already coordinate through the shared main store (claims/reservations/holds);
the granted-worktree island is the one gap. User directive (2026-07-20):
"giải quyết triệt để phần đợi chờ nhau này để tăng tốc làm việc."

## Locked decisions

- **D1 — Shared ledger location.** One cross-checkout holds ledger at the
  MAIN store: `.bee/runtime/cross-worktree-holds.json`, beside
  `worktree-grants.json` (which set the precedent: grant data lives ONLY in
  the main store). Every session can address it because `resolveRoots`
  already computes `mainRoot` from any linked worktree. The ledger is the
  cross-STORE view only; each store's internal per-agent reservation logic is
  unchanged.
- **D2 — Entry shape + TTL.** Keyed by repo-relative path. Entry:
  `{holder, feature, session_id, acquired_at, expires_at}` where `holder` is
  the granted worktree id or `"main"`. Entries expire by TTL and are pruned
  on every read; a lapsed hold never blocks. TTL default aligns with the
  existing claims/session expiry precedent in the codebase (validating pins
  the exact constant).
- **D3 — Acquisition rides the reservation seam.** `reservations reserve`
  mirrors the path into the shared ledger (holder = this checkout);
  `release` removes it; `worktree merge --cleanup` / worktree removal
  release every entry for that worktree id. Conflict rule at reserve time:
  refuse when the ledger holds the path for a DIFFERENT live checkout, with
  a typed refusal naming holder + expiry (same language as rule 14).
  Same-checkout conflicts stay with the local store's finer-grained logic.
- **D4 — Fail-fast, never blocking waits.** A denied write/reserve returns
  `[BLOCKED]` naming holder + expiry; the session picks other open work
  (`claim-next` skips cells whose declared files are ledger-held by another
  checkout). No polling loops, no queueing.
- **D5 — Guard integration is a safety net, fail-open, net-first.** The
  write-guard consults the ledger only for paths held by another checkout.
  Per the frozen-green critical pattern (20260716): a byte-for-byte
  regression net over the guard decision table is frozen GREEN before the
  edit; a guard bug that over-denies can lock a session out of its own fix.
  Guard stays fail-open on ledger read errors (crash-log, allow).
- **D6 — Merge gate unchanged.** The staged merge + verify semantic-conflict
  gate stays exactly as is; the ledger reduces conflicts before they are
  written, it does not replace the final net.
- **D7 — Lane-first doctrine.** Exploring/planning/validating for a new
  feature in an occupied checkout ride a LANE on the shared store (already
  supported); a worktree grant is taken only at Gate 3 when source edits
  actually begin in parallel. Captured into the worktree-parallelism spec at
  scribing; keeps most work on live shared coordination.

## Out of scope

- A supervisor/orchestrator process above Claude sessions (external layer,
  not bee code).
- Cross-worktree read visibility (isolation is intentional; digests + merge
  gate remain the interface).
- Changing `resolveRoots` store selection (P40 byte-frozen default).

## Sources

- Conversation analysis 2026-07-20 (session digest of state.mjs:695-757,
  worktree-store.mjs:417-543/868-1048, claims/reservations path resolution).
- docs/specs/worktree-parallelism.md; multi-session-hardening feature
  (claims/holds precedent); rule 14 (AGENTS.md).
