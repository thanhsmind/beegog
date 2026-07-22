---
date: 2026-07-22
feature: okf-migration-f2
categories: [migration, verification, measurement, planning]
severity: high
tags: [okf, knowledge, coverage, fidelity, extraction, blindness]
---

# Learnings — okf-migration-f2

Ten areas migrated (476 anchors including the critical patterns), zero lost, zero duplicated,
every fidelity minimum at 1.000. The verify chain went 66 → 75 suites. And the plan was revoked
before a single cell ran.

## What Happened

**The measuring instrument was broken, and it defined what existed.** The plan's premise was that
the shipped anchor extractor could be reused. An advisor consult ran it against real blobs and
found it required *bare* anchor ids, so the `- **R1** — …` form was invisible: `onboarding`'s 28
rules inventoried as **R0**, `doctrine-layer`'s 17 as **R0**, and two areas returned **zero
anchors** and were filed "shapeless". Across nine areas, **86 anchors were invisible**. Because a
coverage gate compares what the extractor *sees* against what concepts *claim*, migrating on that
basis would have gone green while 86 rules — including `doctrine-layer` R6 ("blocked is not
approved") — sat outside the ground truth entirely.

**The plan's only oracle passed by construction.** The cell's acceptance was "reproduce 26 and 47"
— and `advisor-protocol` is the very file those regexes were written against. A test that can only
confirm what its subject already does is not a test.

**"Shapeless" was a verdict about the instrument, not the sources.** `decision-memory` was slated
for bespoke handling in a late slice. After widening, it inventoried 9 anchors with **zero**
unparsed and became the cleanest area of the eleven. Exactly one area was genuinely shapeless
(`worktree-parallelism`: ten narrative headings, no anchor-bearing sections), and it earned a
scheme where the headings themselves are the anchors — derived from the source, never invented.

**A worker refused a task and was right.** Cell f2-3 was dispatched with a false premise. It
stopped at STEP 0, wrote nothing, and returned `[BLOCKED]` with measurements and a sized fix. The
cell's own prohibition — *if the area is not genuinely conforming, return BLOCKED; do not force a
scheme* — was prose until something used it to say no.

**Counting proved ownership; only sampling proved fidelity.** Set-equality cannot see a rule that
was summarised away, nor the second member of a duplicate-id pair — three sources carried duplicate
ids, and for each the first member's text was silently overwritten in the extractor's map, making
it unmeasurable forever.

**The consumer built to stop context waste became its largest source.** On its first real use, the
manifest returned 45 entries: five genuinely relevant (~6k tokens) and **all 47 critical patterns**
(~13k tokens), most unrelated, with seven more truncated for lack of room. The rule "include every
critical pattern" was authored when three existed.

## Root Cause

**A derived ground truth is trusted more than the hand-maintained list it replaces.** Deriving is
the right fix, but it silently promotes the extractor into the definition of what exists. Anything
it cannot parse does not read as *missing* — it reads as *absent from the source*.

**Measurements taken with a broken instrument were then used to classify the subjects.** The
"shapeless" label, and the migration order built on it, were artifacts of the defect.

**Rules calibrated at small N invert at real N.** Include-every-critical and a single telemetry
median across incomparable shapes were both correct at three samples and wrong at forty-seven.

## Recommendation

1. **When a check derives its ground truth by parsing, make it report what it could not parse, and
   make that count a mandatory, asserted field.** An extractor that returns only what it understood
   cannot distinguish "nothing there" from "I cannot read this", and the difference is the entire
   value of the check.
2. **Never accept an oracle whose subject is the fixture it was written against.** Reproducing 26
   on the file the regex was tuned to proves nothing; test against a source with a different shape,
   or the test is a mirror.
3. **Do not classify sources with an instrument you have not validated.** Re-run the classification
   after every instrument fix — the labels, and any plan ordering derived from them, are outputs of
   the tool, not properties of the subjects.
4. **Counting is necessary and never sufficient.** Pair every set-equality gate with a per-item
   fidelity measure against the pinned original, and refuse to migrate while two items share an id
   — a duplicate makes one of them permanently unmeasurable.
5. **When you widen a parser, prove the strict no-op on every already-verified subject first.** If
   a widening moves a shipped count, it is too broad; narrow it until every prior result is
   byte-identical.
6. **Re-derive any threshold or inclusion rule when the population it was calibrated on grows by an
   order of magnitude** — and compare only within genuinely comparable shapes; pooling incomparable
   populations turns shipped work red on changes it never touched.
7. **Use the tool on the current job before believing it works.** The manifest defect was invisible
   to every fixture (fixtures carry one or two patterns) and surfaced on the first real run.
   Infrastructure that is only ever tested against fixtures is only ever proven against fixtures.
8. **Declare a gate's known limits inside the spec that documents it.** A gate believed inviolable
   is more dangerous than no gate, because people stop checking what it actually covers.
