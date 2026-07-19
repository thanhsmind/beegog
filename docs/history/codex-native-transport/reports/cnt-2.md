# cnt-2 — capability classification + probe record + doctor unlock naming (D3/D4)

**Status:** [DONE]

**Outcome:** Added the pure `classifyNativeTransport(evidence)` classifier (dispatch-guard.mjs,
D3a-authoritative logic per decision `c0cba64e`) plus a version+config-scoped
native-transport-probe record — `writeNativeTransportProbe` / `readNativeTransportClassification`
(bee.mjs, mirroring the g22-3 doctor-attest pattern) with a `config_scope_hash` covering all four
verdict-determining flags per decision `760e9b05` — and a D4 informational doctor row
(`doctorNativeTransportUnlock`) that only names the unlock, never applies it. New
`scripts/test_native_probe.mjs` (29 checks) is wired into `commands.verify` and the verify
manifest guard.

Mid-cell, two authoritative advisor decisions landed during this cell's own execution window
(`c0cba64e`, `760e9b05`) that were not yet reflected in the dispatch prompt or plan.md's Advisor
conditions section; the classifier and hash-scope were reworked to match before capping.

**Files touched:** `skills/bee-hive/templates/lib/dispatch-guard.mjs`,
`.bee/bin/lib/dispatch-guard.mjs`, `skills/bee-hive/templates/bee.mjs`, `.bee/bin/bee.mjs`,
`scripts/test_native_probe.mjs` (new), `.bee/config.json`, `.gitignore`,
`skills/bee-hive/scripts/onboard_bee.mjs`, `skills/bee-hive/scripts/test_onboard_bee.mjs`.

Full trace and verification evidence: `.bee/cells/cnt-2.json`.
