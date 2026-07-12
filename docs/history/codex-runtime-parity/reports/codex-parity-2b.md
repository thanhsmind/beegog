# codex-parity-2b — Worker Report

**Status:** [DONE]
**Worker:** dave

## Outcome

Fix-first repair after the codex-parity-2 catalog inversion (commit d1777ed,
decisions D1/D2): `skills/bee-hive/scripts/test_onboard_bee.mjs`'s onboard
parity check (section 9b, formerly line ~475) hard-coded `hooks/hooks.json`
as the Claude-settings comparison target, so it compared Claude repo settings
against the now-Codex projection and failed on the intentionally-absent
`PreToolUse::Agent|Task::bee-model-guard.mjs` triple.

Rewired to the two-projection layout:
- Claude repo settings (`.claude/settings.json` as applied by
  `renderRepoHookEntries()`) now compare against `hooks/claude-hooks.json`
  — restores the pass.
- Added a new assertion (9b2) comparing `hooks/hooks.json` (Codex) against
  `hooks/claude-hooks.json` (Claude): every triple-level difference between
  the two must be explained by an entry in `hooks/catalog.mjs`'s
  `ALLOWED_DIFFERENCES` export (imported, never re-hardcoded by name), and
  every `ALLOWED_DIFFERENCES` entry must correspond to a real difference
  (no unused/over-permissive allowance). Neither direction re-hardcodes the
  model-guard rule — the boundary is derived entirely from the catalog.

No other onboard check was touched.

## Files changed

- `skills/bee-hive/scripts/test_onboard_bee.mjs`

## Verify

`node skills/bee-hive/scripts/test_onboard_bee.mjs` — PASS (failures: 0,
skipped: 1). Full trace and verify output:
`.bee/cells/codex-parity-2b.json`.

## Deviations

None.
