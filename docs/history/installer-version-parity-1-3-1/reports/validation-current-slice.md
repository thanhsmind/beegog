# Validation: Installer Version Parity 1.3.1 — Current Slice

## Reality gate

- **Mode: high-risk** — PASS. Cross-platform installers, destructive package transitions, project cleanup, and release publication carry external-system, data-loss, public-contract, and weak-proof risk.
- **Repo fit** — PASS. The current split is reproduced directly: canonical runtime and both package manifests are `1.3.0`, while `.agents` and `.claude` project projections are `0.1.43`.
- **Assumptions** — PASS WITH CONSTRAINTS. Bash and the Node suites run locally; real PowerShell and Git metadata writes are unavailable here and remain explicit later release blockers.
- **Smaller path** — PASS. Checking only manifests/status would preserve the reproduced false green; wrapper E2E and exact cleanup ownership are required.
- **Proof surface** — PASS. Cell 1 and cell 2 use existing executable suites; cell 3 creates its named E2E driver and runs it through Node. The computed schedule is three acyclic waves with no unsatisfied dependency or empty file scope.

Decision: proceed with the three-cell local slice. Do not represent it as Windows-proven or release-ready.

## Feasibility matrix

| Assumption | Risk | Proof required | Evidence | Result |
|---|---|---|---|---|
| A strict source tuple can be read before mutation | High | current markers and mixed/missing fixture refusal | canonical state plus both package manifests exist; cell 1 names them exactly | READY |
| Greenfield absence is distinct from a broken source | High | positive empty target + negative source marker cases | D1/cell 1 now enumerate source vs target surfaces | READY |
| Project cleanup can preserve `bee-custom` | High | derive candidates from validated `plugin_skill` inventory | cell 2 owns helper + transaction suite and names the inventory | READY |
| Plugin ordering can be tested without real homes | High | PATH-isolated fake CLIs, call classes, deny sentinels, rollback state | cell 3 enumerates environment, call log, target digest, and rollback postconditions | READY |
| Bash wrapper can execute locally | Medium | parser and child-process execution | `bash -n scripts/install.sh` passes; prior configured baseline completed green | READY |
| PowerShell behavior is proven | High | real Windows execution result | no `pwsh`/`powershell` available in this environment | NOT IN CURRENT SLICE; blocks release |
| Commit/tag/push is possible | High | writable Git metadata and remote evidence | `.git` reports read-only here | NOT IN CURRENT SLICE; blocks release |

## Adversarial plan check

Iteration 1 found four structural blockers: Windows could be falsely capped, source/target absence was ambiguous, broad live projection writes could copy unfinished work, and fixture state could bypass plugin ordering. Security review also found prefix-only project cleanup could delete `bee-custom`.

Repairs split the work into strict tuple, exact cleanup ownership, and Bash transaction E2E; moved live projection refresh plus PowerShell evidence to the release-isolated future slice; named fake CLI ordering/rollback proof; and derived cleanup ownership from the validated release inventory.

Iteration 2: coherence reported no findings. Feasibility reported READY WITH CONSTRAINTS, retaining only the future Windows release condition.

## Cold-pickup review

The initial wrapper cell was rejected for scope overload, ambiguous rollback, incomplete matrix, and Linux-only proof of PowerShell claims. After splitting and repair, the final reviewer reported **0 CRITICAL and 0 MINOR** findings across the current three-cell shape.

## Approval block

VALIDATION COMPLETE — CURRENT SLICE

- Reality gate: PASS
- Feasibility: READY WITH CONSTRAINTS
- Structure: PASS after 2 iterations
- Cells: 3, computed as 3 sequential waves
- Cell review: PASS, 0 CRITICAL open
- Constraint: these cells cannot complete the feature or release; real Windows execution, selective release isolation, writable Git metadata, immutable review, tag, and push remain mandatory.
