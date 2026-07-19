---
date: 2026-07-20
feature: multi-session-hardening
categories: [concurrency, coordination, verify-hygiene, worker-recovery]
severity: high
tags: [lockfile, o-excl, rename-takeover, racer-tests, claim-atomicity, session-identity, derived-artifacts, chain-wiring]
---

# Learnings — multi-session-hardening (msh-1..msh-8)

## What Happened

The five verified multi-session gaps from the 2026-07-19 audit are closed:
every claim path now rides the single-winner O_EXCL claim file (typed CLAIMED
refusal naming owner+expiry; release on every claim-clearing transition);
reservation and state read-modify-write serialize through a lockfile with
atomic-rename stale takeover; session identity self-derives at operation time;
cell mutators check claim ownership with an audited force door; heartbeat
auto-refreshes (60s throttle) with same-session lease renewal that respects
the adoption gate. Four forked-racer suites joined the standing verify chain
(33 suites, all green at close). The feature ran in its own worktree after a
fourth live coordination incident — another session's feature-start clobbered
this feature's non-terminal record through the exact state TOCTOU the feature
was built to mitigate — and the worktree isolation held for all 8 cells.

## Root Cause / What Made It Work

- **Advisor + spike were jointly load-bearing, neither alone sufficed.** The
  advisor's reasoning found the double-unlink takeover race pre-code (Δ1); the
  spike's deliberate negative control then reproduced it on this filesystem
  (7-8 "winners" of 8 racers) while the naive path's happy runs were 40/40
  clean. A happy-path suite structurally cannot see a TOCTOU race; reasoning
  alone reads as theoretical. Adversarial negative controls are the
  acceptance bar for concurrency primitives.
- **Chain wiring is a detector, not bookkeeping.** test_claim_race passed at
  msh-2's cap, silently broke when msh-4's ownership guard landed (msh-4's
  verify never re-ran sibling suites), and was caught only when msh-6 wired
  the new suites into `commands.verify` — the wiring step itself found the
  first real cross-cell interaction bug.
- **Third recurrence of derived-artifact drift, now at the render layer:**
  msh-1 shipped a new lib file + manifest regen but nobody re-rendered the
  committed plugin skill trees; red only at the close chain, fixed by msh-8.
  Same shape as 20260715 (manifest) and cnt-7 (projections). Prose has now
  failed three times — mechanization filed.
- **Worker-death recovery worked:** a worker died mid-cell on a session
  limit; its work was hand-committed with no cell id (0871734). The successor
  audited the diff against the cell's guardrail list line-by-line, completed
  only the unmet remainder (test suite, red-proof, manifest, report), and
  named the violation in the cap record instead of silently absorbing or
  redoing it.

## Recommendation

1. **When shipping a concurrency primitive, its test must include an
   adversarial negative control** (the unguarded/naive shape reproducing the
   corruption) and real forked OS processes — zero-violation green plus a
   demonstrated red is the bar; happy-path repetition proves nothing.
2. **When a cell changes shared guard/ownership/mutator logic, its own verify
   re-runs every existing suite exercising that surface** — not just its new
   suite. Silent sibling rot is invisible until someone runs the full chain.
3. **When a cell touches `templates/lib/` (or any templated source), its
   verify includes every downstream regeneration**: mirror sync, plugin-tree
   render, manifest --write + --check. Third recurrence — now filed for
   mechanization, not another prose reminder.
4. **When dispatching workers into a worktree, the prompt's first action is
   the runtime's worktree-entry tool** (plain `cd` leaves the write-guard
   anchored to the main checkout and denies every write). Observed live by
   the first worker; every later prompt carried it. Belongs in the worker
   prompt template.
5. **When inheriting a dead worker's uncommitted/hand-committed cell:** audit
   the diff against the cell's guardrail list, complete only the gap, record
   the convention violation as a deviation — never re-implement verified
   work, never silently absorb the violation.
6. **New-suite wiring into the standing chain happens inside the feature**
   (msh-6's C6 fold) — suites that live only in a cell's cap verify orphan
   from regression the day the cell closes.

## Deferred / Open

- Full state revision/CAS remains deferred (D6/cnr2-5); the store lock closes
  the practical window for CLI verbs and hooks.
- `updateCell` deliberately untouched by D4 — its existing door (refuse every
  claimed cell) is stricter than ownership; opening it to same-owner updates
  is a separate capability decision (msh-4 deviation #2).
- Unreproduced: two write-guard denials of read-only grep commands during
  analysis (extractBashTargets replay returned empty). Filed for repro via
  `.bee/logs/hooks.jsonl` capture; no rule committed on an unconfirmed cause.
- Codex-runtime heartbeat parity (no per-prompt hook event there) — prose
  rule stands; follow-up if Codex gains the event.
