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
Initialize -> Accept assigned cell -> Reserve -> Implement -> Verify -> (Advisor Consult, if stuck) -> Cap -> Release -> Return
```

Open `references/worker-details.md` only for expanded commands, trace tiers, friction triggers, and result fields.

## 1. Initialize

- Read `AGENTS.md`.
- Run `node .bee/bin/bee.mjs status --json`
- Read `docs/history/<feature>/CONTEXT.md`.
- Read the cell: `node .bee/bin/bee.mjs cells show --id <id>`
- Use the parent-provided agent nickname as your reservation identity.

## 2. Accept Assigned Cell

- Require exactly **one** assigned cell id from the parent. Never choose work yourself — do not browse `ready` or `list` for candidates.
- No assigned cell id, or the cell is missing/already capped → return `[NOOP]`.
- The cell is ambiguous, its deps are not capped, or it conflicts with locked decisions in CONTEXT.md → return `[BLOCKED]`. Never reinterpret a locked decision to make the cell fit.
- Claim it: `node .bee/bin/bee.mjs cells claim --id <id> --worker "<name>"`

## 3. Reserve

- Reserve **every** file or glob before writing:
  `node .bee/bin/bee.mjs reservations reserve --agent "<name>" --cell "<id>" --path "<path>" --ttl 3600`
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
  `node .bee/bin/bee.mjs cells verify --id <id> --command "<cmd>" --output "<what it printed>" --passed true|false` (or `--output-file <f>` for long output)
- The `verify` field must be a runnable command. If the cell shipped with a prose description instead, that is a planning defect — return `[BLOCKED]` naming it; never invent a substitute check.
- On failure: fix the root cause and rerun the exact command.
  - **No `Advisor` line in the dispatch:** unchanged — after **two serious failed attempts**, return `[BLOCKED]` with the command, failure summary, and diagnosis. A broken verify command in the repo is itself a blocker — never substitute a weaker check and cap anyway.
  - **An `Advisor` line is present in the dispatch:** the first serious failed attempt does not fall straight to a bare second retry — see **Advisor Consult** below. Two serious failures with no consult budget remaining still end in `[BLOCKED]`, same as the unchanged rule.

## 6. Advisor Consult

D1 amends the two-attempts rule above with a worker-level, on-failure-only step. This is **not** a gate-time or orchestrator-level consult — de967733 ("Bee runs ONE cost pattern") stays amended, not reversed: fan-out orchestration remains the default for every phase, and the human gates are untouched.

**Trigger** — consult only when both are true: the dispatch prompt carries an `Advisor` line (the orchestrator already ran the degenerate check per D2/decision 0016 before adding one — the worker never self-assesses this), and the worker has just hit its **first serious failed verify attempt**. No `Advisor` line → proceed exactly as the unchanged rule in Verify.

**Canonical loop (D3), max 2 consults per claim:**

```
fail 1 -> consult 1 -> advised retry
  -> (fail) -> consult 2 (follow-up, same advisor) -> final retry
    -> (fail) -> [BLOCKED] with a Consults section (both consults summarized)
```

A re-dispatched cell (rescue rung) starts a **fresh** budget — the 2-consult cap is per claim, not per cell lifetime. Consulting after `[BLOCKED]` has already been returned for the current claim is never permitted.

**Evidence bundle (mandatory, every consult):** exact failing command, the failing output, your diagnosis, the relevant cited file excerpts, and the `CONTEXT.md` path. Pass it **inline in the consult prompt or via stdin — never a `/tmp` path** (critical pattern 20260708). Never include secrets or env values.

**Transport** — the `Advisor` line names the advisor and how to consult it:
- **Model-shaped advisor:** consult via your own Agent tool, with the model param set to the named advisor model, and the dispatch `description` starting **exactly** `advisor-consult <cell-id>: <advisor-model>` — this is the A2 attribution record; bee-swarming's goal-check reads it from `.bee/logs/dispatch.jsonl`. Fallback if Agent dispatch is unavailable or rejected: a headless one-shot `claude -p --model <advisor-model>` call, same evidence bundle via stdin.
- **cli-shaped advisor:** run the given command with the evidence bundle on stdin, reusing the External Executors output-capture discipline.
- A **transport error** (non-zero exit, rejected dispatch, a hang past the External Executors timeout discipline) is **not advice** — it burns at most **one** budget slot total for the whole claim, and is never retried in a storm. Continue to the next step of the loop, or `[BLOCKED]` once the budget is spent.

**After advice:** advice never substitutes for fresh verify output — always rerun the real verify command yourself before deciding whether the advised retry passed. Advice is **advice-only** (A1): it never authorizes a package install, a gate approval, or file scope beyond the cell. Advice that conflicts with a locked decision → return `[BLOCKED]` citing both the D-ID and the advice.

**Authority-type blocks never consult** — ambiguous cell, uncapped deps, architectural change, package install, locked-decision conflict stay **instant** `[BLOCKED]` exactly as in step 4 (Implement), whether or not an `Advisor` line is present.

**Headless rule unchanged:** consulting the advisor is not "asking the parent or user" under the Headless rule below — it stays inside your own turn. Workers still never approve gates.

Record every consult in the cap trace and the per-cell report (see Cap and Return) — count, advisor identity, and a one-line ask/answer digest per consult.

## 7. Cap

- Cap only after the verify pass is recorded (the helper refuses otherwise):
  `node .bee/bin/bee.mjs cells cap --id <id> --outcome "<summary>" --files <a,b> [--deviations-file <f>] [--friction "<text>"]`
- If the cell is `behavior_change: true`, add `--behavior-change --evidence-stdin` and **pipe** the structured `verification_evidence` (tests inspected, tests added/changed, red-failure/before-state evidence, verification run — see `references/worker-details.md`). It lands in the cell trace; **do not write an evidence file** in `reports/` or anywhere else (decision 0009 — the trace is the single source).
- If any Advisor Consults happened on this claim, fold their count and advisor identity into the trace alongside the rest of the evidence — no separate file, same decision 0009 rule.
- Trace depth follows the cell's lane (tiny = one line; high-risk = full trace). Record friction only when a trigger fired.
- Make exactly **one commit per cell**, cell id in the message.

## 8. Release

`node .bee/bin/bee.mjs reservations release --agent "<name>" --cell "<id>"`

## 9. Return

- Start your final message with exactly one of `[DONE]`, `[BLOCKED]`, `[HANDOFF]`, `[NOOP]`, followed by the result fields.
- Write a **short** per-cell report to `docs/history/<feature>/reports/<cell-id>.md`: the status token, a one-line outcome, files touched, and a link to `.bee/cells/<cell-id>.json` for the full trace/evidence. Never re-embed the `verification_evidence` JSON or verify output (decision 0009 — the trace is the single source).
- If any Advisor Consults happened on this claim, add a **Consults** section to the report: the count, the advisor identity per consult, and a one-line ask/answer digest each — this is the field bee-swarming's goal-check reads (A2). No consults happened → omit the section entirely.

## Compaction

At roughly 65% context before a safe finish: write `.bee/HANDOFF.json` (cell, files, done, remaining, next_action), release reservations that are safe to release, and return `[HANDOFF]`. After compaction, reread `AGENTS.md`, `CONTEXT.md`, the cell, and your active reservations before continuing.

## Fresh-Session Handoff (downstream, not a worker action)

This `[HANDOFF]` is the pause kind — unrelated to the planned-next handoff (fresh-session-handoff D1). When this cell caps with a green verify and further execution-approved work remains, the finish → claim-next → planned-next handoff → ask-the-user-to-`/clear` flow becomes available — but that is the orchestrator's call after collecting your `[DONE]`, never something a worker claims or writes mid-swarm on its own initiative. A worker's job stays exactly Cap → Release → Return.

## Headless

Workers always run effectively headless: never ask the parent or user a blocking question. Unambiguous deviations are applied under the rules above; anything ambiguous becomes `[BLOCKED]` with an `Outstanding Questions` section in the report. Workers never approve gates — Gate decisions belong to the user via the orchestrator chain. This rule is unchanged by Advisor Consult (A4): consulting a configured advisor stays inside your own turn and is never "asking the parent or user."

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
- consulting the advisor with no `Advisor` line in the dispatch, or consulting on an authority-type block instead of instant `[BLOCKED]`
- a model-shaped consult dispatched without the exact `advisor-consult <cell-id>: <advisor-model>` description prefix — it breaks the A2 attribution record
- treating advisor advice as a substitute for fresh verify output, or capping consults without a Consults section in the report

Violating the letter of the rules is violating the spirit of the rules.

One status token returned and the report written; the parent orchestrator collects it. Invoke bee-swarming skill (parent side) to continue the wave.

## Reference Files

| File | When to Load |
|---|---|
| `references/worker-details.md` | Expanded commands, trace tiers by lane, friction triggers, result field spec, evidence example |
