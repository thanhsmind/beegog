# worker report — model-tier-guard-2

**Status:** [DONE]

**Outcome:** Registered `bee-model-guard.mjs` everywhere the six existing hooks are registered — `HOOK_FILENAMES` and a new `Agent|Task` `PreToolUse` entry in `renderRepoHookEntries()` (`skills/bee-hive/scripts/onboard_bee.mjs`), mirrored in `hooks/hooks.json` — verified red-first against the hard-coded hook list in `skills/bee-hive/scripts/test_onboard_bee.mjs`. The existing `Edit|Write|MultiEdit|Bash|Read|Glob|Grep` matcher is untouched (byte-identical); `.codex/hooks.json` untouched per D4.

**Files touched:**
- `hooks/hooks.json`
- `skills/bee-hive/scripts/onboard_bee.mjs`
- `skills/bee-hive/scripts/test_onboard_bee.mjs`

Full trace/evidence: `.bee/cells/model-tier-guard-2.json`.
