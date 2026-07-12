# review-od-3 — [DONE]

`bee_status.mjs` review block + §9 wording, retired Gate-4-pending warning, candidate-aware `recommended_next`.

Added a fail-open `review` block to `buildStatus` (candidate counts by derived status — unreviewed/in_review/reviewed/stale — + open session ids + R7 high-risk-unreviewed count), sourced entirely from `lib/reviews.mjs`'s own derivation (review-od-1/2), never re-implemented here. Retired the `POST_REVIEW_PHASES` "past reviewing but gate review still pending" staleness warning per R3 — a post-execution close without Gate 4 is now the normal truthful state — and replaced it with an informational SPEC-§9 completion line in `renderText` ("Completed and verified; independent review not requested; N candidate(s) awaiting review.") that fires only in scribing/compounding/compounding-complete with unreviewed candidates present. Added a prominent R7 high-risk-unreviewed warning line. Made `recommended_next` candidate-aware so it reports the unreviewed count and never proposes `bee-reviewing` as an automatic post-execution step (§11.5), even overriding a stale `state.next_action`. The decision-0004 unknown-phase warning and every other staleness warning are untouched. Mirrored byte-identical into `.bee/bin/`.

Full suite: `node skills/bee-hive/templates/tests/test_lib.mjs` → 206 passed, 0 failed (12 new checks for this cell).

Files touched: `skills/bee-hive/templates/bee_status.mjs`, `.bee/bin/bee_status.mjs`, `skills/bee-hive/templates/tests/test_lib.mjs`.

Full trace/evidence: `.bee/cells/review-od-3.json`.
