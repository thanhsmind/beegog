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
| Model tier | `model` parameter per Agent call = `config.models.claude[tier]` (default `haiku`/`sonnet`/`fable`; ceiling = the orchestrator's model, kept scarce) | `config.models.codex[tier]` if set; today Codex cannot select a per-agent model → tier is enforced as a read budget + output cap in the prompt |
| Result collection | You are notified when each background agent completes; its final message is the worker report — parse the leading status token | Status tokens arrive in the parent thread; use `wait_agent(..., timeout_ms=60000)` only when a specific result is needed |
| Follow-up / rescue | `SendMessage` to the same agent id continues it with context intact; a new `Agent` call starts fresh | Re-`spawn_agent` with enriched context; do not send routine `send_input(...)` mid-flight |
| Harness assist | `bee-chain-nudge` hook fires on SubagentStop: collect the status, update the cell, check reservations | None — the tend loop in this skill is the nudge |
| Isolation guarantee | Fresh context per Agent call; include only the contract fields | `fork_context=false`; never fork the parent context for routine cells |

On both runtimes the integrity rails are identical because they live in the helpers: `bee_cells.mjs cap` refuses without a verify pass, and `bee_reservations.mjs reserve` reports conflicts the worker must turn into `[BLOCKED]`.

## Model Tiers — Config-Driven, Runtime-Keyed (decision 0012)

Only the **cheaper** slots are configured, in `.bee/config.json` `models`, keyed by runtime first (bee is dual-runtime and each names models differently), then slot. **The ceiling is never configured** — it is always the session/orchestrator model (decision 0015). The default is the all-Claude role split (decision 0021) — session model orchestrates, opus reviews, sonnet implements, haiku extracts — and **every slot is editable to whatever models the user actually has** (only a Claude subscription → keep all-Claude; a Codex plan too → point slots at GPT via cli executors):

```json
"models": {
  "claude": { "extraction": "haiku", "generation": "sonnet", "review": "opus" },
  "codex":  { "extraction": null,    "generation": null,     "review": null }
}
```

A slot value may also be `{ "model": "opus", "effort": "xhigh" }` (P17 — per-agent reasoning effort, applied where the runtime supports it, silently recorded where it does not; levels: low/medium/high/xhigh/max) or `{ "kind": "cli", "command": "..." }` (external executor, section below — effort rides inside the command). The `review` slot is consumed by bee-reviewing's specialists, exploring's fresh-eyes, and validating's plan-checker/cell-reviewer; `null` review falls back to generation. **Copy-paste presets** (all-claude, tuned, GPT adversarial review, codex-implements, budget): `docs/model-presets.md` in the bee repo.

- **ceiling** = the strongest model in play = **the session model itself** (no config entry). A ceiling cell inherits the session model — omit the `model` param. Keep it scarce: planning, integration, architecture, final review only. Touch it on every dispatch and the saving evaporates.
- **generation** = the mid worker that runs the loops (implementation, test writing). Where the bulk of dispatches go.
- **extraction** = cheapest capable (retrieval, mechanical edits).
- A **null** tier means the runtime cannot switch per-agent models (Codex today) → state the tier in the worker prompt and enforce it as a read budget + output cap. Set real ids (e.g. `"generation": "gpt-5"`) only if your runtime supports per-agent selection.

Resolve a tier for the active runtime before spawning:

```
node .bee/bin/bee_status.mjs --json    # .models shows both runtime maps
```

Or in code: `resolveTier(root, tier, runtime)` from `lib/state.mjs` returns a typed dispatch — `{type:'inherit'}` (ceiling → omit the model param), `{type:'model', model}`, `{type:'budget'}` (prompt-enforced tier), or `{type:'cli', command}` (external executor, below). The legacy `modelForTier` still returns a model name or `null`. Two shapes, one map: keep the strongest model as `ceiling` and it stays scarce whether it is the orchestrator (fan-out) or a called-only advisor (rescue ladder).

## External Executors — Multi-Provider Workers (P14, decision 0019)

A configurable tier may name an **external CLI executor** instead of a model — that is how GPT/Codex, GLM, Kimi, or any other provider's CLI becomes a bee worker while Claude (or Codex) stays the orchestrator:

```json
"models": {
  "claude": {
    "extraction": "haiku",
    "generation": { "kind": "cli", "command": "codex exec --json -m gpt-5.3-codex -c model_reasoning_effort=high --full-auto" }
  }
}
```

**Dispatch guard — what never routes to a cli executor** (codex-first field notes): a cell whose work needs the *session's* tools — MCP servers (browser, computer-use), credential managers, secrets reads, or anything only the orchestrating harness can reach — stays on a native tier; the external process cannot see those tools and will improvise instead of failing loudly. Destructive/irreversible operations (pushes, releases, external-system mutations) also never go external.

**Dispatch protocol** (`resolveTier(...).type === 'cli'`):

1. **Prompt file, never shell-quoted args:** write the standard worker prompt (template above, verbatim — same contract, same status tokens) to `.bee/workers/<cell-id>.prompt.md`. The external worker starts with ZERO session context — the prompt carries goal, exact paths, constraints, non-goals, and the proof expected (the cell's verify command); spec quality decides success.
2. **Spawn detached, result to a file:** run the configured command as a background process, prompt via stdin, final result to a dedicated file where the CLI supports it (codex: `-o .bee/workers/<cell-id>.result.md`), raw stream to a job log with stderr suppressed — thinking noise bloats the orchestrator's context; re-enable stderr only to debug a failing run. E.g. `<command> -o .bee/workers/<id>.result.md - < .bee/workers/<id>.prompt.md > .bee/workers/<id>.out.log 2>/dev/null`. Record the worker (nickname, cell, `executor: cli`) in `.bee/state.json` as usual.
3. **Tend by artifact, not by chat:** the external worker runs the same `.bee/bin` helpers (reserve → verify → cap → release) because they are plain node scripts — the cell status and reservations ARE the progress signal. Poll `node .bee/bin/bee_cells.mjs show --id <id>` and read the result file for the final status token; never parse the raw JSONL stream. A quiet run is not a dead run — do not kill on silence alone.
4. **Trust boundary is decision 0018, doubly:** an external worker's `[DONE]` is never accepted on its word — the orchestrator ALWAYS re-runs the cell's verify itself and runs `bee_cells.mjs judge --id <id>`. External executors never get the tiny/small spot-check relaxation; every external cell is goal-checked.
5. **Rescue — resume before re-dispatch:** on a goal-check miss, prefer the CLI's session-resume (codex: `codex exec resume --last`, run from the repo dir) with a short prompt carrying the failing verify output — it keeps the worker's context and costs far less than a fresh run. **After 2 failed resume rounds, stop ping-ponging:** mark `[BLOCKED]` and climb the normal rescue ladder (a stuck/garbled run is killed and re-dispatched; the tier rung may swap `cli` for a native model tier when the provider itself is failing).

Constraints: the external CLI must be able to edit the repo working tree and run node (the `.bee/bin` contract); grant write access scoped to the repo only (codex: `-s workspace-write`) — never a machine-wide bypass (`--yolo`-style flags) as the house default; the 0018 goal-check exists so bee does not have to *trust* the worker, not so it can hand over the machine. Secrets: the external process gets only its own provider's credentials from the user's environment — bee passes none.

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
