# Validation: Codex Hook And State Parity — Plugin-First Shape

**Date:** 2026-07-16  
**Mode:** high-risk  
**Decision:** `READY — EXECUTABLE PROOF SURFACE GREEN`  
**Reason:** the plugin-first design fits the repository, installed-plugin status is
observable, and the unchanged configured baseline now executes completely in the
managed Codex environment through the contract-preserving test transport shipped by
`codex-sandbox-baseline`.

## Reality Gate Report

```text
REALITY GATE REPORT
Mode: high-risk
Current work: one authoritative bee plugin, integrity-gated cleanup, and state/hook parity
MODE FIT: PASS       — installer cleanup, state authority, hooks, and cross-runtime release are high-risk
REPO FIT: PASS       — canonical skills/hooks/plugin manifests/installers are writable and already own the delivery model
ASSUMPTIONS: PASS    — CLI status, marketplace root, package cache, and cleanup boundaries were directly inspected
SMALLER PATH: PASS   — three serialized cells isolate state, hooks, then distribution without direct projection edits
PROOF SURFACE: PASS  — unchanged full verify exits 0 with all functional, mirror, manifest, and doctrine checks green
Decision: approve execution under the configured total bypass
```

## Evidence

### Plugin package and status surface

The official Codex plugin contract permits a plugin-root `skills/` directory and
default `hooks/hooks.json`. The marketplace entry points at the plugin package; root
`.agents/**` and `.codex/hooks.json` are not required as the installed plugin's source.

Observed CLI capabilities:

```text
codex plugin list --json
  -> pluginId, name, marketplaceName, version, installed, enabled, source

codex plugin marketplace list --json
  -> marketplace name and resolved marketplace root
```

The local installation also has a concrete versioned package cache:

```text
/home/thanhsmind/.codex/plugins/cache/
  <marketplace>/<plugin>/<version>/
```

The CLI does not include that package path in `plugin list --json`. Consequently the
installer must not treat command success as content proof. It must combine:

1. CLI evidence that the exact plugin id/version is installed and enabled;
2. a single, realpath-safe versioned package root owned by the configured installer;
3. a complete skills/hooks inventory match against the release inventory.

Only after all three checks pass may project-root legacy bee projections be removed.
An absent, ambiguous, aliased, symlinked, incomplete, or disabled package is a
zero-mutation refusal.

### Cleanup and reverse-transition feasibility

Existing onboarding code already has guarded `bee-*` directory deletion and
merge-preserving hook writers. The distribution cell will centralize these in one
Node helper used by Bash and PowerShell installers, rather than duplicating weaker
shell deletion logic.

Plugin-first cleanup is limited to:

- plain `bee-*` directories directly under project `.claude/skills`,
  `.agents/skills`, and `.codex/skills`;
- catalog-recognized bee hook entries in project `.claude/settings.json` and
  `.codex/hooks.json`;
- installer-owned user-root projections recorded in an ownership ledger.

The parent directories, unrelated skills, and unrelated hook entries are preserved.
The reverse repo-copy transition first removes/disables the installed plugin and
proves it inactive; otherwise it also refuses before mutation.

### Sandbox baseline repair and terminal proof

Minimal probe:

```sh
node -e "const {spawnSync}=require('node:child_process'); const r=spawnSync(process.execPath,['-e','console.log(123)'],{encoding:'utf8'}); console.log(JSON.stringify({status:r.status,signal:r.signal,error:r.error&&{code:r.error.code,message:r.error.message},stdout:r.stdout,stderr:r.stderr}))"
```

Observed:

```json
{"status":0,"signal":null,"error":{"code":"EPERM","message":"spawnSync /home/thanhsmind/.nvm/versions/node/v24.14.1/bin/node EPERM"},"stdout":"","stderr":""}
```

The probe identified one unavailable capability: nested Node module launches did not
execute. It did **not** justify replacing real Git, Bash, installed-Node, or Codex
integration, because those commands returned concrete status and output.

`codex-sandbox-baseline` repaired the proof surface without changing production
behavior or weakening assertions:

- nested Node test entrypoints run through `scripts/lib/run-module-worker.mjs`,
  preserving argv, environment, virtual cwd, fake home, stdin, stdout, stderr,
  exit status, and deterministic timeout behavior;
- concurrency-sensitive claim and handoff tests retain real barrier-synchronized
  Worker racers rather than serializing the behavior under test;
- external integration remains external and is graded from concrete status plus
  required output, even when the sandbox attaches auxiliary launch metadata;
- release mirrors were regenerated through the canonical manifest writer.

The unchanged configured baseline then exited 0 with 1,224 output lines: core state
tests 322/0, onboarding failures 0, hook contracts 141/141, CLI examples 132/0,
17 library mirrors byte-identical, split-brain zero-mutation proof green, 36 release
files matching the manifest, and gate-bypass doctrine green.

### State isolation

- Default `.bee/state.json` remains owned by `worktree-isolation`, at validating,
  with execution false.
- The isolated `codex-hook-state-parity` lane reached validating with context and
  shape approved; the now-green proof surface permits execution approval.
- No source cell was claimed and no source file was edited.

### Installed projection split-brain

The onboarding ledger's `drift` flag covers the vendored runtime (`.bee/bin`) and
its recorded helper/lib hashes; it does not identify or hash the project skill
projection that launched onboarding. That distinction explains the apparently
contradictory evidence:

- canonical runtime and source templates are version `1.3.0`, so canonical status
  correctly reports `drift: false`;
- project `.agents/skills/bee-hive` and `.claude/skills/bee-hive` are identical
  stale `0.1.43` projections;
- the stale `.agents` launcher anchors templates to its own directory, compares
  those old bytes with the current runtime, and therefore reports
  `changes_needed`;
- its self-skip path predates the target-independent downgrade guard, while the
  canonical source now contains that guard and a regression fixture for this exact
  split-brain scenario.

This is not corruption of the active runtime state. It is concrete evidence that
the distribution cell must make plugin/package identity authoritative and retire
stale root projections only after integrity proof; runtime-only `drift: false`
cannot authorize cleanup by itself.

## Feasibility Matrix

| Assumption | Risk | Proof required | Evidence | Result |
|------------|------|----------------|----------|--------|
| State mutation has one owner-aware atomic CLI choke point. | High | Strict selected-record read plus atomic write and caller migration. | Existing state CLI/lane primitives and tests; cell 1 names canonical and mirrored callers. | PASS |
| Installed Codex plugin status is machine-readable. | High | Exact id/version plus installed/enabled flags. | `codex plugin list --json` exposes all required status fields. | PASS |
| Marketplace/package provenance is resolvable. | High | Marketplace root plus one safe versioned package root. | Marketplace JSON exposes root; local cache layout contains the versioned installed package. | PASS WITH GUARD |
| Plugin content can replace project skill/hook projections. | High | Plugin package carries canonical `skills/` and `hooks/hooks.json`. | Official plugin contract and current repo catalog/manifest layout. | PASS |
| Legacy cleanup can preserve user content. | High | Exact direct-child allowlist, recognized hook entries, ownership ledger, zero-mutation preflight. | Existing guarded onboarding deletion and merge writers are reusable through one shared helper. | PASS |
| Repo-copy fallback cannot coexist accidentally with plugin mode. | High | Prove plugin inactive before vendoring. | CLI installed/enabled status plus remove command provide the required transition surface. | PASS |
| Exact full repository verify can prove the implementation here. | High | Configured command exits zero without assertion skips or external-command emulation. | `codex-sandbox-baseline-6` records the unchanged 1,224-line command exiting 0 after contract-preserving Worker isolation for nested Node entrypoints only. | PASS |

## Structural Status

The reshaped dependency schedule is mechanically clean and serial:

```text
codex-hook-state-parity-1  state ownership
  -> codex-hook-state-parity-2  plugin hook runtime
  -> codex-hook-state-parity-3  install, cleanup, release inventory, UAT
cycles=0, unsatisfiable_deps=0, empty_files=0
```

The prior direct-writability failure for source-checkout `.agents/**` and
`.codex/hooks.json` is retired: those are fallback/dev projections and are not direct
cell outputs. Cell 3 instead owns plugin inventory, installer transitions, and tests.

High-risk repository fit, cold-pickup shape, and the executable proof surface are now
green. Total bypass therefore auto-approves Gate 3; it does not create an independent
review session.

## Gate 3 Resolution

The fix-first baseline feature supplied the missing executable proof and passed the
unchanged configured verify command. No direct write access to root `.agents/**` or
`.codex/hooks.json` is required for plugin-first implementation; those remain
fallback/dev projections generated by the authoritative source and installer.

## Approval Block

```text
VALIDATION COMPLETE — EXECUTION AVAILABLE
Mode: high-risk
Work: authoritative plugin distribution, guarded cleanup, state and hook parity
Reality gate: PASS
Feasibility: design, repository fit, and unchanged baseline PASS
Structure: serial cells mechanically valid
Source mutations: none
Execution gate: auto-approved under total bypass
```
