# worktree-session-routing — plan (high-risk lane)

Fix GH #21 by building the never-built remainder of `worktree-feature-parallelism`:
the enter step, the return step, and the routing rule. Decisions: CONTEXT.md
D7-D10 (this feature) + parent D1-D6 (still binding).

## Mode gate

High-risk: touches the CLI dispatcher + command registry (public contract),
git-mutating machinery (worktree add/merge/remove — data-loss-adjacent), and
the multi-session coordination story. Advisor consult required before Gate 3
(AO3/AO13).

## Slice (3 cells, serialized wsr-1 → wsr-2 → wsr-3)

### wsr-1 — `bee worktree new --feature <slug>` (behavior_change)
- `createFeatureWorktree(mainRoot, {feature, baseRef})` in
  `skills/bee-hive/templates/lib/worktree-store.mjs`: validate slug; refuse
  from a non-ordinary checkout, on existing sibling path/branch/grant (typed,
  zero-mutation); `git worktree add ../<basename>--wt--<slug> -b wt/<slug>
  [baseRef]`; then reuse the existing grant + `bootstrapWorktreeStore` path
  exactly as `register` does; return `{id, worktreeRoot, branch}`.
- CLI verb `worktree.new` (D7): registry entry + handler + usage line in both
  dispatcher copies; prints the path + "open your next session there".
- Tests: extend `scripts/test_worktree_cli.mjs` e2e (create → list shows it →
  store bootstrapped idle → repeated call typed-refuses → bad slug refuses →
  from non-git/linked dir refuses) + registry example row in
  `templates/tests/test_bee_cli.mjs` (bijection).
- Verify: `node scripts/test_worktree_cli.mjs && node scripts/test_worktree_store.mjs && node skills/bee-hive/templates/tests/test_bee_cli.mjs && node scripts/test_lib_mirror.mjs`

### wsr-2 — `bee worktree merge --id <id>` (behavior_change)
- `mergeFeatureWorktree(mainRoot, {id, cleanup})` in the same lib: typed
  refusals for unknown/ungranted id, dirty MAIN tree, dirty WORKTREE tree,
  detached/wrong-branch worktree; `git merge --no-ff wt/<slug>` on main;
  on textual conflict → typed `MERGE_CONFLICT` (git state left for the human,
  jsonl logs already `merge=union`); on clean merge → run the configured
  `commands.verify` (from `.bee/config.json`; if none recorded, report
  `verify: skipped`), green → `{ok, merged, verify:'green'}` (+ optional
  `--cleanup`: `git worktree remove` + `removeGrant` + `git branch -d`),
  red → typed `MERGE_VERIFY_RED` with the tail of the output — the
  semantic-conflict alarm (D8). Merge commit is never rolled back by bee.
- CLI verb `worktree.merge`: registry + handlers, same 4-mirror discipline.
- Tests: e2e fixture pair in `test_worktree_cli.mjs` — green path (with
  fixture verify command), `MERGE_VERIFY_RED` path (textual-clean merge that
  flips a fixture test red), dirty-tree refusals, cleanup path; registry row.
- Verify: same command as wsr-1.

### wsr-3 — routing prose + render + spec hook (behavior_change)
- `skills/bee-hive/SKILL.md`: Session Scout gains the D9 routing note (new
  feature work in an occupied checkout → `bee worktree new`, open the session
  in the printed path; docs-lane/tiny/release stay in main).
- AGENTS.md template (the bee-managed block source in
  `skills/bee-hive/templates/`): rule 14 gains the same paved road + the
  merge-back sentence (merge from main, verify is the semantic gate).
- Re-render plugin trees (`scripts/render_plugin_skill_trees.mjs`) + refresh
  `.claude/.agents` copies + `release_manifest.mjs --write`.
- Verify: `node scripts/test_skill_render.mjs && node skills/bee-hive/scripts/test_plugin_distribution.mjs && node scripts/release_manifest.mjs --check && node skills/bee-hive/scripts/test_onboard_bee.mjs`

## Files (union)
`skills/bee-hive/templates/lib/worktree-store.mjs`,
`skills/bee-hive/templates/lib/command-registry.mjs`,
`skills/bee-hive/templates/bee.mjs`, `skills/bee-hive/templates/tests/test_bee_cli.mjs`,
`scripts/test_worktree_cli.mjs`, `skills/bee-hive/SKILL.md`,
AGENTS.md template + repo AGENTS.md, all byte mirrors
(`.bee/bin/*`, `.claude/`, `.agents/`, both plugin trees), release manifest.

## Close-out
Full configured verify green in this checkout; one commit per cell; spec sync
`docs/specs/worktree-parallelism.md` (scribing); comment + close GH #21.
Release NOT included — user triggers releases explicitly.

## Reality anchors (from the gather, checked against code)
- `bootstrapWorktreeStore` exists and is idempotent (`worktree-store.mjs:235-271`).
- `register` handler already resolves `{id, mainRoot, worktreeRoot}` from a
  linked worktree — `new` inverts it (starts in main, creates the linked tree).
- The 3 jsonl logs carry `merge=union` (`.gitattributes:6-8`).
- DA5 bijection test forces registry+example rows for every new verb.
- `replayLog()` stays unwired in this MVP (D8 uses git merge + union attrs;
  full replay stays with the parent feature's deferred tier split).
