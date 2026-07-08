# harness10 — Discovery (L1)

**Level:** L1 quick-verify. No unfamiliar territory: every slice extends a seam harness09 already built and tested. Findings below are command/file evidence gathered 2026-07-08; no external research needed.

## Verified facts

| Claim | Evidence |
|---|---|
| `COMMAND_KEYS = ['setup','start','test','verify']` exported from templates/lib/state.mjs | `state.mjs:33` |
| onboard_bee.mjs has the exact seam for candidate proposals: `commandsNotices(repoRoot)` returns the capture notice when config commands are empty | `onboard_bee.mjs:265-277` |
| onboard_bee.mjs duplicates COMMAND_KEYS locally; a drift test already guards it | `onboard_bee.mjs:263`; test "COMMAND_KEYS matches lib/state.mjs (no drift)" green this session |
| New lib modules auto-vendor: copy step iterates `listTemplateLibModules()` (readdir), hash-tracked in managed versions | `onboard_bee.mjs:317-330, 385-395` |
| Fixture-repo test harness exists and is Windows-safe (uses `E:\Temp\bee-onboard-test-*`, not `/tmp`) | test_onboard_bee.mjs output this session |
| Baseline verify green before any work | 41 + 74 assertions passed, this session |
| Preamble seam for future slices (commands section pattern) | `templates/lib/inject.mjs:84-95` |

## Precedent

harness09 (docs/09 items 1–5) shipped through the same seams — onboarding notice + preamble section + drift-guard test. Reuse the trio verbatim; no new patterns required.
