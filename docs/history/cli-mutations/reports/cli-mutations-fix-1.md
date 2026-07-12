# cli-mutations-fix-1 — readStateStrict: corrupt state.json must fail loud

**Status:** [DONE]

**Outcome:** Fixed review P1-1. Added `readStateStrict(root)` to
`skills/bee-hive/templates/lib/state.mjs` — absent `state.json` still returns
`defaultState()` (unchanged); a present-but-unparseable or non-object
`state.json` now throws an ERROR/WHY/FIX message naming the file, exit
non-zero, file untouched. `readState` itself is unchanged (hooks and
`bee_status` still depend on its fail-open shape). Switched all four
`bee_state.mjs` mutation verbs (`set`, `gate`, `worker`, `scribing-run`) from
`readState` to `readStateStrict`. Added 5 test rows to `test_lib.mjs`
(lib-level absent/corrupt/non-object/non-strict-unchanged, plus a CLI-level
refusal case). Re-synced templates ↔ `.bee/bin` vendor copies
(byte-identical, confirmed by `cmp`). Full suite: 148 passed / 0 failed.
Verified against the pre-fix code in an isolated fixture: the old CLI
clobbered a corrupt `state.json` to defaults (exit 0); the fixed CLI refuses
(exit 1, file byte-identical) — see `trace.verification_evidence` for the
red_failure_evidence detail.

**Files touched:**
- `skills/bee-hive/templates/lib/state.mjs`
- `skills/bee-hive/templates/bee_state.mjs`
- `skills/bee-hive/templates/tests/test_lib.mjs`
- `.bee/bin/lib/state.mjs` (vendor copy)
- `.bee/bin/bee_state.mjs` (vendor copy)

Full trace/evidence: `.bee/cells/cli-mutations-fix-1.json`
