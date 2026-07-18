# Validation report — reality anchors (wsr, high-risk lane)

Reviewer: opus (review tier), read-only, judged against git HEAD (sibling session mid-edit on templates). 2026-07-18. All anchors PASS.

1. PASS — `bootstrapWorktreeStore(worktreeRoot, mainStoreRoot, feature)` at worktree-store.mjs:235, idempotent (state.json guard :252 returns {created:false}; onboarding/config copy-if-absent).
2. PASS — `worktree register` at HEAD: registry command-registry.mjs:1267; handler bee.mjs:2087 (map :2493). Resolves via resolveRoots(process.cwd()), requires worktreeResolution === 'linked-valid'; writeGrant(mainStoreRoot, id) :2104 then bootstrapWorktreeStore :2105. `new` inverts (starts in main, git worktree add first).
3. PASS — merge=union at .gitattributes:6-8 for .bee/decisions.jsonl, .bee/backlog.jsonl, .bee/review-candidates.jsonl (the .bee/ copies only).
4. PASS — DA5 bijection: `worktree` in GROUP_NAMES (test_bee_cli.mjs:208); loop :250 enforces registry entry per runtime verb; examples non-empty :158; both failing-assertion directions quoted at :267/:275.
5. PASS — scripts/test_worktree_cli.mjs is a real temp-repo e2e: helpers record :22, git() spawnSync :27, bee() :33, verifiedId() :37; fixture :44+ (mkdtemp, git init -b main, seeded .bee/onboarding.json + config.json {commands:{}}, git worktree add -b feat wt :61). New tests extend by seeding fixture verify commands into config.json.
6. PASS — no worktree.new / worktree.merge at HEAD (handler map bee.mjs:2493-2495; worktreeUsageFallback :2384 = "Use: register, list, unregister.").
7. PASS — commands come from readConfig(root).commands (state.mjs:1112; used at inject.mjs:222, bee.mjs:354): mergeFeatureWorktree reads readConfig(mainRoot).commands.verify; falsy → verify: skipped (D8).

## Coupling flags (fold into cells)

- **Bijection derives runtime verbs by parsing the `Use:` fallback string, not the handler map** (probe regex over worktreeUsageFallback, bee.mjs:2384). New verbs MUST be added to that usage string ("Use: register, list, unregister, new, merge.") in the same cell as the registry entry, in all mirror copies — the coupling most likely to bite (especially wsr-2).
- Every new registry entry needs parameters.type === 'object' valid JSON-Schema (:167) and a `deprecated` key (:160).
- No write-guard/resolveRoots constraint blocks a git-mutating verb (subprocess, not a guarded tool write). resolveRoots only classifies.
- createFeatureWorktree gates on worktreeResolution === 'ordinary' — the mirror of register's linked-valid requirement (bee.mjs:2097).
- Worktree examples are presence-checked, not executed, by DA5 — real execution coverage lives entirely in scripts/test_worktree_cli.mjs.
