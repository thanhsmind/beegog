---
type: bee.pattern
title: An append-only learning artifact transmits its own obsolete advice with the authority of a critical pattern
description: "Corrections get appended; the headline is authored once. Under compaction and skim-reading an agent loads the summary and the citation, never the tail — so the doc keeps teaching the mistake it was written to stop."
tags: [process, knowledge, patterns, compaction, review]
timestamp: 2026-07-23
bee:
  id: pattern-20260723-an-append-only-learning-artifact-transmits-obsolete-advice
  lifecycle: active
  areas: [hook-runtime]
  required_context: []
  decisions: []
  sources: ["compaction-hardening (three consecutive shape revisions failed independent review on five instances of one defect class; revision 1 cited PAT37 by name and followed its stale headline; traces in .bee/cells/cz-*.json and docs/history/compaction-hardening/reports/, 2026-07-23)"]
  polarity: pitfall
  critical: true
---

# An append-only learning artifact transmits its own obsolete advice with the authority of a critical pattern

## What it looks like

A pattern doc is written once, then corrected by appending a recurrence note each time
the lesson is relearned. The headline paragraph — the part anyone quotes, the part a
session preamble digests, the part that survives a compaction — still says whatever was
believed on the first day.

## Why it bites harder than a merely stale doc

An ordinary stale doc is ignored. This one is **cited**. It carries the authority of a
critical pattern, so an agent that reads it does the wrong thing *confidently*, and the
review that follows sees a plan correctly citing a canonical source.

The measured instance: PAT37 (`20260715-shipping-a-lib-file-means-shipping-the-manifest.md`)
had a headline reading *"the regen is part of the FEATURE, owned by its last cell or its
close step"*, scoped to `templates/lib/`. Its corrective — *"any lib-touching cell's verify
carries all three regen/checks explicitly"* — sat three paragraphs down, inside the **third**
recurrence note of an append-only log. `compaction-hardening` revision 1 cited PAT37 **by
name** and routed the whole chain to its last cell: exactly what the headline said, and
exactly what recurrence #2 had already condemned. Revision 2 then inherited the
`lib/`-only trigger from the same sentence and put the check that *stays green* on the two
cells that needed the one that *moves*. Two of five instances of one defect class in a
single feature came from the artifact meant to prevent them.

## The mechanism

Under compaction and under skim-reading, an agent loads **the summary and the citation,
never the tail**. That is not carelessness — it is what summarization is for. So an
append-only structure guarantees that the least-current sentence is the most-read one.

## Rules

- **Rewrite the headline rule on every recurrence.** If the fix direction changed, the old
  sentence is a defect, not history — move it below an explicit `SUPERSEDED` line that names
  what it caused. History belongs in the recurrence log; the headline belongs to what is true
  now.
- **When you cite a pattern to justify a decision, quote the recurrence note with the highest
  number, not the summary.** If the two disagree, the pattern doc has this defect and fixing
  it is part of your work.
- **A scope, trigger, or contract stated in a pattern doc is still prose.** Execute the thing
  that defines it and paste the real output into the plan — regardless of which document the
  assumption came from. (See also: *a scan scope set from assumption passes green while hiding
  the very bug it was built to catch*.)

## Where this is enforced

Nowhere yet, mechanically. Filed as backlog friction: a check that refuses a recurrence note
appended to a `bee.pattern` whose headline paragraph is byte-unchanged in the same commit.
Until that ships, this is prose relying on being read — which is precisely the failure mode it
describes.
