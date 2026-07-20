# cross-worktree-holds — plan (frozen at Gate 2)

Mode: standard. 4 cells, sequential (shared files: test_lib.mjs, mirrors).

## Shape

The same-store coordination stack is complete today: `reservations.mjs`
(reserve/release/TTL/sweep, session-keyed `findSessionConflicts`),
`guards.mjs` `checkWrite` branch 4 (cross-session hold deny naming
holder + expiry, guards.mjs:204-228), `cells.mjs` `claimNextCell` hold-skip
predicate (cells.mjs:1950-1953). The gap: a GRANTED worktree's store is
isolated, so none of those consult other checkouts. Fix = one shared ledger
at `<mainRoot>/.bee/runtime/cross-worktree-holds.json` (grants precedent:
main-store-only, worktree-store.mjs:35-43) + three read-side taps.

Topology access is already free: `resolveRoots` returns `mainRoot` + `id`
for every linked worktree (state.mjs:695-752); `withStoreLock(root, name)`
accepts any root, so a granted worktree locks `<mainRoot>/.bee/locks/`
directly (lock.mjs:150, sanitized names).

## Cells

1. **xwh-1 — ledger module.** New `templates/lib/worktree-holds.mjs`:
   `mirrorHold`, `releaseHolds` (by holder+session/cell), `findForeignHolds`
   (unexpired entries whose holder ≠ acting checkout), `releaseAllForHolder`,
   TTL-only expiry pruned on read (reservations `sweepExpired` precedent, no
   heartbeat), every mutation under `withStoreLock(mainRoot,
   'cross-worktree-holds')`, atomic tmp+rename writes (grants precedent).
   Holder = worktree id or `"main"`. Unit section in test_lib.mjs + race
   suite `scripts/test_worktree_holds_race.mjs`, registered in run_verify
   SUITES + SERIAL_SENSITIVE. Purely additive, no wiring.
2. **xwh-2 — reservation seam + lifecycle release.** `bee.mjs`
   reservations handlers: reserve checks `findForeignHolds` first (typed
   refusal naming holder + expiry, rule-14 language) then mirrors the
   local reserve into the ledger; release/sweep release/prune mirrored
   entries; `reservations list` gains the ledger view. Worktree lifecycle:
   `performCleanup` (worktree-store.mjs:729-781) releases all holds for the
   removed worktree id, best-effort after `removeGrant`.
3. **xwh-3 — claim-next skip.** `claimNextCell` hold-free predicate also
   consults `findForeignHolds` (topology via resolveRoots; ordinary
   checkout = holder "main"). A cell whose declared files are ledger-held
   by another checkout is skipped, same as local holds today.
4. **xwh-4 — guard tap, net-first.** Frozen-green regression net over the
   `checkWrite` decision table FIRST (critical pattern 20260716: an
   over-denying guard locks sessions out of their own fix), then: new
   branch beside branch 4 — foreign-hold deny naming holder + expiry;
   corrupt ledger = deny (reservationStoreCorrupt precedent,
   guards.mjs:108-117), missing = open, unreachable mainRoot = fail-open
   crash-log path; `DIRECT_EDIT_DENY` gains
   `.bee/runtime/cross-worktree-holds.json` + `worktree-grants.json`
   (CLI-only writes).

Every cell: edit templates source of truth → self-onboard
(`onboard_bee.mjs`) refreshes `.bee/bin` mirrors → plugin trees via
`render_plugin_skill_trees.mjs` → full `node scripts/run_verify.mjs` green.

## Deferred / out of scope

Supervisor layer above sessions; cross-worktree read visibility; any
`resolveRoots` store-selection change (P40 frozen). D7 lane-first doctrine
lands in docs/specs/worktree-parallelism.md at scribing, no code.
