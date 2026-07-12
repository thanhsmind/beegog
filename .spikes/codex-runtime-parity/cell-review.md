**codex-parity-1**

CRITICAL: Broken verify command masks harness failure. Field quoted: `"verify": "node hooks/test_hook_contracts.mjs --baseline 2>&1 | tail -5"`. Without `pipefail` or another status-preserving wrapper, `tail` can return 0 even when the node test exits non-zero.

CRITICAL: Assumed context for wrapper set. Field quoted: `"action": "Build the executable fixture harness hooks/test_hook_contracts.mjs: for EACH of the seven wrappers..."`; but `read_first` only names `"hooks/bee-write-guard.mjs"` and `"hooks/bee-session-init.mjs"`. A cold worker is not given the exact seven-wrapper list.

MINOR: `must_haves.key_links` cites `"plan.md test-matrix row 2"` but `read_first` does not include `plan.md`.

**codex-parity-2**

CRITICAL: Broken verify command masks both test failures. Field quoted: `"verify": "node hooks/test_hook_contracts.mjs 2>&1 | tail -3 && node skills/bee-hive/templates/tests/test_lib.mjs 2>&1 | tail -1"`.

CRITICAL: Scope/file mismatch around `BEE_VERSION`. Field quoted: `"action": "Bring .claude-plugin/plugin.json, .codex-plugin/plugin.json and BEE_VERSION under one strict-semver equality guard..."`; but `files` does not include the file defining `BEE_VERSION` (`skills/bee-hive/templates/lib/state.mjs` / vendored twin).

CRITICAL: Vague acceptance criteria. Field quoted: `"action": "...add required publisher fields."` The required fields are not enumerated in the cell, so a cold worker must infer them from external/plugin-validator context.

MINOR: `must_haves.key_links` cites `"plan-review.md P1-1 atomic switch repair"` but `read_first` does not include the actual report path `docs/history/codex-runtime-parity/reports/plan-review.md`.

**codex-parity-3**

CRITICAL: Broken verify command masks all three test failures. Field quoted: `"verify": "node hooks/test_hook_contracts.mjs 2>&1 | tail -3 && node hooks/test_write_guard.mjs 2>&1 | tail -1 && node hooks/test_model_guard.mjs 2>&1 | tail -1"`.

CRITICAL: Vague/under-specified required behavior. Field quoted: `"action": "...Fix registered-worker nickname matching."` No exact failing row, expected matching rule, or acceptance assertion is named in `must_haves`.

MINOR: Acceptance wording is loose for coverage-gap logging. Field quoted: `"truths": ["unsupported host paths log visibly as coverage gaps, not silently"]`. It does not specify log path/schema or required test row.

**codex-parity-4**

CRITICAL: Broken verify command masks both test failures. Field quoted: `"verify": "node hooks/test_write_guard.mjs 2>&1 | tail -3 && node hooks/test_hook_contracts.mjs 2>&1 | tail -1"`.

CRITICAL: Unrecorded/vague proof requirement. Field quoted: `"action": "...Include a temporary-break proof: comment out one target-extraction branch, show the matrix catches it, restore."` No artifact path or required verification evidence format is specified, so a cold worker can satisfy this only informally.

MINOR: `must_haves.key_links` cites `"plan-review.md P1-3 deny-on-unprovable repair; risk map apply_patch HIGH"` but `read_first` omits `reports/plan-review.md`.

**codex-parity-5**

CRITICAL: Broken verify command masks test failure. Field quoted: `"verify": "node skills/bee-hive/templates/tests/test_lib.mjs 2>&1 | tail -1"`.

CRITICAL: Scope/file mismatch for vendored parity. Field quoted: `"action": "...template and vendored .bee/bin twin stay byte-identical via the existing sweep."` But `files` lists only `skills/bee-hive/templates/...`, not `.bee/bin/bee_state.mjs` or `.bee/bin/lib/state.mjs`.

CRITICAL: Verify does not prove a stated must-do. Field quoted: `"action": "...template and vendored .bee/bin twin stay byte-identical via the existing sweep."`; field quoted: `"verify": "node skills/bee-hive/templates/tests/test_lib.mjs 2>&1 | tail -1"`. This verify only runs the template lib suite and does not include the onboarding/sweep parity check.

MINOR: `must_haves.key_links` cites `"plan-review.md P1-4 guarded feature start; test-matrix row 5"` but `read_first` omits both `reports/plan-review.md` and `plan.md`.

CELLS: FIX REQUIRED