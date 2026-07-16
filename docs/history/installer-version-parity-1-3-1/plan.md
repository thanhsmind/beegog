---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: high-risk
---

# Plan: Installer Version Parity 1.3.1

Mode: `high-risk` — 6 risk flags: external systems, public contracts, cross-platform, existing covered behavior, weak proof around the installer wrappers, multi-domain.

Why this is the least workflow that protects the work: the change controls destructive distribution transitions, cross-platform bootstrap, and publication of a mixed dirty tree.

## Requirements

- D1: fail closed unless all authoritative and discoverable version surfaces agree.
- D2: execute both wrappers through new-project and upgrade paths and verify complete postconditions.
- D3: self-onboarding a canonical source refreshes its discoverable project projections.
- D4: release only completed Codex work; exclude unfinished wait/worktree work.
- D5: require real Linux and Windows entrypoint evidence.
- D6: publish an immutable reviewed 1.3.1 commit/tag from `main`.
- D7: preserve project-owned prefix-matching skills unless release ownership is proven.
- D8: prohibit plugin mutation before confirmation and prove ordering through isolated fake CLIs.

## Discovery

L1 local proof found a concrete split: canonical runtime/plugin markers are 1.3.0 while both source-repo project projections are 0.1.43. The self-onboard branch deliberately skips those targets, and current release/status tests omit them. Both wrappers verify only `installed: true`; PowerShell sparse checkout also omits the required release inventory.

## Shape

Feature outcome: re-running either supported installer can upgrade a new or existing project to one coherent 1.3.1 installation and prove that outcome before publication.

| Epic | Capability / risk area | Why it exists | Slices | Proof needed |
|---|---|---|---|---|
| E1 | Version identity and self-onboard | eliminate the reproduced stale-projection false green | strict tuple + projection refresh | zero-mutation negative; stale-to-current repeat |
| E2 | Cross-platform wrapper proof | helper tests do not prove top-level behavior | Bash and PowerShell E2E | greenfield, brownfield, failure, idempotency |
| E3 | Release isolation and publication | dirty `main` mixes complete and open work | selective ownership + 1.3.1 release | immutable diff review, full verify, Windows green, tag/push |

## Test matrix

| Dimension | Probe |
|---|---|
| User types | non-interactive `yes` path and prompt-safe refusal without a console |
| Input extremes | missing target, empty target, paths with spaces/Unicode, malformed/missing version marker |
| Timing | abort between plugin transition and onboarding; snapshot revalidation catches drift |
| Scale | zero, one, and full managed skill inventories use derived lists rather than hardcoded counts |
| State transitions | fresh → repo-copy; old repo-copy → current repo-copy; repo-copy ↔ plugin-first; repeat current → no-op |
| Environment | Linux Bash; Windows PowerShell 5.1/7; no real HOME leakage; missing CLI and offline source fail loudly |
| Error cascades | failed package proof/onboarding leaves target and foreign content unchanged |
| Authorization | global cleanup requires exact ownership ledger; project cleanup requires release-set ownership, never prefix alone |
| Data integrity | owner AGENTS/CLAUDE content, state, decisions, cells, foreign hooks/skills survive upgrade |
| Integration | package list shape drift and mixed client/source versions refuse |
| Compliance | fixture state contains no secrets and no real user-home writes |
| Business logic | version equal/older/newer/unknown cases; exact 1.3.1 postcondition and second-run current |

## Out of scope

- Implementing open wait-loop/worktree-isolation cells.
- Claiming Windows or remote publication success without fresh external evidence.

## Current slice

Entry state: canonical/runtime manifests are 1.3.0, discoverable project skills are 0.1.43, wrapper tests are indirect, and PowerShell's remote payload is incomplete.

Exit state: release identity fails closed in fixture-backed onboarding, Bash executes the complete fixture matrix locally, and the same PowerShell matrix is wired without being misreported as executed. The live source projections are refreshed only after the completed release source is isolated, so unfinished canonical content cannot leak into them.

Bounded files and verification commands are authoritative in the three cells below.

## Cells

- `installer-version-parity-1-3-1-1` — strict tuple and self-onboard projection parity.
- `installer-version-parity-1-3-1-2` — exact managed-release ownership for project cleanup.
- `installer-version-parity-1-3-1-3` — Bash wrapper transaction and E2E proof.

## Future slice queue

- Release isolation proof (D4): construct an immutable source containing only completed Codex work plus these capped fixes; audit every shared-file hunk.
- Windows implementation and acceptance (D2, D5, D8): apply the proven transaction contract to `install.ps1`, fix sparse bootstrap, run the PowerShell E2E job on real Windows, and record the run URL/result; failure or unavailability blocks publication.
- Release publication (D6): bump 1.3.1, regenerate live projections and release inventory from the isolated source, require complete tuple/tree parity, run full verify, review, commit/tag/push.
