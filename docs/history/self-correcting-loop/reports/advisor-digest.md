# Advisor digest — self-correcting-loop (high-risk lane)

Advisor: fable (AO13 pre-Gate-3 consult, fresh context). 2026-07-20.

**Verdict: GO-WITH-CONDITIONS.** D1-D6 sound and additive; two counting/
ordering flaws in scl-2 and one verify gap had to change before Gate 3 — all
folded into CONTEXT "Validating amendments" + cell actions:

- **Δ1 (scl-1/scl-2):** claim counting by session transitions undercounts the
  solo-session loop (the primary threat). Rule: distinct
  `(claim_session, claimed_at)` pairs; ledger entries carry the live claim's
  `claimed_at`. Legacy no-ledger cells count 0 (D6 preserved).
- **Δ2 (scl-2):** budget check INSIDE the O_EXCL critical section (acquire →
  check → release-on-refusal, unwind precedent cells.mjs:951); outside is
  TOCTOU + order-nondeterministic. Chosen over plan-check's pre-acquire
  alternative (recorded). Enforcement lands at the next claim — bounded
  one-attempt overrun, stated in tests.
- **Δ3 (scl-2):** claim-next SELECTION skips exhausted/repeated cells or a
  bricked top candidate bricks the pool (rule-14 consistency); only direct
  claim --id surfaces the refusal.
- **Δ4 (scl-1/scl-3):** both edit the claim-clearing surface —
  test_claim_race added to their verifies (critical-patterns 20260720).
- **Δ5 (scl-3):** duplicate scan tolerant-parses, sha256 of trimmed evidence,
  ≥80-char entries only, refusal names the colliding cell.
- **Δ6 (scl-4/scl-5):** builder_model orchestrator-supplied at record time;
  the fail-open dispatch log is corroboration only (absent ⇒ unverified,
  never a refusal). Judge-tier table single-homed in routing-and-contracts;
  seven 565e68d0-adjacent surfaces get one-line scoping clauses.

Most dangerous cell: **scl-2** — rewrites the sole claim door; can fail
dangerous in both directions (false EXHAUSTED locks the store; undercount
misses the loop it exists to stop).

## Companion evidence (same validating pass)

Plan-check (opus, read-only, baseline all green): no P1. Folds: F1 trace is
already frozen wholesale for updateCell — test the property, no hint-map
edit; F2 swept/dropped acquisitions may undercount (conservative-safe);
F3 claim-next skip decided per Δ3; F4 advisories to STDERR (pah-2
emitManifestLintWarnings precedent, bee.mjs:615-639), never the JSON result;
F5 deliberate_exceptions door keeps today's contract + advisory; F6 a new
judge.mjs is auto-covered by the readdirSync-derived enumerators once present
in both roots with manifest --write; F7 scl-5's suite boundary rests on the
close full chain (noted). Anchors: recordVerify cells.mjs:517-534, blockCell
:639-652, cap spread :560/:624-633, claim door :931-958, claimNextCell
:999-1099, bypassLevel state.mjs:1284-1290, pinned/unverified
dispatch-guard.mjs:405-418, PINNED_AGENT_TYPE :100-103.
