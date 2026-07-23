# ro-1 — [DONE]

A cell cannot be authored without the regen obligations its own file list implies: `cells add` /
`cells update` now refuse a cell whose `files` touch a root a standing guard hashes unless its own
`verify` carries that guard's `--check` (and, for the manifest, unless `files` lists the manifest
path). The trigger roots are parsed out of `scripts/release_manifest.mjs` and
`scripts/ledger_parity.mjs` at every write — no root list is kept in the guard — with a recorded
`regen_obligation_ack` reason string as the deliberate-skip hatch.

Files touched:

- `skills/bee-hive/templates/lib/cells.mjs` (the guard + wiring into validateNewCell/updateCell)
- `skills/bee-hive/templates/tests/test_bee_cli.mjs` (12 new rows; the two existing
  `manifestLintWarning` fixtures untouched and still green)
- `.bee/bin/lib/cells.mjs`, `.bee/onboarding.json`,
  `docs/history/codex-harness-hardening/release-manifest.json`, `.claude-plugin/skills/**`,
  `.codex-plugin/skills/**` (regen chain, run in the mandated order inside this cell)

Measured, not recited: the script hashes **12** roots, not the six the routing brief and decision
`531765fc` both assert — the recited six omit `.claude-plugin/marketplace.json`, both installers
and both distribution tests (`release_manifest.mjs:141-142`, outside the `:130-136` window that
was quoted). Deriving rather than copying is what caught it.

Full trace, verify output and verification evidence: `.bee/cells/ro-1.json`.
