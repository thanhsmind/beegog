---
artifact_contract: bee-implement-plan/v1
feature: codex-runtime-parity
lane: high-risk
status: Slice 1 (Safety foundation) merged — Gate 4 passed 2026-07-12; slices E2–E4 pending
updated: 2026-07-12
sources: [CONTEXT.md, discovery.md, approach.md, plan.md, reports/intake-audit.md, reports/plan-review.md, reports/validation-safety-foundation.md]
decisions: [D1, D2, D3, D4]
---

# Implementation Plan: Codex Runtime Parity

> Human-layer projection of the truth artifacts. Truth lives in CONTEXT.md
> (decisions), plan.md + cells (work), and the validating report (evidence).
> Feedback on this document flows back to those artifacts, then this re-renders.

## 1. Goal

Make Codex a first-class bee runtime: one install provides the current shared
skills and every lifecycle guardrail Codex can support, while unsupported paths
remain honestly visible and helper-enforced rather than being described as safe.

**Success looks like**

- A fresh Codex thread loads the release's bee skills and ends migration with
  exactly one configured, active bee hook source (D1).
- Session context, write/privacy/reservation checks, state refresh, worker
  nudges, and close hygiene behave correctly on every compatible Codex event;
  unsupported paths are named and tested (D2).
- Every nested Codex executor keeps normal approvals and workspace-scoped write
  access, with no blanket bypass (D3).
- Native workers start without parent history, continue through the same agent,
  and external rescues resume the assigned session; no inert profile is shipped
  (D4).

## 2. Current State

Bee's shared helpers and Claude runtime are green at 0.1.22, but the Codex
manifest and installed skills remain at 0.1.18. The committed Codex project
hooks resolve through a Claude-only variable. Six lifecycle wrappers crash on
malformed payloads, Codex `apply_patch` can bypass the current wrapper, and
several Codex events reject or ignore the wrapper's plain stdout.

The existing repository marketplace already installs the root as a Codex
plugin and exposes the bundled skills. The active gaps are therefore runtime
contracts and migration safety, not plugin discovery.

## 3. Scope

**In scope**

- Plugin-first Codex distribution with a tested, mutually exclusive repo
  fallback and protected legacy-skill migration (D1).
- Separate Claude/Codex hook catalogs rendered from one logical definition,
  with shared wrappers/helpers and exact event adapters (D2).
- Codex patch guarding, malformed-input behavior, state transitions, source
  arbitration, rollback, and platform/runtime fixtures (D2).
- Safe native and external dispatch, exact-session rescue, and RED-first skill
  updates across the active clean-context call sites (D3, D4).
- Current AGENTS, install, runtime, config, contract, and release guidance.

**Out of scope**

- Custom Codex agent profiles (P25), fanout-delegation (P23), a Codex status
  display, new gate semantics, or new model/provider integration.
- Silent global install, hook trust, legacy deletion, release, push, or host
  rollout. These retain separate human approval boundaries.

## 4. Proposed Approach

Use the existing shared marketplace/plugin and business logic. Render two
runtime-specific hook catalogs, route each manifest atomically to the correct
projection, and pass an explicit source/runtime identity into one shared
adapter. The adapter normalizes hostile input, selects the correct output
format, and delegates decisions to the existing vendored helpers.

For Codex installation, keep project fallback configuration available during
plugin probation, atomically select the plugin for fresh-thread UAT, restore the
repo selector on failure, and remove fallback entries only after PASS. Update
native collaboration and external CLI contracts only after recorded pressure
tests expose their current failure modes.

**Why this approach** — it reuses the assets already proven by the green Claude
runtime and hardened mirror while making every host difference explicit.

**Alternatives considered**

- One union catalog — hides inert/wrong matchers and broadens hook firing.
- Forked Codex wrappers/plugin — duplicates logic and recreates version drift.
- Project hooks as primary — contradicts D1 and collides with enabled plugins.
- Repo-wide Codex config or custom profiles — introduces unproved/inert config.

## 5. Technical Design

```text
marketplace -> runtime manifest -> Claude/Codex catalog
            -> shared hook adapter -> host .bee helper -> context / deny / advisory

native cell -> spawn_agent(fork_turns: none) -> status result
            -> followup_task for continuation

CLI cell -> on-request approvals + workspace-write -> capture session UUID
         -> result-file acceptance -> resume that UUID only when rescue is needed
```

The Codex default `hooks/hooks.json` and the Claude manifest's explicit catalog
path switch land in one atomic safety-foundation change. Each hook invocation
carries `plugin` or `repo`; the per-repository selector makes a transient
double-config state execute only one source, while successful migration removes
the inactive fallback so the final configuration has one source.

`apply_patch` targets are normalized before the existing gate, direct-edit, and
reservation decisions run. If an intercepted patch's targets cannot be proven,
the call is denied with a correction; malformed outer hook payloads and truly
unsupported host paths remain visible fail-open gaps. PreCompact,
SubagentStop, and Stop warnings become JSON `systemMessage`, preserving
advisory behavior without continuing a child or main turn.

Feature start becomes one guarded atomic operation. It refuses unless the prior
feature is terminal and has no HANDOFF, nonterminal cells, workers, or
reservations; it never erases work as cleanup. Only then does it reset gates and
enter a valid phase.

### Security / Permissions

- Plugin hooks require the human to trust the current hash; installation never
  bypasses hook trust silently.
- External Codex commands set top-level `on-request` approval and
  `workspace-write`; no `--yolo`, `--full-auto`, danger-full-access, or
  equivalent blanket bypass is accepted.
- Ordinary onboarding does not enable/disable plugins or rewrite global Codex
  config. Global plugin and legacy-skill mutations are previewed and separately
  approved.
- Hooks remain guardrails, not a security boundary. Native reads and incomplete
  unified shell paths that Codex cannot intercept remain governed by AGENTS,
  helper checks, and explicit user privacy approval.
- Dispatch artifacts carry bounded contracts and session IDs, never parent
  transcripts or provider secrets.

## 6. Affected Files

| Action | File / component | Purpose |
|---|---|---|
| Modify | `hooks/*.mjs`, `hooks/hooks.json` | Shared adapter behavior and Codex default projection |
| Create | Claude hook projection and logical catalog/renderer under `hooks/` | Exact dual-runtime catalogs without wrapper forks |
| Modify | `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json` | Atomic hook routing plus version/publisher parity |
| Remove as active config | `.codex/hooks.json` | Eliminate the broken committed fallback; onboarding can generate an explicit fallback |
| Modify | `skills/bee-hive/templates/`, onboarding scripts and tests | Guarded state start, fallback assets, source arbitration, migration and parity proof |
| Modify | `scripts/install.sh`, `scripts/install.ps1` | Plugin-first reported install and protected legacy fallback/cleanup |
| Modify | active Codex config samples and executor/model docs | Safe approvals, sandbox and exact-session rescue |
| Modify after RED | exploring, planning, swarming, validating, and reviewing skills/references/creation logs | Current clean-context, continuation, phase and reviewer-slot contracts |
| Modify | AGENTS template/current block, README, INSTALL, runtime/contracts/config docs | Durable runtime truth and project description |
| Update after behavior settles | `docs/specs/onboarding.md` and feature reports | State-layer contract and evidence |

The exact file list is narrowed per current-slice cell after Gate 2. P23 and
`docs/history/fanout-delegation/` remain untouched.

## 7. Implementation Steps

- [ ] **Safety foundation** — checkpoint RED hook/state fixtures; land both
  catalog routes atomically; normalize all wrappers; guard intercepted patches;
  add guarded feature start.
- [ ] **Distribution and migration** — align manifest/version metadata; add
  per-repo source arbitration, plugin probation/rollback, protected legacy
  cleanup, and plugin-first installer behavior.
- [ ] **Dispatch and skills** — checkpoint five pressure scenarios, then update
  native collaboration, safe executor flags, exact-session rescue, valid phases,
  and identical GREEN evidence.
- [ ] **Truth and rollout** — reconcile AGENTS/docs/spec, run isolated plugin and
  fallback UAT, complete review, then prepare the standing tagged release.

Only Safety foundation receives cells after this Gate 2. Later-slice cells are
created only when their slice becomes current.

## 8. Validation Plan

**Automated**

- Full seven-wrapper malformed-input process table and event-output parsing.
- Patch Add/Update/Delete/Move/multi-target/path/malformed/gate/reservation
  matrix; unknown intercepted target must deny.
- Catalog generation plus allowed-difference and both-runtime load tests.
- Guarded feature-start and complete valid-phase transition tests.
- Plugin/fallback/both/neither, selector transition, rollback, foreign-hook,
  downgrade, symlink/alias/overlap, idempotency, and version-parity tests.
- Five dispatch pressure scenarios RED then identical GREEN, plus static active
  surface census.
- Existing hook suites and full project verify.

**Live / manual**

- Isolated Codex home installs the shared marketplace/plugin, sees the exact
  release and skills, and reinstalls cleanly.
- Two parallel CLI sessions are captured and resumed by different UUIDs.
- Workspace write succeeds; an outside write requires approval or is denied.
- Plugin-only fresh thread and fallback-only trusted project each fire every
  expected lifecycle outcome once.
- Human reviews/trusts the real plugin hook hash and confirms `/hooks` shows one
  final bee source.

**Evidence** — `bee-validating` complete for the Safety foundation slice
([validation-safety-foundation.md](reports/validation-safety-foundation.md)):
reality gate 5/5 PASS; session-UUID capture, exact-UUID resume, machine-readable
plugin status, and marketplace/manifest acceptance proved **live** (spikes in
`.spikes/codex-runtime-parity/`); catalog *firing* and child-payload capture
carry named constraints owned by E2/E3 (per-invocation trust override proven
insufficient — real config trust required); Windows/case-insensitive and
PowerShell rows are explicit local limitations (WSL2, case-sensitive FS, no
pwsh). Persona panel: iteration 1 FAIL → 5 blockers repaired; iteration 2 clean
(final DAG fix mechanically evidenced). Cold-pickup cell review: 11 CRITICALs
repaired, verified exit-code-honest verifies. Verdict: **READY WITH
CONSTRAINTS** (constraints listed in the report §Constraints Carried to
Execution).

## 9. Risks & Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| Wrong hook schema allows a forbidden write or breaks a turn | High | Every-wrapper process fixtures and event-specific live proof |
| Plugin and fallback execute concurrently | High | Source identity/selector arbitration, transition tests, final fallback removal |
| Migration deletes user config or legacy skills | High | Preview, backup, hardened identity/downgrade fences, cleanup only after plugin UAT |
| Feature start abandons prior work | High | Terminal/no-HANDOFF/no-cell/no-worker/no-reservation refusal |
| Rescue continues the wrong worker | High | Capture and resume exact UUID; parallel-session proof |
| Shared changes regress Claude | Medium | Atomic manifest routing plus the existing Claude catalog and full suites |
| Windows/subdirectory paths drift | Medium | PowerShell/path and case-sensitive/insensitive checks from root and nested cwd |

## 10. Rollback Plan

Every implementation cell is a separate commit and is reverted in reverse
dependency order. The catalog-path/Claude-manifest switch is one atomic commit,
so neither runtime is left pointing at the other's projection.

For plugin probation, retain the backed-up repo fallback and selector. If trust,
fresh-thread loading, version, or lifecycle UAT fails, switch the selector back
to `repo` and restore the backup before disabling/removing the candidate plugin.
Fallback entries are not removed until plugin UAT passes. Legacy skills are
backed up and never cleaned before that checkpoint; failed release UAT restores
them and reinstalls the preceding tagged plugin version. No data migration is
involved.

## 11. Open Questions

No product decision is blocking Gate 2. Before Gate 3, validating must answer:

- Which current JSON event carries the stable external session UUID?
- Can child hook payloads identify reservation ownership reliably?
- Does the exact default-Codex/explicit-Claude catalog routing load correctly
  through both manifests and the shared marketplace?
- Which Windows/case-insensitive proofs run locally, and which remain explicit
  limitations for review/UAT?
