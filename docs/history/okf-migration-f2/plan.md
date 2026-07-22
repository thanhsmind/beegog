---
artifact_contract: bee-plan/v1
mode: high-risk
feature: okf-migration-f2
updated: 2026-07-22
revision: 2 (rev 1 revoked pre-execution — its premise was falsified by the advisor consult)
sources: [docs/history/okf-migration-f2/CONTEXT.md (F4-F12; F1/F2/F3 superseded); docs/history/okf-migration-f2/reports/advisor-digest-f2.md; okf-foundation D17-D38; docs/history/learnings/20260722-okf-foundation.md]
decisions: [F4, F5, F6, F7, F8, F9, F10, F11, F12; inherited D17-D38]
---

# okf-migration-f2 — Plan (revision 2)

## Why revision 2

Revision 1 was revoked before a single cell ran. The advisor consult executed the real extractor
against real blobs and falsified its premise: the extractor is **format-blind** (`onboarding.md`'s
22 `- **R1** —` rules inventory as **R0**; `decision-memory` and `worktree-parallelism` yield **0
anchors**), and rev 1's only oracle — "reproduce 26 and 47" — passed *by construction*, because
`advisor-protocol` is the file those regexes were written against. Ordering by size would have put
the two unparseable areas first. Full findings: `reports/advisor-digest-f2.md`.

## Mode gate (mechanical record)

Flags: **data model** · **public contracts** · **multi-domain** · **changes behavior an existing
suite asserts** = **4 → high-risk**. Unchanged from rev 1.

## Discovery

**L1 — measured, not assumed.** The advisor's inventory run over all 10 remaining specs is the
discovery result and is treated as evidence: 2 areas yield 0 anchors; 5 more report B0 or B0/R0;
`doctrine-layer` is the cleanest conforming area (B8/E5/P7 = 20); `workflow-state` carries 139
(B36/R58/E25/P20).

## Approach

**Chosen:** make the gate honest *and self-aware* first (F8) — content-addressed pins, asserted
expected counts, unparsed-line reporting, a committed verbatim source copy — then migrate ordered by
**shape** (F9), proving the loop on `doctrine-layer`; decide an explicit anchor scheme for shapeless
areas rather than forcing them into `B*/R*`; add a per-anchor fidelity floor (F11) and drift
telemetry (F12) so the long serial run cannot rot quietly; split `workflow-state` (F10).

**Rejected:** rev 1's ordering and its reuse-the-same-extractor premise (both superseded, above);
forcing shapeless prose areas into the `B*/R*` scheme (invents structure the source never had —
D10); one cell for `workflow-state` (F10).

**Risk map:**

| Component | Risk | Proof |
|---|---|---|
| F8 shape-aware extractor + pins | HIGH | Must reproduce 26/47 **and** report a non-trivial unparsed-line count for `onboarding` — a clean parse there would prove the extractor is still blind. Bad-sha and count-mismatch runs must both exit 1. |
| Shapeless-area schemes (F9) | MED | Scheme declared per area in the pin; the gate must refuse an area with no declared scheme rather than pass it 0/0. |
| Fidelity floor (F11) | MED | Threshold tuned against the two already-migrated areas: they must pass at ≥60% without edits. If they do not, the floor or the normalization is wrong, not the concepts. |
| Long-run drift (F12) | MED | Telemetry vs running median, evaluated every cell. |
| `workflow-state` (F10) | HIGH | Split by D30 clusters; own validating pass when its slice becomes current. |

## Slices

| # | Slice | Cells | Exit state |
|---|---|---|---|
| S1 | Honest gate | f2-1b | Content-addressed pins; expected counts asserted; unparsed lines reported; committed source copies; bad-sha/mismatch/empty all exit 1; both shipped areas still 26/47 from the derived path; chain green |
| S2 | Fidelity + telemetry | f2-2 | F11 floor and F12 telemetry live in the gate; both shipped areas pass unedited; chain green |
| S3 | Prove the loop on shape | f2-3 `doctrine-layer` | One conforming nine-section area migrated end-to-end under the honest gate |
| S4 | Conforming areas | f2-4 `verify-pipeline`, f2-5 `performance-log`, f2-6 `feedback-digest`, f2-7 `onboarding`, f2-8 `hook-runtime` | 5 areas migrated, each with its gate in the chain |
| S5 | Shapeless areas | f2-9 `decision-memory`, f2-10 `worktree-parallelism` | Explicit per-area schemes declared and migrated |
| S6 | `workflow-state` | f2-11..f2-1n, split by D30 clusters | All areas migrated; `docs/specs/` holds only stubs + `reading-map.md` + `okf-profile.md` |

Current slice: **S1 only.** Later slices are cut when they become current.

## Test matrix sketch

Extraction honesty: `onboarding` reports a large unparsed-line count (a clean parse = the bug) ·
Pin integrity: wrong sha → exit 1; right sha, wrong expected_counts → exit 1; empty extraction →
exit 1, never 0/0 green · Shallow clone: `git show` unavailable → falls back to the committed source
copy verified by `git hash-object`, never silently skips · Fidelity: a concept that summarizes an
anchor below threshold → gate red naming the anchor · Determinism, canonicality, index freshness,
authority uniqueness: whole-bundle, every cell (F12) · Cross-platform: CI runs both.

## Open questions for validating

1. Prove the F8 extractor reports unparsed lines for `onboarding` — a clean parse means it is still
   blind and the cell has not done its job.
2. Confirm the fallback actually engages when `git show` fails (simulate by pinning an unreachable
   sha with the committed copy present).
3. Tune F11's overlap threshold against `advisor-protocol` and the 47 patterns: they must pass
   unedited, or the normalization is wrong.
