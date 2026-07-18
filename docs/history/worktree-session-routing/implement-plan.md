# worktree-session-routing — implement plan (brief)

Fixes GH #21 ("2 sessions, one had to wait"). Builds the never-built remainder
of `worktree-feature-parallelism`: the enter step, the return step, and the
routing rule. Decisions: D7-D10 (CONTEXT.md here) + parent D1-D6.

**Workspace note (dogfood):** at lane start a sibling session was live on
cnr2-13 in the main checkout — exactly the D9 situation. The lane therefore
builds through P40 harness-worktree execution workers (main-store resolution),
integrating on branch `wt/worktree-session-routing` (registered sibling
worktree `beegog--wt--worktree-session-routing`); merge to main happens after
the sibling's slice caps, ideally via the freshly built `bee worktree merge`.

## What ships

| Cell | What | Verify |
|---|---|---|
| wsr-1 | `bee worktree new --feature <slug>`: `createFeatureWorktree` in worktree-store.mjs — validate slug, typed zero-mutation refusals (non-ordinary checkout / existing path / branch / grant), `git worktree add ../<basename>--wt--<slug> -b wt/<slug>`, then grant + `bootstrapWorktreeStore` exactly as `register`; CLI verb `worktree.new` (registry + handler + usage, 4-mirror discipline); prints path + "open your next session there" (D7) | test_worktree_cli + test_worktree_store + test_bee_cli + test_lib_mirror |
| wsr-2 | `bee worktree merge --id <id>`: `mergeFeatureWorktree` — typed refusals (unknown id, dirty main, dirty worktree, detached/wrong branch), `git merge --no-ff wt/<slug>` from MAIN; textual conflict → typed `MERGE_CONFLICT`; clean merge → run configured `commands.verify` (none recorded → `verify: skipped`); green → ok (+ `--cleanup`: worktree remove + grant remove + branch -d); red → typed `MERGE_VERIFY_RED` with output tail = the semantic-conflict alarm (D8). Merge commit never rolled back by bee. CLI verb `worktree.merge` | same as wsr-1 |
| wsr-3 | D9 routing prose: bee-hive Session Scout note + AGENTS.block.md rule 14 rider (new feature work in an occupied checkout → `worktree new`; docs/tiny/release stay in main; merge from main, verify is the semantic gate); re-render plugin trees + refresh managed copies + manifest --write | test_skill_render + test_plugin_distribution + release_manifest --check + test_onboard_bee |

Serialized wsr-1 → wsr-2 → wsr-3. One commit per cell on `wt/worktree-session-routing`.

## Out of scope
Parent D3 tier split, P40 dispatch changes, same-file concurrency (claims/holds
own it), host rollout, auto-teleport, release.

## Risks / mitigations
- Git-mutating machinery (worktree add/merge/remove): every failure path is a
  typed zero-mutation refusal proven in e2e fixtures; cleanup only after green.
- Public CLI contract: DA5 bijection test forces registry+example rows.
- Merge-back to main will conflict with the sibling cnr2 slice in
  bee.mjs/command-registry.mjs — expected, handled at merge time (the user's
  locked direction: only touch the merge step, never wait).

## Close-out
Full configured verify green on the integration branch; scribing sync of
`docs/specs/worktree-parallelism.md`; comment + close GH #21 after merge-back.
