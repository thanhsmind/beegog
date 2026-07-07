# Reviewing Reference

Load after `bee-reviewing` is selected. Companion to SKILL.md — flow lives there; prompts, schemas, and checklists live here.

## Specialist Dispatch

Isolation contract: each reviewer receives the diff (or branch range), `history/<feature>/CONTEXT.md`, and `history/<feature>/plan.md` — nothing else, never session history. Reviewers 1–5 run in parallel; `learnings-synthesizer` runs after all of them return.

Common prompt shape:

```text
You are the <X> reviewer. Review only your focus area. Lead with findings.
For each: severity, file/line evidence, failure scenario, smallest credible fix.
Do not rewrite code.
```

Per-reviewer focus lines (append to the shape):

| Reviewer | Focus line |
|---|---|
| `code-quality` | Correctness, readability, type safety, error handling. Cite file/line evidence for every claim. |
| `architecture` | Boundaries, coupling, API design, maintainability, drift from plan.md structure. |
| `security` | Auth, authorization, secrets in code or logs, injection, permissions, data exposure. |
| `test-coverage` | Missing edge cases, regression paths, weak or tautological assertions, untested behavior changes. |
| `learnings-researcher` | Search `history/learnings/` (including `critical-patterns.md`) for precedent related to the modules touched in this diff. Return matched learnings with file paths and one line each on why they apply. Report only — no severity scoring. |
| `learnings-synthesizer` | Take all reviewer findings plus researcher precedent. Deduplicate overlaps, mark cross-reviewer corroboration (promotes one severity level), attach known-pattern notes, classify each finding's autofix_class, and present counts by severity. |

Tiers: researcher = extraction, specialists = generation, synthesizer = ceiling (orchestrator's model). Where the runtime cannot select per-agent models, fall back to read budgets and output caps.

## Conditional Reviewers (selected by diff analysis)

Before dispatch, scan the diff ONCE and spawn any conditional reviewer whose trigger matches, in the same parallel wave as the always-on four. Same isolation contract, same prompt shape, same generation tier — only the focus line differs. Personas stay thin lens contracts: no failure-mode catalogs (the model already knows the domain; the trigger and the lens are the value).

| Reviewer | Spawn when the diff touches | Focus line |
|---|---|---|
| `performance` | ORM/query calls inside loops, caching layers, pagination, hot-path data access | Query patterns, N+1 exposure, cache correctness, unbounded result sets. Flag only measurable risks with the triggering code cited. |
| `api-contract` | routes, serializers, public response shapes, exported type signatures, versioned endpoints | Client-visible breaking changes, envelope drift, missing versioning, silent field removals — checked against locked decisions (D-ids). |
| `data-migration` | **spawn gate:** only if the diff includes migration files or schema definitions (`**/migrations/**`, `db/migrate/*`, `schema.*`, `*.sql` DDL) | Destructive DDL, backfills on large tables, NOT NULL without default, irreversibility, deploy-order coupling. |
| `reliability` | retries, timeouts, queues, background jobs, webhooks, external service calls | Failure paths: what happens on timeout, partial failure, replay, and double delivery. Missing idempotency and dead-letter handling. |

Rules:

- Triggers are mechanical — grep the diff's file paths and hunks; do not spawn on vibes, and do not skip a matched trigger to save time.
- Cap the wave at 7 reviewers total. If more triggers match, fold the extra lens into the closest always-on reviewer's focus line and say so in the synthesis.
- A `security` overlap (auth/payments/data-mutation files with ≥50 changed lines) is also the signal for the optional cross-model second opinion at Gate 4 (see 06-runtime-integration.md) — surface the option to the user; never auto-run it.

## Finding Schema

Every distinct issue becomes one finding:

```markdown
### [P<N>] <problem title>   (autofix_class: gated_auto | manual | advisory)

## Plain-Language Summary
<1-3 sentences a non-specialist understands>

## What The Code Does Today
- <current behavior, with source>

## Why This Is A Problem
- <requirement, locked decision (D-id), or invariant broken>

## Concrete Failure Scenario
- <realistic steps and the incorrect outcome>

## Evidence
File: `path`
Line(s): <line>
Snippet: <small relevant snippet>
Why this proves the issue: <one sentence>

## Proposed Fix
Recommended: <smallest credible fix>
Tradeoff: <if any>

## Acceptance Criteria
- [ ] <specific testable condition>
```

Synthesis rules recap: uncertain → P2; independent corroboration promotes one level; disagreement → the more conservative route; `autofix_class` routes work (gated_auto = concrete fix applied after orchestrator judgment; manual = needs design input; advisory = report-only) but never bypasses judgment or the gate.

## Review Cells and Backlog Routing

| Severity | Route | Blocking? |
|---|---|---|
| P1 | fix cell on the current feature (lane tiny/small; verify command required), then re-review the fix | yes — Gate 4 |
| P2 | `.bee/backlog.jsonl` entry; grooming cell if the fix is already concrete | no |
| P3 | `.bee/backlog.jsonl` entry | no |

Backlog entry format (one JSON object per line):

```json
{"ts":"<ISO>","type":"review-finding","feature":"<feature>","severity":"P2","title":"<problem title>","autofix_class":"manual","evidence":"<file:line one-liner>","predicted_impact":"<what it costs if left>","source":"reviewing"}
```

P2/P3 entries carry the feature name for traceability but must NOT be wired as blockers of the current work. If any filing write fails, append the full finding to `history/<feature>/reports/residual-findings.md` — nothing evaporates.

## Verification-Evidence Gate (behavior_change cells)

For each capped cell with `behavior_change: true`, the trace's `verification_evidence` must name: tests inspected, tests added/changed, red-failure or characterization evidence, the verification run, and any deliberate exception. Missing field, or prose like "covered by existing tests" with no test named → P1 finding; the cell's work goes back.

## Human UAT

For each SEE/CALL/RUN decision in CONTEXT.md:

```text
UAT Item <i>/<n> - Decision <D-id>:
"<deliverable>"
Can you confirm this works? [Pass / Fail / Skip]
```

- Fail → create a P1 fix cell, then rerun this UAT item after the fix caps.
- Skip → record the user's reason in `.bee/state.json` before moving on.
- Intermittent failure is a Fail, not a Skip.

## Finishing Checklist

- [ ] all P1 fix cells capped and their findings re-verified
- [ ] project build/test/lint gates run, fresh output quoted
- [ ] P2/P3 → backlog entries (+ grooming cells where concrete), non-blocking
- [ ] residual-findings fallback written if any filing failed
- [ ] UAT results (and skip reasons) recorded in `.bee/state.json`
- [ ] state closeout: phase `reviewing-complete`, summary, `next_action: "Invoke bee-compounding."`

## Red Flags

- P1 passed on user silence
- UAT failure logged as pass, or skip without reason
- artifact verification skipped
- synthesizer run before specialists finish
- P2/P3 blocking the current feature
- findings dropped because a write failed (use residual-findings.md)
