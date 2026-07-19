# Advisor digest — multi-session-hardening (high-risk lane)

Advisor: fable (AO13 pre-Gate-3 consult, fresh context). 2026-07-19.

**Verdict: GO-WITH-CONDITIONS.** D1-D7 sound, cell decomposition right. Six
deltas, all folded into CONTEXT.md amendments + cell actions before Gate 3:

- **Δ1 (msh-1):** unlink+reacquire stale takeover has a double-unlink race
  (waiter deletes the NEW holder's fresh lock). Takeover by atomic rename;
  concurrent-takeover racer case mandatory. 30s threshold fine — locked
  sections are ms-scale JSON RMW (~1000x margin), stated in the lock header.
- **Δ2 (msh-2):** releaseClaim has exactly one caller today (claim-next
  unwind, cells.mjs:831); nothing releases on cap/unclaim/block/drop/reopen.
  Post-D1+D5 a stranded claim file self-refuses its own session for the full
  TTL. Release on every claim-clearing transition; relax claimCellFile's
  session requirement deliberately (sessionless claims + release path).
- **Δ3 (msh-5):** hold/state renewal from hooks outside the lock reintroduces
  the lost-update through the back door (bee-state-sync.mjs:42-45 is itself
  an unlocked state RMW). Hooks take the lock try-once/skip-on-busy; D2
  amended from "hooks never take it" to "hooks never WAIT on it".
- **Δ4 (msh-5):** claim renewal must respect the per-claim .adopting gate
  (claims.mjs:214-230) or a touch can revert an adoption — silent ownership
  corruption. Renewal = new same-session-only primitives, never adoptClaim.
- **Δ5 (msh-4):** capCell replaces trace.deviations wholesale (cells.mjs:531);
  the force audit lives in append-only trace.ownership_overrides (unknown
  keys survive the ...trace spread at :528).
- **Δ6:** idle-session blanket renewal is an accepted residual (documented
  non-goal); force door + terminal release are the rescue.

**Most dangerous cell: msh-5** — turns two fail-open hooks into writers of the
contended stores on the hottest trigger; gated on Δ3/Δ4 folded before claim
(done).

## Companion evidence (same validating pass)

- **Spike (lock-probe.mjs, 8 runs):** unguarded RMW loses updates every run
  (400 expected → 1-8 observed); O_EXCL-guarded = exactly 400 every run;
  backdated-stale takeover with 8 concurrent racers = exactly 1 winner every
  run; negative control (unconditional unlink) = 7-8 winners, proving Δ1's
  race is real on this FS. mtime resolution ≈ ms — 30s threshold safe.
- **Plan-check (opus, read-only):** no P1. Fixes folded: msh-5 files gained
  bee.mjs + reservations.mjs (+mirrors) — the state RMW verbs live in bee.mjs
  (resolveMutationTarget :979, stateWorkerMutate :1151, handleStateGate
  :1153-1157) and hold renewal needs reservations.mjs; msh-6 gained
  .bee/config.json (wire the 4 new suites into commands.verify or they orphan
  after cap); msh-2's "cap already sweeps" corrected to false; catalog.mjs
  does NOT hash handler bytes (no projection re-render for hook edits, mirror
  suite still applies); census/conformance pin no wording msh-6 changes.
