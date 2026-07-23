# cz-7 — the two advisory surfaces, and the PreCompact additivity row they change

**Status:** [DONE]

**Outcome:** PreCompact (`hooks/bee-session-close.mjs`) now appends the `precompact`
compaction record, renders the D9 survival warning off that record's
`cell_compact_count`, and emits the D10 anchor nudge forced past the dedup cache
without marking it; UserPromptSubmit (`hooks/bee-prompt-context.mjs`) emits the same
nudge deduped on key `anchor-missing-nudge`. All three PreCompact strings ride
`parts` into `emitHookOutput` as a `systemMessage` — `encodeBlock` untouched (B2/R14).
D23's PreCompact additivity row was split into two byte-exact rows, never weakened.

**Files touched**

- `hooks/bee-session-close.mjs`, `hooks/bee-prompt-context.mjs` (+ their `.bee/bin/hooks/` mirrors)
- `hooks/test_hook_contracts.mjs` (the D23 split)
- `scripts/test_compaction_advisories.mjs` (new, 7 rows)
- `.bee/onboarding.json`, `docs/history/codex-harness-hardening/release-manifest.json` (D24 regen chain)

Full trace, verify output, and both red-failure captures: `.bee/cells/cz-7.json`.
