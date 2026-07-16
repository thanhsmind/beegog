# Validation: worktree isolation

Date: 2026-07-15  
Mode: high-risk  
Verdict: **NOT READY — review blockers require delta re-review, and the fresh baseline cannot run in this sandbox**

## Reality gate

| Check | Result | Evidence |
|---|---|---|
| MODE FIT | PASS | Cross-platform Git metadata, fail-open/fail-closed hooks, shared coordination state, and native-worktree integration require the high-risk lane. |
| REPO FIT | PASS | Both resolver copies, adapter context, write guard, mirror checker, swarming contract, and worker contract exist at the paths owned by wt-1 through wt-4. |
| ASSUMPTIONS | PASS | Every blocking implementation assumption is represented in the matrix below and mapped to a cell proof. |
| SMALLER PATH | PASS | A resolver-only change would leave hooks, reservations, integration identity, and native acceptance unproved. |
| PROOF SURFACE | FAIL (environment) | Direct non-nested checks run, but this managed sandbox returns `EPERM` for nested `spawnSync`, so the repository's mandatory baseline and hook fixtures cannot produce admissible fresh results. |

Decision: hold execution. The plan re-review found blocking defects in scheduling,
invalid-link fallback, trust modeling, containment, integration/cleanup, and proof
ownership. The planning documents and prepared cells now encode the accepted
repairs. Execution remains held until delta re-review is green and the unchanged
full baseline runs green in an environment that permits child processes.

## Feasibility matrix

| Assumption | Risk | Proof required | Evidence | Result |
|---|---|---|---|---|
| Linked-shaped invalid metadata cannot fork the store | High | Typed `WORKTREE_LINK_INVALID` from library/CLI store operations; non-throwing adapter transport; ordinary directory/submodule/separate-git-dir controls | Repaired D2 and synchronized cell; re-review pending | DELTA RE-REVIEW |
| Canonical target containment precedes logical reservation normalization | High | Existing-target realpath; new-target nearest ancestor; outside/`..`/symlink denials; Windows separator/case rows for every write tool | Repaired D4 and synchronized cell; re-review pending | DELTA RE-REVIEW |
| Runtime mirrors cannot drift | High | Launcher/import-derived production inventory, explicit source-only exclusions, missing/extra/byte-different cases | Repaired plan and synchronized cell; re-review pending | DELTA RE-REVIEW |
| Integration does not pretend same-UID metadata is authority | High | Independent pre-dispatch attestation; runtime eligibility; identity/ancestry/reserved-path-subset rechecks | Repaired D3 and synchronized wt-3; re-review pending | DELTA RE-REVIEW |
| Integration and cleanup preserve recoverability | High | `--no-ff --no-commit`, targeted abort, committed-main full verify, revert on unexpected red, clean/reachable/full-green non-force cleanup only | Repaired D3 and synchronized wt-4 fault rows; re-review pending | DELTA RE-REVIEW |
| A real isolated edit has attributable full-main proof | High | Native wt-4 acceptance after serialized wt-1 → wt-2 → wt-3; `pwd`, pre/post main HEAD, ancestry, command+output | Repaired schedule/proof ownership and synchronized wt-4; re-review pending | DELTA RE-REVIEW |
| Current checkout is green before implementation | Critical | Full recorded `commands.verify` output | Full command and child-heavy constituents fail before assertions with sandbox `spawnSync ... EPERM`; direct authoritative onboarding is `up_to_date`, `test_lib.mjs` reached 321/0 when run directly, mirror check and release-manifest check are green | BLOCKED BY ENVIRONMENT |

## Structural review

Earlier adversarial passes found and repaired:

- stale `BEE_ROOT` and onboarding-based trust;
- reversed `ctx.root` semantics and missing ambiguity transport;
- worktree self-enablement in the pre-fix wave;
- worker-reported branch authority;
- pair-only rather than full hook-tree parity;
- stale wt-3/wt-4 file ownership and token-only verification;
- the missing validation-only single-worker exception; and
- an underspecified worktree-id-to-branch derivation path.

The subsequent independent plan re-review found new blockers: shared-checkout
parallelism, unsafe invalid-link fallback, an overstated same-UID trust model,
non-canonical reservation paths, destructive cleanup/drop gaps, missing
transactional rollback, incomplete fault injection, and no sole owner for exact
full-main verify provenance. CONTEXT, approach, plan, implementation brief, and
this report and the prepared cells now describe the accepted repair. The delta
still requires independent re-review. Earlier green drift checks do not validate
this new delta.

## Cell review

| Cell | Checkout | Dependencies | Proof |
|---|---|---|---|
| wt-1 | shared | — | Resolver fixtures + library mirror parity |
| wt-2 | shared | wt-1 | Non-throwing adapter + canonical containment + runtime-derived hook parity + manifest |
| wt-3 | shared | wt-2 | Eligibility, attestation, identity, ancestry, and reserved-path-subset checks |
| wt-4 | native linked worktree (validation-only exception) | wt-3 | Transactional no-commit integration, exact full-main verify provenance, revert, conservative cleanup/drop, deterministic faults, and real reserved edit/commit |

Open critical planning finding: synchronized repairs await delta re-review.  
Open environment blocker: fresh full baseline unavailable in the current sandbox.

## Approval block

Execution approval is intentionally pending. Total gate bypass does not turn an
unavailable baseline or an unre-reviewed planning delta into green evidence. Work
may proceed only after the delta re-review is green and the unchanged repository
verify command plus final cold-pickup check
run green in a child-process-capable environment.
