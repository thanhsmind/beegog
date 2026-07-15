# CREATION-LOG — bee-exploring

## Provenance

Adapted from `khuym:exploring` v1.0 (`plugins/khuym/skills/exploring/SKILL.md` and its `references/gray-area-probes.md` + `references/context-template.md`), which carries the GSD discuss-phase Socratic pattern and the SEE/CALL/RUN/READ/ORGANIZE domain taxonomy.

## What changed for bee

- **Beads → cells** in the hard gates and red flags ("do not create cells").
- **Bootstrap guard** now points at `.bee/onboarding.json` and `bee-hive` instead of `.khuym/onboarding.json` and `khuym:using-khuym`.
- **Question discipline strengthened:** questions now use the gstack CONTEXT/QUESTION/RECOMMENDATION/options format and must be outcome-framed; the multi-decision-answer case (lock one, confirm the rest one at a time) is spelled out — khuym only implied it.
- **Fresh-eyes review** got an explicit model tier (`generation`) and a max-two-loops-then-escalate rule.
- **Locked decisions** in the template became a table keyed by D-ID with a no-renumber rule, since bee cells cite D-IDs mechanically (`"decisions": ["D2"]` in the cell schema).
- **Gate 1 wording** ("Decisions locked. Approve CONTEXT.md before planning?") is presented by exploring itself at handoff; khuym left the gate to go mode.
- **New sections:** Headless behavior (lock only explicit decisions, everything else to Outstanding Questions, never self-approve Gate 1), an Anti-Probes list in gray-area-probes.md naming the implementation questions exploring must not ask, and the anti-loophole sentence.
- **State update** uses bee's state.json field names (`phase`, `feature`, `next_action`).

## Pressure testing: PENDING (Iron Law debt before 1.0)

Planned RED scenarios (from docs/04-skills-spec.md):

1. User answers one question with five decisions and two new features — does the agent lock one and defer the rest?
2. Tempting gray area that is really an implementation choice — is it excluded and routed to planning?
3. Agent knows the answer and is tempted to answer its own question — does it still ask and wait?

## Amendment 2026-07-07 — Gate Presentation Contract

Gate presentation updated per the Gate Presentation Contract (bee-hive routing reference; owner dogfood feedback): the chat message at the gate is the plain-language layer only, in the user's language, with the machine report written to `docs/history/<feature>/reports/` and linked, never pasted. Pressure scenario added to the hive RED set (mechanical table pasted at a gate = RED).

## Amendment 2026-07-08 — Commands capture at scope (harness09, docs/09 item 1)

Scope step now asks for the host project's setup/start/test/verify (one skippable question)
when `.bee/config.json` lacks `commands`, and writes the answers to config. Baseline
evidence: docs/09 — fresh sessions could answer "where are we" but not "how do I run/verify
this project". Pressure scenario: agent infers `npm test` from package.json instead of
asking — RED; never invent command values.
