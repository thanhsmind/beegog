---
type: bee.area
title: Workflow State — cross-session file holds and the coordination lock behind every shared write
description: "The write-time refusal that names the live session holding a path and when its hold expires, and the bounded-wait lock every shared coordination store's read-modify-write body runs inside — including exactly when a stale holder may be taken over and when it may not."
timestamp: 2026-07-22
bee:
  id: workflow-state-holds-and-the-coordination-lock
  lifecycle: active
  areas: [workflow-state]
  required_context: [areas/workflow-state/overview.md]
  decisions: ["multi-session-hardening D2 with Δ1/Δ3 amendments (the coordination lock: verbs wait bounded, checkpoints try once)", "fresh-session-handoff D3 (a write into another live session's held path is refused at write time)", hardening-1-7-10 (liveness-probed stale takeover with a one-hour pid-reuse ceiling; no timer heartbeat by design)]
  sources: ["fresh-session-handoff cells fsh-7/fsh-8 (phase-independent deny + fail-closed corrupt-store branch; validation-s3, 2026-07-13)", "multi-session-hardening cells msh-1..7 (coordination lock primitive and forked-racer suites, 2026-07-19)", hardening-1-7-10 cells 1710-1..1710-11 (2026-07-21), "docs/specs/workflow-state.md#B14", "docs/specs/workflow-state.md#B21", "docs/specs/workflow-state.md#R37", "docs/specs/workflow-state.md#R52", "docs/specs/workflow-state.md#P15"]
  authoritative_for: "workflow-state: cross-session file holds and the shared-store coordination lock"
---

# Workflow State — cross-session file holds and the coordination lock behind every shared write

Two guards keep concurrent work from quietly destroying each other. One is
visible to the person writing: a path another live session holds is refused at
write time, naming the holder and when the hold lapses. The other is invisible
until it is missing: every shared store's read-modify-write body runs inside a
lock, and a holder that is merely old is a takeover *candidate*, never an
automatic steal.

## Behaviors & Operations

**B14 — A write into another live session's held path is refused at write
time.** Trigger: any write attempt while the acting session's identity is
known. What happens: when the path overlaps a hold owned by a *different*
session that is still live (within its lifetime), the write is refused with a
typed message naming the holder — its session and its worker name — and when
the hold expires. What never blocks: the acting session's own holds, expired
holds, and legacy holds that predate session ownership (they carry no owning
session and keep their original worker-level meaning). The refusal is
unconditional on workflow phase — it fires in every phase, including mid-
execution. When the hold ledger exists but cannot be read, a session-aware
write is refused (fail-closed, as a returned refusal that survives the
guard's fail-open crash handling — never a thrown error, which the guard
would swallow into an allow); a ledger that simply does not exist blocks
nothing. What each actor observes: the blocked session gets the who-and-until
message and stays healthy (free to pick other work); the holding session is
undisturbed; a repo with no session-owned holds behaves exactly as before
(fresh-session-handoff D3).

**B21 — A shared coordination store serializes its own concurrent writes.**
Trigger: two or more sessions attempt a read-modify-write against the same
shared coordination store (a hold ledger, the durable workflow record) at the
same moment. What happens: each read-modify-write body runs inside that
store's coordination lock (Data Dictionary) — acquired by exclusive creation
with bounded retry, and a stale holder is taken over by an atomic handoff
rather than an unconditional removal, so a waiter can never delete a fresh
holder's lock out from under it; staleness is re-verified at every retry,
never cached. Crossing the ordinary staleness age only makes a holder a
takeover candidate: the actual steal requires either a liveness probe to find
the recorded owner process provably dead (a probe that comes back
permission-denied still counts as alive, never as dead — an inconclusive
answer is never license to steal) or an absolute one-hour ceiling to have
passed regardless of what the probe reports, guarding against a reused pid
being mistaken for the original owner. A holder that is genuinely still alive
therefore keeps the lock legitimately across a long synchronous child spawn —
a worktree merge running its verify command is the motivating case — for as
long as the ceiling allows; no timer heartbeat renews the hold from inside the
holder by design, since the holder's own synchronous child spawns already
block the event loop a timer would need (hardening-1-7-10). A command-line
verb waits for the lock, bounded; a lifecycle checkpoint never waits — it
tries once and, if busy, skips its own update silently, preserving the
checkpoint's existing fail-open discipline. On a genuine timeout the caller
receives the typed `LOCK_BUSY` refusal naming the current holder — never a
silent fall-through to an unlocked write, because mutual exclusion is the
entire point. What each actor observes: no hold and no
coordination-record write is ever silently dropped by a second concurrent
writer; a checkpoint that loses the race simply skips one opportunistic
refresh, with the next one along shortly (D2).

## Business Rules

- R37 — A shared coordination store's read-modify-write body always serializes
  through its coordination lock: a command-line verb waits (bounded), a
  lifecycle checkpoint tries once and skips silently on contention — never a
  fall-through to an unlocked write (multi-session-hardening D2, Δ1/Δ3-amended).
- R52 — A stale coordination-lock holder is a takeover candidate only; the
  steal itself requires a liveness probe to find the recorded owner provably
  dead (a permission-denied answer counts as alive) or an absolute one-hour
  ceiling to have passed regardless of the probe, so a genuinely live holder
  keeps the lock across a long synchronous child spawn and no timer heartbeat
  is needed or attempted (hardening-1-7-10).

## Pointers (implementation)

- Hold enforcement (B14): `findSessionConflicts` + optional `session` field in
  `skills/bee-hive/templates/lib/reservations.mjs`; phase-independent deny +
  fail-closed corrupt-store branch in `lib/guards.mjs` `checkWrite`;
  `payload.session_id` threaded at `hooks/bee-write-guard.mjs`; `--session` on
  the reservations verb. Evidence: traces `.bee/cells/fsh-{7,8}.json`, commits
  255757d, 4969e8c; `docs/history/fresh-session-handoff/reports/validation-s3.md`.
