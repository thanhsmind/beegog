---
date: 2026-07-19
feature: lane-ceremony-v3
categories: [process, doctrine, multi-session]
severity: medium
tags: [red-first, doctrine-assertions, manifest-same-cell, plan-freeze, work-packet, concurrent-sessions, verify-collision, diagnosis-discipline]
---

# lane-ceremony-v3 — learnings

## What Happened

A user-supplied external critique of the tiny/small lane ceremony was verified claim-by-claim against source (≈90% held), filed as six backlog rows, then shipped as a 10-decision doctrine rewrite (D1–D10) in five sequential cells: plan frozen at Gate 2, slice-in-cells, tiny = request + one cell, small = logged synthesis + cells, work-packet-first merged gate, product-file-only caps, test-anchored risk flags, intake-first planning. Every doctrine cell extended the permanent assertion suite RED-first (28+ new assertions, each recorded failing before its rewrite) and ran render + manifest regen in-cell. The close-out cell was blocked twice by two red write-guard hold tests that passed standalone for the orchestrator; the full chain then went green with zero source changes, and the feature closed the same hour.

## Root Cause (of the close-out blockage)

A concurrent session was building multi-session-hardening in a worktree branch, but its working files (untracked cells, modified runtime jsonl) leaked into the main checkout, and its `checkWrite` session-hold rewrite landed the same minute as the failing capture. The write-guard test is hermetic-by-copy — it copies the lib from the checkout at run time — so an uncommitted mid-edit lib produced deterministic, byte-identical failures during the collision window and clean passes outside it. The first diagnosis ("transient state interference") was wrong about mechanism; `git status --short` on the implicated paths would have falsified it in seconds, and the evidence report's recommendation ("wait for the other feature to merge") was also wrong — the fix was a clean write window, proven three minutes later.

## Recommendations

1. **When a blocking verify chain is about to run while another session is active in the same checkout, check `git status --short` outside the acting cell's own `files[]` first** — a dirty out-of-scope tree means abort/defer with a named conflict, not a 349-test run into a doomed red. (Mechanization filed as backlog P56.)
2. **When a red suite's failure text names concepts owned by a different, concurrently active feature, diff the implicated source paths before any "is it flaky" retest.** Deterministic, identical error text across runs is the signature of a real content collision, not flakiness.
3. **Never recommend blocking on another feature's merge to fix a red suite until a diff proves the failure comes from that feature's finished semantics** — re-run once the tree is clean before escalating to a merge dependency.
4. **When editing `skills/**` in a repo whose verify chain includes `release_manifest.mjs --check`, render + `--write` in the same cell as the edit** — the manifest hashes the canonical tree, so a deferred regen leaves the shared baseline red (validated repair of the recurring critical-patterns :514-530 case, this time caught at validation, zero red windows).
5. **Doctrine rewrites: extend the existing assertion suite RED-first instead of writing throwaway pressure tests or a new test file** — the assertions are permanent anchors (prose-only constraints get stripped; mechanized ones cannot recur), and the recorded RED tail is the one proof no verify command can produce after the fact. Cost to weigh: a shared test file serializes the slice.
6. **Approved artifacts are immutable except a stamp** (D1's generalization): if a workflow step mutates a human-approved document after approval, the drift machinery downstream is measuring self-inflicted churn — fix the mutation, not the drift threshold.

## Sources

- `docs/history/lane-ceremony-v3/` — CONTEXT (D1–D10), plan, validation-slice1.md (matrix finding #4 = the manifest repair), reports/lcv3-{1..4}-red.txt (recorded REDs), lcv3-5-evidence.txt + lcv3-5-verify-full.txt (the collision), lcv3-5-verify.txt (green close).
- Commits `c275652`, `a852f1a`, `f485603`, `bfec381`, `8065f4e`, `18ba701`; concurrent-session commits on `wt/multi-session-hardening` (msh-1..3, 18:43–19:25:43).
