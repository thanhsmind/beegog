# Approach: Worktree Isolation

## Recommended path

Implement one typed linked-worktree resolver in both existing root-discovery
copies, keeping the library and non-throwing hook adapter explicitly paired
(D2/D4). `resolveRoots` distinguishes `ordinary`, `linked-valid`, and
`linked-invalid`; library root discovery and all coordination CLI store access
raise typed `WORKTREE_LINK_INVALID` for the last state instead of accepting a
worktree-local `.bee/`. Preserve `ctx.root = workRoot`; expose `ctx.storeRoot`
only to the write guard. Before logical reservation normalization, canonically
contain every target in `workRoot` using target realpath or the nearest existing
ancestor for new targets.

Serialize the shared enabling changes wt-1 → wt-2 → wt-3. Before the post-fix
native-worktree acceptance, capture independent control-plane attestation. The
orchestrator then rechecks identity, ancestry, and reserved-path subset;
integrates transactionally; runs the exact full verify on committed main with
provenance; and cleans only a clean, reachable, fully green result. Every other
outcome is preserved unless a destructive drop receives explicit operator
approval and recovery evidence (D1/D3; decisions `5de1fd36`, `58c56bb6`).

## Rejected alternatives

- Environment root override — rejected by `5de1fd36`: CLI-only state can diverge
  from the Edit-triggered guard and leave reservations unenforced.
- `.bee/onboarding.json` as a trust marker — rejected by `58c56bb6`: tracked
  onboarding material exists inside the worktree and proves no Git relationship.
- Worker-reported branch as merge authority — rejected by W9 in `58c56bb6`;
  derive it from the native worktree id.
- Treating Git metadata as an authority boundary against a same-UID worker —
  rejected by plan re-review; the worker is cooperative/fallible, and the
  orchestrator must capture and recheck control-plane attestation.
- Lexical-only target normalization — rejected because traversal and symlink
  escapes can authorize the wrong logical reservation path.
- Automatic cleanup for non-green or dropped work — rejected because it can
  destroy the only recoverable worktree state.
- Running wt-2/wt-3 inside worktrees — rejected by validation sequencing: the
  active vendored guard is pre-fix and correctly denies the environment needed
  to build its own enabling change.
- Importing the state library into the adapter — rejected to preserve the
  adapter's import-light fail-open boundary; duplicate the small resolver and pin
  behavior with a shared contract fixture.
- Bee-managed worktree lifecycle or scheduler hints — deferred by D1; native
  Claude isolation is the bounded current need.

## Risk map

| Component | Risk | Reason | Proof needed |
|---|---|---|---|
| Library root resolver | HIGH | Every coordination CLI verb depends on it; invalid linked-shaped metadata must not fall back to local state | Real linked-worktree rows, typed `WORKTREE_LINK_INVALID`, forged/missing reverse-link rejection, and ordinary `.git` directory/submodule/separate-git-dir controls |
| Hook adapter root resolver | HIGH | It is a separate non-throwing copy on every hook event and can silently diverge | Shared fixture asserting adapter/library typed agreement while the adapter never throws; existing hook-contract suite |
| `ctx.root` / `ctx.storeRoot` split | HIGH | Changing `ctx.root` globally would alter unrelated hooks; failing to use `storeRoot` in the guard forks enforcement | Assert `ctx.root = workRoot`; write guard alone consumes `ctx.storeRoot`; inspect all existing hook consumers under the contract suite |
| Write-tool ambiguity gate | HIGH | One missed tool class creates an unguarded mutation path | Negative rows for Edit, Write, MultiEdit, apply-patch, and Bash before mutation; malformed Git metadata rows |
| Reservation normalization | HIGH | Lexical normalization can miss holds through traversal, symlink, separator, or case variants | Canonical containment using existing-target realpath or nearest existing ancestor; outside/`..`/symlink denials and POSIX/Windows rows for every write tool |
| Mirror discipline | HIGH | Runtime uses `.bee/bin` while fresh installs use templates/source; a hand list can omit production hooks | Derive the runtime production inventory, state explicit source-only exclusions, and inject drift/missing/extra cases; exact filenames follow the implementation inventory |
| Dispatch attestation | HIGH | Same-UID worker text or mutable metadata cannot be treated as independent authority | Pre-dispatch canonical common-dir/worktree/ref/base/path attestation; runtime eligibility refusal; integration recheck, ancestry, and reserved-path subset assertions |
| Transactional integration | HIGH | A conflict or red verify can leave partial history or destroy recoverable work | `--no-ff --no-commit`, targeted precommit checks, abort on red/conflict, committed-main full verify, non-destructive revert on unexpected red |
| Live worktree acceptance | HIGH | Unit fixtures cannot prove native isolation, reservation, integration, provenance, and cleanup work together | Post-wt-3 real reserved edit+commit; exact full verify with pwd/HEAD/ancestry/command/output; reachability-gated non-force cleanup; deterministic failure preservation |

## Files and order

1. **wt-1, shared:** `skills/bee-hive/templates/lib/state.mjs`, its
   `.bee/bin/lib/state.mjs` mirror, and `templates/tests/test_lib.mjs`.
2. **wt-2, shared after wt-1:** `hooks/adapter.mjs`,
   `hooks/bee-write-guard.mjs`, both `.bee/bin/hooks/` mirrors,
   `hooks/test_write_guard.mjs`, `hooks/test_hook_contracts.mjs`,
   `scripts/test_lib_mirror.mjs`, and the release manifest. The hook inventory is
   derived during this cell; exact parity filenames are not guessed in advance.
3. **wt-3, shared after wt-2 (strictly serialized):**
   `skills/bee-swarming/SKILL.md` and
   `skills/bee-executing/references/worker-details.md`, with focused assertions
   added to `skills/bee-hive/templates/tests/test_lib.mjs`.
4. **wt-4, native worktree after wt-3:** the single-worker validation
   exception to normal multi-worker eligibility; a real reserved edit to
   `skills/bee-swarming/references/swarming-reference.md` and
   `skills/bee-hive/templates/tests/test_lib.mjs`, commit, independently derived
   pre-dispatch attestation, transactional branch integration, committed-main
   full verify with provenance, then reachability-gated cleanup or prescribed
   preservation. Deterministic temp repositories inject identity mismatch,
   merge conflict, red verify, and BLOCKED/HANDOFF/abandon outcomes.

## Relevant learnings

- `docs/history/learnings/critical-patterns.md` — **guard placement**: the
  ambiguity gate must sit on every write-capable tool path, not inside a branch
  some tools skip.
- `docs/history/learnings/critical-patterns.md` — **validate state changes against
  callers**: preserve `ctx.root` for existing hook consumers and add the narrow
  `ctx.storeRoot` channel rather than changing the documented diagram alone.
- `docs/history/learnings/critical-patterns.md` — **mirror fixtures must derive
  their file sets**: derive runtime production hooks, document source-only
  exclusions, and detect missing, extra, and byte-different files.
- `docs/history/learnings/critical-patterns.md` — **verify strings are authored**:
  wt-3 uses precise routing/identity assertions; wt-4 installs focused protocol
  contract checks and relies on real Git plus main-checkout verification.
- Decision 0018 — goal-check evidence remains mandatory; this feature refines
  the rejected foundation swap only after demonstrated parallel Git contention.

## Questions for validating

- Does the library loudly reject every linked-shaped invalid relationship with
  typed `WORKTREE_LINK_INVALID` while the non-throwing adapter transports
  `linked-invalid`, and do ordinary directory/submodule/separate-git-dir controls
  remain ordinary?
- Do all existing hook consumers retain their pre-feature meaning when
  `ctx.root` remains `workRoot`, while the write guard alone uses `storeRoot`?
- Does canonical containment deny outside-root, `..`, and symlink escapes before
  normalization for every write-capable tool across POSIX and Windows forms?
- Does the launcher/import-derived runtime inventory catch missing, extra, and
  byte-different files while preserving explicit source-only exclusions?
- Can wt-4 capture attestation independently, refuse ineligible runtimes, prove
  ancestry and reserved-path subset, integrate transactionally, record full-main
  verify provenance, revert unexpected red, and clean or preserve exactly by the
  locked disposition rules under deterministic fault injection?
