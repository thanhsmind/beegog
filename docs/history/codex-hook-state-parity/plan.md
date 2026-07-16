---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: high-risk
---

# Plan: Codex Hook And State Parity

Mode: `high-risk` — 7 risk flags: audit/security, public contracts,
cross-platform, existing covered behavior, weak proof, multi-domain, and external
plugin/runtime integration.

Why smaller modes are insufficient: this changes active-state authority and performs
a proof-gated destructive migration between mutually exclusive plugin and project
distribution sources across Claude, Codex, POSIX, and PowerShell.

## Requirements (from CONTEXT.md)

- D1: one semantic lifecycle policy produces both runtime hook projections; every
  capability difference is explicit and tested.
- D2: one bounded handler serves Codex `SubagentStart` and `SubagentStop` without
  claiming native pre-spawn blocking.
- D3: exactly one bee skill/hook source is active per runtime installation.
- D4: every generic routing mutation supplies the selected record's pre-phase owner;
  gate writes remain separate and review owns no active routing.
- D5: review may block its approval/merge, never execution readiness.
- D6: state schema stays unchanged; default/lane mismatch and corruption fail closed.
- D7: the corrected `worktree-isolation` route remains validation-owned and has no
  delta-review dependency.
- D8: canonical and generated/runtime projections are tested through real consumers.
- D9: installed plugin package `skills/**` plus `hooks/hooks.json` is authoritative;
  project `.agents`/`.codex` are explicit fallback/development projections.
- D10: plugin-first cleanup requires enabled installed-package content to match the
  release inventory; command success is insufficient.
- D11: project cleanup removes only plain owned `bee-*` skill dirs and catalog bee
  hook entries, preserving every user entry/container and refusing unsafe targets
  before mutation.
- D12: repo-copy transition first proves the plugin inactive; neither direction may
  leave two active sources.
- D13: release inventory, one cachebuster, reinstall, and fresh-thread UAT prove the
  package actually updated.
- D14: user-root deletion requires an exact valid installer ownership ledger.

## Discovery

L1 quick verification. Official Codex plugin documentation confirms that a plugin
loads canonical skills and plugin-root lifecycle hooks, and that plugin hooks can be
loaded alongside project hooks. Repository inspection proves the package already has
canonical `skills/**` and `hooks/hooks.json`, while root `.agents/**` and
`.codex/hooks.json` are separate fallback projections. Existing installers do not
perform exclusive source arbitration, do not inventory the complete package, and
have weaker global-copy deletion guards than onboarding.

## Approach

See [approach.md](approach.md). The sequence is state authority → honest Codex event
adapter → package/inventory and two-way source arbitration → installed-package and
fresh-thread proof.

## Shape

Feature outcome: Codex loads the released bee package instead of stale project copies,
hooks and skills never run from duplicate sources, and review cannot poison active
routing state.

| Epic | Capability / risk area | Why it exists | Current slice | Proof needed |
|------|------------------------|---------------|---------------|--------------|
| E1 | Phase-owned routing | Stops the proven review-to-state overwrite at the CLI door. | Required | Owner/refusal/default/lane/caller/review-isolation matrix. |
| E2 | Honest Codex hook parity | Adds every effective native event adapter without false denial claims. | Required | Start/stop handler fixtures, catalog differences, plugin and fallback projections. |
| E3 | Plugin package and source arbitration | Makes release/reinstall update the runtime and removes duplicate skills/hooks safely in both directions. | Required | Full package inventory, enabled/hash proof, fenced cleanup, ownership ledger, plugin-inactive fallback proof, Bash/PowerShell parity. |
| E4 | Recovery and knowledge integrity | Keeps corrected state/review ownership and proves the packaged result. | Required | Specs, release/cachebuster/reinstall evidence, fresh-thread UAT, exact full baseline. |

Slice queue: one serialized current slice contains E1–E4 because cleanup cannot be
safe until package and hook contracts exist, and package proof is meaningless while
state/review doctrine remains split. The old direct-write `.agents/.codex` cell shape
is superseded. The only known environment blocker that remains is the configured
baseline's nested-child `EPERM`.

Exit conditions:

- generic routing writes require the matching pre-state phase and mutate one selected
  record only; review has no active-state caller;
- Codex plugin hooks contain both native subagent events mapped to one bounded handler
  with no pre-spawn-block claim;
- the installed package's complete skills/hooks inventory matches the release before
  cleanup is allowed;
- plugin-first removes all and only owned project bee skill dirs and catalog bee hook
  entries; non-bee/user content survives byte-for-byte;
- repo-copy fallback refuses until the plugin is proven inactive;
- user-root cleanup refuses without exact valid ownership metadata;
- Bash and PowerShell dry-run/apply/repeat/failure cases produce equivalent outcomes;
- canonical, vendored runtime, plugin package, and explicit fallback projections pass
  their declared parity contract;
- exact targeted suites and the unchanged full verify pass in a child-capable
  environment;
- cachebuster/reinstall plus a fresh thread observes the new skills and hook topology;
- corrected `worktree-isolation` state/review routing remains unchanged.

## Test matrix

| Dimension | Probe | Expected result |
|-----------|-------|-----------------|
| User types | Review, validation, plugin-first install, repo-copy fallback. | Each actor/source owns only its record or distribution mode. |
| Input extremes | Empty summary; missing/wrong owner; zero/many bee dirs/hooks; corrupt ledger. | Refusal is zero-mutation; empty valid sets are idempotent. |
| Timing | Phase changes; plugin command exits before inventory proof; fresh thread after reinstall. | Old owner fails; cleanup waits for package proof; fresh thread sees new package. |
| Scale | Multiple lanes, skills, hook events, and runtime roots. | Only selected state/root entries change; inventory is complete, not sampled. |
| State transitions | Workflow phases and plugin↔fallback migration. | Both transitions are exclusive and reversible without a dual-source end state. |
| Environment | Claude/Codex, Bash/PowerShell, repo/user roots. | Same policy and cleanup fence; user roots additionally require ledger ownership. |
| Error cascades | Malformed hook input, failed package proof, symlink/alias, partial plugin deactivation. | Audit fails open; mutation/cleanup/arbitration fails closed before writes. |
| Authorization | Review attempts state mutation; installer encounters foreign bee-like content. | Both are denied without granting synthetic ownership. |
| Data integrity | User hooks/non-bee skills beside bee entries; repeated install. | User bytes survive; only recognized bee entries disappear; repeat is no-op. |
| Integration | Catalog→package hooks→installed package; skills→manifest→runtime; CLI caller→owner check. | Every link is exercised through a real consumer or installed-package fixture. |
| Compliance | Hook/audit data and installer ownership ledger. | Bounded allowlisted metadata only; no secrets or arbitrary transcript content. |
| Business logic | Review P1s and validation evidence disagree; plugin unavailable. | Execution follows validation only; explicit repo-copy fallback remains usable after plugin inactive proof. |

## Out of scope

- Native Codex pre-spawn denial until the platform exposes a blocking event.
- Directly rewriting source-checkout `.agents/**` or `.codex/hooks.json` as a plugin
  update mechanism.
- Deleting whole `.claude`, `.agents`, or `.codex` directories, foreign skills, user
  hook entries, files, or symlink targets.
- Weakening baseline tests to accommodate this sandbox's `EPERM`.
- Publishing/pushing a public release without separate external-release authority;
  this slice makes the package release-ready and proves local reinstall behavior.
- Merging or approving `worktree-isolation` without its own green proof.

## Current slice

**Slice:** State authority, honest Codex hooks, and exclusive plugin distribution.

**Entry state:** D1–D14 are locked; state/review recovery is correct; generic routing
is still authority-free; Codex lacks paired native-subagent audit; plugin payloads
exist but installers neither prove installed-package integrity nor arbitrate plugin
versus project copies. The old direct-write projection shape is superseded. The exact
baseline remains red under nested-child `EPERM` in this environment.

**Exit state:** three serialized cells enforce state ownership, ship paired Codex
plugin hooks, and install exactly one proven bee source with fenced two-way migration,
complete release inventory, cachebuster/reinstall procedure, current specs, and a
green unchanged full baseline.

**Bounded files:** exact paths are frozen in `codex-hook-state-parity-1..3`.
Source-checkout `.agents/**` and `.codex/hooks.json` are not plugin-first write targets.
Existing dirty hunks in tests, routing, docs, and projections are preserved.

**Verification:** cell 1 runs state CLI/library/mirror tests; cell 2 runs hook and
mirror contracts; cell 3 runs onboarding, distribution migration, all existing
repository suites, release checks, and the new verify-manifest-protected full command.

## Cells

- `codex-hook-state-parity-1` — enforce pre-phase ownership and remove review's
  generic active-state caller.
- `codex-hook-state-parity-2` — project honest Codex plugin subagent hooks; depends
  on cell 1.
- `codex-hook-state-parity-3` — install one authoritative bee source and prove
  package release/readiness; depends on cell 2.
