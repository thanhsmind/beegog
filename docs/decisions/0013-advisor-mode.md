# 0013 — Advisor mode (cheap main loop, ceiling consulted on demand)

- **Status:** reversed 2026-07-12 by fanout-delegation D1 (see .bee/decisions.jsonl reversal entry) — owner decision to consolidate on the single fan-out orchestrator pattern (replaces both advisor and orchestrator patterns); advisor mode removed before dogfood completed.
- **Date:** 2026-07-09
- **Source:** the same Anthropic write-up behind decision 0012 described **two** model-pairing strategies. 0012 built the orchestrator/fan-out one (strategy 2). This decision adds the **advisor** one (strategy 1): the cheap model is the main worker running all the loops, and the strong model is called only when a decision is hard — ~92% of the strong model's SWE-bench Pro score at ~63% of the cost. Owner approved building it after 0012/P7 landed.
- **Confidence:** 0.65 (config + resolver + surfacing are built and tested; the consult *protocol* is prose across gate/blocked points and not yet dogfooded).

## Decision

Add an opt-in **advisor mode**: run the whole session on the `generation` tier and consult the `ceiling` model only at configured hard calls. Off by default; per-repo in `.bee/config.json`:

```json
"advisor": { "enabled": true, "at": ["shape", "execution", "blocked"] }
```

- `at` is a subset of consult points: `context` · `shape` (Gate 2) · `execution` (Gate 3) · `review` · `blocked` (swarming rescue).
- At each configured point the agent frames **one tight question**, spawns **one `ceiling`-tier subagent** for the verdict, records it, and continues on the main model — the ceiling stays scarce (one call per point).
- Resolver `advisorModel(root, point, runtime)` in `lib/state.mjs` returns the ceiling model when advisor mode is on and `point` is configured, else `null`. It reuses the decision 0012 `models` map, so the ceiling model is whatever that repo pinned.
- State is surfaced loudly every session (preamble + `bee_status` print `ADVISOR MODE ON`) — a cheap-model session is never silently running without its safety consult.

## Rationale

- **Completes the pattern pair.** 0012 gave the fan-out (ceiling orchestrates cheap workers); 0013 gives the inverse (cheap loop, ceiling advises). Same `models` map, same "ceiling is scarce" discipline — two shapes, one lever.
- **Reuses the tier machinery.** No new model config — advisor resolves the existing `ceiling` tier. The only new state is the `advisor` toggle + consult points.
- **Not gate-bypass, not a human replacement.** The human still approves Gates 1–4. The advisor informs the agent's *recommendation*; it never self-approves. It composes with the rescue ladder (`blocked` = the ladder's "stronger tier" rung, made explicit) and review synthesis.
- **Loud by default-visible.** Like gate-bypass, the one real risk is forgetting it is on; the preamble/status lines make that impossible.

## Alternatives considered

- **A `bee-advisor` toggle skill (like bee-bypass-gate).** Deferred — advisor is a set-once-per-repo config; a skill would hit the decision-0002 skill-cap gate for marginal UX. Config edit + the contract doc is enough for now.
- **Always-on advisor at every gate.** Rejected — consulting ceiling at every point re-introduces the cost the pattern removes. The `at` subset keeps it scarce; default is the three highest-leverage points.
- **Mechanically forcing the consult (hook/gate block).** Rejected for now — the consult is a judgment step (frame the question, read the verdict), prose-ruled like the rest of the chain; the loud surfacing is the enforcement.

## Scope (built)

- `lib/state.mjs`: `ADVISOR_POINTS`, `normalizeAdvisor`, `readConfig().advisor`, `advisorModel(root, point, runtime)`; version 0.1.10 → 0.1.11.
- `onboard_bee.mjs` `DEFAULT_CONFIG.advisor` (off by default).
- `lib/inject.mjs` + `bee_status.mjs`: loud `ADVISOR MODE ON` line when enabled.
- `bee-hive/references/routing-and-contracts.md`: the Advisor mode contract (the consult protocol); `bee-swarming/SKILL.md` rescue ladder points to it at `blocked`.
- Tests: `test_lib.mjs` advisor fixtures (off by default, point subset, unknown-point filtering, models override).

## Consequences / deferred

- **Consult protocol is prose across points.** The gate consults (shape/execution) live in the Gate Presentation flow via the contract doc; only `blocked` has an inline skill pointer. A future pass could add explicit consult steps to validating (Gate 3) and reviewing if dogfooding shows they are missed.
- **Not dogfooded.** Running a real feature end-to-end on generation with ceiling consults is the debt to close before 1.0 — confirm the verdicts actually change decisions and the ceiling stays scarce (one call per point).
