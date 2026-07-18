# pre-162-fixes — plan (high-risk lane)

Decisions D1-D4 in CONTEXT.md (source: user's 1.6.1 review). Three cells;
p162-1 ∥ p162-2 (disjoint files), p162-3 after p162-2 (same lib file).

## Mode gate
High-risk: merge-transaction rework is git-mutating machinery on main
(data-loss-adjacent), doctor fix touches the shipped diagnostic contract,
existing covered behavior (worktree e2e, conformance fixtures). Advisor
consult before Gate 3.

### p162-1 — doctor host-topology hook resolution (behavior_change)
- `templates/bee.mjs` doctor section: `doctorHookHandlersResolvable` stops
  taking a hard-coded "hooks" dir; parse actual handler paths from
  `.codex/hooks.json` commands, canonicalize, require containment in repo,
  check existence; fallback `repoOwnsHookCatalog(root) ? "hooks" :
  ".bee/bin/hooks"` when no parseable entries.
- Conformance/doctor fixtures gain a NORMAL host topology case (hooks under
  `.bee/bin/hooks/`, root `hooks/` absent → ok) + missing-handler negative;
  bee-repo topology case stays green.
- Verify: `node scripts/test_conformance.mjs && node skills/bee-hive/templates/tests/test_bee_cli.mjs && node scripts/test_lib_mirror.mjs`
  (plus whichever doctor test file exists — worker locates it).

### p162-2 — worktree merge transaction (behavior_change)
- `templates/lib/worktree-store.mjs` `mergeFeatureWorktree`: D2's staged
  transaction (--no-commit; abort on conflict; verify uncommitted tree; abort
  on red with HEAD-unchanged proof; commit on green; cleanup only
  post-commit; document the pre/post-commit verify equivalence + revert -m 1
  recovery note).
- CLI text updates (MERGE_VERIFY_RED message now says main was left
  untouched; suggestion text adjusted).
- e2e updates in `scripts/test_worktree_cli.mjs`: conflict → abort + HEAD
  byte-unchanged + no .git/MERGE_MSG; red verify → abort + HEAD unchanged;
  green → exactly one merge commit; cleanup gating; update the old
  "merge commit intact after red" assertion to the new abort contract.
- Verify: `node scripts/test_worktree_cli.mjs && node scripts/test_worktree_store.mjs && node skills/bee-hive/templates/tests/test_bee_cli.mjs && node scripts/test_lib_mirror.mjs`

### p162-3 — base-ref rev-parse validation (behavior_change, after p162-2)
- `createFeatureWorktree`: replace check-ref-format with
  `git rev-parse --verify --end-of-options "<ref>^{commit}"`; typed
  `WORKTREE_BASE_NOT_FOUND` on failure, zero mutation.
- Tests: HEAD, HEAD~1, short sha, tag^{commit} accepted; garbage/nonexistent
  → typed refusal; injection strings still refused.
- Verify: same command as p162-2.

## Close-out
Full configured verify green; scribing sync (worktree-parallelism.md D8
supersede + doctor row prose in onboarding/hook-runtime spec as applicable);
release 1.6.2 only on the user's explicit call.
