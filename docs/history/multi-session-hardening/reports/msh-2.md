# msh-2 — cells claim re-backed by O_EXCL claim file + session-id self-derivation (D1+D3)

**Status:** [DONE] — capped, verified green, one commit.

**Outcome:** `cells claim --id` (`bee.mjs` `handleCellsClaim`) is re-backed by the
same O_EXCL claim-file gate `claim-next` already used
(`claims.mjs` `claimCellFile`, via the reused `cells.mjs` `claimCellCrossSession`),
so concurrent claimants on one cell now produce exactly one winner and N-1
typed `CLAIMED` refusals naming the owner + expiry instead of a silent
double-claim. Session id resolution is centralized in `claims.mjs`'s new
`resolveSessionId` (explicit flag → `CLAUDE_CODE_SESSION_ID` env → null),
used by both `cells claim` and `cells claim-next`. A null/absent session is a
legal sessionless claim (the claim file omits the `session` key rather than
writing `null`). Every claim-clearing cell transition (cap/unclaim/block/
drop/reopen) now releases the claim file via a new `claims.mjs` `clearClaim`
helper.

**Files touched:** see `.bee/cells/msh-2.json` `trace.files_changed` for the
full list (includes two files outside the cell's originally declared scope —
`command-registry.mjs` and `test_bee_cli.mjs` — auto-added and explained in
`trace.deviations`; `bee cells judge --id msh-2` flags the test-source one for
reviewer visibility).

**Verification:** full trace, verify output, and `behavior_change` evidence
(including the deliberate-red falsifiability run) live in
`.bee/cells/msh-2.json`. New permanent regression guard:
`scripts/test_claim_race.mjs`.

**Deviations / design notes:** three entries in `trace.deviations` — two
auto-added files required to deliver the cell's own D3 CLI requirement, one
design note on why the bare `claimCell` function itself stays unchanged
(preserves the pinned W4 unwind test and `claimNextCell`'s exact ordering
contract) while `cells claim --id` is still fully re-backed by the claim-file
gate at the CLI-verb level.

**Reservations:** released.
