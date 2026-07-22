---
type: bee.area
title: "Worktree Parallelism — the shared holds ledger that makes an island's writes visible"
description: "One path-keyed ledger in the main store that mirrors every reservation, acquired under a single lock so two checkouts can never both believe they hold a path, renewed by a live session's heartbeat, read by three taps that all refuse the same way, and released by cell rather than by holder."
timestamp: 2026-07-22
bee:
  id: worktree-parallelism-cross-worktree-holds
  lifecycle: active
  areas: [worktree-parallelism]
  required_context: [areas/worktree-parallelism/the-trust-model.md]
  decisions: ["cross-worktree-holds D1-D6 (the shared ledger, 2026-07-20)", "hardening-1-7-10 (acquisition is one atomic step; holds renew on heartbeat, 2026-07-21)", "a0ab91b6 (release is scoped by cell, never by holder alone — live incident)"]
  sources: [docs/history/worktree-feature-parallelism/, "docs/specs/worktree-parallelism.md#S-cross-worktree-holds-the-shared-ledger-cross-worktree-holds-d1-d6-2026-07-20"]
  authoritative_for: "worktree-parallelism: the cross-worktree holds ledger, its acquisition, renewal, taps and release"
---

# Worktree Parallelism — Cross-Worktree Holds

A granted worktree's store is an island by design — which used to mean its reservations were
invisible to main and to sibling worktrees, and overlapping edits surfaced only at merge. The
shared holds ledger closes that gap at WRITE time:

## Cross-worktree holds (the shared ledger — cross-worktree-holds D1-D6, 2026-07-20)

- **One ledger, main store only:** `<mainRoot>/.bee/runtime/cross-worktree-holds.json`,
  beside the grant registry (same trust model: the main store is the authority; a worktree
  reaches it via `resolveRoots().mainRoot`). Path-keyed rows
  `{holder, feature, session, cell, acquired_at, expires_at}`; holder is the git-verified
  worktree id or `"main"`. TTL-expired rows are pruned on every read; all mutations run under
  the main store's `cross-worktree-holds` lock with atomic tmp+rename writes.
- **Mirror on reserve:** a reservation in any checkout mirrors into the ledger (an ungranted
  linked worktree never double-mirrors — its reservations already live in the shared store).
  Before reserving, the seam consults the ledger and refuses with a typed `FOREIGN_HOLD`
  result naming the holding checkout, feature, and expiry.
- **Acquisition is one atomic step, not three sequential ones (hardening-1-7-10).** Checking
  the ledger for a conflicting foreign hold, reserving the path in the local (worktree or
  main) store, and inserting the mirrored row into the shared ledger all run under the SAME
  single lock acquisition at the main root — never as separate lock-check, lock-reserve,
  lock-insert steps that could interleave with another checkout's attempt on the identical
  path. Two checkouts racing the same path can therefore never both come away believing they
  hold it; exactly one wins, and the loser gets the typed `FOREIGN_HOLD` refusal instead of a
  hold it does not actually have.
- **Holds renew, not just expire (hardening-1-7-10).** A hold's TTL ceiling (1 hour) is the
  same failure-recovery backstop as before, but a live session's own heartbeat now refreshes
  the timestamp on every cross-worktree hold it owns — a try-once refresh that never blocks
  the session's primary work. A long-running live worker therefore keeps its holds protected
  for as long as it stays genuinely active; TTL expiry now fires only for a session that has
  actually gone silent (a dead or abandoned worker), not for one still working past the old
  fixed ceiling.
- **Three read taps, one voice:** (1) `reservations reserve` — typed refusal before any local
  row is written; (2) `claim-next` — silently skips a cell whose declared files overlap a
  foreign hold, so a session always picks conflict-free work instead of waiting; (3) the
  write-guard — denies a write to a foreign-held path, naming holder + feature + expiry,
  phase-independent, added net-first (frozen 26-row green before the edit, 31/31 after).
- **Release is scoped by cell, never by holder alone.** All agents in the main checkout share
  `holder:"main"`; an early cut that released by holder wiped a concurrent worker's mirrored
  holds (live incident, same day, decision a0ab91b6). Release derives the acting agent's own
  active cell ids and clears exactly those rows. Worktree merge `--cleanup` releases every
  row for the removed worktree id, best-effort after the grant is removed.
- **Failure discipline:** missing ledger = empty (byte-identical to pre-ledger behavior);
  unparseable ledger = typed deny (`worktree-holds-unreadable`, mirroring the reservation
  corrupt-store rule); unresolvable topology = fail-open with crash-log. Both runtime files
  (`cross-worktree-holds.json`, `worktree-grants.json`) are direct-edit-denied in every
  phase — CLI-only writes.
- **Waiting model:** fail-fast, never blocking — a refusal names who and until when; the
  session takes other open work (`claim-next` already routed it away) and the hold lapses by
  TTL if its owner dies. The merge verify-gate stays as the final semantic net.
