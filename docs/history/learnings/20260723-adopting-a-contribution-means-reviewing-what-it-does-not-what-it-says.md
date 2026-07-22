---
date: 2026-07-23
feature: herding-adopt
categories: [pattern, decision, failure]
severity: critical
tags: [external-contribution, security-review, unattended-automation, safety-posture, adoption]
---

# Learning: adopting a contribution means reviewing what it does, not what it says

An external PR contributed an unattended loop with merge authority. Taking it well meant separating
the design (good, kept) from the implementation (unsafe, fixed) — and it exposed a mistake of my
own on the way in.

## Learning 1: My own first read of "why CI is red" was wrong, and it was wrong in the reassuring direction

**Category:** failure
**Severity:** critical
**Tags:** [triage, distribution]
**Applicable-when:** any red CI on a change that adds files to a managed/shipped set.

### What Happened

I first told the owner the PR's CI was red only because the release manifest was stale, and that
regenerating it would clear the path. That was wrong. The real refusal was by **name**: the
distribution preflight hard-requires a managed-skill naming shape, and the contributed skill did not
match. Regenerating the manifest would have cleared the *messenger* check while leaving the install
refusal — and had it been forced green, **every install would have hard-refused for every user.**

### Root Cause

A stale-manifest failure and a name-refusal failure present almost identically at the top of a CI
log — both mention the manifest. I read the first plausible explanation and stopped, and the first
plausible explanation was the harmless one.

### Recommendation

**When a shipped-set check goes red, trace it to the assertion that actually threw before naming a
cause — and be most suspicious when the available explanation is the harmless one.** A manifest
"mismatch" and a distribution "refused" are different failures with different blast radii; the
harmless-looking one at the top of the log is not evidence the harmful one below it is absent.

## Learning 2: A contribution's prose describes intent; only the code describes behavior

**Category:** pattern
**Severity:** critical
**Tags:** [security-review, external-contribution]
**Applicable-when:** reviewing any contribution whose docs claim safety properties.

### What Happened

The contribution's documentation named strong containments — role boundaries, a lane-safety filter,
a four-slot cap, a stop gesture, "it will not pick up hard-gate work." Reviewed against the code,
every one was weaker than stated: the lane filter passed 8 of 8 real rows including "delete the
entire JS runtime"; the cap was a model counting panes; the stop file left a ~91-minute window in
which merge could still fire, and never stopped the working agents at all. The prose was not
dishonest — the PR flagged some of these itself — it was simply describing what the author intended
the system to guarantee, not what the code enforced.

### Root Cause

Documentation is written from the design's point of view, where the guarantees are real because they
are intended. The gap between intent and enforcement is invisible from inside the prose and only
appears when you run the code against adversarial input.

### Recommendation

**Review a contribution's executable code against its own safety claims, one claim at a time, by
running it — and treat every claimed containment as a hypothesis until a reproduction or a code path
confirms it.** For unattended automation specifically: reproduce the failure modes (a bad flag, a
non-numeric input, a missing binary) rather than reasoning about them; they took seconds and each
was real. "The PR says it won't do X" is where the review starts, never where it ends.

## Learning 3: Make the dangerous act the human's, and let the cheap act run unattended

**Category:** decision
**Severity:** critical
**Tags:** [unattended-automation, safety-posture]
**Applicable-when:** designing or adopting any automation that both produces work and lands it.

### What Happened

The contribution ran two loops: dispatch (start work in an isolated worktree) and merge (land it in
the trunk). Every serious risk concentrated in the second — merge authority in unattended hands, the
long stop-latency window, and running the project's verify over code unsandboxed agents had just
written. The adoption kept dispatch as a loop and demoted merge to a single-shot the owner runs by
hand. That dropped one of four hard-gate flags outright and shrank the stop-latency problem to the
harmless half, at the cost of the owner being present when something lands.

### Root Cause

The two halves of the automation had very different blast radii, but the original design gave them
the same autonomy. Autonomy should track blast radius: starting work in a throwaway copy is
recoverable; landing it in the shared trunk is not.

### Recommendation

**Split automation at the point where an action becomes hard to reverse, and keep the irreversible
side a human gesture while automating the reversible side.** The test is not "can this step be
automated" but "what does one bad iteration of this step cost" — the reversible side can loop
unattended; the irreversible side is a keystroke, and its being a keystroke is a feature, not a
limitation.

## Learning 4: A safety posture asserted about the code must be measured against the code

**Category:** failure
**Severity:** standard
**Tags:** [safety-posture, measurement]
**Applicable-when:** writing any plan that narrows or reasons about permissions or selection.

### What Happened

My own plan asserted two things that measurement disproved. It said the control panes "never need to
write" — dispatch creates worktrees and merge aborts and cleans, so narrowing them to read-only would
have stalled both silently every interval. And it deferred a backlog-format reconciliation on the
reasoning that a format mismatch made the loop select nothing — but the classifier anchored on the
status value, not column position, so it already parsed the repo, and two rows qualified for dispatch
that moment. The advisor caught both by running them.

### Root Cause

Both were assertions about how existing code behaves, written from reading rather than execution — the
same intent-versus-enforcement gap as Learning 2, applied to my own plan instead of the
contribution's.

### Recommendation

**Any plan claim about how existing code behaves — what a component reads, what it writes, what it
selects — is a measurement, not a premise; run it before locking it.** A consult or a review that
runs the claim is worth more than one that reasons about it, and the claims most worth running are
the ones the plan leans on hardest.
