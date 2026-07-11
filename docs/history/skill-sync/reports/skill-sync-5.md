# skill-sync-5 — worker report (mason-5)

[DONE] — Review P1 clusters 6-9 fixed red-first: forced-apply transparency
(blocked-forceable dry-run and refused `--apply` both enumerate the skills a
`--force-downgrade` would overwrite/delete via `skills.items`), blocked-first
recheck precedence (a residual blocked skill stage can never report
`recheck: "up_to_date"`; `recheck_skills` exposes status/reason/versions),
the `{source, host_helpers, installed_skills}` version triple reported as
`"unknown"` on every `blocked_no_source` return (identity/overlap/repo-
overlap), and a `scope: "installed" | "source"` discriminator on every
skill-stage plan item (legacy items unchanged). Also rewrote README's stale
decision-0014 manual-copy parenthetical to reflect automatic skill-sync.
16 new checks; suite 641 ok/PASS lines green (1 pre-existing unrelated skip
on case-sensitive `/tmp`), test_lib 124 green.

Files: `skills/bee-hive/scripts/onboard_bee.mjs`,
`skills/bee-hive/scripts/test_onboard_bee.mjs`, `skills/bee-hive/SKILL.md`,
`README.md`

Commit: 3d36b22. Full trace and verification evidence (including the 16 red
failure captures): `.bee/cells/skill-sync-5.json`.
