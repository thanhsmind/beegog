# p49-force-downgrade-blast-radius-1 — worker report

[DONE] — the refused `--apply` payload (and its dry-run twin) now enumerates the
`copy_lib`/`copy_helper` blast radius as `host_items`, per the advisor-verdict.

Files touched:
- `skills/bee-hive/scripts/onboard_bee.mjs`
- `skills/bee-hive/scripts/test_onboard_bee.mjs`

Full trace/evidence: `.bee/cells/p49-force-downgrade-blast-radius-1.json`.
