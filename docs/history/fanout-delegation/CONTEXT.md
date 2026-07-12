# Fan-out Delegation — Context

**Feature slug:** fanout-delegation
**Date:** 2026-07-11
**Exploring session:** complete
**Scope:** Standard
**Domain types:** ORGANIZE (workflow contract + config schema), RUN (skill instructions the agent executes)

## Feature Boundary

Bee runs exactly one orchestration cost pattern: the session model (the owner's best model) is the orchestrator in every phase, mechanical gather/render/mine steps dispatch down-tier and return digests, and advisor mode is removed from the harness entirely. The feature ends at the harness (skills, vendored libs, config schema, docs, tests) — it does not touch host-project configs beyond what onboarding syncs, and it does not add any new hook.

## Locked Decisions

These are fixed. Planning must implement them exactly — cited, never reinterpreted.
Changing one requires the user, a new D-ID or an explicit supersession note, never
a silent edit.

| ID | Decision | Rationale (only if it changes implementation) |
|----|----------|-----------------------------------------------|
| D1 | Advisor mode is removed in full: code (`advisorModel`, `normalizeAdvisor` in lib/state.mjs), the preamble line (lib/inject.mjs), `bee_status` surfacing, chain-nudge references, config schema (`advisor` key), routing-and-contracts section, swarming/reviewing skill references, and its test rows. Reverses decisions 0013/0015 — log the reversal as a decision. Backlog P13 (advisor dogfood) is killed with a one-line closure note. Onboarding/`bee_status` warns (never errors) when a repo's `.bee/config.json` still carries an `advisor` key — the key is ignored. | One pattern, one mental model; dead-but-kept code is exactly the debt grooming hunts. Owner's stated direction 2026-07-11. |
| D2 | Delegation trigger is a default rubric plus orchestrator judgment: a mechanical step delegates down-tier when it needs reading >3 files OR content the main model only needs as a digest (not verbatim); the orchestrator may override either way at dispatch, same spirit as tier-judging (decision 0016). Prose-ruled — no new hook enforces the threshold. | Hard thresholds misfire both directions (2 huge files vs 5 tiny ones); judgment-at-dispatch already proved out for tier selection. |
| D3 | The delegation rubric applies in EVERY lane and EVERY phase, tiny/small included. Lane scaling v2 (decision d02a6bc6) is amended, not repealed: its "0 subagents" for tiny/small means zero *ceremony* subagents (reviewers, checkers, gates) — I/O-offload workers are exempt. A 1-file tiny fix still runs inline naturally because it never crosses the D2 rubric. | Compounding/scribing/grooming burn the most main-model tokens today and mostly run while the feature lane is tiny/small; excluding those lanes would keep the biggest burn unaddressed. |

### Agent's Discretion

Planning decides the per-phase delegate/decide split (which named steps in exploring, planning, briefing, validating, reviewing, scribing, compounding, grooming are gather-altitude), the worker-registry and model-guard treatment of non-swarm dispatches, and the rescue-ladder wording once "stronger tier" has no rung above the session model — all constrained by D1–D3 and the pinned assumptions below.

## Terms

| Term | Meaning in this feature |
|------|-------------------------|
| decide-altitude | Work the main session never delegates: gates, judgment calls, state writes, human conversation, accepting/rejecting worker results. |
| gather-altitude | Mechanical steps whose output the main model consumes as a digest: multi-file reads, trace/report mining, doc rendering from artifacts, repo scans. |
| ceremony subagent | A reviewer/checker/panel dispatch that exists to gate quality. Lane scaling v2's "0 subagents" for tiny/small refers to these only (per D3). |
| I/O worker | A down-tier dispatch that only gathers/renders and returns a digest; carries no decision authority; exempt from lane subagent limits (per D3). |
| fan-out pattern | The one remaining cost pattern: best model orchestrates, cheaper tiers execute; replaces the advisor pattern entirely (per D1). |

## Specific Ideas And References

- Owner's cost audit (2026-07-11 session screenshot): Fable 5 [high] session, 509k new tokens / $28, ctx 77% — most burn was the main model inline-running `node -e` trace reads, briefing renders, and report mining. This is the concrete failure the feature fixes.
- Pinned assumption (unasked, conventional): delegated gathers run **in the background where the runtime supports it**, same pattern as the fresh-eyes review (decision 0017) — the session keeps talking to the human while workers gather.
- Pinned assumption: every I/O-worker dispatch keeps the existing audit conventions — anchored `[bee-tier: <tier>]` marker or model param (decision 0023), model name in the Agent description, and the dispatch log (P22).

## Existing Code Context

### Reusable Assets

- `.bee/bin/lib/state.mjs` — `modelForTier`/`resolveTier` (decisions 0012/0015/0019) already resolve tier→model for any dispatch; delegation reuses them unchanged. `advisorModel`/`normalizeAdvisor` (~lines 87–95, 329, 390–394) are the D1 removal targets.
- `.bee/bin/hooks/` model-guard + dispatch log (P22) — already sees every Agent dispatch; coverage question for non-swarm dispatches goes to planning.
- `skills/bee-swarming/SKILL.md` step 4 — the tier-judging rubric wording (decision 0016) is the template for D2's judge-at-dispatch prose.

### Established Patterns

- Background non-blocking dispatch — fresh-eyes reviewer (exploring step 5, decision 0017): dispatch early, collect before the gate; delegated gathers copy this.
- `[bee-tier: <tier>]` anchored marker (decision 0023) — transport for tier intent on every dispatch.

### Integration Points

- `skills/bee-hive/references/routing-and-contracts.md` — advisor section (~line 174) removed; a new "Delegation contract" section is the natural replacement, applying to the per-skill I/O table (~line 100).
- `skills/bee-*/SKILL.md` (all eight phase skills) — each gains its delegate/decide line per planning's split.
- `skills/bee-hive/templates/lib/state.mjs` + `templates/lib/inject.mjs` + `templates/bee_status.mjs` + `templates/tests/test_lib.mjs` — vendored twins of every lib change (byte-equality sweep enforces the pairing).
- `skills/bee-hive/scripts/onboard_bee.mjs` — the stale-`advisor`-key warning (D1).
- `docs/backlog.md` P13 row — killed per D1; P23 row tracks this feature.

## Canonical References

- `docs/history/learnings/critical-patterns.md` — mandatory pre-work reading.
- Decisions 0012 (tiers), 0013/0015 (advisor — being reversed), 0016 (judge at dispatch), 0017 (background/capture), 0019 (cli executors), 0023 (anchored marker), d02a6bc6 (lane scaling v2 — amended by D3).
- Memory: bee-harness-philosophy — lean harness, knowledge over ceremony; delegation is I/O offload, not new ceremony.

## Outstanding Questions

### Resolve Before Planning

(none — D1–D3 unblock planning)

### Deferred To Planning

- [ ] Per-phase delegate/decide split — enumerate each skill's gather-altitude steps against its I/O table in routing-and-contracts; output is one delegate/decide line per skill.
- [ ] Worker registry + model-guard coverage for non-swarm I/O dispatches — do they register via `bee_state.mjs worker add` like swarm workers, or is the P22 dispatch log alone sufficient? Investigation: what breaks (reservations? status surfacing?) if they skip the registry.
- [ ] Rescue ladder "blocked → stronger tier" rung once the session model IS the ceiling — likely re-dispatch at ceiling stays, and the advisor-mode sentence is deleted; confirm wording against swarming-reference.
- [ ] Digest contract for I/O workers — minimal prose spec (what a digest must carry: paths read, facts extracted, verbatim quotes when asked) so main never re-reads what a worker already read.

## Deferred Ideas

- Cheap-session option for host projects (post-advisor) — if a host repo later wants a sonnet-driven session, that's a new feature (per-repo pattern choice), not a config revival of advisor mode. → backlog `proposed` row added.
- Delegation cost telemetry — measure tokens saved per delegated gather (extend P22 dispatch log with a digest-size field). Nice-to-have, not part of this feature.

## Handoff Note

CONTEXT.md is the source of truth. Decision IDs are stable. Planning reads locked
decisions, code context, canonical references, and deferred-to-planning questions.
Validating and reviewing use locked decisions for coverage and UAT.
