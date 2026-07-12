# adv-1 — advisor slot: normalizeModels acceptance + resolveAdvisor + RED-first tests + stale-key warning copy

**Status:** [DONE]
**Worker:** kevin (generation/sonnet)

## Outcome

Added `resolveAdvisor(root, runtime)` beside `resolveTier` in `lib/state.mjs`
(D2): resolves `models.<runtime>.advisor` to `{type:'model'}` /
`{type:'cli', command}`, never a budget type, never falls back to
`generation` — null unambiguously means no advisor. `normalizeModels` now
normalizes the `advisor` slot through a new local `MODEL_NORMALIZE_SLOTS`
list so `CONFIGURABLE_SLOTS`/`CONFIGURABLE_TIERS` stay untouched (no 0015
collision). `STALE_ADVISOR_KEY_WARNING` copy now names the top-level key
explicitly and disambiguates from the new nested slot. RED-first test rows
added and watched fail before implementation.

## Files touched

- `skills/bee-hive/templates/lib/state.mjs`
- `.bee/bin/lib/state.mjs` (kept byte-identical — parity test enforced)
- `skills/bee-hive/templates/tests/test_lib.mjs`

## Verification

`node skills/bee-hive/templates/tests/test_lib.mjs` — 222 passed, 0 failed.

Full trace, RED-first evidence, and verification_evidence are recorded in
`.bee/cells/adv-1.json`.
