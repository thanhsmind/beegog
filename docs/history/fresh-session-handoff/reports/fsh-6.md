# fsh-6 — Presentation readers show the session's lane

**Status:** [DONE]
**Worker:** Mel (generation tier)

**Outcome:** `buildSessionPreamble`/`buildPromptReminder` (inject.mjs) gain an optional `sessionId` parameter — omitted (today's exact call shape) resolves to the default pipeline, byte-identical to before; a bound session shows that lane's own phase/mode/feature/gates plus a one-line summary of other ACTIVE (non-terminal) lanes, and an unresolvable binding falls back to the default record (informational-only, never blocks). `bee.mjs` `buildStatus` carries a new `lanes` block (per-lane phase/gates/bound sessions, via a `buildLaneRows` helper shared with `handleStateLanes` — no second implementation) alongside every pre-existing zero-lane field unchanged; `renderStatusText` adds a `Lanes:` line only when lanes exist. `bee-chain-nudge.mjs`/`bee-session-close.mjs` thread `payload.session_id` through `resolvePipeline` for the phase they branch on, default fallback otherwise — `bee-session-init.mjs` stays untouched (S4's scope). RED-first: 5 new `test_lib.mjs` rows and 6 new `test_hook_contracts.mjs` rows (verified failing against the pre-change code via a temporary `git stash` of just the implementation files, tests kept), then green after restoring the implementation.

**Files touched:**
- `skills/bee-hive/templates/lib/inject.mjs` (optional-sessionId preamble/reminder + lanes summary)
- `skills/bee-hive/templates/bee.mjs` (`buildLaneRows` + status `lanes` block + text render line; `handleStateLanes` refactored onto the same helper)
- `hooks/bee-chain-nudge.mjs`, `hooks/bee-session-close.mjs` (thread `payload.session_id` into `resolvePipeline` for phase resolution)
- `skills/bee-hive/templates/tests/test_lib.mjs` (5 new rows, RED-first; existing rows extended, never modified)
- `hooks/test_hook_contracts.mjs` (6 new rows across `chain-nudge-lane`/`session-close-lane` groups, RED-first)
- `.bee/bin/lib/inject.mjs`, `.bee/bin/bee.mjs`, `.bee/bin/hooks/bee-chain-nudge.mjs`, `.bee/bin/hooks/bee-session-close.mjs` (vendored byte-identical)

**Verify:** `node skills/bee-hive/templates/tests/test_lib.mjs && node hooks/test_hook_contracts.mjs && node skills/bee-hive/scripts/test_onboard_bee.mjs` — 258 passed/0 failed, 125 rows/0 failing, onboard PASS (baseline before first edit: 253 passed/0 failed, 119 rows/0 failing, onboard PASS).

Full trace and verification evidence: `.bee/cells/fsh-6.json`.
