---
date: 2026-07-23
feature: backlog-submit-command
categories: [pattern, decision, failure]
severity: standard
tags: [backlog, cli-design, standard-lane, validating, promotion-criteria]
---

# Learnings — backlog-submit-command (P80: `bee backlog propose`)

**Category:** pattern
**Severity:** standard
**Tags:** [validating, mode-gate, mechanical-rule]
**Applicable-when:** classifying a feature's lane when risk flags and file count disagree.

## What Happened

D5 locked a file split (new function in `lib/backlog.mjs`, handler in `bee.mjs`, registry entry in `lib/command-registry.mjs`) plus a test file — 4 product files, 0 risk flags. The mode gate's mechanical file-count cap (`small` requires ≤3) pushed this to `standard` lane despite the change being genuinely low-risk, bringing the full plan-checker + cell-review + semantic-judge ceremony. The same-session sibling feature (P79, backlog-auto-commit) sat at exactly 3 files and correctly stayed `small` — a direct in-repo A/B of the boundary applied literally.

## Root Cause

The file count was a direct consequence of a locked product decision (D5's file split, chosen to match existing sibling-function conventions), not scope creep. Compressing to 3 files would have meant reinterpreting a locked decision to dodge ceremony — itself a documented red flag.

## Recommendation

When a feature's file count crosses a lane boundary only because of an already-locked structural decision (not because of padding or indecision), apply the mechanical lane rule as written rather than reinterpreting the locked decision to fit a cheaper lane. The extra ceremony is not wasted: this session's `standard` lane caught a plan.md citation typo and confirmed a borderline undeclared-file touch was legitimate — checks a `small` lane's lighter self-review would have skipped.

---

**Category:** decision
**Severity:** standard
**Tags:** [yagni, scope-discipline]
**Applicable-when:** deciding whether to build an adjacent capability now or defer it.

## What Happened

Two adjacent capabilities were explicitly deferred rather than built: importing an existing `.bee/backlog.jsonl` proposal into the new PBI row (P81, blocked by D4), and refactoring `bee-exploring`/`bee-scribing`'s hand-edit conventions to call the new shared function (P82, blocked by D5). Both were filed as trackable backlog rows with a concrete re-trigger condition, not silently dropped.

## Root Cause

Both deferrals had real design cost that didn't belong in this feature's acceptance criteria: P81 requires solving a genuine schema mismatch (a friction-style entry has no natural "CoS"); P82 requires touching two other skills' locked, working behavior for a consolidation with no urgency signal.

## Recommendation

When an adjacent capability surfaces mid-feature, defer it with a filed backlog row carrying a concrete, falsifiable re-trigger condition ("revisit only if X becomes real friction") rather than either building it speculatively or dropping it silently. This is the difference between YAGNI and scope-cutting: the idea survives, just not in this feature's blast radius.

---

**Category:** failure
**Severity:** standard
**Tags:** [promotion-criteria, false-recurrence]
**Applicable-when:** evaluating whether a repeated finding clears bee-compounding's critical-pattern promotion bar.

## What Happened

This feature's scribing pass documented the already-known `readBacklogCounts` silent-drop bug (first found during the prior same-session feature's close, backlog-auto-commit/P79) in a new knowledge-area concept — citing the *original* friction entry by its original timestamp. This looked, at first glance, like the "seen twice" recurrence the earlier close's compounding decision was explicitly waiting for before promoting. It is not: no new friction was filed for this feature (`feature:backlog-submit-command` returns zero hits in `.bee/backlog.jsonl`), the cell's own trace shows no friction, and the new doc cites the original finding rather than independently re-discovering it. This feature's own P80 row joining the affected set is a passive byproduct of the still-unfixed bug plus a still-standing table convention, not a new discovery event.

## Root Cause

The promotion decision tree's "seen twice" language doesn't distinguish an independent second discovery/friction event from a later feature's documentation merely citing the first one. A scribing pass that correctly propagates a known gap into a new concept's Open Gaps section looks, on the surface, like a second sighting.

## Recommendation

When judging "seen twice" for critical-pattern promotion, count only freshly-filed friction/blocked-work records as independent sightings — a later feature's documentation citing an earlier finding by timestamp, with no new friction of its own, does not clear the bar. Filed as a proposal (`.bee/backlog.jsonl`, `layer: bee-compounding`) to tighten this language in `bee-compounding`'s own SKILL.md.
