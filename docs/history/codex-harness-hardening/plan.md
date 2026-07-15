---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: standard
feature: codex-harness-hardening
slice: 1a — Foundational guards (split from Slice 1; 1b = the downgrade fix, high-risk, planned next)
note: Slice 1 overall is high-risk; 1a ALONE is standard (additive integrity guards, no hard-gate flag — the audit/security flag belongs to 1b's runtime downgrade rewrite). Flags for 1a: public-contracts + cross-platform + multi-domain = 3, no hard-gate → standard.
context_source: docs/history/codex-harness-hardening/SPEC.md
decisions: ed0b2920 (§15 locked), 49f032fe (verify self-guard), fe6593c0 (downgrade fix targets .bee/bin/lib copy path)
---

# Slice 1 — Release manifest + source classifier

## Mode gate (mechanical)

Flags: **audit/security** (silent-downgrade prevention = integrity safety — HARD-GATE) · **public-contracts**
(release manifest, release-tuple, status JSON shape) · **existing-covered-behavior** (rewrites
`onboard_bee.mjs` source resolution + `bee.mjs` drift) · **cross-platform** (POSIX mode in manifest,
Windows) · **multi-domain** (manifest + classifier + status + onboarding + preflight) = **5 flags incl. a
hard-gate flag → high-risk.** Gate bypass does not apply. Smaller modes rejected: it changes a
safety mechanism across multiple modules — nowhere near tiny/small/standard.

## Discovery (L1 — verified against repo, recon 2026-07-15)

- **E-03 hole located exactly:** `computePlan()` step 3 "vendored helpers + lib"
  (`onboard_bee.mjs:1645-1651`) pushes `copy_lib` items by **pure byte-diff** against the running
  launcher's own `templates/lib/`, with **no version gate**; apply (`:1977-1981`) `writeFileAtomic`s
  unconditionally. `self_skip` (`:868-881`) gates only `computeSkillSyncTarget`, **not** `computePlan`
  — confirmed by grep. So a stale 0.1.43 launcher silently downgrades `.bee/bin/lib/state.mjs`.
- **False-green located:** `bee.mjs:295` — `drift = onboardingRaw.bee_version !== BEE_VERSION`, a
  compare of a *recorded* `onboarding.json` field against the local constant; it never re-reads or
  re-hashes actual `.bee/bin/lib` bytes and never calls onboard_bee's detectors. A `copy_lib`
  downgrade leaves this `false`.
- **Version primitives exist:** `readVersionStrict` (`:310`), `compareVersions` (`:349`),
  `computeSkillSyncTarget` (`:625-778`, already emits `blocked_downgrade` for the skill-sync path).
  The fix reuses these on the copy_lib path.
- **No standing guards to build on:** no release-tuple equality check (only throwaway per-release
  greps), and **no standing `templates/lib/` ↔ `.bee/bin/lib/` byte-identity mirror test** (only
  ad-hoc `cmp -s` in individual cell verifies). Both are foundations this slice must add.
- **Shared-module home:** `skills/bee-hive/templates/lib/*.mjs` (source, imported by both `bee.mjs`
  and `onboard_bee.mjs` via `TEMPLATES_LIB_DIR`) mirrored to `.bee/bin/lib/*.mjs` (runtime). A new
  shared classifier goes in both + a mirror check.

## SPLIT RECOMMENDED (Scope-Reduction Prohibition)

Slice 1 bundles four deliverables across a hard-gate surface; that is too much for one honest
high-risk cell wave. Proposed boundaries — each honors every locked decision it touches:

### Slice 1a — Foundational guards (additive, no onboarding-logic change yet)
- **Release manifest schema** — a generator/reader producing a tree-level manifest: per-file relative
  path, SHA-256, POSIX mode, role (DIST-01/DIST-03/D-03).
- **Strict release-tuple guard** — a standing test/module asserting `BEE_VERSION` == both
  `plugin.json` versions == runtime == projections (DIST-05); replaces throwaway per-release greps.
  Joins `commands.verify`.
- **Standing mirror test** — assert `templates/lib/*.mjs` byte-identical to `.bee/bin/lib/*.mjs`
  (PROJ-08 direction). Joins `commands.verify`. Needed *before* 1b adds a shared module.
- Risk: MEDIUM (additive checks; no behavior change to onboarding). Flips no freeze yet.

### Slice 1b — The downgrade fix (behavior change; flips the Slice 0 freeze green)
- **Shared source classifier** — pure module (`source_checkout`/`project_projection`/`plugin_package`/
  `legacy_global`/`unknown`) in `templates/lib/` + mirror, imported by BOTH `bee.mjs` status and
  `onboard_bee.mjs` (SRC-01..06/DIST-04/D-04).
- **Downgrade/unknown zero-mutation preflight on the copy_lib path** — gate `computePlan` step 3 with
  a version check reusing `compareVersions`; refuse a source older than the target `.bee/bin/lib`,
  zero-mutation (VER-01..06 + decision fe6593c0).
- **Status drift via the shared detector** — `bee.mjs` drift re-reads real component versions through
  the classifier so a `copy_lib` downgrade can no longer read `drift:false` (DIST-04).
- Exit: `test_split_brain_regression.mjs` flips exit 3 → exit 0 and JOINS `commands.verify`; status &
  plan can no longer contradict about identity/drift.
- Risk: HIGH (hard-gate; rewrites source resolution + drift). Full persona-panel validation.

**Why split here:** 1a is additive scaffolding that de-risks 1b (a mirror test must exist before a
shared module is added; the release-tuple guard is independent). 1b is the single behavior-changing
fix, provable by one exit criterion (the freeze flips green). Doing them together mixes additive
guards with a hard-gate rewrite in one wave — harder to validate and to review.

## Approach (if approved as split — 1a first)

Slice 1a is the current slice. Likely files: new `templates/lib/release-manifest.mjs` (+ mirror),
new `scripts/test_release_tuple.mjs`, new `scripts/test_lib_mirror.mjs`, both appended to
`commands.verify` (create-if-missing config already proven editable, Slice 0). Order: manifest reader
→ tuple guard → mirror guard. No change to `onboard_bee.mjs`/`bee.mjs` logic in 1a.

## Risk map (1a)

| Component | Risk | Proof needed (validating) |
|---|---|---|
| Release manifest schema | MEDIUM | manifest reproducibly hashes the real tree; mode captured on POSIX |
| Release-tuple guard | LOW-MED | fails when a version is desynced (negative proof); green now |
| Mirror byte-identity test | MED | derives file set via readdirSync (no hand-list, crit-pattern 20260714); fails on an injected diff |

## Open questions for validating (1a)

1. Manifest scope: whole release tree vs just `lib/` + plugin manifests + version files? (Start with
   the release-identity-critical set; expand in later slices.)
2. Does the mirror test belong as a standalone suite or folded into `test_verify_manifest`/`test_lib`?
3. Windows: assert POSIX mode on POSIX only; on Windows assert invocation contract (TEST-10).

## Cells

None yet — Gate 2 (and the split decision) must be approved first. If the split is approved, cells are
created for **1a only**; 1b returns to planning as its own high-risk slice.
