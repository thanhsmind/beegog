# Validation Report — fresh-session-handoff, slice S2

Date: 2026-07-13 · Lane: high-risk · Cells: fsh-3, fsh-4, fsh-5, fsh-6 · Verdict: **READY WITH CONSTRAINTS**

## Reality gate

| Check | Result | Evidence |
|---|---|---|
| MODE FIT | PASS | same feature-level 4-flag count; S2 touches the core record model + ~20 pinned test sites — the high-risk protocol is the honest fit |
| REPO FIT | PASS | panel verified the registry pattern (entries `command-registry.mjs:450-607`, `HANDLERS` map `bee.mjs:1310-1341`, 12-line shims) matches fsh-4 exactly; `startFeature` seam and S1 `claims.mjs` APIs exist as cells assume |
| ASSUMPTIONS | PASS | matrix below; the two unsatisfiable-in-scope promises found by the reviewers were repaired by rescoping, not by weakening (BL-1, W-4) |
| SMALLER PATH | PASS | additive default-lane design is precisely the smaller path vs a state.json split; cells forbid touching anything a later slice owns |
| PROOF SURFACE | PASS | all four verify commands dry-run green today (suite 238/0, CLI 102/0, onboard PASS); zero-lane byte-parity is falsifiable because every pinned row can run before and after |

## Feasibility matrix

| Assumption | Risk | Proof required | Evidence | Result |
|---|---|---|---|---|
| Zero-lane byte-parity achievable with additive code | blocks S2 | inspection of every pinned site | panel: status parity row compares two shims over ONE `buildStatus` (structural parity); `test_hook_contracts.mjs:1760-1774` hashes the live state file, not hook source; `--help --json` check is subset-based; session-shape rows assert fields individually so an omitted-when-unbound `lane` key is invisible | PROVEN (with C4 below) |
| session_id can thread hook→guard | blocks D3 path | call-chain inspection | `bee-write-guard.mjs:279-288` has `ctx.payload` in scope at the `checkWrite` call (:383); `adapter.mjs` preserves the payload | PROVEN as a seam — threading itself is S3's (BL-1 rescope); S2 ships `checkWrite(…, sessionId?)` defaulting to today |
| claimCell gate-source swap safe for 118 capped cells | blocks S2 | code inspection | `claimCell` acts only on `status==='open'` (`cells.mjs:302-306`); capped cells untouchable by construction; zero lanes → default `gateApproved` path byte-identical | PROVEN |
| Registry extension pattern matches | blocks fsh-4 | code inspection | one entry + one handler + shim confirmed; per-entry `runExample` requirement pinned into the cell (cold-pickup trap: generic loops validate shape only) | PROVEN |
| Lane attribution for handoff/workers derivable without new fields | blocks fsh-3 | record inspection | handoff carries `feature`; workers carry `cell` → cell.feature — derivation pinned into fsh-3 (cold-pickup CRITICAL repaired) | PROVEN |

## Persona panel — 1 BLOCKER / 4 WARNINGS, all resolved

| # | Finding | Resolution |
|---|---|---|
| BL-1 | fsh-5 promised hook-threaded guard gating while prohibiting hook edits — unsatisfiable; production guard would stay unbound | fsh-5 rescoped to lib capability (`checkWrite` optional `sessionId`, default = today, proof by direct lib rows); hook threading + bound hook-contract rows explicitly moved to S3 (recorded in the epic map) |
| W-1 | Stale line anchors after S1 inserted ~2,900 lines | anchors replaced with symbol-grep references + corrected ranges in fsh-4/fsh-6 |
| W-2 | Wave collisions: fsh-4∥fsh-5 share test_lib.mjs; fsh-4/fsh-6 share bee.mjs | deps serialized: fsh-5→[3,4], fsh-6→[3,4,5] — single-worker waves |
| W-3 | fsh-5 cited D3 without doing D3 work | D3 dropped from fsh-5's decisions (S3 owns it) |
| W-4 | fsh-6 preamble lane view unwired end-to-end (bee-session-init out of scope) | reworded to lib capability; SessionStart threading assigned to S4 beside the rehydrate branch (epic map updated) |

## Cold-pickup cell review — repairs applied

- fsh-3: PICKS UP COLD after repair — the under-defined "handoff/worker bound to lane" preconditions are now pinned as derived attribution (handoff.feature match; worker→cell→feature), no invented fields; scope noted as heavy but every truth provable.
- fsh-4: PICKS UP COLD — `test_bee_cli.mjs` added to read_first; the per-entry `runExample` requirement (silent-green trap) is now an explicit truth.
- fsh-5: was NEEDS REPAIR (same root as BL-1 + undefined contract) — repaired: optional `sessionId` contract pinned, hook files prohibited, bound proof by direct lib call.
- fsh-6: was NEEDS REPAIR (stale :746-887 anchor; overstated part-1 wiring) — repaired: anchor corrected to the grep-located preamble rows (~:949-1224), part 1 scoped to lib capability, chain-nudge/session-close threading kept (in scope, payload available).

## Approval block

- Verdict: **READY WITH CONSTRAINTS**
  - C4 (parity method): every cell runs the full suite green BEFORE its first edit (baseline) and after; pinned rows are extended, never modified.
  - C5 (deferred wiring, honest close): after S2 the production write-guard and SessionStart preamble still resolve the default pipeline — by design; S3/S4 own their hook threading (recorded in the epic map). S2's close report must state this so the slice never reads as fully lane-wired.
  - C6 (serialized waves): fsh-3 → fsh-4 → fsh-5 → fsh-6, one live worker at a time (shared test_lib.mjs/bee.mjs).
- Approval covers slice S2 only. S3-S5 return through planning + validating.
