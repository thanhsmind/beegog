# footprint-4 — Review fixes: tracked-paths advisory + gitignore splice hardening (D1)

**Status:** [DONE]

**Outcome:** Fixed the review wave's two P2s and three foldable P3s in the
gitignore stage of `onboard_bee.mjs`. (1) Added a tracked-paths advisory:
`git ls-files -z -- <GITIGNORE_BLOCK_PATTERNS>` via `execFileSync` with an
argv array (never shell interpolation), emitting one notice line naming the
count and the exact `git rm -r --cached <paths>` command when any managed
path is still git-tracked; degrades to silence on missing git/non-repo/any
git error. Never auto-runs `git rm`. Notice appears in both plan (`--json`)
and post-apply recheck output. (2) Hardened the marker splice:
`gitignoreBlockPresent`/`extractGitignoreBlock`/`mergeGitignoreContent` now
anchor to whole lines (`/^# BEE:START[ \t]*\r?$/m` style, not bare
substring) so a user comment like `# BEE:START custom notes` is never
adopted as the managed block; the update path now preserves user header AND
footer bytes exactly (dropped the whole-file `.replace(/\s*$/, "")` trim);
drift comparison normalizes `\r\n` to `\n` only for the extracted-vs-rendered
compare (writes stay LF), so a CRLF-saving editor no longer causes a
perpetual `update_gitignore_block` loop.

**Deviations:** none — all changes were within the cell's described scope
(gitignore stage of `onboard_bee.mjs` + its tests only); `guards.mjs`,
hooks, and the AGENTS.md marker path were untouched, and no package
installs were needed.

**Files touched:** `skills/bee-hive/scripts/onboard_bee.mjs`,
`skills/bee-hive/scripts/test_onboard_bee.mjs`.

**Verification (behavior_change — RED-first):** captured RED by
`git stash push` on only `onboard_bee.mjs` (keeping the new/strengthened
tests), then ran `test_onboard_bee.mjs`: 9 FAILs — exact header/footer
equality, both marker-lookalike append-vs-update checks, both
marker-lookalike content-preservation checks, the appended-block-present
check, the CRLF up_to_date check, and both tracked-paths-notice checks
(plan + post-apply). `git stash pop` restored the fix; full cell verify
command (`test_onboard_bee.mjs && test_lib.mjs`) then passed: 0 failures/1
pre-existing skip, and 171 passed/0 failed respectively. Full trace and
evidence: `.bee/cells/footprint-4.json`.

**Note:** no commit made in this cell — the orchestrator owns the closing
commit per this cell's global constraints.
