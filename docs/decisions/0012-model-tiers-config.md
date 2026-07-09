# 0012 — Runtime-keyed model-tier config (advisor / orchestrator patterns)

- **Status:** active — owner-approved 2026-07-09; **built in 0.1.9** (2026-07-09). Lib + config + swarming prose + bee_status; lib suite green (61/61), onboarding suite green. Not yet redeployed to dogfood repos.
- **Date:** 2026-07-09
- **Source:** owner shared Anthropic's two model-pairing strategies (Fable 5 as advisor to Sonnet 5 workers → ~92% SWE-bench Pro at ~63% cost; Fable 5 as orchestrator fanning out to Sonnet 5 workers → 96% BrowseComp at 46% cost). Core lesson: the expensive model should touch only the decision points; cheap models carry the loops — and the discipline is **keeping the strong model scarce**. Owner asked how bee realizes this, and required the config to be **runtime-keyed** (a Claude map and a ChatGPT/Codex map, since bee is dual-runtime).
- **Confidence:** 0.7 (the config + resolver are built and tested; the scarcity *enforcement* and the advisor pattern are deferred, and Codex per-agent model selection is not available today).

## What bee already had

`bee-swarming` = the orchestrator/fan-out pattern (strategy 2): the orchestrator (session model) plans, splits into cells, spawns workers in parallel; step 4 already said "pick the model tier per dispatch" (extraction/generation/ceiling) and the `[BLOCKED]` rescue ladder already bumps a stuck worker up a tier (advisor-ish). The gap: the tier→model map was **prose-only and stale** — hardcoded `haiku/sonnet/opus` (pre–Claude-5), no config, no runtime keying, and no mechanism keeping ceiling scarce.

## Decision

Add a **runtime-keyed** `models` map to `.bee/config.json`, resolved by a shared-lib helper:

```json
"models": {
  "claude": { "extraction": "haiku", "generation": "sonnet", "ceiling": "fable" },
  "codex":  { "extraction": null,    "generation": null,     "ceiling": null }
}
```

- Keyed by **runtime first** (each runtime names models differently), then tier.
- **ceiling** = strongest, kept scarce (orchestrator's model / called-only advisor); **generation** = mid worker running the loops; **extraction** = cheapest capable.
- A **null** tier = the runtime cannot select a per-agent model (Codex today) → the tier is enforced via read budget + output cap in the worker prompt. Users with per-agent-capable runtimes set real ids (e.g. `codex.ceiling: "gpt-5-pro"`).
- Resolver `modelForTier(root, tier, runtime='claude')` in `lib/state.mjs` returns the model name or `null` (→ budget/cap fallback). Unknown runtime → `claude`; unknown tier → `generation`. `readConfig().models` is always a full normalized map.
- `swarming` reads the map: on Claude Code the Agent `model` param = `config.models.claude[tier]`; ceiling refreshed from `opus` to `fable` per the Claude 5 family.

## Rationale

- **One map serves both strategies.** Whether the ceiling model is the orchestrator (fan-out) or a called-only advisor (rescue ladder), it is the same `ceiling` slot — keep it scarce and the cost lever holds in both shapes.
- **Runtime-keyed is required, not cosmetic.** bee is dual-runtime; `fable`/`sonnet` are meaningless to Codex and vice-versa. Keying by runtime lets one repo config serve both, and encodes the honest truth that Codex has no per-agent model switch today (null → budget/cap).
- **Config-driven beats hardcoded prose.** The stale `haiku/sonnet/opus` mapping proved the point — a mapping baked into skill prose ages into a ceiling. Config + resolver means refreshing models is a per-repo edit, not a skill rewrite.
- **Shared lib = one brain.** The resolver lives in `lib/state.mjs`; `bee_status` surfaces the map for Codex/plugin-less agents, the swarming skill uses it on Claude Code. No second source of truth.

## Alternatives considered

- **Flat tier→model map (no runtime key).** Rejected — breaks the moment the same config is used from the other runtime.
- **Hardcode the Claude 5 names in the skill.** Rejected — repeats the exact staleness this decision fixes.
- **Auto-detect and switch models mechanically.** Out of scope — the harness (Claude Code Agent `model` param) does the switch; bee only supplies the name per tier.

## Scope (built)

- `lib/state.mjs`: `MODEL_TIERS`, `RUNTIMES`, `normalizeModels`, `modelForTier`; `readConfig().models`; version 0.1.8 → 0.1.9.
- `onboard_bee.mjs` `DEFAULT_CONFIG.models` (new onboards ship the map; absent = defaults, no migration).
- `bee_status.mjs`: `.models` in JSON + a text line ("keep ceiling scarce").
- `bee-swarming/SKILL.md` step 4 + `references/swarming-reference.md`: config-driven, runtime-keyed, ceiling = fable, null = budget/cap fallback.
- Tests: `test_lib.mjs` resolver fixtures (defaults, codex null, override both runtimes, unknown-runtime/tier fallbacks).

## Consequences / deferred (PBI)

- **Scarcity is documented, not yet enforced.** Nothing stops most dispatches going to `ceiling`. Deferred: a `tier` field on cells (planning assigns it) + a `bee_status`/preamble warning when ceiling-tier share exceeds a threshold — turns "keep the strong model scarce" into a measured signal (the same spine move as decision 0011's scribing debt).
- **Advisor pattern (strategy 1) not first-class.** Running the whole session on `generation` and consulting `ceiling` only at Gate 2/3 or `[BLOCKED]` via a single advisor subagent is a further add (a cross-model escalation gate). Deferred.
- **Codex model switching** depends on the runtime gaining per-agent selection; null tiers are correct until then.
