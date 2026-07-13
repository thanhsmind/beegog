# Validation Report — fresh-session-handoff, slice S4

Date: 2026-07-13 · Lane: high-risk · Cells: fsh-9, fsh-10, fsh-11 (split from 2 at review) · Verdict: **READY WITH CONSTRAINTS**

## Reality gate

| Check | Result | Evidence |
|---|---|---|
| MODE FIT | PASS | the user-visible flow rides every prior primitive; auto-resume authority is D1's hard boundary — high-risk protocol |
| REPO FIT | PASS | panel verified: `trace.verify_passed` is the real cap precondition field (cells.mjs:27,359,387); `readHandoff` normalization cannot weaken `startFeature`'s existsSync-based block (state.mjs:727) or `startLane`'s feature match (:853); `buildSessionPreamble` already takes `{sessionId}`; SessionStart is plain-stdout (adapter ADVISORY_EVENTS) |
| ASSUMPTIONS | PASS | matrix below; the sweep hole, event-scope trap, and purity breach found in review are all pinned into the cells |
| SMALLER PATH | PASS | fsh-9 split at review (handoff lifecycle | claim-next) — each cell now one coherent concern |
| PROOF SURFACE | PASS | verify commands + cmp chains dry-run green; hook rows drive the real child; the two-session fixture is the epic-map E4 proof |

## Feasibility matrix

| Assumption | Risk | Proof required | Evidence | Result |
|---|---|---|---|---|
| Planned-next preconditions readable | blocks fsh-9 | field inspection | `trace.verify_passed` boolean set by recordVerify, enforced by capCell | PROVEN |
| Kind normalization safe for existing consumers | blocks fsh-9 | call-chain inspection | startFeature blocks on file existence, not readHandoff; startLane matches `.feature` (additive) | PROVEN |
| Stale claims recoverable in auto-pull | blocks D2 | caller inspection | `sweepExpiredClaims` had ZERO production callers (tests only) → panel B1; claim-next now sweeps in-pass and is the production trigger (C10) | PROVEN BY DESIGN PIN |
| Fresh-session boundary identifiable | blocks D1 | hook contract | SessionStart matcher is `startup|resume|clear|compact`; `payload.source` distinguishes them — start-now gated to clear/startup (C11) | PROVEN |
| Backlog rank usable for cross-lane order | blocks fsh-11 | code inspection | rankBacklog returns ID order only; Feature column unparsed → helper must be BUILT (pinned); `—` rows and missing rows fall to lane created_at | PROVEN (overstatement corrected) |
| Two-store claim unwind | blocks fsh-11 | signature inspection | claimCell THROWS on every failure — try/catch + releaseClaim pinned (a return-check would orphan) | PROVEN BY DESIGN PIN |

## Persona panel — 1 BLOCKER / 5 WARNINGS, all resolved into pins

| # | Finding | Resolution |
|---|---|---|
| B1 | no production sweep → dead session's claim wedges its cell forever; false NO_APPROVED_WORK stops | claim-next sweeps in-pass before selection and is the production sweep trigger; stop only returnable after the sweep ran (fsh-11 truth #1) |
| W1 | preamble adopts on resume/compact → premature handoff clear + off-spec auto-start in a non-fresh session | source-gated: adopt+start-now only on `clear`/`startup`; resume/compact render pending-wait with handoff intact; writer_session recorded (fsh-9) and checked (fsh-10) |
| W2 | mutation injected into the pure preamble builder (~20 test call sites) | adoption moved to the hook; buildSessionPreamble stays pure and renders a passed outcome (fsh-10 truth #5) |
| W3 | rankBacklog Feature-column overstatement | corrected in fsh-11; helper built, not assumed |
| W4 | unwind coded as return-check would orphan claim files (claimCell throws) | try/catch + releaseClaim pinned (fsh-11) |
| W5 | "clears the handoff atomically" spans two files | reworded: clear-after-adopt with documented idempotent recovery (fsh-9) |

## Cold-pickup cell review — repairs applied

- fsh-9: was NEEDS REPAIR (scope overload; ordering-rule not derivable) — **split**: claim-next moved to fsh-11; read_first gained bee.mjs + test_bee_cli.mjs (the exact fsh-4 repair carried forward).
- fsh-10: PICKS UP COLD; read_first gained claims.mjs + test_lib.mjs (minor hops closed). All three named traps (payload reachability, plain-stdout contract, real-child fixture) verified cleared by read_first content.
- fsh-11 (new): carries the corrected ordering reality (docs/backlog.md in read_first), the sweep pin, and the throw-safe unwind.

## Approval block

- Verdict: **READY WITH CONSTRAINTS**
  - C10: claim-next's in-pass sweep is mandatory evidence — a stale-claimed cell must be reclaimed-and-selected in one pass in the suite.
  - C11: auto-start fires only on the `clear`/`startup` sources; the resume/compact negative rows are mandatory evidence.
  - C12: buildSessionPreamble stays pure (no mutation); adoption lives in the hook.
  - C9 (carried): vendored parity via cmp in every verify.
- Execution order: fsh-9 → fsh-10 → fsh-11 (shared files serialize the waves).
- Approval covers slice S4 only. S5 returns through planning + validating.
