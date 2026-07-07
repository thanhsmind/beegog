---
name: bee-swarming
description: >-
  Orchestrate bounded workers over validated cells without implementing anything directly. Use when validating approves execution (Gate 3) and current-slice cells are open and validated.
metadata:
  version: '0.1'
  ecosystem: bee
  dependencies:
    nodejs-runtime:
      kind: command
      command: node
      missing_effect: unavailable
      reason: Orchestration reads cells and sweeps reservations through the vendored .bee/bin helpers.
---

# Swarming — Orchestrator

You are the orchestrator. Launch workers, tend results, handle rescues, keep the swarm moving. You never implement cells yourself — spawned workers load bee-executing and do the work.

## Preconditions

- Gate 3 is approved: run `node .bee/bin/bee_status.mjs --json` and confirm `gates.execution` is true. If not, stop — return to bee-validating. Never spawn workers before execution approval.
- Sweep stale reservations: `node .bee/bin/bee_reservations.mjs sweep`
- `docs/history/learnings/critical-patterns.md` has been read when present.

## Operating Contract

1. **Wave analysis.** List claimable cells with `node .bee/bin/bee_cells.mjs ready` and walk their deps: cells with all deps capped and no shared files run in parallel within one wave; dependent or file-overlapping cells go to later waves. Two ready cells sharing a file means fix the reservations or split the cell scope — never "spawn both and be careful".
2. **Assign.** The orchestrator picks exactly **one cell per worker**. Workers never self-select, browse the ready list, or take a second cell.
3. **Spawn with the isolation contract.** Each worker prompt contains: the cell id, the path to `docs/history/<feature>/CONTEXT.md` and `docs/history/<feature>/plan.md`, the global constraints, its reservation identity (agent nickname), and the status-token protocol (`[DONE] [BLOCKED] [HANDOFF] [NOOP]`) — **nothing else, never session history**. Use the template in `references/swarming-reference.md`. Spawn as the runtime's default/general subagent type with that template inline — NEVER as an agent type registered by another plugin, even when the name matches the role: a same-named agent carries a different contract and makes the run depend on what happens to be installed.
4. **Pick the model tier per dispatch** and state it explicitly in the spawn: `extraction` = cheapest capable (retrieval, mechanical edits), `generation` = mid (implementation, test writing), `ceiling` = the orchestrator's own model (integration, architecture, final review). Where the runtime cannot select per-agent models, fall back to read budgets and output caps in the prompt.
5. **Record workers** (nickname, cell id, tier, status) in `.bee/state.json` `workers` before results arrive.
6. **Tend** the swarm: collect status tokens, update cells and state, verify reservations were released. Silence is not failure — inspect cell status and `node .bee/bin/bee_reservations.mjs list --active-only` before assuming a worker is stuck. Do not send routine mid-flight pings; interrupt only for explicit user aborts or confirmed deadlocks.
7. **Wave clean → next wave.** All waves clean → completion.

Load `references/swarming-reference.md` for runtime spawn mechanics, the worker prompt template, result formats, and handoff content.

## [BLOCKED] Rescue Ladder

Escalate in order, one rung at a time:

1. **More context** — re-dispatch the same cell with the specific missing information (a file path, a decision quote, a reservation fix).
2. **Stronger tier** — re-dispatch at the next model tier up (extraction → generation → ceiling).
3. **Escalate** — surface the blocker to the user with the worker's diagnosis; if it invalidates the plan, return to bee-planning.

A reservation conflict is rescued by adjusting reservations or cell scope — never by telling workers to be careful.

## Context Budget

At roughly 65% context, write `.bee/HANDOFF.json` (phase, feature, mode, cells_in_flight, done, remaining, next_action) and pause safely. Never push through the budget mid-wave.

## Completion Signals

Swarming is complete when either:

- the current slice is executed and more approved work remains → return to bee-planning for the next slice, or
- the final slice is executed → tell the user: `Swarm execution complete for the final slice. Invoke bee-reviewing.`

Before declaring completion: all wave cells capped or explicitly blocked/dropped, `node .bee/bin/bee_reservations.mjs list --active-only` is empty, and `.bee/state.json` `workers` is cleared.

## Hard Rules

- Never implement cells yourself — not even a one-line fix; make it a cell and dispatch it.
- Never spawn before Gate 3 approval.
- Never let workers self-select cells; pass one explicit cell id each.
- Never resolve file conflicts by "being careful" — fix reservations or cell scope.
- Never paste session history into a worker dispatch.
- Silence ≠ failure; no routine mid-flight pings.

## Headless

With `mode:headless`: waves run without check-ins; unrescuable blockers and anything needing user judgment go to an `Outstanding Questions` section of the terminal report instead of a blocking question. Gate 3 must already be approved — headless swarming never grants or assumes it, and it never self-approves Gate 4 at the end.

## Red Flags

- spawning before validation approval
- a worker choosing its own cell, or handling two
- full session context forked into a routine worker
- a worker spawned as another plugin's registered agent type instead of the default type + inline template
- two in-flight workers holding overlapping paths
- passive waiting while cells/reservations look unhealthy
- state.json missing in-flight workers
- orchestrator editing source files

Violating the letter of the rules is violating the spirit of the rules.

Swarm execution complete for the final slice. Invoke bee-reviewing skill.

## Reference Files

| File | When to Load |
|---|---|
| `references/swarming-reference.md` | Runtime spawn mechanics, worker prompt template, result formats, red flags |
| `.bee/state.json` | Runtime worker and phase state |
| `.bee/HANDOFF.json` | Pause/resume artifact |
