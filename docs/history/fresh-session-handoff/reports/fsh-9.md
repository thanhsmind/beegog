# fsh-9 — Handoff kinds + guarded writer/adopter verbs (lib + CLI, RED-first)

[DONE]

Shipped the two-kind handoff lifecycle (planned-next | pause, D1) as lib + CLI, owning the handoff LIFECYCLE only (claim-next is fsh-11's, SessionStart wiring is fsh-10's). `readHandoff` normalizes `kind` for display (missing/unknown → `pause`, the fail-safe that keeps every legacy handoff on surface-and-wait); `writeHandoff` is the strict guarded writer — `planned-next` refuses with zero mutation unless the previous cell is capped with `trace.verify_passed === true` AND the next cell's claim is already owned by `writer_session`; `adoptHandoff` wraps `claims.mjs`'s `adoptClaim` as clear-after-adopt with documented idempotent recovery (typed refusal, never a throw). Three new CLI verbs (`state.handoff.write`/`adopt`/`show`) land through the unified registry with exercised runExample rows.

RED-first evidence: git-stashed the implementation behind the new tests and confirmed genuine failures (test_lib.mjs 12 failed, test_bee_cli.mjs 6 failed — every new function "is not a function", plus the export-allowlist drift row) before restoring the implementation and returning to green.

Files touched: `skills/bee-hive/templates/lib/state.mjs`, `skills/bee-hive/templates/lib/command-registry.mjs`, `skills/bee-hive/templates/bee.mjs`, `skills/bee-hive/templates/tests/test_lib.mjs`, `skills/bee-hive/templates/tests/test_bee_cli.mjs`, `.bee/bin/lib/state.mjs`, `.bee/bin/lib/command-registry.mjs`, `.bee/bin/bee.mjs`. (`claims.mjs` was read-only — `adoptClaim` already existed, no change needed.)

Full trace/evidence: `.bee/cells/fsh-9.json`.

Reservations: released (10/10). Commit: `79e800e`.
