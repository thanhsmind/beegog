---
artifact_contract: bee-plan/v1
mode: high-risk
feature: okf-switchover-f3
updated: 2026-07-22
approved_gate2: 2026-07-22 (auto-approved, gate_bypass=total)
sources: [docs/history/okf-switchover-f3/CONTEXT.md (G1-G7); docs/history/learnings/20260722-okf-migration-f2.md; docs/specs/okf-profile.md B1-B12]
decisions: [G1, G2, G3, G4, G5, G6, G7; inherited D17-D38, F8-F14]
---

# okf-switchover-f3 — Plan

## Mode gate (mechanical record)

Flags: **public contracts** (skill behaviour changes for every host repo on the next release) ·
**multi-domain** (skills prose, lib, chain, docs) · **changes behaviour an existing suite asserts**
(the conformance and skill-render suites cover the prose being rewritten) · **data model** (where
new knowledge lands) = **4 → high-risk**. Smaller lanes insufficient: G1 alone must be proven in
two repo shapes.

## Discovery

**L1.** Everything needed is measured and in the repo: the manifest defect (45 entries, 13k of
19,726 tokens spent on irrelevant critical patterns), the scribing drift (8 `docs/specs/`
references vs 0 `docs/knowledge/`), the eleven pins and the migration loop, and the round-trip
guard that catches hand-written frontmatter. No unfamiliar territory.

## Approach

**Chosen:** fix the read half first, then flip the write half, then fence the old tree, then move
the profile spec. Each slice is independently green and independently revertible.

Read-before-write ordering is deliberate: if scribing starts writing concepts while `context`
still spends two thirds of its budget on noise, the loop closes on a consumer that cannot be
trusted, and every later judgement about "is the bundle helping?" is contaminated.

**Rejected:**
- *Flip scribing first* — see above; also the P1 is cheap and its absence poisons measurement.
- *Delete stubs in this feature* — seven live citations resolve through them (G7).
- *Drop the fallback and require a bundle* — breaks every host repo (G1); the owner's explicit
  compatibility requirement.
- *Enforce read-only with prose* — already tried implicitly and already failed: 8 references vs 0.

**Risk map:**

| Component | Risk | Proof |
|---|---|---|
| G5 relevance ranking | MED | The 5 relevant / 40 irrelevant split from the live manifest is the fixture: after ranking, those 5 must survive at a small budget and the irrelevant ones must fall. A ranking that cannot reproduce that separation is not shipping. |
| G3 scribing authors concepts | HIGH | Three paths (update owning concept / new concept in existing area / new area) each need a worked run. Frontmatter through the emitter only. |
| G1 fallback | HIGH | Must be proven in a fixture repo that has **no** `docs/knowledge/` — behaviour byte-identical to today, no nag. This is the compatibility guarantee and it needs its own test, not an assertion. |
| G2 read-only guard | MED | Must be inert where no bundle exists, and must not fire on the 10 existing stubs, `reading-map.md`, or `okf-profile.md`. |
| G4 reading order | LOW | Prose edits in two skills + the AGENTS budget check. |
| G6 profile migration | LOW | The loop is proven eleven times; this is the twelfth. |

## Slices

| # | Slice | Cells | Exit state |
|---|---|---|---|
| S1 | Fix the read half | f3-1 | `context` ranks critical patterns by relevance with a guaranteed floor; the live okf-migration-f2 manifest keeps its 5 relevant entries at a budget that previously drowned them; chain green |
| S2 | Flip the write half | f3-2 | `bee-scribing` authors concepts (3 paths), bundle-first with the G1 fallback proven in a bundle-less fixture; chain green |
| S3 | Fence the old tree | f3-3 | Read-only guard in the chain, inert without a bundle, silent on stubs/reading-map/okf-profile; reading order flipped in bee-hive + bee-planning + AGENTS block under budget |
| S4 | Move the profile | f3-4 | `okf-profile.md` migrated via the standard loop, stub left, gate green |

Current slice: **S1 only.**

## Test matrix sketch

Relevance: the 5-vs-40 live split reproduced; a universal pattern survives a tiny budget via the
floor; ties broken deterministically · Fallback: a fixture repo with no `docs/knowledge/` behaves
byte-identically to today and emits no nag · Guard: inert without a bundle; silent on 10 stubs +
reading-map + okf-profile; fires on a new prose file under `docs/specs/` · Scribing: each of the
three authoring paths produces canonical frontmatter (zero `not_canonical`) and a regenerated
index · Budget: AGENTS.md and its template block stay under 20480 bytes · Cross-platform: CI both.

## Open questions for validating

1. Which signal actually separates the 5 relevant patterns from the 40 — tags, areas, or both.
   Measure against the live manifest before choosing; do not guess.
2. Prove the G1 fallback in a genuinely bundle-less fixture, not by reading the branch.
3. Confirm the read-only guard is silent on all 12 current `docs/specs/` entries before wiring it.
