# Validation report — gh-issue-fixes-172, slice 1 (2026-07-20)

Verdict: **READY WITH CONSTRAINTS** (all constraints folded into cells pre-Gate-3).

## Reality gate
- MODE FIT: PASS — 3 mechanical flags (cross-platform, covered-contract change, multi-domain) → standard; recorded in plan.md.
- REPO FIT: PASS — withStoreLock pattern already used by state.mjs:1649 / reservations.mjs:136 / claims.mjs:543; claims.mjs:34 already imports it.
- ASSUMPTIONS: PASS — feasibility rows F1–F6 below, all evidenced.
- SMALLER PATH: PASS (rejected) — 7 product files, behavior-contract changes in covered code; small cap is 3.
- PROOF SURFACE: PASS — baseline green confirmed twice (session baseline run exit 0; plan-checker re-ran test_lib 400/0, test_bee_cli 206/0, test_heartbeat_touch 23/0, installers-e2e bash 19/0).

## Feasibility matrix (plan-checker evidence, anchors verified)
| # | Assumption | Result | Evidence |
|---|---|---|---|
| F1 | cells.mjs can import withStoreLock acyclically | PASS | lock.mjs:16-19 imports only fs/path/crypto/fsutil |
| F2 | Single claim-file creation site for acquired_at | PASS | claimCellFile claims.mjs:281-308 (flag 'wx'); renewClaimTTL :377 spread preserves unknown fields; adoptClaim :329-336 carries it (pair key includes claim_session → safe on takeover) |
| F3 | Judge fail-verdict value | PASS w/ caveat | judge.mjs:16 JUDGE_VERDICTS=['PASS','NEEDS_REVISION'] — guard keys on NEEDS_REVISION, never 'FAIL' (folded into ghf-6) |
| F4 | New flags won't break arg validation | PASS | parseFlags bee.mjs:3885-3913 accepts any flag; validate-args.mjs:79-82 skips unknown; registry parameters extended additively; DA5 is name-based |
| F5 | ghf-1 cannot disturb DA5 bijection probe | PASS | probe token is not --help (test_bee_cli.mjs:221-224); early-return is --help-gated |
| F6 | Which existing tests the changes touch | PASS | pairing tests stay green (claimed_at kept + legacy fallback); MUST-UPDATE test_lib.mjs:1125 (actor) and preserve :1148 error precedence (folded into ghf-5) |
| S | Schedule | PASS | zero cycles; waves [ghf-1,ghf-2] → ghf-3 → ghf-4 → ghf-5 → ghf-6 |

## Plan-checker findings and resolutions
- BLOCKER (dependency): ghf-1 shared bee.mjs/test_bee_cli.mjs with ghf-5/6 and raced the .bee/bin mirror regeneration with the cells chain. **Resolved:** ghf-3 now depends on ghf-1 — every template-touching cell is serialized; only ghf-2 (install.ps1) runs parallel.
- WARNING (ghf-6 verdict value): guard must use NEEDS_REVISION; throw-with-code pattern matches capCell's existing guards. **Resolved:** cell action rewritten.
- WARNING (ghf-5 ordering + tests): reason-check first, not-found before new guards; test_lib.mjs:1125 needs an actor; :1148 expected messages must not change. **Resolved:** cell action rewritten.

## Cell review (cold pickup)
No CRITICAL flags. MINOR: ghf-1 group-prefix resolution note (group token resolves to no single registry entry — filter by prefix); ghf-2 grep verify is red-pre/green-post by construction. Recorded, shipped as-is.

## Approval
Gate 3 auto-approved under gate-bypass level total (audit decision logged). Advisor consult not required: standard lane, no hard-gate flag (AO2b applies to high-risk/hard-gate only).
