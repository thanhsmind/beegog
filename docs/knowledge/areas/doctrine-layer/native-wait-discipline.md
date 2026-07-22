---
type: bee.area
title: Doctrine Layer — native Codex wait discipline
description: "What an empty wait means, the mandatory progress interval before another bounded wait, and why a timeout never changes worker or ownership state."
timestamp: 2026-07-21
bee:
  id: doctrine-layer-native-wait-discipline
  lifecycle: active
  areas: [doctrine-layer]
  required_context: [areas/doctrine-layer/overview.md]
  decisions: [codex-agent-wait-loop D1-D5 + ebb70b72-e5e5-43f2-a692-beb371b99f6c (native empty-wait discipline and live Codex surface)]
  sources: ["codex-agent-wait-loop (cells codex-agent-wait-loop-2/codex-agent-wait-loop-3, 2026-07-15/2026-07-19 — native wait rule plus independently reviewed D6/D7 repair)", "docs/specs/doctrine-layer.md#B6", "docs/specs/doctrine-layer.md#R9", "docs/specs/doctrine-layer.md#R10", "docs/specs/doctrine-layer.md#E4", "docs/specs/doctrine-layer.md#E5"]
  authoritative_for: "doctrine-layer: native Codex wait discipline"
---

# Doctrine Layer — Native Codex Wait Discipline

Silence is not failure. A `wait_agent` call that returns timeout or no
completion reports only that nothing arrived in that interval — so the rule that
governs it is about what must happen *between* waits, and about what a timeout
is never allowed to change.

## Behaviors & Operations

**B6 — A native Codex empty wait is separated from any later wait by visible,
material progress.** Trigger: `wait_agent` returns timeout or no completion for
a bee-owned native subagent. What happens: the assistant never calls
`wait_agent` again immediately. It first continues material task-local work; if
none remains, it takes exactly one `list_agents` snapshot. At least one material
task-local action satisfies this branch; exhausting every independent action is
not required. If an agent completes during the interval, its result is handled
exactly once, the relevant live-agent set is recomputed, and zero live agents
ends collection without another wait. The assistant then sends one concise
commentary update naming both the live agent state and the next action, after
which a later bounded wait is allowed only when a relevant agent remains. What
does not count: no-op work,
repeated state reads, hidden reasoning, generic commentary, or commentary alone.
What remains owned: every running agent, claim, and reservation; timeout never
licenses interrupt, duplicate dispatch, claim release, or reservation release.
This applies to ordinary gathers and all bee stages using native Codex agents.
External CLI processes and artifact polling keep their separate executor
contract. Authority, urgency, or a no-chatter request creates no exception
(codex-agent-wait-loop D1-D7).

## Business Rules

- **R9** — For bee-owned native Codex agents, `empty wait → wait_agent` is
  forbidden. Another bounded wait is allowed only after the exact progress
  interval: at least one material task-local action or, only when none remains,
  exactly one `list_agents` snapshot; handle any completion exactly once,
  recompute liveness, then commentary naming live agent state and next action.
  Zero relevant live agents means no later wait.
- **R10** — A native wait timeout never changes worker or ownership state. It
  never licenses interrupt, duplicate dispatch, claim release, or reservation
  release; external process and artifact polling remains a separate contract.

## Edge Cases Settled

- **“Sit idle” does not ban native bounded waiting.** It bans scratchpad/file
  polling for harness-managed agents. Native Codex uses `wait_agent` as its yield
  mechanism, with B6's mandatory progress interval after an empty wait; external
  executors continue to use their process/artifact contract.
- **A completion during the interval is not merely elapsed time.** It satisfies
  progress only when its result is consumed exactly once before the update. The
  assistant then recomputes liveness and stops collection instead of issuing an
  unnecessary empty wait when no relevant agent remains.
