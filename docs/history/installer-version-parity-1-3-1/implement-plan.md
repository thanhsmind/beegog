---
artifact_contract: bee-implement-plan/v1
feature: installer-version-parity-1-3-1
lane: high-risk
status: Approved
updated: 2026-07-16
sources: [CONTEXT.md, approach.md, plan.md, reports/validation-current-slice.md]
decisions: [D1, D2, D3, D4, D5, D6, D7, D8]
---

# Implementation Plan: Installer Version Parity 1.3.1

## 1. Goal

Both supported installers upgrade new and existing projects to one coherent bee release, prove complete onboarding, and publish only the completed Codex update as 1.3.1.

**Success looks like**
- Every runtime/package/project projection reports 1.3.1 after apply and the repeat is current (D1–D3).
- The reviewed release excludes unfinished wait-loop and worktree-isolation work (D4).
- Linux and Windows entry points both execute successfully before release (D5–D6).

## 2. Current State

The source runtime and package manifests report 1.3.0, but project-local skills discovered by Codex and Claude report 0.1.43. Source self-onboarding skips those targets, installer success checks accept only an installed flag, and no automated test executes either wrapper end to end.

## 3. Scope

**In scope**
- Strict release tuple and full projection parity (D1, D3).
- Greenfield/brownfield entrypoint proof for Bash and PowerShell (D2, D5).
- Selective completed-Codex release 1.3.1 (D4, D6).

**Out of scope**
- Open wait-loop/worktree-isolation implementation.

## 4. Proposed Approach

Make release identity a shared precondition, refresh every discoverable source-repo projection, strengthen wrapper postconditions, then isolate/review/publish the completed 1.3.1 scope.

## 5. Technical Design

```text
installer source -> strict release identity -> distribution preflight -> onboarding apply
                 -> full projection/status recheck -> success or loud refusal
```

The onboarding transaction derives all managed capability copies from one canonical release and verifies their live fingerprints. Plugin-first and repository-copy remain mutually exclusive; project cleanup requires release-set ownership rather than a name prefix. Planning and preview do not mutate runtime plugins, and the wrapper ordering is tested through isolated fake CLIs with call logs.

**Security / Permissions** — global or user-root cleanup remains forbidden without an exact ownership ledger. Fixtures use isolated homes and never operate on the real user configuration.

## 6. Affected Files

| Action | File / component | Purpose |
|---|---|---|
| Modify | `skills/bee-hive/scripts/onboard_bee.mjs` and its tests | strict tuple plus self-projection refresh |
| Modify | shared distribution helper | exact project cleanup ownership |
| Modify | `scripts/install.sh` | mutation-free preview, rollback, and strict postconditions |
| Create | `scripts/test_installers_e2e.mjs` | execute the Bash wrapper in isolated fixtures |
| Modify | verify/release-tuple configuration | keep the proof in the mandatory release gate |

## 7. Implementation Steps

- [ ] Make release identity and self-onboard projection parity fail closed (`installer-version-parity-1-3-1-1`).
- [ ] Fence project cleanup to the managed release set (`installer-version-parity-1-3-1-2`, after cell 1).
- [ ] Prove the Bash installer transaction end to end (`installer-version-parity-1-3-1-3`, after cells 1–2).
- [ ] In the next slice, implement and execute the equivalent PowerShell path on real Windows.
- [ ] After this slice is reviewed, prepare the selective 1.3.1 release slice.

## 8. Validation Plan

The current slice will run mixed/missing tuple refusal, fixture self-projection upgrade, exact managed cleanup ownership, and the complete Bash wrapper matrix including ordering and rollback. Validation found the three cells executable with no structural findings after repair. Real Windows PowerShell execution and Git publication remain later release blockers; they are not claimed by this slice. Evidence: `reports/validation-current-slice.md`.

## 9. Risks & Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| Partial install reports success | High | strict preflight and full postcondition equality |
| Stale source projections survive | High | explicit refresh plus recursive parity test |
| Unfinished work ships | High | cell ownership map and immutable diff review |
| Platform-only regression | High | real Bash and Windows PowerShell execution |

## 10. Rollback Plan

Do not move the `v1.3.1` tag until all evidence is green. Before publication, revert the bounded cell commits. After publication, revert the release commit on `main`, publish a corrected patch version rather than moving the existing tag, and retain failed-install zero-mutation behavior.

## 11. Open Questions

- A writable Git metadata environment and real Windows PowerShell runner must be available before publication can be called complete.
