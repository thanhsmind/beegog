# ao-2aiii-1 — Guard integrity: model-param short-circuit closed

Worker: Kevin (ceiling tier) · Capped: 2026-07-17T13:25:10Z · Status: DONE (worker stream stalled after cap; orchestrator finished the tail: report, reservation release, commit)

## What changed

`bee-model-guard` now reads the declared tier **before** judging the model param (plan 2A-iii, B4/B5/AO5):

1. **Marker + param** — strict equality with the tier's configured model; mismatch denies naming the configured model (`param-tier-mismatch`). A tier resolving to no model name (ceiling/budget/cli) must carry no param (`param-on-nameless-tier`).
2. **Param only** — membership check against the models configured across claude tier slots (`configuredModelSet`, no hardcoded allowlist). `model:"banana"`/`model:"fable"` deny (`param-not-configured`) with a FIX teaching the configured models, the `[bee-tier: ceiling]` session-model route, and the config-slot route. Empty member set fail-opens.
3. **Marker only** — model/budget/inherit shapes allow as before, now resolution-backed; a cli-shaped tier denies (`cli-tier-denied`) routing to the external-executor gather path (`{for:'gather'}`), never naming a phantom model.
4. **Bare** — denied as before; the FIX resolves the generation slot first, so a cli-shaped/unconfigured generation points at marker tiers + the external-executor path instead of `pass model: "generation"` (W10).

Deny paths unified through `denyWith` — every rejected dispatch now writes an honest transport label to `dispatch.jsonl` (the audit trail no longer records lies — the feature's headline defect).

## Files

`hooks/bee-model-guard.mjs`, `.bee/bin/hooks/bee-model-guard.mjs` (byte-identical, `cmp` verified), `hooks/test_model_guard.mjs` (+12 rows 21–32, 3 new fixture builders: `buildCliSlotFixture`, `buildEmptyModelSetFixture`, `buildMalformedModelsFixture`), `docs/history/codex-harness-hardening/release-manifest.json` (regenerated via `--write`).

## Verification (orchestrator re-ran fresh)

`node hooks/test_model_guard.mjs && node hooks/test_write_guard.mjs && node hooks/test_hook_contracts.mjs && node scripts/release_manifest.mjs --check` → **ALL PASS ×3, 142 files match manifest, exit 0.** Frozen judge: **0 hits.** Red evidence in cell trace: first run of row31 failed against `normalizeModels` seeded defaults (proving the rows bite), then the fixture was corrected to express a truly empty member set.

## Notes carried

- BLOCKER-1 (fable) accepted-by-design per validation report — deny row 22 asserts the FIX teaches the ceiling route.
- WARNING-2 pinned by row 27 (model-shaped review slot keeps `[bee-tier: review]` + param-opus allowed).
