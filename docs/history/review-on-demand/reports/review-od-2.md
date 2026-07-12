# review-od-2 — [DONE]

Coverage + staleness engine: derived candidate statuses (unreviewed / in review / reviewed / review stale) and `bee_reviews.mjs status` verb.

Added `deriveCandidateStatus` + `CANDIDATE_STATUSES` to `lib/reviews.mjs` — a pure, never-stored derivation of the four R10 labels from session records + git (`merge-base --is-ancestor`, `rev-list --count`), with a fail-toward-honesty degrade ladder (unresolvable range / missing git binary → `review stale` + `range unresolvable` note; no covering session → `unreviewed`; never throws on the read path). Added a `bee_reviews.mjs status [--feature F] [--json]` verb rendering verified + four-label counts and the A7 `reviewed (covered by <id>)` answer surface. Mirrored byte-identical into `.bee/bin/`.

Full suite: `node skills/bee-hive/templates/tests/test_lib.mjs` → 198 passed, 0 failed.

Files touched: `skills/bee-hive/templates/lib/reviews.mjs`, `skills/bee-hive/templates/bee_reviews.mjs`, `.bee/bin/lib/reviews.mjs`, `.bee/bin/bee_reviews.mjs`, `skills/bee-hive/templates/tests/test_lib.mjs`.

Full trace/evidence: `.bee/cells/review-od-2.json`.
