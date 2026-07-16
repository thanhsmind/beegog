---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: high-risk
---

# worktree-isolation — Plan

**Feature:** worktree-isolation · **Date:** 2026-07-15 · **Source of truth:**
[`CONTEXT.md`](./CONTEXT.md) D1–D4, including validation amendments
`5de1fd36` and `58c56bb6`.

## Mode Gate

Flags: **existing covered behavior** (root resolution feeds every CLI verb and
hook), **weak proof** (no shipped worktree precedent), **multi-domain** (Git
plumbing, shared libraries, hooks, and dispatch procedure), and
**cross-platform** (POSIX and Windows Git path forms). The write guard is
audit/security-adjacent safety machinery, so it is a hard-gate concern.
**Four flags plus one hard-gate concern → high-risk.** Tiny, small, and standard
would not provide enough proof for a change that can silently fork the
coordination store or bypass reservations.

## Requirements From CONTEXT.md

- **D1 — bounded opt-in.** Only a Claude Code wave with at least two concurrent
  workers may opt into native `isolation: worktree`; solo and one-worker waves
  stay in the shared checkout. Reservations remain the file-ownership primitive.
- **D2 — one trusted store.** The main checkout's `.bee/` is the only live
  coordination store. The sole resolution channel is the linked-worktree Git
  relationship: locate the nearest `.git`-FILE ancestor as `workRoot`, parse its
  `gitdir`, require `<main>/.git/worktrees/<id>`, and validate that metadata's
  reverse `gitdir` pointer back to the worktree before accepting `storeRoot`.
  Library `resolveRoots` returns typed `ordinary`, `linked-valid`, or
  `linked-invalid`; linked-shaped invalid metadata makes `findRepoRoot` and all
  coordination CLI store operations fail loudly with `WORKTREE_LINK_INVALID`
  rather than use local `.bee/`. The hook adapter remains non-throwing. Ordinary
  `.git` directories, submodules, and separate-git-dir repositories stay ordinary
  and receive control tests. `.bee/onboarding.json` is never consent. No
  environment override exists.
- **D3 — integration is part of completion.** The orchestrator derives the
  branch from an independently captured pre-dispatch control-plane attestation,
  never treats a same-UID worker or Git metadata as a security principal, and
  rechecks identity, base ancestry, and reserved-path subset before integration.
  It captures pre-main SHA, merges with `--no-ff --no-commit`, aborts conflicts
  or red targeted checks, commits only green, and runs exact full verification on
  committed main with provenance. Unexpected red gets a non-destructive revert.
  Automatic cleanup requires clean status, green committed-main full verify, and
  reachable worker commit, then non-force removal and `branch -d`; every failure
  or incomplete disposition preserves. Destructive drop requires explicit
  operator approval, diagnostics, and a recovery ref/patch.
- **D4 — guard enforcement is unchanged in meaning.** Physical worktree paths
  are canonically contained in `workRoot` before they normalize into the existing
  logical repo-relative reservation namespace. Existing targets use realpath;
  new targets use the nearest existing ancestor. Outside-root, traversal, and
  symlink escapes are rejected, with separator/case rows for every write tool.
  Any ambiguous root relationship denies every write-capable tool before it can
  mutate; worktree mode never runs unguarded.

## Discovery

L1 in-repo spike and source inspection confirmed native worktrees at
`<main>/.claude/worktrees/agent-<id>`, branches named from that id, shared Git
metadata, commits visible from main, and hooks receiving the worktree cwd through
`payload.cwd`. It also reproduced the current defect: a worktree resolves its
checked-out `.bee/` as a separate empty store and is blocked at the intake gate.
The evidence is recorded in `CONTEXT.md:96-128`. The high-risk synthesis and
rejected alternatives are in [`approach.md`](./approach.md).

## Shape — One High-Risk Capability Slice

**Outcome:** concurrent Claude Code workers can use independent Git worktrees
without creating a second coordination store, bypassing reservations, trusting
worker-supplied integration identity, or weakening shared-checkout behavior.

| Epic | Capability / risk area | Why it exists | Current-slice cells | Proof needed |
|---|---|---|---|---|
| E1 | Trusted root resolution | CLI and hooks must agree on physical worktree versus coordination store without treating a copied marker as consent | wt-1, wt-2 | Real linked-worktree fixtures, bidirectional back-link rejection rows, non-worktree regressions, mirror parity |
| E2 | Guarded logical paths | State and reservations come from main while path normalization remains relative to the physical checkout | wt-2 | Owner/holder reservation rows for all write-tool classes; ambiguity denial before mutation |
| E3 | Attested dispatch | Native isolation needs pre-dispatch evidence plus identity, ancestry, and reserved-path-subset checks without treating same-UID metadata as authority | wt-3 | Eligibility and attestation contract checks |
| E4 | Transactional end-to-end acceptance | The enabling fix cannot prove no-commit integration, full-main verification, revert, and disposition while the pre-fix guard is running | wt-4 | Real reserved edit and commit; attestation recheck; transactional merge; exact full-main verify provenance; deterministic faults and conservative disposition |

## Current Slice

This slice is the whole feature. Entry state: current root resolution treats a
worktree's checked-out `.bee/` as live state and the swarming contract is only
aspirational. Exit state: all four epics above are implemented and the live
worktree acceptance is green in the main checkout.

### Cell index and bounded files

| Cell | Work | Dependencies | Execution checkout | Files |
|---|---|---|---|---|
| `worktree-isolation-1` | Add typed linked-worktree `resolveRoots`; make CLI store operations loudly reject `linked-invalid`; add ordinary directory/submodule/separate-git-dir controls and path-format fixtures | — | shared | `skills/bee-hive/templates/lib/state.mjs`; `.bee/bin/lib/state.mjs`; `skills/bee-hive/templates/tests/test_lib.mjs` |
| `worktree-isolation-2` | Duplicate typed resolution in the non-throwing adapter; preserve root/store split; add canonical target containment and all-write-tool denials; derive full runtime hook parity with explicit source-only exclusions; regenerate manifest | wt-1 | **shared** | Resolver/guard runtime and source mirrors, their tests, mirror inventory checker, and release manifest; exact hook parity filenames are fixed only after inventory gather |
| `worktree-isolation-3` | Specify eligibility and non-worker-supplied attestation; recheck identity, ancestry, and reserved-path subset | wt-2 | **shared** | `skills/bee-swarming/SKILL.md`; `skills/bee-executing/references/worker-details.md`; `skills/bee-hive/templates/tests/test_lib.mjs` |
| `worktree-isolation-4` | Run live native-worktree acceptance; own transactional no-commit integration, exact full-main verify provenance, revert, conservative cleanup/drop, and deterministic identity/conflict/red/BLOCKED/HANDOFF/abandon fault injection | wt-3 | **native worktree** | `skills/bee-swarming/references/swarming-reference.md`; `skills/bee-hive/templates/tests/test_lib.mjs` |

### Computed execution schedule

1. **Shared enabling sequence:** wt-1 → wt-2 → wt-3. There is no parallel shared
   wave: serial commits avoid shared-index and mixed-commit contention while the
   isolation mechanism is still being enabled.
2. **Native acceptance:** wt-4 after wt-3 caps, using the one validation-only
   single-worker exception once resolver, guard, and integration protocol exist.

No additional implementation slice is planned. Deferred Codex/manual lifecycle
and scheduler hints remain backlog scope, not hidden future cells.

## Proof Map

| Claim | Owning cell | Required proof |
|---|---|---|
| CLI resolves one store and keeps a physical work root | wt-1 | `node skills/bee-hive/templates/tests/test_lib.mjs && node scripts/test_lib_mirror.mjs` |
| Linked invalidity never becomes local coordination state | wt-1 | Positive backlink fixture; typed `WORKTREE_LINK_INVALID` from root/store CLI calls; forged/missing backlink and onboarding decoy rejection; ordinary `.git` directory/submodule/separate-git-dir controls; Windows-backslash row |
| Hook adapter exposes compatible roots without throwing or changing every hook's `ctx.root` meaning | wt-2 | Shared adapter/library typed fixture plus existing hook contract suite |
| Reservation enforcement canonically contains before logical normalization | wt-2 | Existing/new target rows; outside/`..`/symlink escape denial; owner/foreign-holder outcomes across every write tool and POSIX/Windows separator/case variants |
| Every shipped production mirror remains byte-identical | wt-2 | Runtime-derived inventory with explicit source-only exclusions and injected drift/missing/extra self-tests |
| Dispatch eligibility and identity checks are attested | wt-3 | Runtime-ineligible row; pre-dispatch attestation fields; integration identity recheck; base ancestry and reserved-path subset |
| Native worktree completes through transactional integration and disposition | wt-4 | Real reservation/edit/commit; attestation recheck; no-commit merge and targeted abort; `pwd`, pre/post main HEAD, ancestry, exact verify command+output; revert; clean/reachable non-force cleanup; deterministic identity/conflict/red/BLOCKED/HANDOFF/abandon preservation rows |
| Existing hosts are unchanged | wt-4 | Exact full repository verify after committed-main integration, with provenance |

## Test Matrix — 12 Edge Dimensions

| Dimension | High-risk probe | Mapping |
|---|---|---|
| 1. User types / actors | Main orchestrator, owning worker, and foreign holder observe the correct root and reservation outcome; worker input never authorizes branch identity | wt-2 reservation truths; wt-4 integration trace |
| 2. Input extremes | Start at worktree root and deep descendants; empty, missing, malformed, absolute, relative, trailing-whitespace, and Windows-backslash `gitdir` content | wt-1 fixture table and verify |
| 3. Timing | Shared enabling cells serialize; interruption before merge or cleanup leaves branch/worktree preserved and attributable | wt-1 → wt-2 → wt-3 schedule; wt-4 transaction/disposition acceptance |
| 4. Scale | Zero worktrees, one worktree, and a 2+-worker wave keep one store; single-worker waves do not opt in | wt-1 regressions; wt-3 threshold contract |
| 5. State transitions | DONE attests → no-commit merges → checks → commits → full-verifies → cleans; conflict/red aborts or reverts; BLOCKED/HANDOFF/abandon/drop preserve unless destructive approval includes recovery evidence | wt-4 deterministic temp-repo assertions and trace |
| 6. Environment | POSIX real worktree, relative and absolute Git metadata, hand-crafted Windows backslashes, paths with spaces, and ordinary non-worktree CI | wt-1 fixtures; full verify |
| 7. Error cascades | Linked-invalid metadata raises typed CLI failure; conflict/red verify aborts or reverts; identity mismatch and incomplete dispositions suppress cleanup | wt-1/wt-2 negative rows; wt-4 deterministic fault injection |
| 8. Authorization | Only the reservation owner may edit a held logical path; another session is denied naming the holder and expiry | wt-2 write-guard rows |
| 9. Data integrity | Coordination state comes only from main; targets are canonically contained; worker commit descends base and touches only reserved paths | wt-1 root assertions; wt-2 path assertions; wt-3/wt-4 integration |
| 10. Integration | Typed resolver copies agree; runtime production mirrors are complete; transactional merge is fully verified on committed main before cap | wt-2 contract/inventory tests; wt-4 faults and acceptance |
| 11. Compliance / audit | Attestation, conflict, preservation, HEAD/reachability, verify provenance, recovery artifact, and cleanup are recorded without pretending same-UID metadata is authority | wt-3 attestation contract; wt-4 transaction/disposition trace inspection |
| 12. Business logic | Shared enabling work is serial; qualifying ≥2-worker waves may later opt in; only post-fix wt-4 uses the single-worker validation exception | wt-3 eligibility assertions; execution schedule; wt-4 acceptance |

## Out of Scope

- Codex/manual `git worktree` lifecycle for external CLI executors.
- Worktree annotations or recommendations in `bee cells schedule`.
- Any change to reservation meaning, TTL, ownership, or overlap semantics.
- Treating onboarding files, environment variables, or worker-reported branch
  names as trust or authorization channels.
