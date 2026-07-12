# review-od-7 — removal census + acceptance evidence

**Status:** [DONE] — worker: mel

**Outcome:** Swept the remaining auto-review chain wording strays in the cell's file list (cells 4/5/6
already rewired the primary skill/AGENTS surfaces). Fixed: the exact retired `bee-reviewing` description
trigger in `docs/04-skills-spec.md:72`; two stale Phase 1/3 lines in `docs/05-roadmap.md` ("light review",
"chain after reviewing"); `docs/02-architecture.md`'s "scribing runs after reviewing" chain description;
`docs/11-implement-plan-adoption.md`'s walkthrough trigger wording; and `README.md`'s workflow diagram,
Gate table row, "How review works" intro, lanes table, and session-flow diagram (all previously showed
`bee-reviewing`/Gate 4 as an automatic post-execution stage). Added two self-match-safe census tests to
`test_lib.mjs` (banned phrases built by string concatenation per critical pattern 20260712). Wrote
`docs/history/review-on-demand/reports/uat-scenarios.md` mapping SPEC A1–A12 to real named tests
(A6/A7/A8/A10) or recorded UAT scripts (A1/A2/A3/A4/A5/A9/A11/A12).

**Files touched:** `docs/04-skills-spec.md`, `docs/05-roadmap.md`, `docs/02-architecture.md`,
`docs/11-implement-plan-adoption.md`, `README.md`, `skills/bee-hive/templates/tests/test_lib.mjs`,
`docs/history/review-on-demand/reports/uat-scenarios.md`.

**Verify:** `node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/scripts/test_onboard_bee.mjs && test -f docs/history/review-on-demand/reports/uat-scenarios.md` — passed (test_lib.mjs 208/0; test_onboard_bee.mjs PASS, 0 failures/1 platform skip; uat-scenarios.md exists).

**Commit:** `c5e089c`. Reservations released (18).

Full trace/evidence: `.bee/cells/review-od-7.json`.
