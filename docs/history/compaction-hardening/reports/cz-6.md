# cz-6 — SessionStart takes the compact branch

**[DONE]**

SessionStart now emits the compact capsule on `source=compact` (carrying the
`handoffOutcome` the hook already computes, D27) and today's full preamble on
every other source; `intentLeadBlock` / `ANCHOR_LEAD_SOURCES` are untouched, so
the anchor is still rendered exactly once, by the hook (D19).

Files touched:

- `hooks/bee-session-init.mjs`
- `.bee/bin/hooks/bee-session-init.mjs` (mirror)
- `scripts/test_compact_capsule.mjs` (three through-the-hook rows)
- `docs/history/codex-harness-hardening/release-manifest.json`, `.bee/onboarding.json`
  (D24 regen chain: render → onboard --apply → manifest --write)

`hooks/test_hook_contracts.mjs` was **not** edited and is green — 193 rows, 0
failing, including the compact/resume additivity row and both HANDOFF rows.

Full trace, verification evidence and red-failure evidence: `.bee/cells/cz-6.json`.
