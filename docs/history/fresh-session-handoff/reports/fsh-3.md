# fsh-3 — Lane store, session→lane binding, lane-scoped feature-start

Status: [DONE]

Outcome: Per-feature lane records (`.bee/lanes/<feature>.json`) shipped additively over the default pipeline — readLane/readLaneStrict/writeLane/removeLane/listLanes, resolvePipeline (session → bound lane → default, typed refusals, never a guess), bindSessionLane/unbindSessionLane on the S1 session record (lane key omitted while unbound), and opt-in lane-mode startFeature with the validated Q4 lane-scoped preconditions (derived attribution, declared-paths holds check) resetting exactly that lane's four gates. Zero-lane byte-parity held: all 238 pre-existing rows pass unmodified; 12 new RED-first rows added (250/0 + onboard PASS).

Files touched:

- skills/bee-hive/templates/lib/state.mjs
- skills/bee-hive/templates/lib/claims.mjs
- skills/bee-hive/templates/tests/test_lib.mjs
- .bee/bin/lib/state.mjs (vendored byte-identical)
- .bee/bin/lib/claims.mjs (vendored byte-identical)

Deviation: the pre-existing export-surface exact-set row required its EXPECTED_STATE_EXPORTS allowlist constant extended with the 8 new lane exports (fixture-data extension by design; assertions untouched) — recorded in the trace.

Full trace and verification evidence: `.bee/cells/fsh-3.json`.
