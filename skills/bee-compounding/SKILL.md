---
name: bee-compounding
description: >-
  Capture durable learnings and decisions so future work starts smarter. Use when reviewing completes, or when work is intentionally abandoned with lessons worth keeping.
metadata:
  version: '0.1'
  ecosystem: bee
  dependencies:
    nodejs-runtime:
      kind: command
      command: node
      missing_effect: degraded
      reason: Reads cell traces and logs decisions via the vendored .bee/bin helpers.
---

# Compounding (honey)

Compounding captures reusable lessons from completed work and feeds them back into future exploring, planning, and reviewing. Run it after `bee-reviewing` completes, or when work is intentionally abandoned with lessons. Do not skip it for meaningful work just because the session feels done.

## 1. Gather Evidence

- `docs/history/<feature>/CONTEXT.md`, `plan.md`, worker reports under `docs/history/<feature>/reports/`
- cells and traces: `node .bee/bin/bee_cells.mjs list --feature <feature>`
- review findings (including residual-findings.md, if present)
- feature commit history

If history artifacts are incomplete, fall back to the session summary and recent git diff. NEVER fabricate learnings — a thin honest entry beats an invented rich one.

## 2. Analyze — Three Parallel Analysts

Launch three temp-finding subagents in parallel (prompts in `references/compounding-reference.md`):

| Analyst | Focus | Tier |
|---|---|---|
| pattern extractor | reusable code/process/integration patterns | extraction |
| decision analyst | important choices, tradeoffs, surprises | generation |
| failure analyst | blockers, wrong assumptions, regressions, missing checks | generation |

Subagents return temporary findings only — they NEVER write durable files. The orchestrator synthesizes.

## 3. Synthesize — One Learnings File

Write one dated file: `docs/history/learnings/YYYYMMDD-<slug>.md` with frontmatter (`date`, `feature`, `categories`, `severity`, `tags`) and sections **What Happened** / **Root Cause** / **Recommendation**. Recommendations are imperative future rules: "When X, do Y" — specific enough to act on. Template in the reference.

Before writing, redact secrets and PII from every evidence snippet. If a finding cannot be safely redacted, drop it and note the skip in the run summary. Secrets never enter learnings.

## 4. Promote Criticals — Sparingly

Append a summary block to `docs/history/learnings/critical-patterns.md` only when a lesson meets ALL three criteria:

1. **Multi-feature relevance** — it will matter beyond this feature.
2. **Meaningful waste prevented** — it would save future agents real time or real damage.
3. **Generalizable** — it is a rule, not an anecdote.

Ten findings rarely yield ten criticals. Keep critical-patterns.md high signal; a bloated file gets skipped, and then nothing compounds.

## 5. Log Durable Decisions

```
node .bee/bin/bee_decisions.mjs log --decision "..." --rationale "..." [--alternatives "..."] [--confidence N]
```

Log choices future planning must honor. Supersede outdated decisions (`bee_decisions.mjs supersede`) — never edit history.

## 6. Sync the State Layer (decision 0001)

Update `docs/specs/` so it matches what actually shipped:

1. Collect capped cells with `behavior_change: true` and their `verification_evidence` — this is the delta list; do not re-derive behaviors from the diff.
2. Map each delta to an area by the files it touched (kebab-case area names, stable once chosen). Merge the deltas into each touched area's `docs/specs/<area>.md` — create the spec from the template if the area has none. Specs are written in the present tense and state only current behavior, requirements, and settled edge cases, citing active D-IDs; never narrate history ("was", "changed from" are banned — history lives in git and `docs/history/`).
3. Refresh `docs/specs/reading-map.md`: add or correct one-line entries for locations this feature created or repurposed.

No `behavior_change` cells → record "state layer: no sync needed" in the run summary and move on. Templates and merge rules in the reference.

## 7. File Unresolved Friction

Unresolved friction from cell traces or the session → `.bee/backlog.jsonl` entries with a predicted impact, so `bee-grooming` can hunt them later. Entry format in the reference.

## 8. Update State

Record the completed compounding run in `.bee/state.json` (phase, learnings file path, promotion count, next_action).

## Hard Gates

- Do NOT skip compounding for meaningful work. "The session feels done" is the rationalization, not a reason.
- Do NOT promote everything as critical — apply all three criteria.
- Do NOT write generic lessons ("test more carefully" is banned-grade advice). Concrete situation, root cause, imperative rule.
- Do NOT let subagents write durable files; the orchestrator synthesizes.
- Do NOT skip the state-layer sync when `behavior_change` cells were capped — a spec older than the behavior it describes is measured entropy, not a detail.
- Secrets and PII never appear in learnings, decisions, backlog entries, or specs.

## Headless

`mode:headless`: gather, analyze, and write the dated learnings file for unambiguous findings; log clearly-durable decisions and friction; apply spec merges whose deltas come directly from `behavior_change` cells + evidence (they are mechanical). Critical promotions, ambiguous merge/keep calls, and any spec rewording beyond the delta merge are NOT applied — they go to an `Outstanding Questions` section of the structured terminal report for the human.

## Red Flags

- skipping compounding because the user left or the session feels done
- promoting most findings as critical
- vague advice with no situation or root cause
- inventing findings when artifacts are missing
- an analyst subagent writing to `docs/history/learnings/` directly
- an API key, token, or credential in an evidence snippet
- history narration inside a spec ("previously", "changed from") — specs state only what is
- `behavior_change` cells capped but no spec touched and no "no sync needed" record

Violating the letter of these rules is violating the spirit of these rules.

## Handoff

Compounding complete: learnings at `docs/history/learnings/YYYYMMDD-<slug>.md`, <N> critical promotions, <M> area specs synced. Invoke bee-hive skill.

| Reference | When to Load |
|---|---|
| `references/compounding-reference.md` | analyst prompts, learnings template, promotion format, spec + reading-map templates, backlog entry format |
