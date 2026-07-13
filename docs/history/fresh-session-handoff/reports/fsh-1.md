# fsh-1 — Session + claim lib: O_EXCL claims with TTL/heartbeat (RED-first)

**Status:** [DONE] — worker Kevin, commit e042cb8

**Outcome:** `templates/lib/claims.mjs` ships the full session+claim API — createSession/readSession/heartbeatSession, claimCellFile ('wx' one-winner), releaseClaim, adoptClaim (in-place owner rewrite under the exclusive `<cellId>.adopting` gate), sweepExpiredClaims (re-verify TTL expired AND heartbeat stale under the gate; held gate = skip), isClaimActive — with the pinned typed `{ok:false, code, reason}` contention contract. STEP 0 win32 probe PASS recorded before any edit. No consumer wiring (S1 boundary).

**Files touched:** `skills/bee-hive/templates/lib/claims.mjs` (new), `skills/bee-hive/templates/tests/test_lib.mjs` (10 new claims rows, RED-first), `.bee/bin/lib/claims.mjs` (vendored sibling — deviation, see trace: the standing parity test fails the cell's verify without it; plan.md S1 bounds allow it).

Full trace, verify output, and verification evidence: `.bee/cells/fsh-1.json`.
