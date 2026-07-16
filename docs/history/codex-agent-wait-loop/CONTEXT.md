# Codex Agent Wait Loop — Context

**Feature slug:** codex-agent-wait-loop
**Date:** 2026-07-15
**Exploring session:** complete
**Scope:** Quick
**Domain types:** SEE, RUN

## Feature Boundary

Prevent bee-driven Codex sessions from rendering consecutive empty
`Waiting for agents` / `No agents completed yet` panels while native subagents
are still running. This feature changes orchestrator behavior and its standing
instructions; it does not modify Codex's UI, collaboration tools, or agent
scheduler.

## Locked Decisions

These are fixed. Planning must implement them exactly — cited, never
reinterpreted. Changing one requires a new decision or explicit supersession.

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | A `wait_agent` result with no completion is a timeout signal only. It never means the worker failed, stalled, or lost ownership, and it never licenses interrupt, duplicate dispatch, claim release, or reservation release. | The existing critical pattern already forbids treating silence as death; the screenshot exposes the same mistake one layer earlier. |
| D2 | Codex must never call `wait_agent` twice consecutively after a timeout/no-completion result. The forbidden observable sequence is `empty wait → wait_agent`; no rationale or urgency creates an exception. | The repeated tool calls are what Codex renders as repeated empty panels. |
| D3 | After an empty wait, another wait is allowed only after this exact interval: (1) at least one non-wait action with a material purpose — continue task-local work when any remains, otherwise take one `list_agents` snapshot; then (2) send one concise commentary update naming the running agent state and the next action. Only then may one new bounded wait run. A no-op command, repeated state read, hidden reasoning, or commentary without the non-wait action does not satisfy the interval. | This gives the user meaningful progress between rendered wait panels and makes the break condition pressure-testable. |
| D4 | The rule applies to every bee-owned native Codex subagent flow — exploring, planning, validation, review, swarming, and ordinary delegated gathers. External processes remain governed by their artifact/process polling contract. | Fixing only swarming would leave the same UX defect in review and plain-conversation delegation. |
| D5 | The always-loaded rule must name the native Codex tools `wait_agent` and `list_agents`, while preserving the generic prohibition on file/scratchpad polling for harness-managed subagents. For native Codex, bounded waiting is the yield mechanism; the prior “sit idle” guidance means no file polling and no consecutive empty waits, not that `wait_agent` is forbidden. | Runtime-specific precedence removes the apparent conflict with the 2026-07-11 learning. |
| D6 | “Continue material work” is satisfied after **at least one** material task-local action; it does not require exhausting every independent local action. If a completion arrives during that interval, its result must be handled exactly once before the update, the relevant live-agent set must be recomputed, and no later wait is allowed when that set is empty. | Independent review found both an ambiguous minimum and a stale-completion race that could produce an unnecessary empty wait. |
| D7 | Release evidence must prove both instruction meaning and native behavior: an isolated root-`AGENTS.md` replay, plus controlled native traces for an ordinary gather and a swarm/review wave. The trace must exercise material-work-remaining, completion-during-interval, and zero-live-agent cases. | The original A/B/C GREEN replay loaded canonical procedures and called no collaboration tools, so it proved comprehension but not the current deployment boundary or real orchestration. |

### Agent's Discretion

Planning may choose the smallest set of doctrine, procedure, and anchor-test
surfaces that makes D1–D5 always available and drift-resistant.

## Terms

| Term | Meaning |
|------|---------|
| Empty wait | A completed `wait_agent` call that reports timeout or no completed agent. |
| Consecutive wait | A new `wait_agent` call made after an empty wait without completing D3's exact non-wait-action-then-commentary interval. An agent event is a non-wait action only when the orchestrator actually handles it and then updates the user before waiting again. |
| Progress interval | The exact D3/D6 sequence: at least one material non-wait action, handle any completion received during the interval exactly once, recompute relevant liveness, then one user-visible commentary update before another wait; zero live agents ends collection without another wait. |

## Specific Ideas And References

- User screenshot: `/mnt/e/Temp/jarvis-memorypad/img_1784130141741.png` — two consecutive empty Codex wait panels are the regression example.

## Existing Code Context

### Reusable Assets

- `docs/history/learnings/20260711-subagent-poll-waste.md` — established rule: harness-managed subagents should not be polled through scratch files.
- `skills/bee-swarming/references/swarming-reference.md` — current Codex result-collection contract says to use `wait_agent` when a result is needed, but does not define timeout handling.
- `skills/bee-hive/templates/AGENTS.block.md` — master always-loaded doctrine copied into governed projects.
- `skills/bee-hive/templates/tests/test_lib.mjs` — doctrine anchor tests that make standing rules fail loudly when removed.

### Established Patterns

- Always-applicable orchestration rules belong in the doctrine layer and carry a suite-enforced anchor (`docs/specs/doctrine-layer.md` B2/B4).
- A quiet worker is not a dead worker, and reservations are never released from a stall signal alone (`docs/history/learnings/critical-patterns.md`).

### Integration Points

- `skills/bee-hive/references/routing-and-contracts.md` — shared delegation/tending details.
- `skills/bee-swarming/references/swarming-reference.md` — Codex-specific collection behavior.
- `AGENTS.md` — current repo projection of the master doctrine.

## Canonical References

- `docs/specs/doctrine-layer.md` — placement and anchor requirements for always-applies rules.
- `docs/history/learnings/20260711-subagent-poll-waste.md` — prior polling failure and completion-notification contract.

## Outstanding Questions

### Deferred To Planning

- Which existing census/anchor row should own the new doctrine phrase so the master and current projection cannot drift?
- Which minimal procedure surfaces should repeat the doctrine without creating divergent copies?

## Deferred Ideas

- Changing Codex's visual rendering of collaboration tool calls — outside this repository's ownership.
- Adding a new runtime API that blocks until completion while still emitting periodic commentary — requires Codex platform work, not bee instructions.

## Handoff Note

CONTEXT.md is the source of truth. D1–D7 are stable. Planning should produce the
smallest doctrine-plus-contract change with a RED-first anchor, and validation
must pressure-test the exact timeout/action/commentary/wait sequence for both an
ordinary delegated gather and a swarm worker, while doctrine-anchor tests prove
exploring, planning, validation, and review inherit the same always-loaded rule.
