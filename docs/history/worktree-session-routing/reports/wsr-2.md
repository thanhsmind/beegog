# wsr-2 — done report (bee worktree merge)

Worker: wsr2-worker (sonnet, isolated harness worktree, base 3c56b7a). Worker
commit `d8957fd`, merged into integration branch `wt/worktree-session-routing`
as `e0759a6`. 2026-07-18.

## What shipped
- `mergeFeatureWorktree(mainRoot, {id, cleanup, verifyCommand})` in
  `skills/bee-hive/templates/lib/worktree-store.mjs`: typed zero-mutation
  refusals (`WorktreeMergeError`): `WORKTREE_MERGE_INVALID_ID`,
  `WORKTREE_MERGE_CALLER_NOT_ORDINARY` (covers own-worktree self-merge, advisor
  R5), `WORKTREE_MERGE_UNKNOWN_ID`, `WORKTREE_MERGE_MAIN_DIRTY`,
  `WORKTREE_MERGE_WORKTREE_DIRTY` (D8a: porcelain without --ignored — a
  bootstrapped gitignored .bee store is never dirty, proven by test),
  `WORKTREE_MERGE_DETACHED_HEAD`, `WORKTREE_MERGE_BRANCH_MISMATCH`.
- `git merge --no-ff` in MAIN; textual conflict → `MERGE_CONFLICT` (git state
  left, no rollback); clean merge → caller-passed verifyCommand (CLI resolves
  `readConfig(mainRoot).commands.verify`; lib stays dependency-free, matching
  wsr-1's structure) → red = `MERGE_VERIFY_RED` with output tail named as the
  semantic-conflict alarm, merge commit never rolled back.
- `--cleanup` (D8b/D8c): unconditional on green/skipped verify; order worktree
  remove → branch -d (never -D) → removeGrant; typed cleanup refusal when
  tracked-modified/untracked files remain (merge stays ok); never after
  conflict/red; skipped-verify cleanup carries the D8c warning (decision
  d5a00839).
- CLI verb `worktree merge` + registry entry + usage fallback "Use: register,
  list, unregister, new, merge." (bijection coupling); `cleanup` in
  FLAG_ALONE_BOOLEANS; 4-way byte mirrors synced (md5-verified by worker,
  test-verified below).

## Verification (fresh command output)
Independent orchestrator re-run on the integration branch after merge e0759a6:

```
node scripts/test_worktree_cli.mjs   -> SUMMARY: 90/90 passed
node scripts/test_worktree_store.mjs -> SUMMARY: 22/22 passed
node skills/bee-hive/templates/tests/test_bee_cli.mjs -> 170 passed, 0 failed
node scripts/test_lib_mirror.mjs     ->
PASS test_lib_mirror: templates/lib and .bee/bin/lib are byte-identical (19 files)
PASS test_lib_mirror: runtime-derived hook inventory is byte-identical (10 files)
```

## Diff (merge e0759a6)
16 files changed, 2248 insertions(+), 13 deletions(-).

## Deviations (accepted)
- Own-worktree self-merge collapses into `WORKTREE_MERGE_CALLER_NOT_ORDINARY`
  (no separate code) — advisor-confirmed single-code interpretation.
- Cleanup-on-skipped-verify resolved as D8c with mandatory warning (decision
  d5a00839) — advisor-confirmed gap resolution, not literal D8 text.
- Known cosmetic: one unused variable (`grantsFileA`, test_worktree_cli.mjs
  ~line 476) flagged by the linter — queued for wsr-3 to drop.
