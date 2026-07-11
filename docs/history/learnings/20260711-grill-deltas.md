---
date: 2026-07-11
feature: grill-deltas
categories: [failure, pattern, decision]
severity: critical
tags: [skill-prose, review, temporal-consistency, external-adoption, prose-verification]
---

# Learning: Prose skill edits — temporal consistency, class-sweeps, and the prose proof surface

**Category:** failure + pattern + decision
**Severity:** critical (one promotion)
**Tags:** [skill-prose, review, temporal-consistency, external-adoption]
**Applicable-when:** editing any `skills/*/SKILL.md` step prose; fixing any reviewer finding; evaluating an external skill/library for adoption.

## What Happened

Two prose deltas from the `grill-for-unknowns` research brief (P20 materiality test, P21 Terms glossary) were folded into bee-exploring/context-template/bee-scribing, small lane, solo execution. The external codex reviewer (review slot, gpt-5.6-sol) failed the diff **twice for the same defect class**: step-4 bullets instructing writes into `CONTEXT.md`, a file that step 5 creates. Round 1 caught the P21 bullet; the fix corrected only the cited line; round 2 caught the identical defect four lines up in the P20 bullet, which had been sitting in the round-1 diff all along. Round 3: NO FINDINGS / PASS. Suites stayed green throughout (the defect class is invisible to them).

## Root Cause

1. **Drafting:** new step-4 prose referenced a downstream artifact as if it already existed, instead of using the file's own settled idiom for step-4-settled / step-5-written content (the D-ID pattern: confirm and pin during locking, Context Assembly writes the file).
2. **Fix pass:** after round 1 named the defect *class*, the fix cell repaired only the reviewer's cited line — no diff-wide sweep for sibling instances — forcing a second external review round for a bug already understood.
3. **Structural:** the prose proof surface (marker-greps, repo↔installed diff, suite) proves *presence and non-regression*, never *logical/temporal correctness* of prose — the only defense for that class is the reviewer, so reviewer round-trips are the expensive path to protect.

## Recommendation

- **When a reviewer names a defect class, sweep the entire diff for that class before re-submitting** — grep for the defect signature (here: `CONTEXT.md` mentions inside step-4 bullets), fix every instance, then re-review. One cited line is a sample, not the population. (Promoted to critical-patterns.)
- **When adding step-N prose that references an artifact created at step M>N, use the pin-now/write-later idiom** already established by D-IDs in the same file: settled/pinned during the early step, written by the artifact-creating step. Never instruct a write into a file that does not exist yet.
- **For prose-only skill edits, reuse the proof-surface template**: RED marker-grep (exit 1 pre-edit) → GREEN (hits post-edit) + `diff -q` repo vs installed copy + suite still green — while remembering what it cannot prove (see root cause 3).
- **External skill adoption follows reuse-over-install**: map the upstream against local equivalents first (here ~90% was already decision 0020); fold only the genuine deltas into existing skills; never install a parallel, gate-less pipeline competitor. Anchor: `docs/history/research/grill-for-unknowns.md`.

## Dormant thread (not a recommendation)

Reviewer round 1 proposed restructuring bee-exploring to create a working CONTEXT.md *before* Socratic locking (declined as out of cell scope, not on merits). If a future feature touches exploring's step order, weigh this alternative explicitly rather than rediscovering it.
