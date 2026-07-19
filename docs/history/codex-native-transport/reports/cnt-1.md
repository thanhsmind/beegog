# cnt-1 — resolver + config: native slot shape + explicit-fallback composite (D2)

**[DONE]** — `models.<runtime>.<slot>` now accepts the native V2 model-override leaf `{kind:'native', model, effort?, fork_turns?, agent_type?}` and the explicit-fallback composite `{primary, fallback, fallback_policy:'explicit-only'}` (D2). Every pre-existing slot shape resolves byte-identically; a composite exposes its cli fallback only when `fallback_policy === 'explicit-only'` (no silent native→cli fallback, D1).

## Files touched
- `skills/bee-hive/templates/lib/state.mjs` + `.bee/bin/lib/state.mjs` (byte-identical mirror in the same commit): `normalizeTierValue` preserves both new shapes; `resolveTier`/`resolveAdvisor` gain a `kind:'native'` branch inserted **before** the generic `value.model` branch (cnt-1 note) via a shared hoisted `nativeResolved` helper (defaults `fork_turns:'none'` per E2, `agent_type:'worker'`); `validateModelsConfig` detects composite + native **before** `looksLikeCli` (ADVISOR-R2 Δ1) with typed reject codes.
- `scripts/test_config_validate.mjs`: 2 accept + 5 reject validator rows.
- `skills/bee-hive/templates/tests/test_lib.mjs`: `cnt-1 golden freeze` (byte-identical regression net, frozen green before the edit — critical-pattern 20260716) + `cnt-1 native override` resolver rows.
- `docs/config-reference.md`: slot-shape table extended from four to six shapes.

## Verify
`node scripts/test_config_validate.mjs && node skills/bee-hive/templates/tests/test_lib.mjs && node scripts/test_lib_mirror.mjs` → exit 0 (46/46 · 349/0 · mirror byte-identical).

Full trace, deviations, and behavior-change evidence: `.bee/cells/cnt-1.json`.

## Deviations / notes (see cell trace for full text)
- **Auto-add (type 2):** `normalizeTierValue` extension — the resolver reads normalized config, so without it the new resolver branches would be dead code. Within the cell's config-shape scope.
- **Defensive:** two extra validator reject codes (`composite-primary-malformed`, `composite-fallback-malformed`) beyond the three named.
- **Slice-close obligation (NOT done in cnt-1 by design):** `release_manifest.mjs --check` is red after this lib-content edit (critical-pattern 20260715). Regen is owned by the slice's last cell / close step — cnt-3/cnt-4/cnt-5 also edit lib files and will re-redden it. Do not regen per-cell.
