# review-od-1 — [DONE]

Review-session store + candidates ledger: `lib/reviews.mjs` (create/list/show/record/candidate,
A6 auto-exclusion, A10 fail-closed preflight, R5 scope immutability) + `bee_reviews.mjs` CLI, both
vendored byte-identical into `.bee/bin/`. 17 new `test_lib.mjs` checks cover session roundtrip, A6,
A10, id non-reuse, immutability refusal, corrupt-file strict-read-vs-fail-open split, and the
candidates ledger append contract. Full suite: 188 passed, 0 failed (verify command unchanged).

Files touched:
- `skills/bee-hive/templates/lib/reviews.mjs` (new)
- `skills/bee-hive/templates/bee_reviews.mjs` (new)
- `.bee/bin/lib/reviews.mjs` (new, byte-identical vendor copy)
- `.bee/bin/bee_reviews.mjs` (new, byte-identical vendor copy)
- `skills/bee-hive/templates/tests/test_lib.mjs` (17 new checks added, none removed/weakened)

Full trace and evidence: `.bee/cells/review-od-1.json`.
