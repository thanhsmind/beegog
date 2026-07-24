# backlog-auto-commit-2 — orchestrator done-report

**Cell:** backlog-auto-commit-2 (small lane, single dispatched execution worker `bac-exec-1`, tier generation/sonnet)
**Status:** capped 2026-07-23T10:12:26.561Z, `verify_passed: true`, frozen judge: no hits
**Commit:** `58a95c5` — feat(backlog): scope backlog add auto-commit to --queue-submit, surface merge-in-progress skips [backlog-auto-commit-2]

This report is authored by the orchestrator, not the worker — evidence below is the worker's verbatim diff plus the orchestrator's own independent fresh verify re-run, per bee-swarming's single-execution-worker contract.

## What changed (verbatim diff, core logic — `skills/bee-hive/templates/bee.mjs`)

```diff
@@ -2498,13 +2498,36 @@ function runBacklogGit(root, args) {
- * test_bee_cli.mjs's backlog.add example passing unchanged. */
-function commitBacklogRow(root, line) {
+ * test_bee_cli.mjs's backlog.add example passing unchanged.
+ *
+ * Gated on `queueSubmit` (D1): a human queue-submit row (`--queue-submit`)
+ * is the only case that attempts a commit at all — an agent's own
+ * self-observation row (friction/debt/finding about its own session) is
+ * appended by appendJsonl but never committed, so the flag stays false and
+ * this returns immediately without invoking git. When queueSubmit is true,
+ * a merge in progress is detected up front (D2) by resolving the REAL
+ * git-dir via `git rev-parse --git-dir` — never a hardcoded .git/MERGE_HEAD,
+ * since linked worktrees point .git elsewhere — and checking for a
+ * MERGE_HEAD file there before attempting the scoped commit. */
+function commitBacklogRow(root, line, queueSubmit) {
+  if (!queueSubmit) {
+    return { committed: false, sha: null };
+  }
+
   const inWorkTree = runBacklogGit(root, ['rev-parse', '--is-inside-work-tree']);
   if (inWorkTree.error || inWorkTree.status !== 0 || (inWorkTree.stdout || '').trim() !== 'true') {
     return { committed: false, sha: null };
   }
 
+  const gitDirResult = runBacklogGit(root, ['rev-parse', '--git-dir']);
+  if (gitDirResult.error || gitDirResult.status !== 0 || !(gitDirResult.stdout || '').trim()) {
+    return { committed: false, sha: null };
+  }
+  const gitDir = path.resolve(root, gitDirResult.stdout.trim());
+  if (fs.existsSync(path.join(gitDir, 'MERGE_HEAD'))) {
+    return { committed: false, sha: null, commit_skipped_reason: 'merge_in_progress' };
+  }
+
   const backlogPathspec = path.join('.bee', 'backlog.jsonl');
   const addResult = runBacklogGit(root, ['add', '--', backlogPathspec]);
   ...
@@ -2551,6 +2574,7 @@ function handleBacklogAdd(root, flags) {
   const detail = flags.detail !== undefined && flags.detail !== true ? String(flags.detail) : '';
   const feature = flags.feature !== undefined && flags.feature !== true ? String(flags.feature) : '';
+  const queueSubmit = flags['queue-submit'] === true;
   ...
   appendJsonl(path.join(root, '.bee', 'backlog.jsonl'), line);
-  const { committed, sha } = commitBacklogRow(root, line);
-  const commitSuffix = committed ? ` (committed ${sha.slice(0, 7)})` : '';
+  const { committed, sha, commit_skipped_reason: commitSkippedReason } = commitBacklogRow(root, line, queueSubmit);
+  const commitSuffix = committed
+    ? ` (committed ${sha.slice(0, 7)})`
+    : commitSkippedReason === 'merge_in_progress'
+      ? ' (auto-commit skipped: merge in progress)'
+      : '';
```

Full commit diffstat (10 files — template + every mirrored root + registry + tests + cell record):

```
 .agents/skills/.bee-render.json                                    |   2 +-
 .agents/skills/bee-hive/templates/bee.mjs                          |  45 +++++-
 .agents/skills/bee-hive/templates/lib/command-registry.mjs         |   9 +-
 .agents/skills/bee-hive/templates/tests/test_cli_cells.mjs         | 174 +++++++++++++++++++++
 .bee/bin/bee.mjs                                                   |  45 +++++-
 .bee/bin/lib/command-registry.mjs                                  |   9 +-
 .bee/cells/backlog-auto-commit-2.json                              |  88 +++++++++++
 .bee/onboarding.json                                                |   6 +-
 .claude-plugin/skills/.bee-render.json                              |   2 +-
 .claude-plugin/skills/bee-hive/templates/bee.mjs                    |  45 +++++-
```
(mirrors continue identically across `.claude/skills/**`, `.codex-plugin/skills/**`; `skills/bee-hive/templates/{bee.mjs,lib/command-registry.mjs,tests/test_cli_cells.mjs}` is the authored source, everything else is the established sync)

## Orchestrator's independent verification

**Frozen judge** (`node .bee/bin/bee.mjs cells judge --id backlog-auto-commit-2`): `{"hits": []}` — no undeclared test/CI/lockfile/verify-config drift.

**Fresh full verify re-run**, orchestrator's own shell, after the worker's report (not trusting its 88/88 claim):

```
$ node scripts/run_verify.mjs
... (88 suites)
PASS run_verify: 88 suite(s), concurrency=5, wall=61335ms
```

Includes the 3 new fixture tests in `skills/bee-hive/templates/tests/test_cli_cells.mjs` (queue-submit omitted/false → no git invoked; queue-submit true → scoped commit + `commit_sha`; MERGE_HEAD present + queue-submit true → `commit_skipped_reason:"merge_in_progress"` + text warning, no commit attempted) — all green, no skips.

**Reservations:** `node .bee/bin/bee.mjs reservations list --active-only` → empty.

## must_haves check (against the cell's locked contract)

| Truth | Verified |
|---|---|
| No `--queue-submit` → row appended, zero git ops, `committed:false` | Diff: `if (!queueSubmit) return {committed:false, sha:null}` fires before any `runBacklogGit` call |
| `--queue-submit` → scoped commit, `committed:true` + `commit_sha` | Unchanged original add/commit path, now gated behind `queueSubmit` |
| `--queue-submit` + merge in progress → `commit_skipped_reason:'merge_in_progress'` + visible text warning | `git rev-parse --git-dir` + `MERGE_HEAD` check added ahead of the add/commit sequence; `handleBacklogAdd`'s `commitSuffix` branches on the reason |
| `.bee/bin/**` mirrors `skills/bee-hive/templates/**` byte-for-byte | Confirmed identical diff hunks at both paths in the commit |

**Prohibitions honored:** `appendJsonl`'s unconditional row-append is untouched (runs before the gated `commitBacklogRow` call, unconditionally); the scoped pathspec (`git add`/`git commit -- .bee/backlog.jsonl`, never `-A`/plain commit) is unchanged; no `commit_skipped_reason` value beyond `'merge_in_progress'` was introduced.

## Scope note

The worker's deviation (syncing `.claude/skills/**`, `.agents/skills/**`, plugin trees, and `docs/history/codex-harness-hardening/release-manifest.json` via the established `onboard_bee.mjs --apply` / `render_plugin_skill_trees.mjs` / `release_manifest.mjs --write` chain) is mechanical sync required for the full verify chain's manifest/plugin-distribution checks to pass — the same pattern P78's cell (`1a164fc`) used, not scope creep.

No blockers. No P1/P2 findings. Independent review was not requested for this scope (R1 — on-demand only).
