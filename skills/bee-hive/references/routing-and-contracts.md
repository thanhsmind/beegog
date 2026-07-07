# Routing And Contracts Reference

Open this when the compact bootstrap in `SKILL.md` is not enough.

## Skill Catalog

| # | Skill | One-line description | Load when... |
|---|-------|----------------------|--------------|
| 1 | `bee-hive` | Routing, go mode, gates, red flags. | Starting any session |
| 2 | `bee-exploring` | Identify gray areas, lock decisions into `CONTEXT.md`. | Feature request is vague or new |
| 3 | `bee-planning` | Research, mode gate, approach, unified plan, current-slice cells. | Decisions are locked, or scope is already clear |
| 4 | `bee-validating` | Reality gate, feasibility matrix, spikes, plan-checker, cell review. | Work shape is approved |
| 5 | `bee-swarming` | Launch and tend bounded workers with reservations. | Gate 3 approved |
| 6 | `bee-executing` | Bounded worker loop for one cell. | Spawned by swarming |
| 7 | `bee-reviewing` | Parallel review gate with P1/P2/P3 findings. | Final slice complete |
| 8 | `bee-compounding` | Capture durable learnings and decisions. | Review approved or work abandoned |
| 9 | `bee-grooming` | Entropy audit, debt hunt, approved kills. | Cleanup/audit requested; hive idle |
| 10 | `bee-writing-skills` | TDD-for-skills, pressure testing. | Improving or creating bee skills |

## First-Skill Routing

| Request type | First skill | Notes |
|---|---|---|
| Vague/new feature | `bee-exploring` | Always start here if gray areas exist |
| Research task | `bee-planning` | Skip exploring only if scope is fully clear |
| "Just fix this" / small change | `bee-planning` | Route in tiny or small mode |
| Review code | `bee-reviewing` | Load directly |
| Clean up / tech debt / audit | `bee-grooming` | Load directly |
| Capture learnings | `bee-compounding` | Load directly |
| Improve bee itself | `bee-writing-skills` | Load directly |
| `/go` / full pipeline | Go mode | See `go-mode.md` |
| Resume session | Resume logic | Check `HANDOFF.json` first |

**Surface-scope-earlier check** (runs before routing to exploring): the request contains concrete acceptance criteria AND references to existing patterns → offer "Found clear requirements. Jump straight to planning, or explore alternatives first?" On approval, planning receives a one-paragraph scoping synthesis whose decisions still carry D-IDs.

## State Bootstrap

On every session start:

1. Confirm onboarding is current via `.bee/onboarding.json` (see SKILL.md onboarding protocol).
2. Run `node .bee/bin/bee_status.mjs --json`.
3. If `.bee/HANDOFF.json` exists, present it and wait. Do not auto-resume.
4. Read `docs/history/learnings/critical-patterns.md` when present.
5. Surface recent active decisions: `node .bee/bin/bee_decisions.mjs active --recent 3`.
6. Check active reservations when workers may be in flight: `node .bee/bin/bee_reservations.mjs list --active-only`.

Default `.bee/state.json` shape:

```json
{
  "schema_version": "1.0",
  "phase": "idle",
  "feature": null,
  "mode": null,
  "approved_gates": { "context": false, "shape": false, "execution": false, "review": false },
  "workers": [],
  "summary": "",
  "next_action": "Invoke bee-hive."
}
```

## Resume Logic

If `.bee/HANDOFF.json` exists:

1. Read `HANDOFF.json` and `.bee/state.json`.
2. Extract phase, feature, mode, cells in flight, done/remaining, and next action.
3. Present the pause point to the user in plain language.
4. Continue only after explicit confirmation. If the user's first message is an unrelated request, still surface the handoff first, then ask which to pursue.

Do not auto-resume. Ever.

## Scout Contract (just-enough reading)

Retrieval triggers, not reading lists. Token budgets by lane:

| Lane | Harness-context budget | Always read | Trigger-based reads |
|---|---|---|---|
| tiny / small | ≈ 2K tokens | bee_status, critical-patterns digest, touched area's `docs/specs/<area>.md` when present | touched-file neighborhood only |
| standard | ≈ 5K tokens | + recent active decisions, CONTEXT.md | touching schema → schema decisions first; touching auth → auth decisions |
| high-risk | ≈ 10K tokens | + full decision search on tags, plan history | + high-risk template, prior spikes in `.spikes/`, related learnings files |

Reading order per area (state layer, decision 0001): **spec → decisions → history**. `docs/specs/reading-map.md` answers "where does X live" before any broad grep.

Do not read `node_modules/`, `dist/`, `build/`, `.git/` internals, `vendor/`, `coverage/` — the scout guard blocks them anyway.

## Chaining Contract

| Skill | Reads | Writes |
|-------|-------|--------|
| hive | onboarding, state, HANDOFF, critical-patterns, decisions | state routing updates only |
| exploring | user conversation, critical-patterns, quick scout | `docs/history/<feature>/CONTEXT.md`, state update |
| planning | CONTEXT.md, critical-patterns, active decisions, bee_status | `approach.md`, `plan.md` (requirements-only → implementation-ready), current-slice cells via `bee_cells.mjs add` |
| validating | CONTEXT.md, discovery, approach, approved shape, cells | reality-gate report, feasibility matrix, spike results in `.spikes/`, repaired cells |
| swarming | validated cells, state, reservations | worker registry in state, HANDOFF at ~65%, wave results |
| executing | assigned cell, CONTEXT.md, reservations | implementation commits (one per cell, cell id in message), verify record, cap, report in `docs/history/<feature>/reports/` |
| reviewing | diff, CONTEXT.md, plan.md, capped cells | P1/P2/P3 findings, backlog items, `residual-findings.md` fallback |
| compounding | feature history, traces, findings, commits | `docs/history/learnings/YYYYMMDD-<slug>.md`, critical-patterns promotions, decision log, backlog friction, `docs/specs/<area>.md` sync + reading-map refresh |
| grooming | entropy inputs, backlog, traces, diffs | kill proposals, tiny/small cells, outcome records |

Every skill ends with an explicit handoff: `[Outcome]. Invoke bee-<next-skill> skill.`

## Communication Contract

Plain language first:

- practical first, abstract second; scenario-first, not jargon-first
- explain what happens in real life before naming technical properties
- translate decision IDs, invariants, and architecture terms on first use
- prefer "here is what the code does today" over "here is the category of bug"

For plans, findings, blockers, and handoffs, answer in this order:

1. Plain-language summary
2. Current behavior or state
3. Why it matters
4. Concrete scenario
5. Next step

Avoid "violates D5" or "non-monotonic" without immediate explanation.

## Gate Presentation Contract

A gate message has two layers, and **only the human layer goes into chat**:

1. **Human layer (the chat message)** — written in the language the user is conversing in, jargon-free, answering four questions in order:
   - **What I'm about to do** — one sentence in the user's terms: what changes *for them*, not the mechanism.
   - **Why it's trustworthy** — the single strongest piece of evidence in plain words ("a dry run rebuilt all 3 pages byte-for-byte identical"), never a checklist.
   - **If it goes wrong** — what breaks for the user and how it would be noticed (loud failure, rollback path).
   - **What you are deciding** — the exact commitment being approved and its boundary ("current slice only").

   Then the fixed gate question verbatim, with the standard options, and a link to the full report.

2. **Machine layer (the linked report)** — the full mechanical material (reality-gate tables, feasibility matrices, plan-checker findings, cell lists) is written to `docs/history/<feature>/reports/` and **linked** from the gate message. It is never pasted into the gate message. It exists for the agent, the audit trail, and grooming — not for the human's eyes at decision time.

Litmus test: **the user must be able to restate what they are approving in their own words.** A gate the user cannot restate is a dead gate — worse than no gate, because it manufactures false confidence. A technical term (BLOCKER count, spike id) may appear in the human layer only with an immediate plain-language gloss.

This contract applies to all four gates, in every mode, including go mode.

## Question Format

Used at all gates and Socratic steps:

```text
CONTEXT: <one or two sentences of relevant state, plain language>
QUESTION: <one outcome-framed question>
RECOMMENDATION: <the option the evidence favors, and why in one line>
  (a) <option> — <expected outcome>
  (b) <option> — <expected outcome>
  (c) <option> — <expected outcome>
```

One question per message. Never bundle. Never answer your own question.

## File Quick Reference

```text
.bee/
  onboarding.json  state.json  config.json  HANDOFF.json
  reservations.json  decisions.jsonl  backlog.jsonl
  cells/<id>.json  logs/hooks.jsonl  .inject-cache.json
  bin/  bin/lib/

docs/history/<feature>/
  CONTEXT.md  discovery.md  approach.md  plan.md  reports/

docs/history/learnings/
  critical-patterns.md  YYYYMMDD-<slug>.md

docs/specs/
  <area>.md  reading-map.md

.spikes/<feature>/
```

## Helper CLI Quick Reference

```text
node .bee/bin/bee_status.mjs --json
node .bee/bin/bee_cells.mjs list [--feature F] [--status S] | ready [--feature F] | show --id ID
node .bee/bin/bee_cells.mjs add --file cell.json
node .bee/bin/bee_reservations.mjs list [--active-only] | sweep
node .bee/bin/bee_decisions.mjs active [--recent N] | search --text T
```
