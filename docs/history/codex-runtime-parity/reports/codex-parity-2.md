# codex-parity-2 — Worker Report

**Status:** [DONE]
**Worker:** stuart
**Commit:** d1777ed

## Outcome

Atomic dual-catalog inversion landed in one commit (P1 atomicity, plan-review.md
first bullet; decisions D1 and D2): `hooks/catalog.mjs` is the single logical
hook catalog whose renderer reproduces both checked-in projections
byte-identically — `hooks/hooks.json` is now the Codex default projection
(model-tier guard excluded per approach.md §2) and `hooks/claude-hooks.json`
byte-preserves the prior Claude catalog, with `.claude-plugin/plugin.json`
rerouted to it in the same commit. `hooks/test_hook_contracts.mjs` gained
catalog drift-check + allowed-differences rows, an isolated-`CODEX_HOME`
codex-acceptance group (live-proven on codex-cli 0.144.1: marketplace add
accepted, `bee@bee` listed via `plugin list --available --json`, default
`hooks/hooks.json` route present; loud named SKIP when the CLI is absent), and
an opt-in `--catalog-only` verify mode.

Mode preservation (amended must_have): bare default mode still gates the full
seven-wrapper table — it exits 1 with exactly the 16 inherited RED rows
(cell-3's green target, untouched); `--baseline` still exits 0 with cell-1's
contract unchanged; `--catalog-only` runs only the 6 catalog-drift +
codex-acceptance rows (all pass).

## History note

An intermediate `[BLOCKED]` was returned when the original verify field chained
the bare default harness mode (red by design until cell-3). The orchestrator
accepted the diagnosis and amended the verify to
`node hooks/test_hook_contracts.mjs --catalog-only && node skills/bee-hive/templates/tests/test_lib.mjs`
(sanctioned hand-edit, validation-repair precedent). The trace retains the
earlier honest failing verify record superseded by the passing one.

## Files changed

- `hooks/catalog.mjs` (new)
- `hooks/claude-hooks.json` (new)
- `hooks/hooks.json` (modified — Codex default projection)
- `.claude-plugin/plugin.json` (modified — hooks path → `./hooks/claude-hooks.json`)
- `hooks/test_hook_contracts.mjs` (extended — no existing row weakened)
- `.codex-plugin/plugin.json` — unmodified by design (no hooks override = default route; version/publisher metadata belongs to the Distribution slice)

Full trace, verification evidence, and verify output:
`.bee/cells/codex-parity-2.json`.
