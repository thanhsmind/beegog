---
date: 2026-07-11
feature: onboard-statusline
categories: [pattern, failure]
severity: standard
tags: [onboarding, opt-in-detection, substring-matching, red-first, review]
---

# Learning: An opt-in signal detected by substring matches every superstring context — the review predicted it, red-first proved it twice

**Category:** failure
**Severity:** standard
**Tags:** [onboarding, opt-in-detection, substring-matching, red-first, review]
**Applicable-when:** deriving a boolean opt-in/routing signal from free-form
configuration text (commands, paths, URLs) anywhere in bee or a host project

## What Happened

The statusline vendor stage detects opt-in by reading the host's
`statusLine.command`. Two successive detection defects shipped into the working
tree and were both caught before merge:

1. My own test matrix (written red-first) caught round one: the user-level path
   `/home/x/.claude/statusline-command.sh` contains the substring
   `.claude/statusline-command.sh`, so a plain `includes()` opted in a host that
   pointed at the user's personal copy.
2. The external correctness reviewer (P2-1) caught round two: the *fixed*
   version returned true whenever `CLAUDE_PROJECT_DIR` appeared **anywhere** in
   the command — `test -n "$CLAUDE_PROJECT_DIR" && bash
   ~/.claude/statusline-command.sh` is user-level yet passed. Adding the
   adversarial case as a red test reproduced it (3 FAILs), and anchoring the
   variable to the script path itself went green.

## Root Cause

Same defect class as critical pattern [20260711] model-tier-guard #1: a
free-text token used as a control signal was window-searched instead of
anchored to the structural position that gives it meaning. Each fix that
anchored one token left the *other* token unanchored — the class survived the
instance fix, exactly as the grill-deltas learning predicts.

## Recommendation

1. When a boolean signal is derived from free text, every token in the rule
   must be **anchored to the structure that gives it meaning** (the variable
   must prefix the path; the relative path must have no preceding segment) —
   and the test matrix must carry one adversarial row per token where the
   token appears *outside* that position.
2. After a reviewer names one unanchored token, sweep the whole predicate for
   sibling tokens before re-submitting (grill-deltas rule applied to
   expressions, not just diffs).
3. Red-first paid for itself twice in one small cell: both defects produced
   failing tests *before* the fix, so the before-state is characterized in the
   cell trace, not reconstructed.
