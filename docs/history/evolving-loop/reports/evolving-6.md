# evolving-6 — [DONE]

**Outcome:** Fixed the P2 data-loss regression from evolving-5. `normalizeKind` was not idempotent, so
the D2b consumer re-normalization it added rejected the producer's own already-normalized kind
vocabulary (`audit`/`correction`/`approval`/`closed`), reproducing the reported 59→52 real-corpus loss.
Added `export const NORMALIZED_KINDS = new Set(Object.values(KIND_ALIASES))` (single source both
`KIND_ALIASES` and the idempotence check derive from) and made `normalizeKind` (now exported) return a
value unchanged when it is already a member of `NORMALIZED_KINDS`, before falling through to
`unknown_type`. Consumer-side re-normalization on the `mergeDigests` path is untouched — the D2b
security control stays intact.

**Tests added (4, on top of the 100 frozen):** idempotence for every alias key and every normalized
kind; the four regressed kinds merging with zero `unknown_type` drops; a foreign `kind` of `{}`,
`"<script>"`, or `null` still dropped as `unknown_type`; and the round-trip guard the suite lacked — a
digest built by `buildDigest` and fed straight into `mergeDigests` loses zero entries (17 entries
spanning all 13 normalized kinds).

**Red → Green:** reverting only `normalizeKind`'s body to the evolving-5 form reproduced the regression
exactly (101 passed, 3 failed — including "produced 17, merged 13, dropped [...approval, audit, closed,
correction]"). After the fix: `test_lib.mjs` **104 passed, 0 failed**; `test_onboard_bee.mjs` **PASS,
failures 0**.

**Files:** `skills/bee-hive/templates/lib/feedback.mjs`, `skills/bee-hive/templates/tests/test_lib.mjs`

Full trace / verification evidence / friction: `.bee/cells/evolving-6.json`.
