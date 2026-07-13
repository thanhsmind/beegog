# ih-2 — per-project skill sync (D2, D3, D6)

[DONE] Skill sync now runs over per-target roots: default `<repo>/.claude/skills` + `<repo>/.agents/skills`, `--global-skills` opt-in for `~/.claude/skills`; singular `skills` payload became `skills.targets` with blocked-first aggregation (D5), per-target forced-apply transparency (D2), self-onboard `self_skip`, in-repo overlap exemption (all other refusals kept), no gitignore entries (D4).

Files: `skills/bee-hive/scripts/onboard_bee.mjs`, `skills/bee-hive/scripts/test_onboard_bee.mjs`, `skills/bee-hive/SKILL.md`

Full trace/evidence: `.bee/cells/ih-2.json`
