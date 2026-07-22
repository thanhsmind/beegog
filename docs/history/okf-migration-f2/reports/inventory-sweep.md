# Inventory sweep — after the id-form widening (cell f2-4)

**Date:** 2026-07-22 · **Cell:** f2-4 (gate-definition, inserted ahead of f2-3) · **Lane:** high-risk

## Why this sweep exists

Cell f2-3 was asked to migrate `doctrine-layer` — the area F9 picked precisely *because* it was the
cleanest nine-section spec. It returned `[BLOCKED]` instead of forcing a scheme, with a measurement:
the shipped classifier derived **20 anchors and 21 UNPARSED blocks** from that file. More of the
source was invisible than visible.

The cause was not the file. The classifier shipped by okf-5 required a **bare** id at the head of a
block — `**B1 — …`, `- R1 — …` — and those two patterns were written against `advisor-protocol.md`,
the one file they were then tested on. Five of the nine remaining areas write the same anchors in a
different hand, and every one of them derived **R0**.

The consequence went further than counts. `decision-memory` was recorded by the F9 planning sweep as
*"shapeless, 0 anchors"* and slated for a bespoke per-area scheme in S5. It is not shapeless. Its nine
business rules were simply written `- **R1 — …**`. **The shapeless verdict was a property of the
reader, not of the file** — which is the same defect the derived coverage gate exists to prevent, one
level up: a hand-authored list proving consistency with itself, here a classifier proving structure
exists only where it already knew to look.

So this cell widened the classifier and re-inventoried all nine remaining areas. The migration order
is re-classified below on the evidence, not on the earlier verdict.

## The id forms, measured

Every form below was found in `docs/specs/`, with the line cited. The widening recognises **id forms
only** — it never invents an id.

| Form | Example | Where | Shipped classifier |
|------|---------|-------|--------------------|
| bare bold | `**B1 — …**` | advisor-protocol | read |
| bare bullet | `- R1 — …` | hook-runtime L450 | read |
| bold-wrapped id | `- **R1** — …` | doctrine-layer L213, onboarding L337 | **blind** |
| dash inside the bold | `- **R1 — …**` | decision-memory L16, performance-log L140 | **blind** |
| citation before the dash | `- **R1** (D1) — …` | feedback-digest L259 | **blind** |
| citation carrying its own em dash | `- **R7 (not yet implemented — P24)** — …` | onboarding L365 | **blind** |
| letter-suffixed | `B3a`, `R8a`, `R20b` | doctrine-layer L89, hook-runtime L412, onboarding L478 | **blind** |

Deliberately **still** unread, and reported as unparsed rather than invented:

- unnumbered bold-lead behaviour paragraphs — `**Detect (every run).**` (onboarding L96)
- unnumbered behaviour bullets — `- **Per-module suites, no monolith.**` (verify-pipeline L19)
- continuation bullets that belong to the block above them (hook-runtime L86-92)

Assigning these positional B-ids would fabricate structure the source never had (D10), and would
collide with the source's own B-ids in the areas that use both. They stay visible in the unparsed
report, which is exactly where a later decision can pick them up.

## The bound: a strict no-op on both shipped pins

The widening is only trustworthy because it changes nothing that was already trusted. Derived from
the **pinned blobs**, with `expected_counts` untouched:

```
PASS advisor-protocol: 26 anchors {"behaviors":4,"rules":9,"edges":6,"pointers":7,"total":26,"unparsed_blocks":0} from blob f3f123173726517c6a5068fd07d2b6c048a94043 via git (scheme ba-nine-section)
PASS critical-patterns: 47 anchors {"patterns":47,"total":47,"unparsed_blocks":0} from blob 2bf112090761cb8d1b2fbc63c897b525ac0f3b9f via git (scheme flat-pattern-list)
```

The F11 fidelity floor also holds on both shipped areas with **zero concept edits**:

```
fidelity margin (F11, floor 0.6): advisor-protocol n=26 min=0.977 median=1.000 max=1.000
                                  critical-patterns n=47 min=0.795 median=0.907 max=0.959
```

The rule this establishes for any future widening: **if a widening moves 26 or 47, the widening is
too broad and gets narrowed.** Never the pin relaxed, never the floor lowered.

## The sweep — nine areas, before and after

Counts are `{B, R, E, P}` from `docs/specs/<area>.md` in the working tree (these areas are not pinned
yet; each migration cell authors its own pin against a pre-migration blob).

| Area | Lines | Before {B,R,E,P} = total | Before unparsed blocks | After {B,R,E,P} = total | After unparsed blocks | Unparsed lines |
|------|------:|--------------------------|-----------------------:|-------------------------|----------------------:|---------------:|
| decision-memory | 40 | {0,0,0,0} = **0** | 9 | {0,9,0,0} = **9** | **0** | 0 |
| verify-pipeline | 133 | {0,5,4,5} = 14 | 7 | {0,5,4,5} = 14 | 7 | 73 |
| performance-log | 226 | {0,0,5,7} = 12 | 21 | {0,11,5,7} = **23** | 10 | 88 |
| worktree-parallelism | 226 | {0,0,0,0} = 0 | 0 | {0,0,0,0} = 0 | 0 | 0 |
| feedback-digest | 356 | {0,0,6,8} = 14 | 41 | {0,15,6,8} = **29** | 26 | 106 |
| doctrine-layer | 387 | {8,0,5,7} = 20 | **21** | {10,17,5,7} = **39** | **2** | 246 |
| onboarding | 690 | {0,0,15,15} = 30 | 48 | {0,28,15,15} = **58** | 20 | 479 |
| hook-runtime | 763 | {21,22,17,18} = 78 | 11 | {22,24,17,18} = **81** | 8 | 523 |
| workflow-state | 1465 | {36,58,25,20} = 139 | 8 | {37,58,25,20} = **140** | 7 | 1066 |
| **totals** | | **307** | **166** | **393** | **80** | |

**86 anchors that already existed in the sources were invisible to the gate**, and 86 of the 166
unparsed blocks were them. doctrine-layer moved from *more unparsed than parsed* (20/21) to 39/2.

## Verdicts — honest per area

An area is **GENUINELY SHAPELESS** only when it has no anchor-bearing sections at all. It is not
shapeless merely because the extractor cannot read its format — that confusion is the whole reason
this cell exists.

| Area | Verdict | Evidence |
|------|---------|----------|
| decision-memory | **CONFORMING** | Was filed "shapeless, 0 anchors". Derives 9 rules, `unparsed_blocks 0` — a perfectly clean parse. It has one anchor-bearing section (`## Business rules`) and no behaviours/edges/pointers sections; small and clean, not shapeless. **Re-classified: it needs no bespoke scheme.** |
| verify-pipeline | **CONFORMING** | Four anchor-bearing sections; 14 anchors. All 7 residual unparsed blocks are unnumbered behaviour bullets (`- **Per-module suites, no monolith.**`) — real behaviours the source never numbered. |
| performance-log | **CONFORMING** | 11 rules recovered (R1-R11, source-ordered R11 before R10). Residual 10 = 7 unnumbered bold-lead behaviour paragraphs + 3 continuation bullets under `**Measurement rules.**`. |
| worktree-parallelism | **GENUINELY SHAPELESS** | The only true case. Its ten `##` headings are all narrative (`The trust model`, `Entering: worktree new …`, `The three tiers`) — **no** Behaviors / Business Rules / Edge Cases / Pointers section exists. 0 anchors **and** 0 unparsed blocks: nothing is hidden, there is genuinely nothing of that shape to read. The advisor's guess was right about this one, and only this one. Needs an explicit per-area scheme (F9/S5). |
| feedback-digest | **CONFORMING** | 15 rules recovered (`- **R1** (D1) — …`). Residual 26 = 18 unnumbered bold-lead behaviour paragraphs (`**Triggers:**`, `**What is read:**` — a per-behaviour sub-field style) + 8 continuation bullets. Its behaviours are structured prose under a `###` behaviour heading rather than numbered blocks; the migration cell decides whether the `###` heading or the `**field:**` line is the behaviour unit. |
| doctrine-layer | **CONFORMING** | 39 anchors, 2 unparsed — the cleanest of the nine and the right area to prove the loop on, exactly as F9 said. The 2 residuals are one wrapped continuation line that happens to start bold (L176) and the unnumbered `- **The verify ladder …**` bullet (L305). **f2-3 can now re-open against ~39, not 20.** |
| onboarding | **CONFORMING** | 28 rules recovered including the letter-suffixed `R20b`. Residual 20 = 17 unnumbered bold-lead behaviour paragraphs + 3 continuation bullets. Largest unnumbered-behaviour population after feedback-digest. |
| hook-runtime | **CONFORMING** | 81 anchors. The widening recovered `B3a`, `R8a`, `R8b`. ⚠ **Duplicate rule id `R14`** (L450 and L477) — pre-existing in the source, present under the narrow classifier too, not introduced here. |
| workflow-state | **CONFORMING** | 140 anchors (`B9a` recovered). ⚠ **Duplicate rule ids `R19`, `R20`, `R21`** — two rule families numbered from R19 inside one `## Business Rules` section (L891-899 and L916-925), pre-existing. F10 already splits this area across cells; the duplicates must be disambiguated when its pin is authored, or set-equality will silently lose the second of each pair. |

No area classified an anchor **outside** an anchor-bearing section, in any of the nine — the widening
did not leak into `## Purpose` or `## Data Dictionary` prose.

## What this changes downstream

1. **`decision-memory` is no longer an S5 special case.** It is the smallest clean `ba-nine-section`
   area in the repo (9 anchors, 0 unparsed) and is the cheapest possible first migration.
2. **`worktree-parallelism` is the only genuine S5 case**, and its `PIN_REGISTRY` refusal reason now
   says so on the evidence rather than by assumption.
3. **`doctrine-layer` re-opens for f2-3 at ~39 anchors**, not 20 — a pin at 20 would have shipped a
   green gate over 17 lost business rules.
4. **Two areas carry duplicate rule ids** (hook-runtime, workflow-state). Their migration cells must
   disambiguate before pinning; a set-equality gate cannot see the second member of a duplicate pair.
5. **Unnumbered behaviours are the remaining known gap** (80 blocks, concentrated in feedback-digest
   26, onboarding 20, performance-log 10, hook-runtime 8). They are *reported*, not lost. Whether they
   become numbered anchors is an authoring decision per area — not something a regex should decide.

## How to reproduce

```
node scripts/okf_migrate.mjs --verify-pins                 # the strict no-op: 26 and 47
node scripts/okf_migrate.mjs --inventory docs/specs/<area>.md
node scripts/test_okf_pins.mjs                             # sections 24-26 guard the widening
```

`scripts/test_okf_pins.mjs` §24 pins every id form in the table above as a fixture, §25 asserts the
strict no-op on both shipped pins with unchanged `expected_counts`, and §26 asserts the widening
still refuses unnumbered, ASCII-hyphenated, and word-shaped bullets — so a future narrowing of the
classifier fails loudly instead of quietly making areas look shapeless again.
