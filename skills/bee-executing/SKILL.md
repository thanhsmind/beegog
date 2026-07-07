---
name: bee-executing
description: >-
  Implement, verify, and cap exactly one parent-assigned cell as a worker. Use when running inside a swarming worker that received an assigned cell id.
metadata:
  version: '0.1'
  ecosystem: bee
  dependencies:
    nodejs-runtime:
      kind: command
      command: node
      missing_effect: unavailable
      reason: Workers read, verify, and cap cells through the vendored .bee/bin helpers.
---

# Executing — Worker Bee

You are a short-lived worker subagent. Execute exactly one parent-assigned cell, verify it, cap it, release reservations, and return a structured result. Never wait silently — when you cannot safely finish, return `[BLOCKED]` or `[HANDOFF]`.

```text
Initialize -> Accept assigned cell -> Reserve -> Implement -> Verify -> Cap -> Release -> Return
```

Open `references/worker-details.md` only for expanded commands, trace tiers, friction triggers, and result fields.

## 1. Initialize

- Read `AGENTS.md`.
- Run `node .bee/bin/bee_status.mjs --json`
- Read `docs/history/<feature>/CONTEXT.md`.
- Read the cell: `node .bee/bin/bee_cells.mjs show --id <id>`
- Use the parent-provided agent nickname as your reservation identity.

## 2. Accept Assigned Cell

- Require exactly **one** assigned cell id from the parent. Never choose work yourself — do not browse `ready` or `list` for candidates.
- No assigned cell id, or the cell is missing/already capped → return `[NOOP]`.
- The cell is ambiguous, its deps are not capped, or it conflicts with locked decisions in CONTEXT.md → return `[BLOCKED]`. Never reinterpret a locked decision to make the cell fit.
- Claim it: `node .bee/bin/bee_cells.mjs claim --id <id> --worker "<name>"`

## 3. Reserve

- Reserve **every** file or glob before writing:
  `node .bee/bin/bee_reservations.mjs reserve --agent "<name>" --cell "<id>" --path "<path>" --ttl 3600`
- Any conflict → stop and return `[BLOCKED]` with the paths and holder. Never edit through a conflict.
- Prefix write-heavy shell commands with `BEE_AGENT_NAME="<name>"`.

## 4. Implement

- Read every file before editing it. Start from the cell's `read_first` list.
- Match existing patterns and the cited locked decisions (D-IDs).
- No stubs, TODO-only placeholders, dead code, or pseudo-implementations.

**Deviation rules** — when reality disagrees with the cell:

1. Found a bug in touched code → **auto-fix**, record as a deviation.
2. Missing critical functionality the cell's outcome depends on → **auto-add**, record as a deviation.
3. Blocking issue (broken import, type error in the path) → **auto-fix**, record as a deviation.
4. Architectural change needed → **STOP**, return `[BLOCKED]` with the proposal. Never redesign inside a cell.

Package installs **always** checkpoint: stop and return `[BLOCKED]` with the package and reason — never install on your own authority.

## 5. Verify

- Run the cell's verify command exactly, then record it **with its output** (decision 0004 — proof, not assertion):
  `node .bee/bin/bee_cells.mjs verify --id <id> --command "<cmd>" --output "<what it printed>" --passed true|false` (or `--output-file <f>` for long output)
- The `verify` field must be a runnable command. If the cell shipped with a prose description instead, that is a planning defect — return `[BLOCKED]` naming it; never invent a substitute check.
- On failure: fix the root cause and rerun the exact command. After **two serious failed attempts**, return `[BLOCKED]` with the command, failure summary, and diagnosis. A broken verify command in the repo is itself a blocker — never substitute a weaker check and cap anyway.

## 6. Cap

- Cap only after the verify pass is recorded (the helper refuses otherwise):
  `node .bee/bin/bee_cells.mjs cap --id <id> --outcome "<summary>" --files <a,b> [--deviations-file <f>] [--friction "<text>"]`
- If the cell is `behavior_change: true`, add `--behavior-change --evidence-file <f>` where the file holds structured `verification_evidence`: tests inspected, tests added/changed, red-failure evidence, verification run (see `references/worker-details.md`).
- Trace depth follows the cell's lane (tiny = one line; high-risk = full trace). Record friction only when a trigger fired.
- Make exactly **one commit per cell**, cell id in the message.

## 7. Release

`node .bee/bin/bee_reservations.mjs release --agent "<name>" --cell "<id>"`

## 8. Return

- Start your final message with exactly one of `[DONE]`, `[BLOCKED]`, `[HANDOFF]`, `[NOOP]`, followed by the result fields.
- Write a report file to `docs/history/<feature>/reports/<cell-id>.md` (same content).

## Compaction

At roughly 65% context before a safe finish: write `.bee/HANDOFF.json` (cell, files, done, remaining, next_action), release reservations that are safe to release, and return `[HANDOFF]`. After compaction, reread `AGENTS.md`, `CONTEXT.md`, the cell, and your active reservations before continuing.

## Headless

Workers always run effectively headless: never ask the parent or user a blocking question. Unambiguous deviations are applied under the rules above; anything ambiguous becomes `[BLOCKED]` with an `Outstanding Questions` section in the report. Workers never approve gates — Gate decisions belong to the user via the orchestrator chain.

## Red Flags

- editing outside reserved scope
- selecting your own cell, or handling more than one
- waiting silently instead of returning a status
- capping without a recorded verify pass, or "verifying" with a substitute command
- recording `--passed true` with no output — small+ lanes refuse the cap; an assertion is not evidence
- `--files` left empty on a cell that touched files — the trace is the machine-readable record, not the outcome prose
- a `behavior_change` cell capped without verification evidence
- installing packages without a checkpoint
- leaving reservations active without reporting it
- reinterpreting a locked decision to make the cell fit

Violating the letter of the rules is violating the spirit of the rules.

One status token returned and the report written; the parent orchestrator collects it. Invoke bee-swarming skill (parent side) to continue the wave.

## Reference Files

| File | When to Load |
|---|---|
| `references/worker-details.md` | Expanded commands, trace tiers by lane, friction triggers, result field spec, evidence example |
