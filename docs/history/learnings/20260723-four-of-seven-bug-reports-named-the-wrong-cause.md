---
date: 2026-07-23
feature: issues-46-53
categories: [failure, pattern]
severity: critical
tags: [triage, measurement, guards, flags, self-contradiction]
---

# Learning: four of seven bug reports named the wrong cause

Seven issues were filed in one day. Every symptom was real. **Four named a cause that measurement
disproved** — and in each case, implementing the reported fix would have fixed nothing.

## Learning 1: Triage the cause, not the symptom — the reporter sees the symptom and infers the rest

**Category:** failure
**Severity:** critical
**Tags:** [triage, measurement]
**Applicable-when:** any bug report, especially one that arrives with a confident diagnosis.

### What Happened

| Reported | Measured |
|---|---|
| "PBI ids are `max+1`, concurrent readers collide" | No allocator code exists at all. The two duplicates were authored **a day apart on different branches**. A lock would prevent nothing. |
| "worktree/branch/feature are three inconsistent names" | They are **one slug** at creation. One mutable field drifts afterwards. |
| "it runs verify on the first question" | **Nothing executes verify automatically.** Two call sites exist, both in an unrelated command. |
| "bee shows its internal scratch scripts" | Bee has **no mechanism** that surfaces them. Its own write guard *forces* scripts into that location. |

Each report was a competent user reasoning backwards from a real symptom to a plausible mechanism.
Each plausible mechanism was wrong, and three of the four would have sent the fix into code that
does not exist.

### Root Cause

A reporter observes an effect and supplies the most available explanation. That explanation arrives
in the title, where it reads as a finding rather than a hypothesis — and a title is what a fixer
scopes from.

### Recommendation

**Treat the reported cause as a hypothesis with the same standing as any other, and spend the first
move disproving it: grep for the code the report assumes exists, and time or reproduce the behaviour
it assumes happens.** Where the cause turns out wrong, say so explicitly in the fix and in the reply
— the reporter learns what the system actually does, and the next report is better. "Symptom real,
cause wrong" is a normal and frequent triage outcome, not an accusation.

## Learning 2: A system contradicting itself hides in plain sight, because each half looks correct alone

**Category:** failure
**Severity:** critical
**Tags:** [guards, self-contradiction]
**Applicable-when:** any pair of mechanisms where one produces what another is supposed to consume,
reclaim, or check.

### What Happened

Two instances in one batch:

- A write guard **refuses** scratch-shaped writes elsewhere and instructs the author to write into a
  scratch root. The sweeper that reclaims that scratch listed only directories — so every plain file
  written exactly where the guard sent it was unreachable by every flag, including the one documented
  as clearing everything. 58 of 76 entries were unsweepable.
- A merge refusal derived its expected branch from a *mutable* feature field, then blamed the
  **branch** — which is correct, fixed at creation, and the one thing the operator must not change.

Neither is a bug in either half. Read alone, the guard is right and the sweeper is right; the refusal
is right and the field is right. The defect lives in the seam, and nothing owns the seam.

### Root Cause

Tests and reviews are organised around units. A contradiction between two units is nobody's unit, so
it survives every green run — and it is *invisible* precisely because both halves independently pass
inspection.

### Recommendation

**When one mechanism decides where things go, specify the mechanism that reclaims or checks them
against that same shape — and assert the pair together, not each half alone.** The question to ask
of any guard: *what does this produce, and who consumes it?* If the answer is another mechanism,
there must be a test that exercises the handoff, because neither unit's own tests can see it.

## Learning 3: A flag is honoured or explained, never dropped

**Category:** pattern
**Severity:** standard
**Tags:** [flags, cli]
**Applicable-when:** any code path that returns early while an optional flag is in scope.

### What Happened

A cleanup flag was accepted, then evaporated on one early-return path: exit zero, nothing done,
nothing said. The rule it followed — "cleanup is strictly post-commit" — had substituted a **proxy**
("a commit happened") for the **real** safety property ("nothing would be lost"). On the path in
question no commit is made, but nothing could be lost either: the target already had everything, and
an earlier refusal had already proved the working tree clean.

### Root Cause

Early returns are written to short-circuit the *failure* they are guarding against, and flags in
scope are easy to forget there. Compounding it, the guarding rule was stated as its proxy rather
than its property, so the proxy generalised to a case where the property did not hold.

### Recommendation

**State a safety rule as the property it protects, never as the proxy you happened to check — then
audit every early return for flags still in scope.** A flag the caller passed must be honoured or
explicitly declined with a reason in the output; exit zero with silence is the one unacceptable
outcome, because the caller cannot tell it from success.
