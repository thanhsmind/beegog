# cli-mutations-1 — bee_state.mjs CLI for state.json mutations

**Status:** [DONE]

**Outcome:** Created `skills/bee-hive/templates/bee_state.mjs` (verbs: `set`,
`gate`, `worker` add/update/remove/clear, `scribing-run`), vendored
byte-identical to `.bee/bin/bee_state.mjs`, and added 13 CLI-entry test cases
to `templates/tests/test_lib.mjs`. Full suite: 136 passed / 0 failed. One
deviation recorded (scribing-run's top-level `phase`/`next_action` handling,
filling a gap between the cell's flag list and bee-scribing SKILL.md:112's
requirement — see cell trace).

**Files touched:**
- `skills/bee-hive/templates/bee_state.mjs` (new)
- `.bee/bin/bee_state.mjs` (new, vendor copy)
- `skills/bee-hive/templates/tests/test_lib.mjs`

Full trace/evidence: `.bee/cells/cli-mutations-1.json`
