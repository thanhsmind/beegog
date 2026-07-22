---
type: bee.area
title: "Worktree Parallelism — returning: the staged merge and its verify gate"
description: "Why a feature worktree returns through a merge that is staged but never committed until the configured verify passes, how a textual conflict and a red verify both abort while proving main untouched, and when post-commit cleanup runs and when it refuses."
timestamp: 2026-07-23
bee:
  id: worktree-parallelism-returning-and-the-merge-gate
  lifecycle: active
  areas: [worktree-parallelism]
  required_context: [areas/worktree-parallelism/entering-creating-and-registering.md]
  decisions: [worktree-session-routing D8 (worktree merge --id <id> is the return path), D2-REVISED (the merge is a staged transaction — user review P1-2), D8a (dirty is git status --porcelain without --ignored), D8b/D8c (--cleanup is strictly post-commit), I47 (issues-46-53 — cleanup on ALREADY_UP_TO_DATE)]
  sources: [docs/history/worktree-session-routing/, "docs/specs/worktree-parallelism.md#S-returning-worktree-merge-id-id-d8", "issues-46-53 cell i-2 (GH #47 — the safety property is \"nothing would be lost\", not \"a commit happened\"; --cleanup runs on the no-op and still refuses on conflict and red verify; trace in `.bee/cells/`, 2026-07-23)"]
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
- `--cleanup` (D8b/D8c): on green (or skipped) verify it runs unconditionally — worktree remove,
  then `git branch -d` (never `-D`), then grant removal, in that order. It refuses (typed; the
  merge result stays ok) when the worktree still holds tracked-modified or untracked files.
  Skipped-verify cleanup always carries a warning that nothing was checked.
- **The safety property is "nothing would be lost", not "a commit happened."** Cleanup never runs
  after a textual conflict or a red verify: on those paths the branch's work is **not integrated**,
  so removing the worktree would destroy the only copy of it. It **does** run on the
  already-up-to-date no-op, where no commit is made either — because that outcome means the target
  already holds everything the branch has, and the dirty-tree refusal above has already proved the
  worktree carries nothing uncommitted. Reading the rule as "strictly post-commit" conflates the two
  and made the flag evaporate silently on the no-op: accepted, never acted on, exit zero, no
  message. A flag the caller passed is either honoured or explained; it is never dropped.
- The no-op path therefore reports what cleanup did, and a no-op **without** the flag removes
  nothing and only suggests the command — the flag, not the path, is what removes. The no-op
  carries no "cleaned up unchecked" warning: that warning means *no verify command is recorded*,
  which would be a lie where verify was skipped only because nothing was merged.
