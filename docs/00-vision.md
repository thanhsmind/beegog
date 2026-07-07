# 00 — Vision & Principles

## Why bee exists

Every upstream framework solves the same problem — AI agents write code faster than humans can verify intent, feasibility, and quality — but each solves it at a different layer and with different overhead:

- **khuym** proved the shape: a distilled, opinionated 7-stage chain for one developer, with hard gates and file-based state. bee inherits khuym's skeleton directly.
- **gsd-core** proved that plans can be *executable prompts* and that verification must work *backwards from the goal*, not forwards from the task list.
- **superpowers** proved that skills are code — they must be pressure-tested — and that a workflow only holds if the chain is enforced, not suggested.
- **claudekit** proved context isolation: subagents that receive ~100 tokens of task context outperform subagents fed session history.
- **repository-harness** proved that risk should be *mechanical* (a checklist, not a feeling) and that harness health can be measured (friction, entropy, predicted-vs-actual).
- **gstack** proved that knowledge must be event-sourced (decisions are superseded, never edited) and that a second model's opinion is a gate feature, not a gimmick.

bee reassembles these into one opinionated chain, sized for a single developer running Claude Code and Codex.

## Principles

1. **Validate before execute. Always.** No source-editing execution before the feasibility of the current work is proven with *concrete evidence* — code inspection, command output, or a spike. "This should work" is not evidence. (khuym, gsd)

2. **CONTEXT.md is the source of truth.** Decisions get locked with stable IDs (D1, D2…) during exploring; every downstream stage executes against locked decisions and cites them, instead of reinterpreting intent. (khuym, gsd)

3. **The smallest honest workflow wins.** Every piece of work passes a mode gate first: `tiny` → `small` → `standard` → `high-risk`, plus `spike` when one yes/no proof decides the plan. Risk classification is a mechanical flag checklist, not judgment. Tiny work must not generate ceremony. (khuym modes + repository-harness lanes)

4. **Goal-backward, adversarial verification.** Checkers start from "this plan/claim will fail until evidence proves otherwise." Task completion ≠ goal achievement. Artifacts must be EXISTS + SUBSTANTIVE + WIRED. Claims require fresh command output. (gsd, superpowers, khuym)

5. **Fresh context, minimal context.** Subagents receive one task, the interfaces it touches, and global constraints — never session history. Scouting gathers *just enough*: phase-and-lane-scoped reading lists with token budgets, and research depth levels 0–3. (claudekit, superpowers, repository-harness, gsd)

6. **A cell is capped only after verification.** One worker, one cell, one commit. Workers never pick their own work, never edit outside reservations, and never wait silently — they return `[DONE]`, `[BLOCKED]`, `[HANDOFF]`, or `[NOOP]`. (khuym)

7. **Knowledge compounds or the system decays.** Every meaningful feature ends in compounding: dated learnings, critical-pattern promotion, and event-sourced decisions (`decide` / `supersede` / `redact`, append-only). Learnings and active decisions are injected at the *start* of future sessions, not archived to be forgotten. (khuym, gstack, gsd)

8. **The hive cleans itself.** Friction observed during work is captured in a structured backlog with *predicted* impact; grooming runs kill tech debt and measure *actual* outcomes. Hive health is a computed entropy score, not a feeling. (repository-harness, gstack)

9. **Skills are code. Test them.** No bee skill ships without a failing pressure test first (the Iron Law). Descriptions state *when to use*, never summarize the workflow — a workflow summary in the description causes agents to skip the skill body. (superpowers, khuym)

10. **Humans decide at exactly four gates.** Approve decisions, approve the work shape, approve execution, approve merge. Models recommend; the user decides. When two models disagree at a gate, surface the disagreement — never auto-resolve. (khuym, gstack)

## Non-goals

- **Not a runtime, not a binary.** No Rust CLI, no daemon, no database migrations. State is JSON/JSONL + markdown; helpers are small Node scripts vendored into the repo (like khuym's `.codex/*.mjs`).
- **Not 20 runtimes.** Claude Code and Codex only. The abstraction must make a third runtime cheap later, but bee does not pay for it now.
- **Not 40 skills.** Ten skills, hard cap. Domain skills (frontend, deploy, DB…) are out of scope — that's what other plugins are for.
- **Not a benchmark rig.** Health is measured by internal signals (entropy score, friction backlog, predicted-vs-actual), not an external benchmark harness.
- **Not autonomous merging.** P1 findings block. Gates never auto-approve.

## Success criteria

bee succeeds when, for its owner:

1. A vague feature request reliably becomes locked decisions, a validated plan, and capped cells without a single "wait, that's not what I meant" late in execution.
2. Small fixes complete in minutes with near-zero ceremony (tiny lane works).
3. A session can pause at ~65% context and resume the next day from `HANDOFF.json` without re-explaining anything.
4. `history/learnings/critical-patterns.md` and `decisions.jsonl` visibly change agent behavior in later features (fewer repeated mistakes).
5. Grooming runs find and kill real debt, and the entropy score trends down.
6. The same skills run under both Claude Code and Codex with no divergence in the workflow contract.
