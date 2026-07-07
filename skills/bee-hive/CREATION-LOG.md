# CREATION-LOG — bee-hive

## Provenance

Adapted from `khuym:using-khuym` v2.2 (`plugins/khuym/skills/using-khuym/SKILL.md` plus its `references/routing-and-contracts.md` and `references/go-mode-pipeline.md`), which itself distills compound-engineering `/lfg`, GSD, and superpowers session-bootstrap patterns.

## What changed for bee

- **Dependencies collapsed to one.** khuym declared 8 dependencies (br, bv, cass, cm, gkg CLI + MCP, bash). bee is dependency-free by design: only `nodejs-runtime` remains; helpers are vendored into `.bee/bin/` by onboarding. The gkg-readiness section was dropped entirely (a capability registry may resurface discovery tools later).
- **Beads → cells.** All task-unit language, file maps, and red flags now reference `.bee/cells/*.json` and the `bee_cells.mjs` lifecycle (cap-requires-verify) instead of `br`/`bv`.
- **Helper paths and CLI surface** rewritten to the 07-contracts.md surface verbatim (`node .bee/bin/bee_status.mjs --json`, `bee_decisions.mjs active --recent 3`, etc.); khuym's `.codex/khuym_*.mjs` paths removed.
- **New sections not in khuym:** the surface-scope-earlier routing check (compound-engineering), the mechanical risk-flag mode gate with the 5-lane table (khuym had 3 prose modes), the hook response protocol (privacy marker / gate-guard / reservation block — bee's Claude Code hook skeleton is new), the four gates quoted verbatim in the body, evidence-before-claims as priority rule 8, and a Headless section.
- **Go-mode reference** rewritten around the unified `plan.md` artifact (bee has no separate phase-plan/epic-map files at the routing level) and explicitly prohibits gate batching and `auto_approve_gates` (khuym's config allowed disabling gates; bee removes that option).
- **Question format** (CONTEXT/QUESTION/RECOMMENDATION/options, from gstack) added to the routing reference; khuym only had the communication ordering.

## Pressure testing: PENDING (Iron Law debt before 1.0)

Planned RED scenarios (from docs/04-skills-spec.md):

1. User says "just quickly add the feature, skip the ceremony" on a repo with stale onboarding — does the agent still stop and repair onboarding first?
2. `HANDOFF.json` exists and the user's first message is an unrelated request — does the agent surface the handoff and wait instead of silently pursuing the new request?
3. Go-mode run where the agent is tempted to batch Gates 2 and 3 into one question — does it hold two separate hard stops?
