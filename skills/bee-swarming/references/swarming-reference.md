# Swarming Reference

Load after Gate 3 approval, before spawning the first wave.

## Protocol

1. Confirm gates and state: `node .bee/bin/bee_status.mjs --json`
2. Sweep reservations: `node .bee/bin/bee_reservations.mjs sweep`
3. Compute waves: `node .bee/bin/bee_cells.mjs ready` + each cell's `deps` and `files` (overlapping files → separate waves or re-scoped cells).
4. Assign one cell per worker, build each prompt from the template below, pick and state the model tier.
5. Record workers in `.bee/state.json`, spawn the wave, tend, repeat.

## Runtime Spawn Mechanics (side by side)

| | Claude Code | Codex |
|---|---|---|
| Spawn | `Agent` tool, one call per worker; put the worker prompt in `prompt`; set `run_in_background: true` so the whole wave runs in parallel (send all spawns of a wave in one message) | `spawn_agent(agent_type="worker", message="<WORKER_PROMPT>", fork_context=false)` |
| Model tier | `model` parameter per Agent call: `haiku` ≈ extraction, `sonnet` ≈ generation, inherit/`opus` ≈ ceiling | No per-agent model selection — state the tier in the prompt and enforce it as a read budget + output cap |
| Result collection | You are notified when each background agent completes; its final message is the worker report — parse the leading status token | Status tokens arrive in the parent thread; use `wait_agent(..., timeout_ms=60000)` only when a specific result is needed |
| Follow-up / rescue | `SendMessage` to the same agent id continues it with context intact; a new `Agent` call starts fresh | Re-`spawn_agent` with enriched context; do not send routine `send_input(...)` mid-flight |
| Harness assist | `bee-chain-nudge` hook fires on SubagentStop: collect the status, update the cell, check reservations | None — the tend loop in this skill is the nudge |
| Isolation guarantee | Fresh context per Agent call; include only the contract fields | `fork_context=false`; never fork the parent context for routine cells |

On both runtimes the integrity rails are identical because they live in the helpers: `bee_cells.mjs cap` refuses without a verify pass, and `bee_reservations.mjs reserve` reports conflicts the worker must turn into `[BLOCKED]`.

## Worker Prompt Template

```text
You are a bee worker subagent.

Identity:
- Agent nickname (reservation identity): <NICKNAME>
- Assigned cell id: <CELL_ID>
- Feature: <FEATURE>
- Model tier: <extraction|generation|ceiling> (model: <MODEL_NAME>)

Inputs — read these; nothing else will be provided:
- docs/history/<FEATURE>/CONTEXT.md
- docs/history/<FEATURE>/plan.md
- Global constraints: <GLOBAL_CONSTRAINTS — locked D-IDs, prohibitions, budgets>

Contract:
- Load the bee-executing skill immediately and follow its loop exactly.
- Execute only the assigned cell. Do not select or accept other work.
- Reserve every file before writing, under your nickname.
- Prefix write-heavy shell commands with BEE_AGENT_NAME="<NICKNAME>".
- Return exactly one final status token: [DONE], [BLOCKED], [HANDOFF], or [NOOP],
  followed by the result fields, and write a report to docs/history/<FEATURE>/reports/.

Startup:
1. Read AGENTS.md.
2. Run node .bee/bin/bee_status.mjs --json
3. Read docs/history/<FEATURE>/CONTEXT.md, then run node .bee/bin/bee_cells.mjs show --id <CELL_ID>
4. Reserve, implement, verify, cap, release, report.
```

Never include session history, other cells, or the orchestrator's reasoning. If a worker needs more than this contract, the cell failed cold-pickup review — route the gap back, do not widen the prompt with transcript.

## Result Formats (expected back from workers)

```text
[DONE] <cell-id>: <title>
Nickname: <name>
Files modified: <paths>
Reservations: reserved <paths>; released yes|no
Verification: <command> -> passed
Commit: <hash>
Next action: <suggestion for the orchestrator>
```

```text
[BLOCKED] <cell-id> - <summary>
Requested files: <paths>
Blocker: <conflict | failing verification | ambiguity | locked-decision conflict>
What happened: <description + diagnosis>
What I need next: <specific parent action>
```

```text
[HANDOFF] <cell-id or none>
Reason: <context high / safe pause>
Progress: <done so far>
Reservations: <active paths or none>
Resume: read .bee/HANDOFF.json, node .bee/bin/bee_cells.mjs show --id <cell-id>, reservation list
```

```text
[NOOP] No safe assigned cell
Reason: <missing, already capped, or unavailable>
Suggested next action: <re-check ready set, fix assignment, respawn later>
```

On each result: update the cell if the worker could not (`block` with reason), clear the worker from `.bee/state.json`, and confirm with `node .bee/bin/bee_reservations.mjs list --active-only` that nothing leaked.

## Handoff JSON

Near 65% context, write `.bee/HANDOFF.json`: `{ phase, feature, mode, cells_in_flight, done, remaining, next_action, written_at }`. Include the resume commands:

```text
node .bee/bin/bee_status.mjs --json
node .bee/bin/bee_cells.mjs ready
node .bee/bin/bee_reservations.mjs list --active-only
```

## Red Flags

- spawning before Gate 3 approval
- full-context forks for routine cells
- worker edits without reservations, or the orchestrator editing anything
- passive waiting while cells/reservations are unhealthy
- conflict resolution by optimism ("they'll probably touch different lines")
- results collected but state.json / cells not updated
- session history in a worker prompt
