# [BLOCKED] codex-sandbox-baseline-5

The transitive Node launcher migration is implemented and focused verification is green, but the exact unchanged repository baseline stops at the release-manifest check because the declared review-library mirrors now have new hashes.

Files touched:

- `skills/bee-hive/templates/tests/test_lib.mjs`
- `skills/bee-hive/templates/tests/race_claims_child.mjs`
- `skills/bee-writing-skills/scripts/test_openai_metadata.mjs`
- `skills/bee-hive/templates/lib/reviews.mjs`
- `.bee/bin/lib/reviews.mjs`

Focused proof: metadata parity 14 checks passed; all three claims race scenarios passed with concurrent Workers; `test_lib.mjs` passed 322/0; the 17-file template/runtime mirror check passed.

Blocker: `node scripts/release_manifest.mjs --check` reports SHA mismatches only for the two declared review-library mirrors. Refreshing `docs/history/codex-harness-hardening/release-manifest.json` is required for the terminal baseline, but that generated artifact is outside this cell's declared file scope.

Full trace and exact verify output: [cell record](../../../../.bee/cells/codex-sandbox-baseline-5.json).
