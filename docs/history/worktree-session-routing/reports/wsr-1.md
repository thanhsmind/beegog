# wsr-1 — done report (bee worktree new)

Worker: wsr1-worker (sonnet, isolated harness worktree). Worker commit `d2ef77a`,
merged into integration branch `wt/worktree-session-routing` as `3c56b7a`
(registered worktree `beegog--wt--worktree-session-routing`). 2026-07-18.

## What shipped
- `createFeatureWorktree(mainRoot, {feature, baseRef})` in
  `skills/bee-hive/templates/lib/worktree-store.mjs`: spawnSync argv arrays with
  `--` before user-derived values; typed zero-mutation refusals
  (`WORKTREE_INVALID_SLUG`, `WORKTREE_INVALID_BASE_REF`,
  `WORKTREE_CALLER_NOT_ORDINARY`, `WORKTREE_TARGET_EXISTS`,
  `WORKTREE_BRANCH_EXISTS`, `WORKTREE_GRANT_EXISTS`); runtime add failure typed
  `WORKTREE_ADD_FAILED`; post-add failure rolls back (worktree+branch+grant) as
  `WORKTREE_POST_ADD_FAILED`, rollback failure `WORKTREE_POST_ADD_ROLLBACK_FAILED`
  naming `worktree register` as the adoption path; grant id read back from the
  new worktree's `.git` gitdir pointer (advisor R2/R3/R5 honored).
- CLI verb `worktree new`: handler (requires resolveRoots 'ordinary'), handler
  map entry, registry entry with example, `worktreeUsageFallback` = "Use:
  register, list, unregister, new." (bijection coupling honored).
- 4-way byte mirrors synced (.bee/bin, .claude, .agents).

## Verification (fresh command output)
Independent orchestrator re-run in the integration worktree after merge 3c56b7a:

```
node scripts/test_worktree_cli.mjs && node scripts/test_worktree_store.mjs \
&& node skills/bee-hive/templates/tests/test_bee_cli.mjs && node scripts/test_lib_mirror.mjs
...
169 passed, 0 failed
PASS test_lib_mirror: internal self-test — checker correctly flags injected byte-diff, missing file, and extra file
PASS test_lib_mirror: runtime hook inventory derives launchers/imports and catches missing, extra, and byte drift
PASS test_lib_mirror: templates/lib and .bee/bin/lib are byte-identical (19 files)
PASS test_lib_mirror: runtime-derived hook inventory is byte-identical (10 files)
```

Worker-side full run (its own worktree, pre-merge): test_worktree_cli 49/49,
test_worktree_store 22/22, test_bee_cli 169/0, test_lib_mirror all PASS.

## Diff (merge 3c56b7a)
16 files changed, 1420 insertions(+), 8 deletions(-) — worktree-store.mjs +219,
test_bee_cli.mjs +50, plus CLI/registry edits and their three mirror trees.

## Deviations (accepted)
- Rollback also deletes the just-created branch (`-D`, only after confirmed
  worktree removal) — required for the zero-mutation guarantee on injected
  post-add failure.
- Extra `worktree.new` example-execution test in test_bee_cli.mjs — forced by
  the existing "every registry example is executed" guard.
- Worker briefly created a stray probe worktree in shared repo metadata during
  exploration; removed immediately, `git worktree list` confirmed clean.
