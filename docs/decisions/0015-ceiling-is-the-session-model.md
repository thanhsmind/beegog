# 0015 — The ceiling is the session model, not a config value

- **Status:** active — owner-approved 2026-07-09; **built in 0.1.14** (2026-07-09). Refines decision 0012. Lib suite green (64/64), onboarding suite green. **Transport amended by decision 0023** (2026-07-11): omitting the `model` param alone no longer expresses ceiling — it must be paired with a `[bee-tier: ceiling]` marker; the principle in this document is otherwise unchanged.
- **Date:** 2026-07-09
- **Source:** owner, reviewing the 0012 `models` config: *"ceiling không cần config, nó nên luôn luôn lấy model hiện tại đang được chọn để chạy; chỉ có generation, extraction là cho chọn model."* The ceiling tier being a configured value was both redundant and slightly wrong — the ceiling **is** the orchestrator's own model by definition, so naming it separately invites drift (config says `fable` while the session runs on `opus`).
- **Confidence:** 0.8 (clean simplification; the only wrinkle is advisor mode, handled below).

## Decision

**The ceiling tier is never configured. It is always the model running the session** (the orchestrator's own model). Config `models` holds only the two cheaper tiers you downgrade workers to:

```json
"models": {
  "claude": { "extraction": "haiku", "generation": "sonnet" },
  "codex":  { "extraction": null, "generation": null }
}
```

- `modelForTier(root, 'ceiling', …)` returns **null** = "inherit the session model" → swarming omits the Agent `model` param, so a ceiling cell runs on whatever the session runs on.
- `CONFIGURABLE_TIERS = ['extraction', 'generation']`; `normalizeModels` reads only those, and a stray `ceiling` key in a config file is ignored.
- `MODEL_TIERS` still lists `ceiling` — cells can be **tiered** ceiling ("keep this on the session model, don't downgrade"), and the scarcity warning still counts them.

## Advisor mode gets its own named model

Advisor mode (decision 0013) is the one case where the strong model is **not** the session model — there the session runs on the cheap `generation` tier and phones a stronger expert. So the advisor names its model explicitly:

```json
"advisor": { "enabled": true, "at": ["shape", "execution", "blocked"], "model": "fable" }
```

`advisorModel(root, point)` returns `config.advisor.model` (default `fable`) — it no longer borrows the ceiling tier (which, under 0015, would be the cheap session and defeat the purpose).

## Rationale

- **Truthful by construction.** The ceiling can't drift from the session model because it *is* the session model — there is nothing to keep in sync.
- **Less to configure.** The common setup ("run on my best model, send workers cheaper") needs only `generation`/`extraction`. The user picks the ceiling by choosing what to run the session on — which they already do.
- **The two patterns stay clean.** Fan-out: session = strong, ceiling inherits it. Advisor: session = cheap, `advisor.model` = the strong expert. Each names exactly what it must.

## Alternatives considered

- **Keep ceiling in `models` (0012 as-is).** Rejected per the owner — redundant and drift-prone.
- **Let advisor reuse `models.*.ceiling`.** No longer possible (ceiling isn't configured); and conceptually wrong, since advisor's expert is stronger than the session, not the session.

## Scope (built)

- `lib/state.mjs`: `CONFIGURABLE_TIERS`; `DEFAULT_MODELS` drops ceiling; `modelForTier` returns null for ceiling; `advisor.model` field + `advisorModel` returns it; version 0.1.13 → 0.1.14.
- `onboard_bee.mjs` `DEFAULT_CONFIG`: models without ceiling, advisor with `model`.
- `bee_status` + preamble: models line shows only generation/extraction + "ceiling = session model"; advisor line shows `advisor.model`.
- Prose: `bee-swarming` SKILL + reference, `routing-and-contracts.md` advisor section, `docs/config-reference.md`, README.
- Tests: `test_lib.mjs` model + advisor fixtures rewritten.
- Existing repo configs backfilled to the new shape (ceiling removed from `models`, `advisor.model` added).

## Consequences

- A repo's `.bee/config.json` from 0.1.12/0.1.13 with `models.*.ceiling` still works — the value is ignored, ceiling is the session model regardless.
- Not yet dogfooded end to end; advisor mode in particular still wants a real run.
