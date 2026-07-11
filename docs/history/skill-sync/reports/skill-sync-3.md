# skill-sync-3

[DONE] — Documented the shipped skill-sync onboarding behavior in `skills/bee-hive/SKILL.md`
(Onboarding section: one-command promise, `blocked_downgrade` + `--force-downgrade` escape,
`blocked_no_source` fail-closed, `blocked_symlink` per-skill skip, agent response to each)
and `README.md` (onboarding/updating section: apply updates helpers and skills together,
downgrades refused by default, `--force-downgrade` added to the CLI usage line).

Files touched: `skills/bee-hive/SKILL.md`, `README.md`.

Full trace/evidence: `.bee/cells/skill-sync-3.json`.

Friction logged on the cell: README's Status section (~line 406, decision 0014 bullet) still
carries a stale note claiming manual skill copying is required — now false, but out of this
cell's designated edit area; flagged for a follow-up cleanup cell.
