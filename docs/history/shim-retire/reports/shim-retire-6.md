# shim-retire-6 — Living docs sweep + self-onboard this repo + full green close

[DONE]

Swept every remaining living-doc surface listed in D4 scope — `docs/specs/{reading-map,workflow-state,feedback-digest}.md`, `docs/0{1-9}-*.md`, `docs/config-reference.md`, `docs/model-presets.md` — rewriting every `bee_<group>.mjs` invocation to the `bee.mjs <group> <verb>` form; `docs/02-architecture.md`'s "Vendored helpers" + "Unified CLI dispatcher" sections and `docs/07-contracts.md`'s "Helper CLI surface" section (the two largest, most load-bearing descriptions of the old 4-shim design) were rewritten in full to describe `bee.mjs` as the sole shipped CLI over all 9 groups, with the shim-era design kept only as clearly-marked history. `docs/05-roadmap.md`/`docs/08-harness-adoption.md` (historical/proposal prose) had literal shim filenames replaced with generic descriptions so no living surface still reads as teaching a shim invocation as current.

Removed 2 dead declarations left by cell-1's shim-parity-test deletion: `test_lib.mjs`'s unused `writeCell`/`collectFeedback` imports, and `backlog.mjs`'s write-only `headerLine` local in `rankBacklog` (assigned, never read).

Self-onboarded this repo (`onboard_bee.mjs --repo-root . --apply`): dry-run plan was exactly 9 `remove_helper` (the 9 `bee_*.mjs` shims), 1 `copy_lib` (backlog.mjs), 3 `copy_repo_hook` (drifted hooks), `write_onboarding` — nothing outside the expected D2 shape, so applied. `.bee/bin/` now holds only `bee.mjs`, `hooks/`, `lib/`; the recheck dry-run reports `up_to_date` with an empty plan. This is the D2 end-to-end proof (the onboarding `--apply` did the shim removal itself; no `.bee/bin` file was hand-deleted).

Full baseline verify green: `test_lib.mjs` 292/0, `test_onboard_bee.mjs` PASS (0 failures, 1 skipped), `hooks/test_write_guard.mjs` ALL PASS, `hooks/test_hook_contracts.mjs` 141 rows/16 groups all passing. Post-apply mechanical checks both pass: `.bee/bin/bee_*.mjs` glob is empty, and the shim-invocation grep over the D4-scoped doc set returns zero files.

Files touched: the 14 docs listed above, `skills/bee-hive/templates/lib/backlog.mjs`, `skills/bee-hive/templates/tests/test_lib.mjs`, the 9 deleted `.bee/bin/bee_*.mjs` shims, `.bee/bin/lib/backlog.mjs`, 3 `.bee/bin/hooks/*.mjs` (synced by onboarding), `.bee/onboarding.json`.

Full trace/evidence: `.bee/cells/shim-retire-6.json`.

Note for the orchestrator: `.bee/decisions.jsonl`, `.bee/backlog.jsonl`, `.bee/review-candidates.jsonl`, `.bee/cells/release-v0134-1.json`, `.bee/cells/release-v0133-1.json`, and `.bee/sessions/` were already dirty/untracked before this cell started and are outside shim-retire-6's file scope — left untouched and uncommitted here.
