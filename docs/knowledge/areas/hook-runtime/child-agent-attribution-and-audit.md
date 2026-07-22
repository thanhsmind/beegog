---
type: bee.area
title: "Hook Runtime — child-agent attribution, lifecycle audit, and the passive usage log"
description: "The three checkpoints that observe without authorising: the nudge that finds a returning worker by its registered identity, the bounded paired record of a native child starting and stopping, and the content-free usage log that distinguishes an orchestrator's tool calls from a child's."
timestamp: 2026-07-22
bee:
  id: hook-runtime-child-agent-attribution-and-audit
  lifecycle: active
  areas: [hook-runtime]
  required_context: [areas/hook-runtime/overview.md]
  decisions: [f1ca79b9 (AO15 — orchestrator/subagent attribution fields in tool payloads), "codex-hook-state-parity D1-D3, D8-D13"]
  sources: ["codex-hook-state-parity cells 2, 3, 5 (paired Codex subagent audit, package authority, exclusive hook-source arbitration, and fresh-host handler delivery; capped traces and reports, 2026-07-16)", "advisor-and-orchestration Slice 3A cells ao-3a-1/ao-3a-2 (passive tools logger + onboarding-layer inventory sync, fails-when-broken pair, 2026-07-17)", "docs/specs/hook-runtime.md#B4", "docs/specs/hook-runtime.md#B13", "docs/specs/hook-runtime.md#B17", "docs/specs/hook-runtime.md#R17"]
  authoritative_for: "hook-runtime: observation-only checkpoints over children and tool calls"
---

# Hook Runtime — child-agent attribution, lifecycle audit, and the passive usage log

Three checkpoints here share one property and it is the important one: none of
them can block anything. They watch children start, stop and return, and they
watch tool calls go by, and everything they produce is evidence — bounded,
content-free, and explicitly not a substitute for the pre-spawn control that
does have authority.

## Data Dictionary

| Element | Meaning |
|---|---|
| native-subagent audit | A silent, bounded lifecycle record written after a Codex child starts or stops. It is evidence only: never authorization, never a block, and never a replacement for pre-spawn control. |

## Behaviors & Operations

**B4 — Worker nudges reach the right worker.** The child-stop nudge matches a
returning worker by its registered identity (the same identity workers use to
reserve files); an unregistered child still gets the generic nudge.

**B13 — Codex records paired native-subagent lifecycle evidence.** The same
bounded audit handler receives child-start and child-stop events. It records
only bounded lifecycle identifiers and never prompt, transcript, environment,
credentials, or secrets. Malformed input and write failures stay silent and
fail open; the handler has no deny or block path.

**B17 — A passive usage log records every tool call, and enforces nothing.**
After every tool the assistant runs — any tool, both runtimes — a checkpoint
appends one line to a machine-local usage log: timestamp, the tool's name, and
who ran it (the orchestrating assistant, recorded as no-attribution, or a child
helper, recorded with its identity and helper type — the two are mechanically
distinguishable because a child's calls carry identity fields the
orchestrator's never do). The line **never** contains the tool's input or
output content: names and attribution only, so the log can answer "what ran,
how often, by whom" without ever holding secrets, personal data, or work
content. The checkpoint is pure observation: it cannot block a tool, emits no
messages, and every internal failure fails open with a visible crash line in
the gap log — a broken logger goes loud, never silently green (its own
verification fails when lines stop appearing). It can be switched off per
workspace by its toggle. The log grows without rotation, like every other
machine-local audit log here. This log exists to measure; no claim is made
that it reduces anything.

## Business Rules

- R17 — Codex native-subagent audit is bounded, audit-only, and post-start. It
  never claims pre-spawn authority and never records arbitrary event content.

## Open Gaps

- Child-agent event payloads on the second runtime may not carry a correlatable
  identity for reservation ownership; until proven, those paths rely on the
  helper checks (named fallback, codex-runtime-parity validation).
