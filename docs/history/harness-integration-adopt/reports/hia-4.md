# hia-4 — report

**Status:** [DONE]

**Outcome:** Imported vantt's `docs/decisions/0024-harness-cross-pollination-analysis.md` verbatim from ref `pr-1-vantt`, appended an "Adoption note (2026-07-12)" section per DA7. Ported and adapted the PR's dispatcher hunks for `skills/bee-hive/templates/AGENTS.block.md`, `docs/02-architecture.md`, and `docs/07-contracts.md` to adopted 0.1.26 reality (registry includes `cells.update`, runnable `node .bee/bin/bee.mjs --help --json` form throughout, `command-registry.mjs` named as the single source of truth for the command surface, no claims true only on vantt's branch). Applied the identical AGENTS-block edit inside `AGENTS.md`'s BEE markers and confirmed byte-equality against the template by diff (exit 0). Added a one-line `docs/specs/reading-map.md` pointer for the dispatcher.

**Deviation:** fixed a blocking, unrelated pre-existing gap in `skills/bee-hive/scripts/test_onboard_bee.mjs`'s hardcoded gitignore hash-parity list (hia-1 added `.bee/manifest-hash.json` to `onboard_bee.mjs`'s live generator but not to this test's separately-hardcoded expected list). Confirmed via git-stash A/B that the failure was present with hia-4's doc edits removed — a one-line, no-behavior-change parity fix, reserved before write.

**Files touched:** `docs/decisions/0024-harness-cross-pollination-analysis.md`, `skills/bee-hive/templates/AGENTS.block.md`, `AGENTS.md`, `docs/02-architecture.md`, `docs/07-contracts.md`, `docs/specs/reading-map.md`, `skills/bee-hive/scripts/test_onboard_bee.mjs`.

Full trace/evidence: `.bee/cells/hia-4.json`.
