# du-5 — Close-out: prose canonical form, stale header comments, full verify

[DONE] — Helper CLI Quick Reference now presents `bee.mjs <group> <verb>` as
canonical for all 9 groups (with a shims-remain-valid note); bee.mjs's usage
header lists all 9 groups and describes in-process shim dispatch (no
spawnSync); command-registry.mjs's header no longer describes the stale
spawnSync/"4 existing helper CLIs" delegation idea. Prose/comments only, no
code behavior changes. All 4 verify suites green.

Files touched:
- skills/bee-hive/references/routing-and-contracts.md
- skills/bee-hive/templates/bee.mjs (+ .bee/bin/bee.mjs, byte-identical copy)
- skills/bee-hive/templates/lib/command-registry.mjs (+ .bee/bin/lib/command-registry.mjs, byte-identical copy)

Full trace/evidence: `.bee/cells/du-5.json`.
