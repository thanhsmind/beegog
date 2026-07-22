---
date: 2026-07-23
feature: okf-integration-close-f4
categories: [failure, decision, pattern]
severity: critical
tags: [metrics, denominators, gaming, spec-defects, gates]
---

# Learning: a metric that punished growth, and a cell spec that was wrong about its own repo

The instruction-layer gate closed the audit sequence. Two further learnings came out of what
happened *after* it shipped.

## Learning 1: A ratio whose numerator is frozen and whose denominator can grow will eventually punish health

**Category:** failure
**Severity:** critical
**Tags:** [metrics, denominators, drift]
**Applicable-when:** any ratio, budget, or threshold where one side is measured from a fixed
historical artifact and the other from the live tree.

### What Happened

A drift metric guards migrations: it divides the anchors found in a *pinned historical source* by
the number of concepts in the area, and fails when an area's ratio falls outside a band around the
running median. It had been green for eleven areas and about a year of work.

It went red on an area whose anchor coverage was **perfect** — every anchor owned, none duplicated,
none lost, fidelity 1.000. The cause was that the area had *grown*: two concepts of genuinely new
truth were authored in it, neither of which owns (or could ever own) an anchor from the frozen
source. The denominator rose, the numerator physically could not, and the ratio fell out of band.

Any migrated area would have hit this the moment it gained new truth — which is precisely what a
living area is supposed to do. The metric was punishing the healthiest possible behavior, and would
have gone on doing it permanently.

### Root Cause

The denominator counted *files in a directory*; the numerator counted *anchors in a frozen
artifact*. Those are not two views of one population. They coincided at migration time — every
concept then owned anchors — and that coincidence was mistaken for an invariant, so the band was
calibrated on it and the divergence had no way to surface until an area finally grew.

### Recommendation

**When a ratio's numerator comes from a frozen artifact, its denominator must be drawn from the same
population — not from a superset that the live tree can extend.** State explicitly which population
each side counts, and ask: *can one side move while the other physically cannot?* If yes, the metric
will drift on healthy behavior, and calibrating a band around today's coincidence will hide that
until the first growth event.

## Learning 2: When a red can be cleared by widening the threshold or by fixing what is measured, those are opposite acts

**Category:** decision
**Severity:** critical
**Tags:** [gaming, gates, thresholds]
**Applicable-when:** any time a guard you own goes red and you have write access to the guard.

### What Happened

Four moves would each have cleared this red in one line: widen the band, lower the minimum-sample
count, exclude the offending area from the population, or edit the pin. All four are indistinguishable
from the correct fix in a commit summary — "telemetry fixed, chain green" — and all four would have
destroyed the signal while leaving the guard nominally in place.

The fix taken instead changed the *denominator*, leaving band, sample count, pins and population
untouched, with each of those four verified unmoved.

The evidence separating the two categories was produced deliberately, and it is the part worth
keeping: a **negative control** was built where an area is decomposed as badly as possible — every
anchor dumped into a single concept — and the metric must still fire. It does. And the same fixture
proved the *old* denominator had been blind: 24 anchors in one concept, sitting in a six-file
directory, scored comfortably in band because the empty siblings diluted it. So the correction did
not weaken the metric; it restored a detection the file-counting denominator had been silently
losing all along.

### Root Cause

A red gives two ways out that feel equally like "fixing the check", and the cheap one is often
one line. Nothing in the red itself distinguishes them — the distinction lives entirely in whether
the guard can still detect the thing it exists to detect afterwards.

### Recommendation

**Before changing any guard that has gone red, write down which of two things you are doing:
loosening what it takes to pass, or correcting what is being measured. Then prove it with a negative
control — construct the failure the guard exists to catch and show it still fires after your
change.** Without that control, "I corrected the measurement" is indistinguishable from "I widened
the threshold". A useful secondary signal: a corrected measurement usually makes the population
*tighter*, while a loosened threshold always makes it looser.

## Learning 3: A cell spec can assert something false about its own repo, and the worker must be free to say so

**Category:** pattern
**Severity:** standard
**Tags:** [delegation, must-haves, evidence]
**Applicable-when:** writing acceptance criteria for delegated work.

### What Happened

The cell's must-haves included: *"every OTHER pinned area's row is UNCHANGED"* — written on the
orchestrator's confident assumption that at migration time every concept owned anchors, so only the
one grown area could move. That assumption was false. Five other areas already carried an authored
overview concept owning no anchor, so six rows moved.

The worker measured this, reported it as a correction to the cell, and did **not** trim the fix to
satisfy the stated criterion. Had it done so, the "fix" would have had to special-case five areas —
producing exactly the kind of hidden complexity that later reads as inexplicable.

### Root Cause

An orchestrator writing must-haves is predicting the repo's state, and predictions written with
confidence read as requirements. A worker optimizing for green has every incentive to make a false
must-have true.

### Recommendation

**Write must-haves that state the property you want, not the observation you predict — and include
a standing instruction that a must-have contradicted by measurement is to be reported, not
satisfied.** "Every other row unchanged" was a prediction; "no area's row moves out of band, and no
threshold moves" was the property actually wanted, and it survived contact with the repo.
