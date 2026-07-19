# msh-4 — claim-ownership check on cell mutators + audited force door (D4)

**Status:** [DONE] — capped, verified green, one commit.

**Outcome:** `recordVerify`/`capCell`/`blockCell`/`unclaimCell`/`reopenCell`
(`cells.mjs`) now read the live claim file before mutating: a new
`checkClaimOwnership` helper composes `readClaim`/`isClaimActive` plus
`claims.mjs`'s own `claimExpiry` (newly exported, not duplicated) and
`resolveSessionId`. A LIVE claim whose session differs from the caller's
resolved session (D3) refuses — typed, naming the owner and expiry, never a
throw from inside the guard itself (`guardClaimOwnership` is the sole
guard-consumed caller that converts the typed refusal into the thrown
`Error` every other `cells.mjs` refusal already uses). An expired claim, an
absent claim, a sessionless claim, or a matching session all proceed
unchanged — single-session use never hits a refusal. `--force-ownership`
bypasses the check and appends an audit row (`verb`, `forced_by`,
`owner_bypassed`, `at`) to a new, distinct, append-only trace key
`trace.ownership_overrides` — never `trace.deviations` (Δ5-amended: `capCell`
replaces `deviations` wholesale from its own argument, so an append there
would be silently wiped at the very next cap). A forced unclaim still runs
the existing unconditional `clearClaim` release, so the forced-open cell
stays claimable by the rescuing session. `dropCell` and `updateCell` are
deliberately untouched — see Deviations below.

**Files touched:** `skills/bee-hive/templates/lib/cells.mjs`,
`.bee/bin/lib/cells.mjs`, `skills/bee-hive/templates/lib/claims.mjs`,
`.bee/bin/lib/claims.mjs` (outside the cell's originally declared scope —
see Deviations), `skills/bee-hive/templates/bee.mjs`, `.bee/bin/bee.mjs`
(new `--session-id`/`--force-ownership` flags on `cells verify|cap|block|
unclaim|reopen`, `force-ownership` added to `FLAG_ALONE_BOOLEANS`),
`skills/bee-hive/templates/tests/test_lib.mjs`,
`docs/history/codex-harness-hardening/release-manifest.json`.

**Verification:** full trace, verify output, and `behavior_change` evidence
(including the git-show "before" characterization and the deliberate red the
guard produced against two pre-existing pinned tests) live in
`.bee/cells/msh-4.json`. Freeze-first baseline (`test_lib`/`test_bee_cli`)
was green before any edit. Final chain: `test_lib.mjs` 365/365,
`test_bee_cli.mjs` 188/188, `test_lib_mirror.mjs` 4/4,
`release_manifest.mjs --write` then `--check` clean (364 files). Also
manually smoke-tested the compiled CLI end to end in a disposable
in-worktree fixture: cross-session `verify`/`cap` refuses naming owner +
expiry (exit 1); same-session proceeds; `--force-ownership` proceeds and
lands the audit row.

**Deviations (not recorded in `trace.deviations` — see process note below):**
1. Touched `skills/bee-hive/templates/lib/claims.mjs` (+ its `.bee/bin/lib`
   mirror), which was outside the cell's declared `files` list — needed to
   `export` the already-existing private `claimExpiry` helper so the new
   refusal names owner + expiry in exactly `claimCellFile`'s own wording,
   per the cell's own "compose, do not add readers" instruction. No new
   reader was added; visibility only.
2. `updateCell` is unchanged: its status door already refuses `"claimed"`
   categorically ("only open or blocked cells are updatable"), with a pinned
   test (`updateCell refuses claimed, capped, and dropped cells...`)
   asserting exactly that on a cell with no underlying claim file. Extending
   `updateCell` to allow a claimed cell when the caller owns the live claim
   — as CONTEXT D4's parenthetical "(and `cells update` on claimed cells)"
   suggests — would make that pinned test's no-claim-file `claimed` cells
   updatable, breaking "existing test rows byte-unchanged." Since
   `updateCell`'s existing rule is *stricter* than ownership (it excludes
   every claimed cell, not just cross-session ones), D4's concern for this
   verb is already structurally satisfied without a code change; opening
   the door further is a real capability change better scoped as its own
   decision, not folded into this cell silently.
3. Two pre-existing `test_lib.mjs` rows (`capCell releases the claim file on
   cap (D1 Δ2)`, `unclaimCell releases the claim file... (D1 Δ2)`) claimed
   as a named test session via `claimCellCrossSession` and then called
   `recordVerify`/`capCell`/`unclaimCell` with no matching caller session —
   legal under the old code, and the exact shape the new guard now refuses.
   Updated both calls to pass the *owning* session id (the realistic caller
   shape a real worker has), preserving their original assertions and pass
   status while proving same-session use is unaffected.

Process note: `--deviations-file` was not passed at cap time, so
`trace.deviations` is `[]`; the three items above are recorded here instead.
No functional impact — the guard behavior and its evidence are unaffected.

**Reservations:** released.
