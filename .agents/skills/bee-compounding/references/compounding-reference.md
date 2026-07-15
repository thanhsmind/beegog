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

## Promotion Decision Tree (docs/09 item 3)

1. Seen twice (review finding, user correction, repeated deviation) AND it clears the three promotion criteria below? If not, it stays a learning entry.
2. Mechanizable? A grep/lint line in a verify command, a `bin/lib` guard, a hook denial → **promote as the check**, note the check's location in the learnings file, done.
3. Not mechanizable (judgment, taste, product intent) → promote as prose below.

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
node .bee/bin/bee.mjs decisions log --decision "..." --rationale "..." [--alternatives "..."] [--confidence N]
```

- Log only decisions with forward force (conventions adopted, approaches rejected with reasons, constraints discovered).
- Include `--alternatives` whenever real alternatives were weighed; add `--confidence N` when the evidence was partial.
- To change a past decision: `node .bee/bin/bee.mjs decisions supersede --id UUID --decision D --rationale R`. Never rewrite the log.
- The logger rejects secret-like content and injection patterns; do not try to work around a rejection — redact instead.

## State-Layer Guard (decisions 0001, 0002)

The area-spec and reading-map templates live in `bee-scribing/references/scribing-reference.md` — compounding never writes `docs/specs/` itself. The guard check reads `.bee/state.json` for the feature's scribing record; absent while `behavior_change` cells were capped → invoke `bee-scribing`, then resume.

## Friction Backlog Entry

Unresolved friction (from cell `trace.friction` or the session) appends to `.bee/backlog.jsonl`:

```json
{"ts":"<ISO>","type":"friction","feature":"<feature>","title":"<short name>","detail":"<what kept hurting>","predicted_impact":"<what it will cost if left>","layer":"<spec|context|environment|verification|state>","source":"compounding"}
```

`layer` is optional but valuable: attribute the friction to exactly one harness layer —
`spec` (the task was underspecified), `context` (the right information wasn't provided),
`environment` (the tooling/setup failed), `verification` (feedback was missing or wrong),
`state` (continuity/records failed). Grooming aggregates these to find the bottleneck
layer; entries without `layer` stay valid.

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
    "scribing_verified": true
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
- compounding writing `docs/specs/` itself instead of invoking bee-scribing
