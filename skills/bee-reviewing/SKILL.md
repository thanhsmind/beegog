---
name: bee-reviewing
description: >-
  Run the multi-agent review gate: severity findings, artifact verification, and user acceptance. Use when the final swarm slice completes, or when the user asks to review completed bee work before merge.
metadata:
  version: '0.1'
  ecosystem: bee
  dependencies:
    nodejs-runtime:
      kind: command
      command: node
      missing_effect: degraded
      reason: Reads bee records (cells, state, backlog) via the vendored .bee/bin helpers.
---

# Reviewing (inspector bees)

Reviewing is the final automated quality gate after execution. It verifies that the completed feature is correct, safe, wired, and acceptable to the user before compounding begins. Cell closure is NOT proof the feature works.

## Required Inputs

- `docs/history/<feature>/CONTEXT.md` and `docs/history/<feature>/plan.md`
- the feature diff (or merged branch range)
- capped cells and traces: `node .bee/bin/bee_cells.mjs list --feature <feature>`
- current state: `node .bee/bin/bee_status.mjs --json`

Missing CONTEXT.md or plan.md → stop and return to the stage that owns it.

## 1. Specialist Review

Dispatch reviewers with ISOLATED context: the diff + CONTEXT.md + plan.md ONLY. Never session history.

**Spawn contract:** spawn every reviewer as the runtime's default/general subagent type with the persona prompt from the reference pasted inline. NEVER use an agent type registered by another plugin, even when its name matches the role (`*-correctness-reviewer`, `*-security-reviewer`, …) — a same-named agent carries a different contract (finding format, severity scale, report paths), silently breaks bee's synthesis rules, and makes the run depend on which plugins happen to be installed on this machine.

| Reviewer | Focus | Tier | Order |
|---|---|---|---|
| `code-quality` | correctness, readability, type safety | generation | parallel |
| `architecture` | boundaries, coupling, API design, maintainability | generation | parallel |
| `security` | auth, secrets, injection, permissions, data exposure | generation | parallel |
| `test-coverage` | missing edge cases, regression paths, weak assertions | generation | parallel |
| `learnings-researcher` | searches `docs/history/learnings/` for precedent on the touched modules | extraction | parallel |
| `learnings-synthesizer` | dedupe, corroboration, known-pattern notes | ceiling | AFTER all of the above |

**Conditional reviewers** join the same parallel wave when the diff mechanically matches their trigger: `performance` (queries in loops, caching), `api-contract` (routes, public shapes), `data-migration` (spawn gate: migration/schema files only), `reliability` (retries, queues, external calls). Scan the diff once before dispatch; spawn every matched trigger; cap the wave at 7. Trigger table and focus lines in `references/reviewing-reference.md`.

Full prompts in `references/reviewing-reference.md`.

## 2. Severity and Synthesis

- **P1** — security breach, data loss, breaking change, production blocker. Blocks merge.
- **P2** — real performance, architecture, reliability, or important test gap.
- **P3** — cleanup, docs, future debt.

Rules: uncertain → P2. Reviewers score independently; corroboration across independent reviewers promotes a finding one level. On disagreement, take the more conservative route. Every finding carries an `autofix_class` — `gated_auto` (concrete fix, apply after judgment), `manual` (needs design input), `advisory` (report-only) — as a routing SIGNAL, never an apply gate.

Finding format, in this order: plain-language summary → what the code does today → why it matters → concrete failure scenario → file/line evidence → smallest credible fix. Schema in the reference.

## 3. Verification-Evidence Gate

For every capped cell with `behavior_change: true`, inspect the recorded `verification_evidence` in the cell trace. Missing or vague evidence ("tests pass", "should be covered") is itself a P1 finding — the work goes back; it does not pass forward.

This is now a **backstop, not the primary catch** (decision 0009): the cap helper already refuses a `behavior_change` cell without a "before" characterization (`red_failure_evidence`, or a `deliberate_exceptions` note for a genuinely new surface), so an assertion-capped cell should not reach review. If one does, treat it as a helper bypass and a P1. Do **not** raise a P1 whose only remedy is "record the missing before-state in a new evidence cell" — that backfill loop is exactly what the cap-time enforcement exists to prevent; a real evidence gap means the behavior was never actually proven, which the worker fixes by re-verifying, not by writing a document. Read evidence from the cell trace — the single source — never from a parallel `reports/*-evidence.*` file.

## 4. Artifact Verification

For everything CONTEXT.md and plan.md promised, verify three levels:

- **EXISTS** — the artifact is present
- **SUBSTANTIVE** — not a stub, placeholder, TODO-only, fake static path, or empty handler
- **WIRED** — imported and used on the integration path

All three = OK. EXISTS + SUBSTANTIVE only = P2. Missing or EXISTS-only = P1.

## 5. Human UAT

Walk the user through every SEE/CALL/RUN decision in CONTEXT.md (wording in the reference). Failure → P1 fix cell + rerun the item. Skip requires a recorded reason in `.bee/state.json`. UAT failures are never logged as passes.

## 6. Finishing

1. Run the project build/test/lint gates; quote fresh command output — never claim "passing" without it.
2. P2/P3 findings → `.bee/backlog.jsonl` entries (plus grooming cells where warranted) with non-blocking traceability to the feature. They never block the current work.
3. If filing a residual finding anywhere fails, write it to `docs/history/<feature>/reports/residual-findings.md` so nothing evaporates.
4. Close out `.bee/state.json`: phase, summary, next_action.

## Gate 4 (wording is fixed)

Present per the Gate Presentation Contract (bee-hive routing reference): plain-language layer in chat — what was built / what review found in plain words / consequence of merging now / what you are deciding — in the user's language, with full findings linked from `docs/history/<feature>/reports/`, never pasted as a findings table. Then verbatim:

- P1 > 0 → "P1 findings block merge. Fix before proceeding?"
- P1 = 0 → "Review complete. Approve merge?"

Never continue past open P1s without explicit user acknowledgment. Silence is not acknowledgment.

**Gate bypass does not fully cover Gate 4 (decision 0010).** Even with `.bee/config.json` `gate_bypass: true`: the §5 UAT items (every SEE/CALL/RUN decision) are always presented to the human, and any P1 finding always stops. Bypass may auto-approve the **merge** question only when P1 = 0 **and** every UAT item was confirmed pass by the human — then record the review gate, log a one-line audit decision, and post a short `⚡ auto-approved merge (bypass)` line instead of asking. Any P1, or any UAT fail/skip, stops Gate 4 for the human as normal. Secret reads during review always require human approval regardless of bypass.

## Headless

`mode:headless` = report-only: run all reviewers, both verification gates, and artifact checks; emit every finding in a structured terminal report with UAT items and ambiguous severities deferred to an `Outstanding Questions` section. Gate 4 still requires the human — headless never self-approves merge.

## Red Flags

- continuing past a P1 without explicit user acknowledgment
- UAT failure marked pass, or a skip without a recorded reason
- artifact verification skipped because "the cells are capped"
- a `behavior_change` cell accepted with vague verification evidence
- `learnings-synthesizer` run before the other reviewers finish
- P2/P3 filed as blocking work on the current feature
- a reviewer dispatched with session history in its context
- a reviewer spawned as another plugin's registered agent type instead of the default type + inline persona
- "should work" accepted as evidence

Violating the letter of these rules is violating the spirit of these rules.

## Handoff

Review complete. For `standard`/`high-risk`, invoke `bee-briefing` in walkthrough mode to write `docs/history/<feature>/walkthrough.md` from the execution records (cell traces, review findings, UAT) and set the implement plan `status: Shipped`; then invoke bee-scribing skill. For `tiny`/`spike`/`small`, invoke bee-scribing skill directly (no walkthrough).

| Reference | When to Load |
|---|---|
| `references/reviewing-reference.md` | specialist prompts, finding/review-cell schema, UAT wording, finishing checklist |
