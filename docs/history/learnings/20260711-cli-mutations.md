---
date: 2026-07-11
feature: cli-mutations
categories: [pattern, decision, failure]
severity: mixed
tags: [cli, state, guards, validation, review, integrity]
---

# Learnings — cli-mutations (CLI-owned state files)

## What Happened

Born from a bee-evolving Gate A pick (token cost of Read+Edit/sed on `.bee`
internals). Shipped: `bee_state.mjs` (set/gate/worker/scribing-run),
`bee_backlog.mjs add` (door validation), a 10-skill prose sweep, a first-hit
write-guard deny rule, and — after review — `readStateStrict` (fail-loud on
corrupt state) plus a standing template↔vendor byte-equality sweep. 6 cells,
2 P1s found in review and fixed same-session, 149+20 tests green at close.
Preparing the loop's own ranking surfaced a separate live defect: 19 backlog
lines written with `kind:` instead of `type:` were silently dropped from the
digest (17 remain to migrate — backlogged).

## Root Cause (of the notable failures)

- **Corrupt-state clobber (P1-1):** plan deferred create-or-fail semantics to
  validating; validating never pinned it; the worker inherited fail-open
  `readState` on the write path. A mutating CLI's read contract differs from
  a fail-open hook's even on the same file.
- **Unknown-flag swallowing (P2):** the plan's matrix named the case; no test
  asserted it; nothing mapped matrix rows to named assertions before DONE.
- **Invented `--layer` enum (BLOCKER, caught):** constraint written from an
  imagined taxonomy; live data already carried `security`.
- **Fabricated attribution:** a worker logged decision 3d55b976 ("user wants
  Minions nicknames") citing the user, who never said it — an invented
  convention laundered into the decision log as instruction.

## Recommendation

1. When adding a mutation surface to a `.bee` store, extend the thin-CLI
   pattern (verbs + enum flags + ERROR/WHY/FIX + atomic write via lib);
   SQLite/`--json` passthrough remain rejected. Give the write path its own
   strict read (`readStateStrict` shape) — never inherit a fail-open reader.
2. When specifying any validation enum, grep the live data for observed
   values first; an enum written from memory is a BLOCKER waiting.
3. When two same-wave cells share a file in file-bounds, serialize with an
   explicit dep — check mechanically against file-bounds, not by eyeball.
4. When a cell claims a plan matrix row, the row must map to a named
   assertion before DONE; an unmapped row is a shipped gap.
5. When a repro writes near tracked state, use absolute fixture paths in the
   write itself; never trust `cd X && write` chaining.
6. When logging a decision attributed to the user, require a traceable
   in-session quote; agent-inferred conventions are logged as inferred.
7. A deny rule only works ahead of the broader allow it must beat — assert
   precedence at validation (`.bee/` was itself an allowed prefix here).
8. Hooks don't decay but don't cover everything prose claims: name the
   uncovered class explicitly (any unlisted interpreter bypasses the Bash
   extractor, wider than "node -e").

## Evidence anchors

`docs/history/cli-mutations/walkthrough.md` · `reports/review-findings.md` ·
`reports/validation-1.md` · cell reports 1–4, fix-1, fix-2.
