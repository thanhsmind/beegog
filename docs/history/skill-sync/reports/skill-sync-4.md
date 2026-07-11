# skill-sync-4 — worker report (mason-4)

[DONE] — Review P1 clusters 1-5 fixed red-first in the skill-sync stage:
partial-install guard (absent only with zero bee-* entries), line-anchored
single-match version reader on lstat-verified regular files, cleanup-before-
materialize ordering for dir<->file transitions, repoRoot<->targetRoot overlap
refusal at preflight, and canonical-identity (dev:ino) case-alias fail-closed
blocking. 32 new checks; suite 232 green (case-alias case additionally
exercised green on a case-insensitive mount), test_lib 124 green.

Files: `skills/bee-hive/scripts/onboard_bee.mjs`,
`skills/bee-hive/scripts/test_onboard_bee.mjs`

Commit: 8681ab5. Full trace and verification evidence (including the 5 red
failure captures): `.bee/cells/skill-sync-4.json`.
