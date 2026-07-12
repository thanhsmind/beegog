---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: high-risk
---

# Plan: Codex Runtime Parity

Mode: `high-risk` — 7 risk flags: audit/security, external system/runtime,
public contracts, cross-platform, existing covered behavior, weak live proof,
and multi-domain.

This is the least workflow that protects the work: it changes a write/privacy
guard, destructive global migration, public skill/plugin contracts, and two
runtimes at once. A standard lane cannot honestly cover those hard-gate and
cross-platform risks.

## Requirements From CONTEXT.md

- **D1** — distribute Codex plugin-first with shared skills and compatible
  hooks; keep a tested repo fallback and activate exactly one bee hook source.
- **D2** — provide every compatible lifecycle outcome without weakening shared
  helper enforcement; unsupported paths fail open visibly and are tested.
- **D3** — nested Codex executors/reviewers use workspace-write and normal
  approvals; no blanket bypass, and broader authority is separately approved.
- **D4** — use the current clean-context/continuation collaboration contract;
  do not ship unselectable Codex profiles.

## Discovery

L3 findings and evidence labels are in [discovery.md](discovery.md). The selected
path reuses the existing root marketplace/plugin and helper logic, then adapts
only runtime catalogs, payload/output contracts, migration, and dispatch.

## Approach

The chosen architecture, rejected alternatives, risk map, file groups, and
validating questions are in [approach.md](approach.md).

## Shape

**Feature outcome:** a fresh Codex thread receives the current bee skills and
Claude-equivalent compatible lifecycle help from one trusted plugin source; a
fallback install behaves the same without coexisting with the plugin; native
and CLI workers start isolated and scoped, and every unsupported edge is named
rather than implied safe.

**Repo-reality basis:** Codex already discovers the shared marketplace/plugin,
while all observed failures sit at version, adapter, migration, state, or
dispatch boundaries. The implementation therefore evolves the current assets
instead of creating a parallel Codex stack.

| Epic | Capability / risk area | Why it exists | Slices | Proof needed |
|---|---|---|---|---|
| E1 | Executable runtime contracts | Current wrappers crash on malformed input, allow Codex patches, and emit invalid/ignored output | Safety foundation | RED fixtures, patch matrix, JSON event outputs, valid state transitions |
| E2 | Plugin-first distribution and migration | Codex is four releases stale and plugin/project sources are additive | Distribution and migration | Isolated install, version parity, exclusivity matrix, protected cleanup |
| E3 | Native and external dispatch safety | Current native call shape is obsolete; CLI presets bypass safety; `--last` can rescue the wrong worker | Dispatch and skills | Pressure RED/GREEN, CLI parse, clean-fork/continuation, parallel UUID resume |
| E4 | Durable guidance, UAT, and release | AGENTS/docs still describe the old runtime and plugin trust is thread-bound | Truth and rollout | Claude regression, plugin/fallback UAT, human trust/new thread, full verify and review |

### Slice queue

| Slice | Entry state | Observable exit | Depends on | Feasibility status |
|---|---|---|---|---|
| Safety foundation | D1–D4 approved; baseline green | Both runtime projections and their manifest routing land atomically; every wrapper has an executable contract; guarded feature start cannot inherit gates or orphan work | none | **Pre-Gate-3 proof required:** both catalogs load, Codex JSON is accepted, unknown intercepted patches deny, child identity behavior is known |
| Codex repo-fallback incident | Safety foundation green; the trusted project fallback is the only active Codex bee source | All nine project hook commands resolve without Claude environment variables from root or nested cwd; Stop output is silent or valid JSON; the active config is rendered from the shared catalog and reviewed by the human before live UAT | Safety foundation | Direct cause reproduced; official cwd/default-enable/trust contracts established; installed-command and deterministic-render proofs pending |
| Distribution and migration (remaining) | Repo-fallback incident green | Install/trust/version-check with fallback available; atomically select plugin; fresh-thread UAT; restore repo on failure; only PASS removes fallback, leaving one final source; legacy cleanup stays checkpointed | Codex repo-fallback incident | Deferred to the owner's other workstream; release-version, selector transition, rollback, and destructive proofs remain pending |
| Dispatch and skills | Safety foundation green | First checkpoint the RED pressure evidence; then all active guidance uses current collaboration calls, exact session rescue, and safe CLI flags; profiles remain absent | Safety foundation | Native call surface and CLI parse proved; RED run and two-session live fire pending |
| Truth and rollout | Prior slices green and reviewed | AGENTS/docs/spec match reality; plugin-only and fallback-only UAT pass; release is ready for Gate 4 | all prior slices | Human hook trust/new-thread and external release actions pending |

**Current slice:** Codex repo-fallback incident (bounded E2 subset). Safety
foundation is already capped and Gate-4 accepted. This slice fixes the live
trusted project source without installing a plugin or touching global Codex or
Claude configuration. Remaining E2 work and all E3/E4 work receive no cells in
this slice.

## Test Matrix

| Edge dimension | Required probe | Proof owner |
|---|---|---|
| 1. User/install types | plugin-only, repo-fallback-only, neither, both, untrusted hook, foreign user hooks | E2/E4 migration and UAT |
| 2. Input extremes | empty/junk/null/array/wrong `cwd`; huge/multi/Unicode patch; malformed config/manifest | E1 wrapper and patch tables |
| 3. Timing | concurrent matching sources, parallel worker rescue, compaction/stop during active work, repeated prompt event | E1/E3 live fire |
| 4. Scale | 0/1/all skills, 0/1/many hooks, multiple repositories and parallel reviewers | E2/E3 suites |
| 5. State transitions | start refused with active phase/HANDOFF/any nonterminal prior cell/worker/reservation; explicit drop before abandonment; new feature after a clean terminal feature; every valid phase/gate handoff; plugin↔fallback migration and reinstall | E1/E2 state/migration tests |
| 6. Environment | root vs nested cwd, missing git/Codex/helper, login-shell execution, Linux/Windows/case-insensitive paths, read-only config | E1/E2 platform matrix |
| 7. Error cascades | throwing import/log write, unprovable intercepted patch, failed/untrusted plugin install, missing session id/result, malformed hook output | E1–E3 fail-open/refusal/rollback tests |
| 8. Authorization | hook trust absent, on-request approval, workspace/outside writes, no PermissionRequest auto-allow, no bypass | E2/E3 security UAT |
| 9. Data integrity | preserve foreign hooks/config and user dirty files; rollback untrusted/failed plugin migration; downgrade/symlink/alias/overlap; no stale gates or orphaned workers | E1/E2 destructive matrix |
| 10. Integration | Codex 0.144.1 event/CLI schema, legacy marketplace, both manifests, Claude regression | E1/E2/E4 integration proof |
| 11. Compliance | secret-shaped reads never logged/read silently where interceptable; no transcript/history/secrets in dispatch artifacts | E1/E3 privacy/isolation proof |
| 12. Business logic | exactly one active Codex bee source, D1–D4 coverage, valid state vocabulary, four status outcomes | All epics; final review census |

The current incident slice maps environment (root/nested cwd and missing Claude
variables), error cascades (module-not-found and malformed Stop output),
integration (Codex 0.144.1 hook contract), and business logic (one active Codex
bee source) directly to its cell truths and executable command harness. Remaining
rows stay in the cumulative ledger until their owning E2/E3/E4 slice becomes
current; future-slice cells are not created early. No row is accepted by prose
or string-presence alone.

## Current Slice

**Entry state:** Codex 0.144.1 has hooks enabled by default; this project is
trusted; the bee plugin is absent; `.codex/hooks.json` is the only active Codex
bee source and its two Stop commands reproduce exit `1` when
`CLAUDE_PROJECT_DIR` is unset. The official runtime contract states that hook
commands run with the session cwd and recommends git-root resolution for
repo-local commands; the inconclusive `q3-cmdsubst` spike does not override that
contract and does not establish a `features.hooks = true` prerequisite.

**Automated cell exit:** `.codex/hooks.json` is a deterministic repo-target
rendering of the shared Codex catalog. Every configured command resolves
through the git root to the current shared wrapper under the same login-shell
contract Codex uses, from root/nested cwd and a path containing spaces/Unicode,
with Claude root variables absent. Root-resolution/setup failure fails open
visibly instead of exiting `1`; wrapper denials preserve exit `2`. Non-empty
Stop stdout parses as JSON `systemMessage`, never a turn-control verdict, and
the configured PreToolUse route itself denies a gated patch.

**Gate-4 live exit:** because Codex skips changed non-managed definitions until
they are reviewed, the human opens `/hooks`, reviews/trusts the changed project
definitions, starts a fresh lifecycle event, confirms both Stop failures are
gone, and confirms the project fallback remains the sole Codex bee source. No
automation edits or bypasses persisted trust state.

**Bounded files:** `.codex/hooks.json`, `hooks/catalog.mjs`, and
`hooks/test_hook_contracts.mjs`.

**Verification:** cell 6a proves the repo-target renderer/config drift row RED
before regeneration and GREEN afterwards, while `git diff --exit-code` pins the
existing plugin-Codex and Claude projections unchanged. Cell 6b parses and runs
the active commands under `$SHELL -lc` in a temporary git fixture, records a
RED sensitivity run against the pre-6a config, and asserts the live `.bee`
state/cache/logs remain unchanged. The full hook suite and recorded repository
baseline run after each cell. A parseable plugin census must show no bee plugin
before either edit; an enabled or unknown plugin state blocks with zero edits.
The final one-source census happens in `/hooks` during Gate 4.

## Cells

- `codex-parity-6a` — add the parameterized repo-target catalog rendering,
  prove its drift row RED, regenerate the active project config, and keep both
  existing plugin projections byte-identical.
- `codex-parity-6b` — execute every installed project command under the Codex
  shell/cwd contract in an isolated fixture; depends on 6a.

## Out Of Scope

- P25 custom Codex explorer/worker/reviewer profiles.
- The P23 fanout-delegation redesign or changes to its user-owned artifacts.
- New gate semantics, a Codex status display, a new provider/model, or a repo
  permission-policy override.
- Native Windows `commandWindows` transport and non-POSIX login-shell support;
  these remain in the cross-platform Distribution slice rather than widening
  this WSL/bash incident fix.
- Silent global plugin installation, persisted hook-trust mutation or bypass,
  legacy deletion, release/tag, push, or downstream host mutation. Human review
  of the changed project definitions is an explicit Gate-4 UAT boundary.
