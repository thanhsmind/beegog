# CREATION-LOG — bee-swarming

## Provenance

Adapted from `khuym:swarming` (SKILL.md v1.0 + `references/swarming-reference.md`), khuym's Codex same-session swarm orchestrator. Normative content re-derived from `bee/docs/03-workflow.md` (stage contract: bee-swarming) and `bee/docs/04-skills-spec.md` (entry 5); runtime mechanics from `bee/docs/06-runtime-integration.md`; CLI commands verbatim from `bee/docs/07-contracts.md`.

## What Changed From The Upstream

- **Beads/bv graph → cells + waves.** khuym's `bv --robot-triage --graph-root <EPIC_ID>` graph triage is replaced by wave analysis over `node .bee/bin/bee_cells.mjs ready` plus each cell's `deps` and `files`. No `br`/`bv` dependency; frontmatter is `nodejs-runtime` only.
- **Dual-runtime spawn mechanics.** khuym documented Codex `spawn_agent` only; the bee reference shows Claude Code (Agent tool, `run_in_background` waves, SendMessage rescue, chain-nudge hook) and Codex (`fork_context=false`, parent-thread token collection, `wait_agent` on demand) side by side.
- **Model tiers made explicit per dispatch** (extraction/generation/ceiling with Claude Code model mapping and the read-budget/output-cap fallback), per compound-engineering via bee's shared standards. Upstream had only "slim explicit context".
- **Isolation contract tightened and enumerated:** cell id, CONTEXT.md + plan.md paths, global constraints, reservation nickname, status-token protocol — with an explicit "never session history" rule and the cold-pickup routing note.
- **[BLOCKED] rescue ladder added** (more context → stronger tier → escalate) — upstream handled rescues ad hoc.
- **Headless section added:** blockers defer to Outstanding Questions; gates never self-approved.
- Renames: `KHUYM_AGENT_NAME` → `BEE_AGENT_NAME`, `.khuym/` → `.bee/`, `.codex/khuym_*.mjs` → `.bee/bin/bee_*.mjs`, phase → slice.

## Pressure Testing

Pressure testing: PENDING (Iron Law debt before 1.0)

Planned RED set (from 04-skills-spec.md):

1. Two ready cells share a file — split waves or adjust reservations, not "be careful".
2. A worker is silent for a long time — inspect cells/reservations vs ping or assume failure.
3. The orchestrator is tempted to "just fix" a one-line bug itself instead of dispatching a cell.

## Amendment 2026-07-07 — Spawn-type pin

Dogfood finding (anphabe-gog): with the compound-engineering plugin installed, the review wave dispatched `ce-*-reviewer` agent types instead of bee's inline personas — name-matched agent types from other plugins hijack the dispatch. Fix: spawn contract now pins the runtime's default/general subagent type with the persona/template inline; third-party agent types are banned even on a name match (different finding contract + silent install-dependent behavior). New red flag added. Pressure scenario for the RED set: a registered agent type named exactly like the needed reviewer exists — does the agent still spawn default + inline persona?
