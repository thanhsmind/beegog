# transcript-recovery-1

**Status:** [DONE]
**Worker:** kevin

## Outcome

Added `recovery.mjs` (crash-candidate detection, transcript-tail reading, clean-end-trio detection, durable-settlement lookup, bounded mining-window math, and the miner prompt template) plus a 29-case unit suite, byte-identical in `skills/bee-hive/templates/lib/` and `.bee/bin/lib/` per the mirror law. RED-first: `node skills/bee-hive/templates/tests/test_recovery.mjs` failed with `MODULE_NOT_FOUND` before implementation (recorded in the cap's `verification_evidence`); GREEN after: 29/29 recovery tests pass and `scripts/test_lib_mirror.mjs` (4/4) confirms mirror parity.

## Files

- `skills/bee-hive/templates/lib/recovery.mjs` (new)
- `.bee/bin/lib/recovery.mjs` (new, byte-identical mirror)
- `skills/bee-hive/templates/tests/test_recovery.mjs` (new)

## Consults

None (advisor not engaged — no verify failure occurred).

Full trace/evidence: `.bee/cells/transcript-recovery-1.json`.

## Note

Cap printed `JUDGE_STANDARD_INSUFFICIENT: red_failure_evidence floor ... was not enforced ... via the deliberate_exceptions door (F5)` — recovery.mjs is a genuinely new module (no prior behavior to diff against), so `deliberate_exceptions` was used per `bee-executing/references/worker-details.md`'s guidance for new surfaces; the cap itself succeeded (`status: capped`, `verify_passed: true`). Logged as a P3 friction row for follow-up.
