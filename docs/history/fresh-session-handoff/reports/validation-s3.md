# Validation Report — fresh-session-handoff, slice S3

Date: 2026-07-13 · Lane: high-risk · Cells: fsh-7, fsh-8 · Verdict: **READY WITH CONSTRAINTS**

## Reality gate

| Check | Result | Evidence |
|---|---|---|
| MODE FIT | PASS | D3 is the feature's hard-block promise touching the production write path — high-risk protocol is the honest fit |
| REPO FIT | PASS | panel verified: `checkWrite` already carries the opt-in sessionId param (guards.mjs:99); the hook call site is the single 4-arg caller (bee-write-guard.mjs:383); `runWrapper`/`writeSessionFile`/`writeLaneFile` fixture machinery exists and was used by fsh-6; reservations verb schema+handler map one-to-one for the session field |
| ASSUMPTIONS | PASS | matrix below; the fail-open/fail-closed collision found by the panel is repaired by a pinned returned-verdict shape |
| SMALLER PATH | PASS | two cells, clean lib-vs-hook split, zero file overlap between them |
| PROOF SURFACE | PASS | verify commands dry-run green today, now including a `cmp` chain that makes vendored-sibling drift a red verify instead of a silent gap (cold-pickup cross-cutting note) |

## Feasibility matrix

| Assumption | Risk | Proof required | Evidence | Result |
|---|---|---|---|---|
| checkWrite accommodates the hold check without breaking callers | blocks S3 | code inspection | opt-in `{sessionId=null}` param shipped in fsh-5; all existing callers use the 4-arg form | PROVEN |
| Real-hook bound rows are writable | blocks fsh-8 | fixture inspection | `runWrapper` (test_hook_contracts.mjs:204) drives the child with arbitrary payloads; lane/session fixture writers exist (:985,:1008); a reservations fixture writer is authored in-cell (pinned) | PROVEN |
| Deny reaches the agent | blocks D3 | channel inspection | write-guard denials are stderr + exit 2 (bee-write-guard.mjs:424-432), asserted by the existing `expectApplyPatchDenied` pattern — pinned into fsh-8 (the systemMessage channel is for other events) | PROVEN |
| Fail-closed corrupt store survives the fail-open hook | blocks D3 | design + end-to-end row | hook's outer catch returns 0 on any throw (:419-422) → the corrupt branch MUST return a typed deny, never throw (pinned); an fsh-8 truth drives a corrupt store through the real child asserting exit 2 | PROVEN BY DESIGN PIN + REQUIRED ROW (C7) |
| Phase-independence of the hold check | blocks D3 | placement + test topology | early-return phase branches (guards.mjs:129-180) would mask a tail-placed check; placement pinned before them, and deny tests required to run in a swarming/execution-approved lane (C8) | PROVEN BY DESIGN PIN |
| Session-aware conflict finder | blocks fsh-7 | export inspection | `isActive`/`isExpired` module-private; `findConflicts` keys on agent — a new exported session-aware finder is pinned, skipping legacy session-less rows | PROVEN BY DESIGN PIN |

## Persona panel — 1 BLOCKER / 2 WARNINGS, all resolved into pins

| # | Finding | Resolution |
|---|---|---|
| B1 | corrupt-store fail-closed would throw; the fail-open hook swallows throws into an allow — the exact D3 hole; no end-to-end corrupt row existed | fsh-7: returned-verdict shape pinned (`{allow:false}`, never throw), corrupt-vs-missing discriminator pinned; fsh-8: corrupt-store-through-real-hook truth added (exit 2) |
| W1 | hold check appended after the phase early-returns never runs in swarming/gated — the primary multi-terminal topology | placement pinned before the phase branches; deny tests required in a swarming-with-execution-approved lane in BOTH cells |
| W2 | action referenced non-exported internals; `findConflicts` keys on agent | new exported session-aware conflict finder pinned; internals stay private; legacy session-less rows never deny |

## Cold-pickup cell review — repairs applied

- fsh-7: PICKS UP COLD. Minors fixed: command-registry.mjs + test_bee_cli.mjs added to read_first (CLI/runExample half briefed, not just referenced); vendored-drift gap closed by appending a `cmp` chain to the verify (dry-run green on today's tree).
- fsh-8: PICKS UP COLD. Minors fixed: test_hook_contracts.mjs added to read_first (it is both edit target and the fixture-pattern source — `runLaneSessionRows` is the direct template; a reservations fixture writer must be authored, pinned); deny channel pinned (stderr + exit 2, substring-match fsh-7's format); `cmp` for the vendored hook sibling appended to verify.

## Approval block

- Verdict: **READY WITH CONSTRAINTS**
  - C7: the corrupt-store fail-closed branch returns a typed deny (never throws); fsh-8's corrupt-store row through the real hook child is mandatory evidence.
  - C8: hold-deny tests in both cells exercise a swarming-phase, execution-approved lane (phase-independence proven, not assumed).
  - C9: vendored `.bee/bin` parity is enforced by each verify's `cmp` chain — a forgotten vendor is a red verify.
- Approval covers slice S3 only. S4-S5 return through planning + validating.
