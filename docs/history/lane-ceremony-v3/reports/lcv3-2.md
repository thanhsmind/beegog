# lcv3-2 — bee-hive surfaces (D3/D4/D5/D6/D7/D1 consistency pass)

**Status:** [DONE]

**Outcome:** `skills/bee-hive/SKILL.md`, `skills/bee-hive/references/go-mode.md`, and `skills/bee-hive/references/routing-and-contracts.md` now restate the same lane doctrine as the already-rewritten `skills/bee-planning/SKILL.md` (lcv3-1): narrowed D7 risk flags, D6 product-files-only lane caps, D3/D4 lane-table Plan column (tiny = no plan.md, small = opt-in behind a logged scoping synthesis), D5 preview-before-persist fast path, and D1 plan-freeze wording across go-mode's STEP 2/3 + Gate 2 revise line + routing-and-contracts.md's Chaining Contract and working-files tree. Also caught and fixed pre-existing drift in go-mode.md line 7 ("solo in-session execution") that contradicted AO14's already-established dispatched-execution-worker doctrine.

**Files touched:** `skills/bee-hive/SKILL.md`, `skills/bee-hive/references/go-mode.md`, `skills/bee-hive/references/routing-and-contracts.md`, `scripts/test_gate_bypass_doctrine.mjs`, `.claude-plugin/skills`, `.codex-plugin/skills`, `docs/history/codex-harness-hardening/release-manifest.json`.

**RED-first evidence:** 15 new assertions added to `scripts/test_gate_bypass_doctrine.mjs`; RED output recorded to `docs/history/lane-ceremony-v3/reports/lcv3-2-red.txt` before the rewrite, all 15 GREEN after.

**Full trace/evidence:** `.bee/cells/lcv3-2.json`

**Commit:** `a852f1a` — `feat(hive): lane-ceremony-v3 bee-hive surfaces — flag narrowing, product-file caps, lane shapes, plan freeze [lcv3-2]`
