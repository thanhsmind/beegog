OUTCOME: done

FINDINGS

1. P2 — The legacy `Task` dispatch path has no behavioral coverage.
   - Evidence: `hooks/bee-model-guard.mjs:19` declares both `Agent` and `Task`, and `hooks/hooks.json:38` registers `Agent|Task`, but every dispatch case in `hooks/test_model_guard.mjs:124-233` uses `tool_name: "Agent"` (apart from the unrelated `Edit` control at line 213).
   - Failure scenario: a later refactor drops `Task` from `DISPATCH_TOOLS`, changes its payload handling, or narrows the hook matcher to `Agent`; the entire payload-table suite remains green while legacy Task calls silently inherit the session model.
   - Smallest credible fix: table-drive the dispatch-tool dimension and run at least the bare-deny and explicit-tier allow cases for both `Agent` and `Task`.

2. P2 — The onboarding regression test proves filename presence, not correct hook wiring.
   - Evidence: `skills/bee-hive/scripts/test_onboard_bee.mjs:398-410` string-searches the serialized settings for each hook filename, while the production contract is the exact `PreToolUse` entry at `skills/bee-hive/scripts/onboard_bee.mjs:959-962`. The idempotence assertion at `test_onboard_bee.mjs:418-424` counts only `bee-session-init.mjs`, not the newly added model guard.
   - Failure scenario: onboarding places `bee-model-guard.mjs` under the wrong event, uses an `Agent`-only/wrong matcher, attaches it to the write-guard entry, or duplicates only this entry on the second apply. The current assertions still pass, but dispatches are unguarded or the guard runs twice.
   - Smallest credible fix: inspect `settings.hooks.PreToolUse` structurally; assert exactly one entry with matcher `Agent|Task` whose command names `bee-model-guard.mjs`, assert the existing write-guard matcher remains separate, and repeat the exact count after the second apply.

3. P2 — D2's fail-open import/crash behavior is not exercised.
   - Evidence: the catch-and-log path is implemented at `hooks/bee-model-guard.mjs:120-151`, but `hooks/test_model_guard.mjs:40-45` always copies valid library modules. Its malformed cases (`hooks/test_model_guard.mjs:202-225`) cover absent/non-object input, junk JSON, and no repo, none of which reaches a failing dynamic import or a throwing state helper.
   - Failure scenario: a vendored `state.mjs` becomes corrupt/incompatible or `hookEnabled` throws; a regression in the catch path makes every Agent/Task invocation exit nonzero instead of failing open, blocking all subagent dispatches. The current suite cannot distinguish this from a correct implementation.
   - Smallest credible fix: add an isolated repo fixture with a syntactically invalid or throwing `.bee/bin/lib/state.mjs`; assert exit 0, empty stderr, and one parseable `model-guard` crash record. Add the missing-state fixture as the non-crash fail-open control.

SUMMARY
Coverage is strong for the primary Agent payload matrix, including the 500-character boundary, toggle, deny message, and deny logging.
Before merge, add Task symmetry plus structural onboarding/idempotence and crash-path tests; these are the regression paths most able to leave the guard silently ineffective or globally blocking.
