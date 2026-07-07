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
4. Read `history/learnings/critical-patterns.md` when present.
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
| tiny / small | ≈ 2K tokens | bee_status, critical-patterns digest | touched-file neighborhood only |
| standard | ≈ 5K tokens | + recent active decisions, CONTEXT.md | touching schema → schema decisions first; touching auth → auth decisions |
| high-risk | ≈ 10K tokens | + full decision search on tags, plan history | + high-risk template, prior spikes in `.spikes/`, related learnings files |

Do not read `node_modules/`, `dist/`, `build/`, `.git/` internals, `vendor/`, `coverage/` — the scout guard blocks them anyway.

## Chaining Contract

| Skill | Reads | Writes |
|-------|-------|--------|
| hive | onboarding, state, HANDOFF, critical-patterns, decisions | state routing updates only |
| exploring | user conversation, critical-patterns, quick scout | `history/<feature>/CONTEXT.md`, state update |
| planning | CONTEXT.md, critical-patterns, active decisions, bee_status | `approach.md`, `plan.md` (requirements-only → implementation-ready), current-slice cells via `bee_cells.mjs add` |
| validating | CONTEXT.md, discovery, approach, approved shape, cells | reality-gate report, feasibility matrix, spike results in `.spikes/`, repaired cells |
| swarming | validated cells, state, reservations | worker registry in state, HANDOFF at ~65%, wave results |
| executing | assigned cell, CONTEXT.md, reservations | implementation commits (one per cell, cell id in message), verify record, cap, report in `history/<feature>/reports/` |
| reviewing | diff, CONTEXT.md, plan.md, capped cells | P1/P2/P3 findings, backlog items, `residual-findings.md` fallback |
| compounding | feature history, traces, findings, commits | `history/learnings/YYYYMMDD-<slug>.md`, critical-patterns promotions, decision log, backlog friction |
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

history/<feature>/
  CONTEXT.md  discovery.md  approach.md  plan.md  reports/

history/learnings/
  critical-patterns.md  YYYYMMDD-<slug>.md

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
