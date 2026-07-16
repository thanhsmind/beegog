---
artifact_contract: bee-implement-plan/v1
feature: codex-hook-state-parity
lane: high-risk
status: Approved
updated: 2026-07-16
sources: [CONTEXT.md, approach.md, plan.md]
decisions: [D1, D2, D3, D4, D5, D6, D7, D8, D9, D10, D11, D12, D13, D14]
---

# Implementation Plan: Codex Hook And State Parity

> Human-layer projection of the truth artifacts. Truth lives in CONTEXT.md,
> plan.md + cells, and validating evidence. Feedback flows back to those sources.

## 1. Goal

Make Codex load the released bee plugin instead of stale project copies, keep skills
and hooks on exactly one active source, and prevent independent review from changing
active feature routing.

**Success looks like**

- Generic routing writes prove their current phase owner; review owns no routing
  state (D4–D7).
- Codex receives honest start/stop audit without unsupported pre-spawn claims
  (D1–D3, D8).
- Release/reinstall updates canonical skills and plugin hooks directly (D9, D13).
- Plugin↔repo-copy transitions remove only proven bee duplicates and never user
  content (D10–D12, D14).

## 2. Current State

The plugin package already contains canonical `skills/**` and `hooks/hooks.json`.
Project `.agents/**` and `.codex/hooks.json` are separate fallback projections, not
plugin release outputs. Generic `state set` is authority-free; Codex lacks paired
native-subagent audit; installers do not enforce exclusive plugin/project ownership,
complete installed-package integrity, or provenance-gated global cleanup.

The concrete `worktree-isolation` state and review wording are already corrected.
Direct project-projection writability is no longer a plugin-delivery prerequisite.
The remaining known environment blocker is nested-child `EPERM` in the configured
full baseline.

## 3. Scope

**In scope**

- Pre-phase ownership for generic default/lane routing mutation and review isolation.
- Shared Codex `SubagentStart`/`SubagentStop` audit from one semantic catalog.
- Plugin package as the authoritative runtime skills/hooks source.
- Mutually exclusive plugin-first and repo-copy modes.
- Enabled installed-package status plus complete inventory/hash proof before cleanup.
- Fenced project skill and recognized bee-hook cleanup; user-root ownership ledger.
- POSIX/PowerShell parity, release inventory, one cachebuster, reinstall, and
  fresh-thread acceptance.

**Out of scope**

- Native Codex pre-spawn denial.
- Rewriting source-checkout `.agents/**` or `.codex/hooks.json` as plugin delivery.
- Deleting runtime directories, foreign skills, user hooks, files, or symlink targets.
- Weakening baseline tests for this sandbox.
- Publishing/pushing a public release without separate external-release authority.

## 4. Proposed Approach

Close state authority first, add the honest Codex event adapter second, then build
exclusive distribution arbitration. Plugin-first verifies installed package status
and complete release inventory before removing owned duplicate skills and catalog bee
hooks. Repo-copy verifies the plugin inactive before vendoring. User-root cleanup
requires the installer ledger. Release readiness is proven with package inventory,
one cachebuster, reinstall, and fresh-thread observation.

**Alternatives rejected** — copying Claude's model guard into Codex; persisting a
state owner; granting review an owner; direct project-projection overwrite; cleanup
based only on basename or command success; dual plugin/project hooks; deleting the
repo-copy fallback.

## 5. Technical Design

### State mutation

```text
workflow caller
  -> state set --owner <selected record pre-phase>
  -> strict default/lane read
  -> owner + existing transition checks
  -> atomic selected-record write

independent review -> reviews record -> review session only
```

No owner is stored. A phase change changes the owner required by the next mutation.
Missing/mismatched owner or corrupt state refuses before write.

### Hook delivery

```text
semantic catalog
  -> hooks/hooks.json (Codex plugin)
  -> hooks/claude-hooks.json (Claude plugin)
  -> explicit project fallback projections
  -> runtime event -> shared bounded handler
```

One new handler distinguishes start from stop and emits only allowlisted audit/
bootstrap data. It is post-start advisory, never spawn authorization.

### Exclusive distribution migration

```text
plugin-first:
  install/update -> enabled + full inventory/hash proof
  -> zero-mutation cleanup preflight
  -> remove owned bee skill dirs + recognized bee hook entries
  -> fresh-thread UAT

repo-copy fallback:
  disable/uninstall plugin -> prove inactive
  -> vendor managed project skills/hooks
```

Project cleanup is restricted to exact skill roots and recognized bee entries.
Container configuration files and user hook entries remain. Any symlink, alias,
unknown target, or failed proof aborts the whole cleanup. User-home roots require a
valid ownership ledger naming the exact root and directories.

**Security / permissions**

- Active-state writes and destructive cleanup fail closed with zero mutation.
- Hook audit fails open and is not authority.
- Package integrity is derived from the release inventory, not project fallbacks.
- No arbitrary prompt, transcript, secret, or foreign runtime content enters audit or
  ownership metadata.

## 6. Affected Files

| Action | Component | Purpose |
|--------|-----------|---------|
| Modify | State CLI/templates, registry, callers, runtime mirrors, tests | Add pre-phase authority and remove review's state caller. |
| Modify/Create | Hook catalog, new Codex handler, plugin/fallback projections, tests | Add honest paired native-subagent audit. |
| Modify/Create | Plugin validation, release inventory, installer cleanup/ledger helper | Prove package and fence destructive migration. |
| Modify | Bash and PowerShell installers plus migration tests | Enforce exclusive two-way source transitions. |
| Modify | Install/runtime docs and current specs | Describe package authority, fallback, cleanup, and proof. |

Root `.agents/**` and `.codex/hooks.json` remain fallback test surfaces, not direct
plugin-first output targets. The three cell records are the authoritative file lists.

## 7. Implementation Steps

- [ ] Enforce phase-owned routing and review isolation
  (`codex-hook-state-parity-1`).
- [ ] Add honest Codex plugin start/stop hook parity
  (`codex-hook-state-parity-2`, depends on cell 1).
- [ ] Implement package inventory, proof-gated cleanup, ownership ledger, two-way
  source arbitration, release readiness, knowledge sync, and full proof
  (`codex-hook-state-parity-3`, depends on cell 2).

## 8. Validation Plan

- Missing/wrong owner preserves state bytes; matching owner works for default/lane;
  old owner fails after phase change; review writes preserve active state.
- Both Codex events map to one bounded handler with explicit runtime differences.
- Installed plugin must be enabled and complete skills/hooks hashes must match release
  inventory; failed proof preserves every fallback byte.
- Plugin-first removes only owned plain bee skill directories and recognized bee hook
  entries; user hooks, foreign skills, files, aliases, symlinks, and container files
  survive or trigger zero-mutation refusal.
- Repo-copy refuses until plugin inactivity is proven; user-root cleanup refuses on
  absent/corrupt/mismatched ledger.
- Bash and PowerShell dry-run/apply/repeat/failure outcomes match.
- One cachebuster/reinstall followed by a fresh thread observes the new skills and
  hook topology; fallback checks do not substitute.
- The exact configured repository verify must pass in a child-process-capable
  environment.

Cell commands:

- Cell 1: `node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/templates/tests/test_bee_cli.mjs && node scripts/test_lib_mirror.mjs && git diff --check`
- Cell 2: `node hooks/test_hook_contracts.mjs && node hooks/test_model_guard.mjs && node scripts/test_lib_mirror.mjs && git diff --check`
- Cell 3: the configured full verify with `test_plugin_distribution.mjs` added and
  guarded by `test_verify_manifest.mjs`.

**Evidence** — the prior [validation report](reports/validation-current.md) is
superseded for direct-projection writability and remains evidence only for baseline
`EPERM`. A refreshed report is pending.

## 9. Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Missed state caller | High | Caller census and zero-write owner matrix. |
| False Codex enforcement | High | Structural capability/event assertions. |
| Stale installed package | High | Enabled status plus complete release inventory/hash proof. |
| Dual plugin/project source | High | Exclusive two-way arbitration and postconditions. |
| Destructive cleanup | High | Exact roots, catalog matcher, ownership ledger, symlink/alias refusal, whole-plan preflight. |
| Bash/PowerShell drift | High | Shared helper where possible and parity tests. |
| Full baseline unavailable | High | Execution remains closed until the unchanged command is green. |

## 10. Rollback Plan

Revert implementation cells in reverse order. Before reverting distribution code,
restore exactly one known-good source: reinstall the prior verified plugin package or
prove it inactive and restore repo-copy from the prior release inventory. Never roll
back into a dual-source state. Regenerate fallback projections from the restored
catalog, not by hand.

State JSON needs no migration rollback because no owner field is introduced. The
corrected `worktree-isolation` route and review decision are truth repairs and remain.
Cleanup must retain sufficient inventory/backup metadata to restore only removed bee
entries without overwriting user hooks or foreign skills.

## 11. Open Questions

No product decisions remain. Validation must prove installed-package discovery and
inventory, shared Bash/PowerShell cleanup semantics, complete state caller coverage,
stable bounded Codex event data, and a green unchanged full baseline.
