# Reviewing Reference

Load after `bee-reviewing` is selected. Companion to SKILL.md — flow lives there; prompts, schemas, and checklists live here. Every record on this page lands on a review session (`.bee/reviews/<id>.json`) via `node .bee/bin/bee.mjs reviews record --id <id> --kind ...` — a session exists only after an explicit user request created it (SKILL.md Trigger + Scope Freeze and Preview).

## Specialist Dispatch

Isolation contract: each reviewer receives the session's cumulative diff (baseline..head, or the mapped multi-feature diff), `docs/history/<feature>/CONTEXT.md`, and `docs/history/<feature>/plan.md` for every feature in scope — nothing else, never session history. All reviewers run in parallel; the orchestrator synthesizes only after every one has returned (SKILL.md §2 — synthesis is orchestrator work, never a dispatched reviewer). Precedent is already in `plan.md` (planning's bootstrap owns the learnings search).

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

Tiers: specialists = the review slot (SKILL.md §1). Where the runtime cannot select per-agent models, fall back to read budgets and output caps.

Orchestrator synthesis (after all reviewers return): deduplicate overlaps, mark cross-reviewer corroboration (promotes one severity level), attach known-pattern notes from the precedent in `plan.md`, classify each finding's autofix_class, and present counts by severity.

## Conditional Reviewers (selected by diff analysis)

Before dispatch, scan the diff ONCE and spawn any conditional reviewer whose trigger matches, in the same parallel wave as the always-on four. Same isolation contract, same prompt shape, same review slot — only the focus line differs. Personas stay thin lens contracts: no failure-mode catalogs (the model already knows the domain; the trigger and the lens are the value).

| Reviewer | Spawn when the diff touches | Focus line |
|---|---|---|
| `performance` | ORM/query calls inside loops, caching layers, pagination, hot-path data access | Query patterns, N+1 exposure, cache correctness, unbounded result sets. Flag only measurable risks with the triggering code cited. |
| `api-contract` | routes, serializers, public response shapes, exported type signatures, versioned endpoints | Client-visible breaking changes, envelope drift, missing versioning, silent field removals — checked against locked decisions (D-ids). |
| `data-migration` | **spawn gate:** only if the diff includes migration files or schema definitions (`**/migrations/**`, `db/migrate/*`, `schema.*`, `*.sql` DDL) | Destructive DDL, backfills on large tables, NOT NULL without default, irreversibility, deploy-order coupling. |
| `reliability` | retries, timeouts, queues, background jobs, webhooks, external service calls | Failure paths: what happens on timeout, partial failure, replay, and double delivery. Missing idempotency and dead-letter handling. |

Rules:

- Triggers are mechanical — grep the diff's file paths and hunks; do not spawn on vibes, and do not skip a matched trigger to save time.
- Cap the wave at 6 reviewers total (4 core + 2 conditionals). If more triggers match, fold the extra lens into the closest always-on reviewer's focus line and say so in the synthesis.
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

P2/P3 entries carry the feature name for traceability but must NOT be wired as blockers of the current work. If any filing write fails, append the full finding to `docs/history/<feature>/reports/residual-findings.md` — nothing evaporates.

## Session Record Checklist (SPEC §8)

A review session (`.bee/reviews/<id>.json`) minimally carries these fields — `create` writes the first eight at freeze time (SKILL.md, Scope Freeze and Preview); the rest fill in as the session progresses via `record`:

| Field | Set by | Notes |
|---|---|---|
| `id` | `create` | stable, never reused |
| `requested_by` / `requested_at` | `create` | proves this is a user request, and when |
| `scope_description` | `create` | how the user described the boundary |
| `included` | `create` (frozen, R5) | feature/cell/commit entries actually in scope |
| `excluded` | `create` (frozen, R5) | related work left out, with reason (e.g. "in progress", A6) |
| `baseline` / `head` | `create` (frozen, R5) | the two immutable diff endpoints |
| `reviewer_manifest` | `record --kind manifest` | reviewers, model/tier/executor actually dispatched |
| `verification_preflight` | `create`, then `record --kind preflight` if re-checked | evidence check result before reviewer spend (A10) |
| `findings` | `record --kind finding` (append) | severity, evidence, status, fix/re-review reference |
| `uat` | `record --kind uat` (append) | item, pass/fail/skip, skip reason |
| `decision` | `record --kind decision` | `pending`/`blocked`/`approved` + Gate 4 record |

`record` refuses any payload touching `baseline`/`head`/`included`/`excluded` — those four are frozen at `create` and no sub-record kind legitimately needs to touch them (R5). Before creating a new session for a scope that might already be covered, run `node .bee/bin/bee.mjs reviews status` — an unchanged range already reported `reviewed (covered by <id>)` is not re-reviewed (R6/A7).

## Delta Re-Review Protocol (R9/A12)

After a P1 fix caps:

1. Re-review the fix delta itself.
2. Sweep the whole scope diff for the finding's defect class — the same category of bug, anywhere else in scope, not just the line that changed (critical pattern 20260711: grill deltas).
3. Record the outcome: `node .bee/bin/bee.mjs reviews record --id <session-id> --kind finding --file <finding-update.json>` (status moves to resolved, with the fix's evidence).
4. Decide whether the fix stayed inside its own boundary:
   - **stayed inside** (localized fix, no public-contract change, no destabilized assumption elsewhere in scope) → only the delta + defect-class sweep is required; the full panel does not re-run (A12).
   - **crossed a boundary** (touches another feature's contract, changes a public/API shape, or invalidates an assumption the rest of the scope relied on) → propose an expanded re-review to the user; do not silently pick either the minimal or the maximal option.
5. A session stays `blocked` (A11) until every open P1's delta re-review passes.

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

- [ ] all P1 fix cells capped and their findings re-verified (delta re-review + defect-class sweep, R9/A12)
- [ ] project build/test/lint gates run, fresh output quoted
- [ ] P2/P3 → backlog entries (+ grooming cells where concrete), non-blocking
- [ ] residual-findings fallback written if any filing failed
- [ ] UAT results (and skip reasons) recorded on the session (`record --kind uat`) and in `.bee/state.json` where a skip reason is needed
- [ ] session closeout: `node .bee/bin/bee.mjs reviews record --id <session-id> --kind decision --file decision.json` (`pending`/`blocked`/`approved`) — this closes the SESSION, not a workflow phase; every covered feature already reached its own close via execution → scribing → compounding independently, and that feature state is left untouched (7.5). Do not set `next_action: "Invoke bee-compounding."` here — there is no automatic chain hop out of a review session.

## Red Flags

- P1 passed on user silence
- UAT failure logged as pass, or skip without reason
- artifact verification skipped
- synthesis started before every reviewer returned
- P2/P3 blocking the current session
- findings dropped because a write failed (use residual-findings.md)
- a session closeout that sets `next_action: "Invoke bee-compounding."` as if review were a chain stage a feature must pass through
- a new session created for a range `bee.mjs reviews status` already reports `reviewed (covered by <id>)` and unchanged
