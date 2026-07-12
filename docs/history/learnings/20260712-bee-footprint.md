---
date: 2026-07-12
feature: bee-footprint
categories: [process, onboarding, guards, git]
severity: medium
tags: [gitignore, marker-splice, worker-isolation, write-guard, verify-authoring, spikes]
---

# Learnings — bee-footprint

## What Happened

Host-user feedback ("bee's json churn breaks my focus; bee should stay in its own box") became three shipped changes: an onboard-managed `.gitignore` block for machine-local runtime files, spikes relocated to `.bee/spikes/` with the root `.spikes/` allowlist entry removed, and the bee repo's own migration (corrupt `.gitignore` fixed, 201 tracked files un-indexed with the working tree intact). Review (4 opus specialists) found 0 P1 but 2 real P2s, both fixed in-feature: the original plan missed that `.gitignore` is inert for already-tracked files — the actual root cause of the complaint — and the first-pass splice substring-matched markers and stripped user trailing whitespace.

## Root Cause

- The plan treated "write ignore rules" as the fix while the complaining host's files were already tracked; only an independent reviewer connected the two.
- The migration cell enumerated two spike dirs by name; validation's own probe created a third tree in the same namespace, making the cell's `test ! -e .spikes` deterministically unsatisfiable until the cell reviewer caught it.
- footprint-2's `! grep '\.spikes'` verify was authored before the RED-first test existed; the test fixture necessarily contains the banned string, so the stored predicate degrades on re-run.
- The write-guard's bash parser matches command text, not effective semantics: it blocked three legitimate spike probes (`$VAR`, post-`cd` redirect, `git -C add`) and a sanctioned `git rm --cached`, teaching the worker to reach for the unmodeled `git update-index --force-remove`.
- Two parallel workers share one git index; a pathspec-less `git commit` swept the other worker's staged files (content intact, attribution crossed).

## Recommendation

1. When a feature's goal is "make X invisible/ignored", check whether X is already tracked/registered — the ignore mechanism is inert for existing state; ship the untrack/cleanup advisory with it. (Mechanized: onboard tracked-paths advisory + tests.)
2. Exhaustive or destructive operations over a mutable directory glob its children; never enumerate a fixed list — your own validation artifacts may be living there by execution time. (Promoted to critical-patterns.)
3. Before locking a negative-match (`! grep`) verify predicate, run it against the fixtures and tests the work itself will add. (Promoted to critical-patterns.)
4. Marker-splice bar (precedent for any managed block): whole-line-anchored markers, exact byte preservation outside the block, CRLF-insensitive compare, tamper + lookalike + no-trailing-newline + idempotency tests. (Mechanized: test sections 9d/9f.)
5. Worker commits must be pathspec-scoped to owned files, or the orchestrator owns all commits — shared-index sweeps are silent. (Filed as P3 friction with both options; swarming template change pending.)
6. Guard parser gaps (`update-index`, `--cached` semantics, `$VAR`/`-C` resolution) are filed as friction; the durable fix is semantic modeling + parity tests, not more prose. (P3 ×2 on backlog.)

Evidence: docs/history/bee-footprint/{walkthrough.md, reports/validation-1.md, reports/review-1.md}, cell traces footprint-1..4.
