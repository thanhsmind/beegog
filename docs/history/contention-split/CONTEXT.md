# contention-split — CONTEXT

Goal (user directive 2026-07-20): maximize CONCURRENT work across sessions.
Independent features today serialize on three artificial hotspots, not on
real logic conflicts.

## Measured contention (digest 2026-07-20)

1. `templates/tests/test_lib.mjs` — 9622 lines, ~100 sections, every lib
   module's tests in one file; ANY two features collide here. One shared
   mutable temp root at top (test_lib.mjs:218-242) with cross-section
   accumulation; 84 sections already self-isolate via own mkdtempSync.
2. `templates/bee.mjs` — 4421 lines, all command-group handlers inline
   (flat HANDLERS table at 3892+); every CLI-touching feature collides.
3. Regen steps — `render_plugin_skill_trees.mjs` writeTree (127-135) is
   rmSync + non-atomic per-file writes, no lock: two concurrent runs race
   dangerously. `onboard_bee.mjs` converges (atomic rename + hash-skip) but
   has no cross-file transaction.

## Locked decisions

- **D1 — Split the test monolith by contiguous section ranges.** Per-module
  files under `templates/tests/` (test_cells, test_claims, test_reservations,
  test_state, test_guards, test_feedback, test_reviews, test_backlog_capture,
  test_cli_<area> for the bee.mjs CLI block 5288-9253, test_misc for the
  rest). Contiguous ranges preserve intra-range accumulation; each file
  bootstraps its own fixture. Section order inside a file never changes.
- **D2 — New shared fixture helper is sanctioned.** No precedent exists
  (standalone tests duplicate setup); a split multiplies that duplication
  past reason. `scripts/lib/test-fixture.mjs` exports makeTempRepo()/
  makeCell()/the check-runner; split files import it. New convention,
  deliberately chosen.
- **D3 — Conservation is the cap evidence.** Total check count summed over
  split files == the monolith's count before the move (plus nothing lost:
  grep-census of `check(` calls); full verify green. The monolith is
  DELETED at the end, and `test_verify_manifest.mjs` MANDATORY_SUITES stops
  substring-matching `test_lib` and enumerates every split file explicitly
  (today's substring check would not catch a dropped part).
- **D4 — Regen becomes concurrency-safe.** render_plugin_skill_trees
  writeTree runs under withStoreLock and writes via tmp+rename (grants
  precedent); two concurrent renders serialize and converge.
- **D5 — bee.mjs handler split is DEFERRED.** Real hotspot, but a
  4400-line refactor with mirror/shim propagation is its own feature after
  this one proves the test split; not in scope here.
- **D6 — In-flight etiquette.** The split queues honestly behind live holds
  on test_lib.mjs (RC session). After the split lands, open cells that name
  test_lib.mjs (xwh-2..4, future RC slices) are updated to target the split
  file that owns their section; workers re-read current code regardless.

## Out of scope

bee.mjs handler extraction (D5); any behavior change in any test (pure
migration); onboarding/vendor pipeline redesign (mirrors regenerate as
today — split files ride the same whole-dir sync, byte-equality guard
at test_lib.mjs:9129 moves with its section).

## Sources

Topology digest 2026-07-20 (test_lib.mjs:6-152/218-242/526-531,
run_verify.mjs:32-81/130-162, test_verify_manifest.mjs:23-50,
bee.mjs:3892/4392, render_plugin_skill_trees.mjs:127-143,
onboard_bee.mjs:244-256/1503-1594).
