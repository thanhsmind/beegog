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

You are the orchestrator. Launch workers, tend results, handle rescues, keep the swarm moving. In `standard`/`high-risk` lanes you never implement cells yourself — spawned workers load bee-executing and do the work.

## Solo execution (tiny/small lanes)

For `tiny` and `small`, **no workers are spawned** — you implement the cell(s) directly in-session, keeping the cell discipline intact: claim the cell, read its `read_first`, implement within its `files`, run its `verify` command and quote the fresh output, record `verification_evidence` (and `red_failure_evidence` for `behavior_change` cells per the cap rules), cap it. Reservations are unnecessary with one actor; the frozen-judge check (`node .bee/bin/bee.mjs cells judge --id <id>`) still runs before capping. Then hand off: both `tiny` and `small` present the done-report (diff + fresh verify output + capture line) and invoke bee-scribing — no auto reviewer; the 1-correctness-reviewer contract lives inside a user-invoked session (implementation is verified; independent review runs only on user request, R1). Everything below this section is the worker protocol for `standard`/`high-risk`.

## Preconditions

- Gate 3 is approved: run `node .bee/bin/bee.mjs status --json` and confirm `gates.execution` is true. If not, stop — return to bee-validating. Never spawn workers before execution approval.
- Sweep stale reservations: `node .bee/bin/bee.mjs reservations sweep`
- `docs/history/learnings/critical-patterns.md` has been read when present.

## Operating Contract

1. **Wave analysis.** List claimable cells with `node .bee/bin/bee.mjs cells ready` and walk their deps: cells with all deps capped and no shared files run in parallel within one wave; dependent or file-overlapping cells go to later waves. Two ready cells sharing a file means fix the reservations or split the cell scope — never "spawn both and be careful". The dep/overlap walk and verify-output capture delegate as extraction-tier I/O workers per the Delegation contract (D2/D3, `bee-hive/references/routing-and-contracts.md`); judgment (assignment, tier choice, goal-check verdicts) stays on the orchestrator.
2. **Assign.** The orchestrator picks exactly **one cell per worker**. Workers never self-select, browse the ready list, or take a second cell.
3. **Spawn with the isolation contract.** Each worker prompt contains: the cell id, the path to `docs/history/<feature>/CONTEXT.md` and `docs/history/<feature>/plan.md`, the global constraints, its reservation identity (agent nickname), and the status-token protocol (`[DONE] [BLOCKED] [HANDOFF] [NOOP]`) — **nothing else, never session history**. Use the template in `references/swarming-reference.md`. Spawn as the runtime's default/general subagent type with that template inline — NEVER as an agent type registered by another plugin, even when the name matches the role: a same-named agent carries a different contract and makes the run depend on what happens to be installed.
4. **Judge each cell's model tier at dispatch** — you (the orchestrator) assess the task in front of you and pick the fitting tier; it is NOT fixed by planning (a planning `tier` is at most a hint you may override; decision 0016). Rubric from the cell's lane + action + must_haves + files:
   - **extraction** — pure retrieval or mechanical edits: rename, reformat, move a file, a one-line change, no design judgment.
   - **generation** — normal implementation, wiring, writing tests: the default for most cells.
   - **ceiling** — integration across modules, architecture/design calls, security-sensitive or `high-risk`-lane work, ambiguous specs, cross-cutting change: where a wrong call is expensive.

   Record the choice so scarcity stays measurable: `node .bee/bin/bee.mjs cells tier --id <id> --tier <tier>`. Then resolve with `resolveTier(root, tier, runtime)` (decisions 0012/0015/0019): `inherit` → omit the Agent `model` param AND carry the [bee-tier: ceiling] marker, anchored to the first non-whitespace token of the dispatch prompt or the very start of the description — a marker placed anywhere else never counts (decision 0023, hardened per P1-1 — a bare dispatch with neither param nor an anchored marker is denied by the model-guard hook; ceiling = the session model); `model` → set it; `budget` → state the tier in the prompt as a read budget + output cap and carry the matching [bee-tier: <tier>] marker at that same anchored position; `cli` → dispatch an **external executor** (GPT/GLM/Kimi CLI as the worker) per the External Executors protocol in `references/swarming-reference.md` — external `[DONE]`s are always goal-checked, no spot-check relaxation. Keep `ceiling` scarce — if `bee_status` flags ceiling scarcity, re-judge routine cells downward before spawning.

   **After the tier choice, resolve the advisor slot for this dispatch** (D1/D2): `resolveAdvisor(root, runtime)`, then run the degenerate check yourself — this is the orchestrator's judgment, at dispatch, against the worker's own resolved model (decision 0016); the worker never self-assesses it. Add an `Advisor` line to the dispatch (template in `references/swarming-reference.md`) **only** when the advisor resolves AND passes the check:
   - No advisor configured, or the advisor resolves to the **same model name** as the worker's resolved model → skip, no `Advisor` line.
   - The worker is dispatched at **ceiling** tier → always skip (ceiling is already the strongest model in play).
   - Otherwise, for distinct names: judge by the known claude order (haiku < sonnet < opus); an owner-configured advisor whose relative strength isn't covered by that order — including any `cli`-shaped advisor — is presumed stronger by configuration intent.
   - When it passes, the `Advisor` line names the advisor identity and states its proven transport verbatim (model-shaped vs cli-shaped, per `references/swarming-reference.md`) — this must match what bee-executing's Advisor Consult section tells the worker to run.
5. **Record workers** before results arrive: `node .bee/bin/bee.mjs state worker add --nickname <n> --cell <id> --tier <tier> --status <status>` per worker.
6. **Tend** the swarm: collect status tokens, update cells and state, verify reservations were released. Silence is not failure — inspect cell status and `node .bee/bin/bee.mjs reservations list --active-only` before assuming a worker is stuck. Do not send routine mid-flight pings; interrupt only for explicit user aborts or confirmed deadlocks.
7. **Goal-check every `[DONE]` yourself (P12, decision 0018) — miss reruns, hit ships.** A worker's word is never the evidence; the orchestrator measures before the cell counts:
   - **Re-run the verify.** Run the cell's verify command yourself (fresh output, your own shell). `tiny`/`small` lanes may spot-check one representative cell per wave; `standard`/`high-risk` re-run every behavior-change cell. Failure → the cell is NOT done: re-dispatch to the same tier with the failing output (a task miss is a rerun, never a silent tier escalation — provider errors, not task errors, are what the rescue ladder's tier rung is for).
   - **Frozen judge:** `node .bee/bin/bee.mjs cells judge --id <id>`. Hits (undeclared test/CI/lockfile/verify-config changes) → the cell never auto-counts toward a clean wave: record the hits in the cell trace and carry them into any review session that later covers this scope, and ask the worker's diff to justify each file or re-dispatch with corrected scope. A worker that rewrites the test is not passing the test.
   - A `[DONE]` report carrying a **Consults** section is goal-checked exactly like any other — advice never substitutes for fresh verify output; re-run the verify yourself regardless of what the advisor said.
8. **Wave clean → next wave.** A wave is clean only when every cell is capped, goal-checked, and judge-intact (or explicitly flagged and carried to review). All waves clean → completion.

Load `references/swarming-reference.md` for runtime spawn mechanics, the worker prompt template, result formats, and handoff content.

## [BLOCKED] Rescue Ladder

Escalate in order, one rung at a time:

1. **More context** — re-dispatch the same cell with the specific missing information (a file path, a decision quote, a reservation fix).
2. **Stronger tier** — re-dispatch at the next model tier up (extraction → generation → ceiling); ceiling is the session model (decision 0015), so the top rung is handing the blocker back to the orchestrator itself with the worker's evidence attached.
3. **Escalate** — surface the blocker to the user with the worker's diagnosis; if it invalidates the plan, return to bee-planning.

A `[BLOCKED]` arriving here already spent its consult budget for that claim (D1/D3) — the 2-consult cap is per claim, not per cell lifetime, so a rung-1 (more context) re-dispatch grants the re-claimed cell a **fresh** budget. The ladder's three rungs are otherwise byte-unchanged.

A reservation conflict is rescued by adjusting reservations or cell scope — never by telling workers to be careful.

## Context Budget

At roughly 65% context, write `.bee/HANDOFF.json` (phase, feature, mode, cells_in_flight, done, remaining, next_action) and pause safely. Never push through the budget mid-wave.

## Completion Signals

Swarming is complete when either:

- the current slice is executed and more approved work remains → return to bee-planning for the next slice, or
- the final slice is executed → tell the user: `Swarm execution complete for the final slice. Invoke bee-scribing.` Implementation is verified; independent review runs only on user request (R1).

Before declaring completion: all wave cells capped or explicitly blocked/dropped, `node .bee/bin/bee.mjs reservations list --active-only` is empty, and `.bee/state.json` `workers` is cleared.

## Fresh-Session Handoff (offer, never auto)

When a cell or wave finishes (capped, verify green) and further execution-approved work remains — this lane or another Gate-3-approved one — the finish → claim-next → planned-next handoff flow is available (fresh-session-handoff D1/D2): claim the next unit (`bee cells claim-next`), write the handoff (`bee state handoff write --kind planned-next --writer-session <id> --previous-cell <capped-id> --next-cell <claimed-id>`), and offer the user a `/clear` — the fresh session that follows adopts the carried claim automatically and opens straight into the next cell, no confirmation asked. The orchestrator **offers** this; it never issues `/clear` itself and never treats the offer as accepted by default — the user decides. Declining leaves the claimed cell exactly where it is; nothing is lost.

## Hard Rules

- In `standard`/`high-risk` lanes, never implement cells yourself — not even a one-line fix; make it a cell and dispatch it. (`tiny`/`small` run solo by design — see Solo execution.)
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
- orchestrator editing source files in a `standard`/`high-risk` wave
- workers spawned for a `tiny`/`small` lane (solo execution owns those)

Violating the letter of the rules is violating the spirit of the rules.

Swarm execution complete for the final slice. Invoke bee-scribing skill.

## Reference Files

| File | When to Load |
|---|---|
| `references/swarming-reference.md` | Runtime spawn mechanics, worker prompt template, result formats, red flags |
| `.bee/state.json` | Runtime worker and phase state |
| `.bee/HANDOFF.json` | Pause/resume artifact |
