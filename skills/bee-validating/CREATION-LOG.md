# CREATION-LOG — bee-validating

## Provenance

Adapted from `khuym:validating` (SKILL.md v1.2 + `references/validation-reference.md`), which itself distills gsd's plan-checking discipline. Normative content re-derived from `bee/docs/03-workflow.md` (stage contract: bee-validating) and `bee/docs/04-skills-spec.md` (entry 4), with CLI commands taken verbatim from `bee/docs/07-contracts.md`.

## What Changed From The Upstream

- **Beads → cells.** All `br`/`bv` dependencies and bead review removed; cells are read through `node .bee/bin/bee_cells.mjs` (zero-dependency vendored helpers). Frontmatter dependency is now only `nodejs-runtime`.
- **Artifact set simplified.** khuym's shape artifacts (`phase-plan.md`, `epic-map.md`, `current-story-pack.md`, contracts, story maps) collapse into bee's single `plan.md` with `artifact_readiness`; the missing/unapproved-input rule now keys off that field.
- **Plan checker made explicitly adversarial** with the 5 bee dimensions (requirement/decision coverage, cell completeness, dependency correctness, key links, scope sanity) and BLOCKER/WARNING vocabulary; khuym's checker listed dimensions without the adversarial stance or finding severity.
- **High-risk persona panel added** (compound-engineering): coherence + feasibility always, conditional security/product/scope-guardian lenses, auto-fix vs present-for-decision synthesis. Not present upstream.
- **Model tiers named per dispatch** (generation for checker and cell reviewer) per bee's shared standards.
- **Headless section added:** all checks run, ambiguity deferred to Outstanding Questions, hard stop at the Gate 3 question — never self-approved.
- Repair routing retargeted from khuym's contract/story-map artifacts to `plan.md` + cells.
- Gate 3 wording fixed verbatim from 03-workflow.md: "Feasibility validated. Approve execution?"

## Pressure Testing

Pressure testing: PENDING (Iron Law debt before 1.0)

Planned RED set (from 04-skills-spec.md):

1. Everything "looks right" and the user is impatient — does the agent still demand command-output evidence?
2. A spike returns NO but a workaround "probably works" — does the agent return to planning anyway?
3. The plan-checker finds a BLOCKER on iteration 3 — escalate to the user vs iterate a 4th time.

## Amendment 2026-07-07 — Gate Presentation Contract

Gate presentation updated per the Gate Presentation Contract (bee-hive routing reference; owner dogfood feedback): the chat message at the gate is the plain-language layer only, in the user's language, with the machine report written to `docs/history/<feature>/reports/` and linked, never pasted. Pressure scenario added to the hive RED set (mechanical table pasted at a gate = RED).
