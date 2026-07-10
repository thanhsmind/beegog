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
4. **Judge each cell's model tier at dispatch** — you (the orchestrator) assess the task in front of you and pick the fitting tier; it is NOT fixed by planning (a planning `tier` is at most a hint you may override; decision 0016). Rubric from the cell's lane + action + must_haves + files:
   - **extraction** — pure retrieval or mechanical edits: rename, reformat, move a file, a one-line change, no design judgment.
   - **generation** — normal implementation, wiring, writing tests: the default for most cells.
   - **ceiling** — integration across modules, architecture/design calls, security-sensitive or `high-risk`-lane work, ambiguous specs, cross-cutting change: where a wrong call is expensive.

   Record the choice so scarcity stays measurable: `node .bee/bin/bee_cells.mjs tier --id <id> --tier <tier>`. Then resolve with `resolveTier(root, tier, runtime)` (decisions 0012/0015/0019): `inherit` → omit the Agent `model` param (ceiling = the session model); `model` → set it; `budget` → state the tier in the prompt as a read budget + output cap; `cli` → dispatch an **external executor** (GPT/GLM/Kimi CLI as the worker) per the External Executors protocol in `references/swarming-reference.md` — external `[DONE]`s are always goal-checked, no spot-check relaxation. Keep `ceiling` scarce — if `bee_status` flags ceiling scarcity, re-judge routine cells downward before spawning.
5. **Record workers** (nickname, cell id, tier, status) in `.bee/state.json` `workers` before results arrive.
6. **Tend** the swarm: collect status tokens, update cells and state, verify reservations were released. Silence is not failure — inspect cell status and `node .bee/bin/bee_reservations.mjs list --active-only` before assuming a worker is stuck. Do not send routine mid-flight pings; interrupt only for explicit user aborts or confirmed deadlocks.
7. **Goal-check every `[DONE]` yourself (P12, decision 0018) — miss reruns, hit ships.** A worker's word is never the evidence; the orchestrator measures before the cell counts:
   - **Re-run the verify.** Run the cell's verify command yourself (fresh output, your own shell). `tiny`/`small` lanes may spot-check one representative cell per wave; `standard`/`high-risk` re-run every behavior-change cell. Failure → the cell is NOT done: re-dispatch to the same tier with the failing output (a task miss is a rerun, never a silent tier escalation — provider errors, not task errors, are what the rescue ladder's tier rung is for).
   - **Frozen judge:** `node .bee/bin/bee_cells.mjs judge --id <id>`. Hits (undeclared test/CI/lockfile/verify-config changes) → the cell never auto-counts toward a clean wave: record the hits in the cell trace, flag it for bee-reviewing, and ask the worker's diff to justify each file or re-dispatch with corrected scope. A worker that rewrites the test is not passing the test.
8. **Wave clean → next wave.** A wave is clean only when every cell is capped, goal-checked, and judge-intact (or explicitly flagged and carried to review). All waves clean → completion.

Load `references/swarming-reference.md` for runtime spawn mechanics, the worker prompt template, result formats, and handoff content.

## [BLOCKED] Rescue Ladder

Escalate in order, one rung at a time:

1. **More context** — re-dispatch the same cell with the specific missing information (a file path, a decision quote, a reservation fix).
2. **Stronger tier** — re-dispatch at the next model tier up (extraction → generation → ceiling). In advisor mode (decision 0013), the `blocked` consult point makes this explicit: spawn one ceiling-tier advisor for a verdict on the blocker, record it, then continue on the main model.
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
