# evolving-8 — Mechanize two critical patterns instead of trusting prose

**Status:** [DONE]
**Worker:** mason

## Outcome

Added two new assertions to `skills/bee-hive/templates/tests/test_lib.mjs` (108 -> 110, none
of the original 108 weakened, skipped, or deleted):

1. A sweep of every `skills/bee-hive/templates/**/*.mjs` file banning raw C0 control bytes
   other than tab/LF/CR — this caught the real NUL byte in `feedback.mjs`'s `sortKey`
   separator, proving the check works (RED before the fix).
2. A sibling source-grep asserting `ENTRY_FIELDS` carries no literal-array assignment,
   placed directly next to and explicitly **paired with** (not replacing) evolving-7's
   existing behavioral `ENTRY_FIELD_SPEC` guard.

Fixed `sortKey`'s join separator in `skills/bee-hive/templates/lib/feedback.mjs` from a raw
NUL byte to the non-C0 escape-sequence sentinel `␟` (SYMBOL FOR UNIT SEPARATOR, a
printable Control Pictures glyph), with a comment explaining why. Synced
`.bee/bin/lib/feedback.mjs` from the template afterward — `cmp` confirms byte-identity.

D4 was honored: the two new check() blocks were written and run first (109 passed, 1 failed
— the control-byte sweep failing on the pre-existing NUL byte), then `feedback.mjs` was
edited, then the suite was rerun to green (110 passed, 0 failed).

## Files modified

- `skills/bee-hive/templates/tests/test_lib.mjs`
- `skills/bee-hive/templates/lib/feedback.mjs`
- `.bee/bin/lib/feedback.mjs`

Full trace, verify output, and `verification_evidence` (RED failure, tests inspected/added,
verification run): `.bee/cells/evolving-8.json`.
