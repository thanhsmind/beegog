---
date: 2026-07-23
feature: judge-record-tags
categories: [failure, pattern]
severity: critical
tags: [census, scope, measurement, cross-cutting-rules, audit]
---

# Learning: the scope is the finding

A one-line bug took two cells, because the check written to prevent its class was itself scoped
from assumption.

## Learning 1: A cross-cutting write-time rule is unfinished until its existing callers are swept

**Category:** failure
**Severity:** critical
**Tags:** [cross-cutting-rules, refusals]
**Applicable-when:** adding any validation, refusal, or required field to a shared write path.

### What Happened

A rule was added making a decision event refuse to log without at least one tag, once the repo has a
tag taxonomy. It shipped correctly and was well tested — against the *caller the rule was written
for*. Five internal callers already in the tree passed no tags at all: resetting a stale claim,
overriding a judge verdict, resetting a cell budget, reopening a cell on a rework verdict, and
recording the audit line that is the price of the scribing-debt waiver.

All five were live. Three unwound their whole operation. One sat inside a best-effort catch, so its
operation succeeded and the audit line **silently vanished** — the quieter and more dangerous mode.
The fifth was the worst-placed: it is written *after* the state lock releases on feature close, so a
throw leaves the feature closed with its state mutated and the record explaining the waiver absent.

The visible symptom, months later, was a rework verdict that could not be recorded and had to be
hand-written into the log.

### Root Cause

New-rule work is naturally forward-looking: you test the rule against the call you are writing. The
callers already in the tree are invisible because they are not part of the change. Nothing structural
connected "this rule now binds every writer" to "here is every writer".

### Recommendation

**When adding a validation or refusal to a shared write path, sweep the existing callers in the same
change, and leave behind a check that DERIVES the caller list by scanning source rather than listing
it.** A hand-maintained list has the same defect as the original omission — it records what someone
remembered. Two properties keep such a check honest: a caller that legitimately forwards a *user's*
value must never be flagged (or the next author fabricates one to pass), and the check is proven by
injecting a violation and watching it name its own file and line.

## Learning 2: The scope of a check is the finding — and it is the part nobody reviews

**Category:** failure
**Severity:** critical
**Tags:** [scope, measurement, audit]
**Applicable-when:** writing any census, fence, audit, or grep-based check.

### What Happened

Three times in one session, by the same author, a hand-chosen scan scope was one directory too narrow
and reported **clean**:

1. An audit command meant to sweep the instruction surfaces silently omitted `hooks/` — where the P1
   turned out to be. It was only found because the subagent running it noticed the omission and
   measured that directory separately.
2. The census built to prevent the tagless-caller class was scoped to `lib/**` from memory. It passed
   green on a tree that still carried a live instance of that exact bug, in a sibling file one level
   up.
3. That session's first audit read files for meaning instead of counting, and missed two that a
   later `grep -c` found immediately.

Each time the fix was trivial and the miss was not: a scope that is too narrow does not fail loudly.
It returns the most reassuring output a check can produce.

### Root Cause

A check is a **rule** plus a **scope**. Review attention goes to the rule, because that is where the
thinking visibly happened. The scope is typed once, from memory of where the relevant code lives, and
then inherited by everyone who trusts the check afterwards.

### Recommendation

**Derive the scope by measurement before trusting the check: run the unrestricted search first, look
at what comes back, and only then narrow — with every exclusion carrying its reason in the code.**
"I know where those live" is precisely the assumption that produced all three misses. A check whose
scope was never measured proves nothing when it passes; it proves something about the subset someone
remembered.

**Corollary:** every exclusion is a claim that nothing there can carry the defect, and claims need
evidence. Legitimate exclusions exist — a fixture's violation is its subject matter, a legacy
citation resolves through a stub — but each belongs beside the code with its reason, not in the
author's head.
