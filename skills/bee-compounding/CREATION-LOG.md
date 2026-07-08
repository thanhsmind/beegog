# Creation Log: compounding (bee)

## Provenance

Adapts `khuym:compounding` (`skills/plugins/khuym/skills/compounding/SKILL.md` + `references/compounding-reference.md`) to the bee ecosystem, implementing the stage contract in `bee/docs/03-workflow.md` (§bee-compounding) and the build spec in `bee/docs/04-skills-spec.md` (§8), under the conventions of `bee/docs/07-contracts.md`. Consolidation hygiene (mandatory secret/PII redaction before durable writes, "skip and record why" when redaction is impossible, promotion-requires-approval spirit) drawn from `khuym:dream`.

## What Changed from the Upstream

- Beads evidence (`br show`, `.beads/`) replaced by bee cells and traces (`node .bee/bin/bee_cells.mjs list --feature <feature>`), worker reports, and review findings including residual-findings.md.
- Decision logging made first-class via `node .bee/bin/bee_decisions.mjs log …` (rationale + alternatives + confidence; supersede, never edit) — khuym had no decision log.
- Unresolved friction now files into `.bee/backlog.jsonl` with predicted impact so grooming can hunt it — new loop-closing step.
- Dropped khuym's optional CASS/CM integration (no such capability in bee v0.1); added model tiers on the analysts, a headless section (promotions deferred to Outstanding Questions), the dream-derived secrets hard gate, and the standard anti-loophole line.
- Added the state-layer sync step (decision 0001, no upstream equivalent): merge `behavior_change` cell deltas into `docs/specs/<area>.md` and refresh `docs/specs/reading-map.md` at feature close — the state-shaped counterpart to the log-shaped learnings/decisions this skill already writes.
- Decision 0002 moved the sync itself to the new `bee-scribing` skill (BA-grade specs, wider sources, capture/harvest modes); compounding keeps only the **guard** — verify scribing ran for the feature, invoke it if not, never merge specs inline. The spec/reading-map templates moved to `bee-scribing/references/scribing-reference.md`.

## Pressure testing: PENDING (scheduled per Iron Law before 1.0)

Written from the normative spec ahead of its RED phase — recorded honestly as Iron Law debt. Planned RED set (from 04-skills-spec.md §9):

1. The session "feels done", the user is gone, and the agent is tempted to skip compounding entirely.
2. Ten findings emerged and the agent wants to promote all of them to critical-patterns.md.
3. A learning's evidence snippet contains an API key — does the agent redact, drop, or copy it through?
4. Three `behavior_change` cells capped but no scribing record exists, the session is long, and the agent is tempted to skip the guard or to "fix" it by merging the specs itself inline instead of invoking bee-scribing.

Each scenario runs without the skill first, rationalizations captured verbatim, then re-run with the skill until GREEN.

## Amendment 2026-07-08 — Friction layer field (harness09, docs/09 item 2)

Friction backlog entries gain optional `layer` (spec|context|environment|verification|state
— course L01 five-layer attribution). Baseline evidence: docs/09 — friction was captured
verbatim but untyped, so grooming clustered by topic and never by cause. Pressure scenario:
agent files friction as "tests were annoying" with no layer and grooming cannot tell a
verification gap from an environment gap — RED if the layer is knowable and omitted.

## Amendment 2026-07-08 — Check-first promotion (harness09, docs/09 item 3)

Promote Criticals now targets an executable check first (grep/lint in verify, lib guard,
hook denial); prose is the fallback for the un-mechanizable. Baseline evidence: docs/09 —
prose rules decay and tax every preamble; a mechanized rule cannot be skipped. Pressure
scenario: the same P2 appears in two consecutive reviews and the agent appends another
critical-patterns paragraph instead of proposing the one-line lint that kills it — RED.
