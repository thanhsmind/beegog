---
type: bee.area
title: "Worktree Parallelism — returning: the staged merge and its verify gate"
description: "Why a feature worktree returns through a merge that is staged but never committed until the configured verify passes, how a textual conflict and a red verify both abort while proving main untouched, and when post-commit cleanup runs and when it refuses."
timestamp: 2026-07-22
bee:
  id: worktree-parallelism-returning-and-the-merge-gate
  lifecycle: active
  areas: [worktree-parallelism]
  required_context: [areas/worktree-parallelism/entering-creating-and-registering.md]
  decisions: [worktree-session-routing D8 (worktree merge --id <id> is the return path), D2-REVISED (the merge is a staged transaction — user review P1-2), D8a (dirty is git status --porcelain without --ignored), D8b/D8c (--cleanup is strictly post-commit)]
  sources: [docs/history/worktree-session-routing/, "docs/specs/worktree-parallelism.md#S-returning-worktree-merge-id-id-d8"]
  authoritative_for: "worktree-parallelism: the return path, the merge verify gate, and cleanup"
---

# Worktree Parallelism — Returning and the Merge Gate

The return path is where an isolated feature worktree becomes ordinary history on main.
Its whole design follows from one property: nothing is committed to main until the merged
tree has been proven green, so there is never a merge commit to roll back.

## Returning: `worktree merge --id <id>` (D8)

Run from the ordinary MAIN checkout (never from inside a worktree — that includes merging
"yourself"):

- Typed zero-mutation refusals first: unknown/ungranted id, dirty MAIN tree, dirty WORKTREE
  tree, detached HEAD or branch mismatch in the worktree. **Dirty** (D8a) =
  `git status --porcelain` without `--ignored`: the worktree's gitignored `.bee` store never
  counts as dirt.
- The merge itself is a **staged transaction** (D2-REVISED, user review P1-2): `git merge
  --no-ff --no-commit <branch>` stages the merge WITHOUT committing it. Already up to date
  (nothing staged) returns a typed no-op result and never touches `git commit`. A textual
  conflict runs `git merge --abort`, then PROVES main is untouched (HEAD unchanged, no
  `.git/MERGE_HEAD`, clean tracked status) before returning typed `MERGE_CONFLICT` — bee
  still does not auto-resolve a textual conflict, it just no longer leaves conflict state
  sitting on main. A clean stage runs the configured `commands.verify` (none recorded →
  `verify: skipped`) against the merged-but-**uncommitted** tree.
- **A red verify after a textually clean merge is the semantic-conflict alarm** the command
  exists to raise: `git merge --abort` runs, main-untouched is proven the same way, and the
  result is typed `MERGE_VERIFY_RED` with the output tail — fix-first before release. Because
  the merge was never committed until verify passed, **no merge commit ever existed to roll
  back**; this supersedes the old "merge commit is never rolled back" contract. Only once
  verify is green does bee run `git commit` (message names the id). A post-commit guard checks
  `git status --porcelain --untracked-files=no` is clean; if the verify command itself left
  tracked files modified, the result carries a typed `warning.code:
  'verify_mutated_tracked_files'` instead of silently treating the tree as equivalent to the
  commit. Recovery for a merge commit that only fails a LATER independent verify: `git revert
  -m 1 <merge-commit>` (documented, not automated).
- `--cleanup` (D8b/D8c): strictly post-commit — on green (or skipped) verify it runs
  unconditionally — worktree remove, then `git branch -d` (never `-D`), then grant removal, in
  that order. It refuses (typed; the merge result stays ok) when the worktree still holds
  tracked-modified or untracked files. Skipped-verify cleanup always carries a warning that
  nothing was checked. Cleanup never runs after `MERGE_CONFLICT`, `MERGE_VERIFY_RED`, or the
  already-up-to-date no-op.
