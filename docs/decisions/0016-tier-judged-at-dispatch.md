# 0016 — The orchestrator judges the model tier at dispatch, not planning

- **Status:** active — owner-approved 2026-07-09; **built in 0.1.15** (2026-07-09). Refines P7 (decision 0012). Lib suite green (64/64), onboarding suite green.
- **Date:** 2026-07-09
- **Source:** owner: *"ceiling khi tạo sub agent thì tự đánh giá nó phù hợp với mức độ model nào rồi gắn, không nên fix."* The model tier should be a spawn-time judgment about the task in front of the orchestrator, not a label frozen at planning time.
- **Confidence:** 0.75 (the mechanism is small and tested; the judgment rubric is prose and wants dogfooding).

## Decision

The **model tier is judged by the orchestrator at dispatch**, from the cell it is about to spawn — not fixed by planning. A planning-time `tier` is at most a hint the orchestrator may override.

Rubric (from lane + action + must_haves + files):

- **extraction** — pure retrieval / mechanical edits (rename, reformat, move, one-liners); no design judgment.
- **generation** — normal implementation, wiring, tests; the default.
- **ceiling** — integration across modules, architecture/design calls, security-sensitive or `high-risk`-lane work, ambiguous specs, cross-cutting change. `ceiling` resolves to the session model (decision 0015) and stays scarce.

The orchestrator **records its choice** so the scarcity view stays honest: `node .bee/bin/bee_cells.mjs tier --id <id> --tier <tier>` → `setTier(root, id, tier)` in `lib/cells.mjs`. `tierMix` / `ceilingScarcityWarning` read `cell.tier`, so they now reflect real dispatch decisions rather than plan-time guesses.

## Rationale

- **The orchestrator has the most context at spawn.** It sees the actual cell, the diff so far, and the wave — a better place to size the model than planning, which is shaping the work, not sizing each worker.
- **Not fixed = adaptive.** A cell that looked routine at planning may reveal itself as integration work by the time it dispatches; judging at dispatch lets the model track the real difficulty.
- **Scarcity stays measurable.** Recording the chosen tier keeps P7's ceiling-share warning meaningful; without a record it would go blind.

## Alternatives considered

- **Keep planning assigning a fixed tier (P7 as-is).** Rejected per the owner — freezes a judgment too early, before the orchestrator sees the task.
- **No recording, judge silently at spawn.** Rejected — then the scarcity signal has nothing to count; a cheap `tier` command keeps the discipline honest.
- **Auto-classify tier mechanically from lane/flags.** Left as a possible future default (a helper could suggest a tier); for now the orchestrator's judgment leads, with the rubric as guidance.

## Scope (built)

- `lib/cells.mjs`: `setTier(root, id, tier)` (validates against `MODEL_TIERS`).
- `bee_cells.mjs`: `tier --id --tier` command + usage.
- `bee-swarming/SKILL.md` step 4: judge-at-dispatch rubric + record via the `tier` command.
- `bee-planning/SKILL.md`: `tier` is now an optional hint, not a fixed assignment.
- Tests: `test_lib.mjs` setTier fixtures (validation + re-tier clears scarcity). Version 0.1.14 → 0.1.15.

## Consequences

- Planning output is simpler (no tier bookkeeping required); the orchestrator owns model sizing.
- `cell.tier` now means "the tier the orchestrator dispatched at" (or a planning hint until dispatch), not a plan-time contract.
- Not yet dogfooded on a real swarm — confirm the rubric produces sensible tiers and the ceiling actually stays scarce.
