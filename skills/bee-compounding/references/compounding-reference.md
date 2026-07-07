# Compounding Reference

Load after `bee-compounding` is selected. Protocol lives in SKILL.md; prompts and templates live here.

## Analyst Prompts

Each analyst receives: the feature name, CONTEXT.md, plan.md, the cell list with traces, review findings, and the commit log for the feature. Nothing else — never session history. They return findings as structured text to the orchestrator and never write files.

```text
You are the pattern extractor. From the evidence provided, identify reusable
code, process, or integration patterns that worked. For each: name the pattern,
cite the concrete file/command/flow where it appeared, and state when a future
agent should reuse it. Return findings only; write no files.
```

```text
You are the decision analyst. From the evidence provided, identify the important
choices made: what was decided, what alternatives existed, what tradeoff was
accepted, and what surprised us. Flag any decision future planning must honor
or supersede. Return findings only; write no files.
```

```text
You are the failure analyst. From the evidence provided, identify blockers,
wrong assumptions, regressions, verification gaps, and friction recorded in cell
traces. For each: what happened, the root cause, and the check that would have
caught it earlier. Return findings only; write no files.
```

Tiers: pattern extractor = extraction; decision and failure analysts = generation; synthesis = ceiling (the orchestrator itself).

## Learnings File Template

Path: `docs/history/learnings/YYYYMMDD-<slug>.md`. Slug: `YYYYMMDD-<primary-topic>-<secondary-topic>`, lowercase hyphens only.

```markdown
---
date: YYYY-MM-DD
feature: <feature-name>
categories: [pattern, decision, failure]
severity: critical | standard
tags: [tag1, tag2]
---

# Learning: <Concise Title>

**Category:** pattern | decision | failure
**Severity:** critical | standard
**Tags:** [tag1, tag2]
**Applicable-when:** <when future agents should use this>

## What Happened

<2-4 concrete sentences. Name files, commands, tools, or flows.>

## Root Cause

<Why it happened, or why the pattern worked.>

## Recommendation

<Imperative rule: "When X, do Y." Specific enough to act on.>
```

Multiple findings from one feature go in one dated file as repeated Learning sections — not one file per finding.

## Critical Promotion Format

Only lessons passing all three criteria (multi-feature relevance, meaningful waste prevented, generalizable) get a summary block appended to `docs/history/learnings/critical-patterns.md`:

```markdown
## [YYYYMMDD] <Learning Title>
**Category:** pattern | decision | failure
**Feature:** <feature-name>
**Tags:** [tag1, tag2]

<2-4 sentence summary: what happened, root cause, and the future rule.>

**Full entry:** docs/history/learnings/YYYYMMDD-<slug>.md
```

critical-patterns.md is injected into every session preamble — every low-signal block you add taxes every future session. When in doubt, do not promote.

## Decision Logging

```
node .bee/bin/bee_decisions.mjs log --decision "..." --rationale "..." [--alternatives "..."] [--confidence N]
```

- Log only decisions with forward force (conventions adopted, approaches rejected with reasons, constraints discovered).
- Include `--alternatives` whenever real alternatives were weighed; add `--confidence N` when the evidence was partial.
- To change a past decision: `node .bee/bin/bee_decisions.mjs supersede --id UUID --decision D --rationale R`. Never rewrite the log.
- The logger rejects secret-like content and injection patterns; do not try to work around a rejection — redact instead.

## Area Spec Template (state layer, decision 0001)

Path: `docs/specs/<area>.md`. Area name: kebab-case, chosen at first write, stable thereafter. Overwrite/merge freely — this file always describes *now*; history lives in git and `docs/history/`.

```markdown
---
area: <area-slug>
updated: YYYY-MM-DD
sources: [<feature-slugs that shaped current behavior>]
decisions: [<active D-IDs cited below>]
---

# Spec: <Area Name>

<One paragraph: what this area is for.>

## Current Behavior

<Observable behaviors, present tense, one bullet each. Concrete: inputs, outputs, states.>

## Requirements & Constraints

<Active requirements and prohibitions, citing decisions ("per D2") where a choice needs rationale.>

## Edge Cases Settled

<Edge cases with a decided answer. An open question does not belong here — it belongs in exploring.>

## Pointers

<Key files: `path` — role. Keep to the load-bearing few.>
```

Merge rules:

- Deltas come from `behavior_change` cells + `verification_evidence` only — never invent behaviors from memory, never copy from the plan (plans describe intent; specs describe reality).
- A delta that contradicts an existing spec line **replaces** it; do not keep both.
- Update `updated`, append the feature to `sources`, reconcile `decisions` against the active set.
- Present tense only. "Was", "previously", "changed from" are banned words in a spec.

## Reading Map

Path: `docs/specs/reading-map.md`. One line per location, grep-friendly:

```markdown
# Reading Map

- `src/auth/` — session middleware and guards; spec: docs/specs/auth.md
- `scripts/build.mjs` — single build entry point; run with `node scripts/build.mjs`
```

At sync time: add lines for locations the feature created or repurposed, fix lines it made wrong, delete lines for locations it removed. Keep it a map, not documentation — one line each, no prose blocks.

## Friction Backlog Entry

Unresolved friction (from cell `trace.friction` or the session) appends to `.bee/backlog.jsonl`:

```json
{"ts":"<ISO>","type":"friction","feature":"<feature>","title":"<short name>","detail":"<what kept hurting>","predicted_impact":"<what it will cost if left>","source":"compounding"}
```

## State Update

```json
{
  "phase": "compounding-complete",
  "summary": "Compounding complete. Learnings captured for the next feature.",
  "next_action": "Start the next feature or reopen deferred follow-up work.",
  "last_compounding_run": {
    "feature": "<feature-name>",
    "date": "YYYY-MM-DD",
    "learnings_file": "docs/history/learnings/YYYYMMDD-<slug>.md",
    "critical_promotions": 0,
    "specs_synced": 0
  }
}
```

Merge these fields into `.bee/state.json`; do not drop `approved_gates` or other existing fields.

## Red Flags

- skipping compounding for meaningful work
- promoting everything as critical
- writing vague advice such as "test more carefully"
- inventing findings when evidence is thin
- an analysis subagent writing durable files directly
- unredacted secrets or PII in any durable record
- spec content invented from memory or copied from the plan instead of merged from `behavior_change` deltas
