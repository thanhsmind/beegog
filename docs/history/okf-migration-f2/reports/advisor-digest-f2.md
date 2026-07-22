# Advisor consult digest — okf-migration-f2 (pre-Gate-3, AO2b)

Advisor: fable (models.claude.advisor). Read-only. Advice, never approval.
The advisor ran the real extractor against real blobs; every number below is measured, not predicted.

## Findings

1. **The extractor is format-blind, so "lost" anchors never existed.** Measured:
   `docs/specs/onboarding.md:335` has 22 rules written `- **R1** — …` but `inventorySpec`
   (`scripts/okf_migrate.mjs:227`) reports **R0**; its behaviors (`onboarding.md:96`) are unnumbered
   (`**Detect (every run).**`) → **B0**. Derived total 30 vs ~65 real anchors. F1's only fidelity
   oracle was "reproduce 26 and 47" — and advisor-protocol is the very file the regexes were written
   against, so those tests pass **by construction**.
2. **Two remaining areas yield ZERO anchors.** `decision-memory` (39) and `worktree-parallelism`
   (225) are free-form prose; the latter has no `## Business Rules` / `## Edge Cases` sections at all.
   `verify-pipeline`, `performance-log`, `feedback-digest` all report B0 or B0/R0.
3. **Ascending-by-size inverts its own benefit.** It puts the two unparseable areas first, so the
   first migration cell hits a hard stop instead of cheaply exercising the loop.
4. **`workflow-state` has 139 anchors** (B36/R58/E25/P20) against precedents of 26 and 47 — the
   largest, most cross-cutting re-authoring arriving in one commit at peak drift.
5. **A pin of `{commit, path}` alone is insufficient.** `git show <sha>:<path>` fails outright in a
   `--depth 1` clone (this repo is full, CI may not be). Pin
   `{commit, path, blob_sha, expected_counts}` and assert all of them; commit the pre-migration
   source verbatim and verify with `git hash-object`. A hash carried *in the stub* is weaker — the
   stub is the artifact under test and the same editor edits both.
6. **Serial-run degradation: "anchor-shaped compliance."** A later cell can hit the count by
   *summarizing* an anchor rather than preserving it; set-equality stays green. Cheap fix: a
   per-anchor normalized token-overlap floor against the pinned blob, plus per-area
   anchors-per-concept / concepts-per-100-lines telemetry failing on an outlier vs the running median.
7. **Most likely regretted:** F1's phrase "using the SAME extraction the existing `--inventory` mode
   uses" — measurably false for 6 of 9 remaining areas, zero for 2. Once shipped, the derived set
   would be trusted *more* than the hand list it replaced: exactly the failure the promoted pattern
   warns about ("a gate believed to be inviolable is more dangerous than no gate").

ADVISOR DIGEST: The derived gate is right in principle but its extractor is format-blind — proven:
onboarding's 22 rules and all its behaviors inventory as 0, and 2 of 9 remaining areas yield an
empty anchor set entirely. Pin `{commit, path, blob_sha, expected_counts}` plus a committed verbatim
source copy (shallow clones break `git show`), and make a count *mismatch* — not just an empty set —
a loud failure. Reorder by spec shape rather than line count, add a per-anchor text-fidelity floor,
and split the 139-anchor `workflow-state` cell.

## Orchestrator disposition

**All seven accepted. The plan's premise was falsified, so the shape gate was revoked and the plan
rewritten** (hive law 5: a failed reality gate returns to planning). Recorded as F8–F12 superseding
F1/F2/F3. No locked decision was reinterpreted — each is superseded with a new ID and a reason.
