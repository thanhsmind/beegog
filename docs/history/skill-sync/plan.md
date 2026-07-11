---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: high-risk
---

# skill-sync — plan

## Goal

`onboard_bee.mjs --apply` leaves vendored helpers AND the global bee skill set consistent at
the same version in one run (D1–D5, CONTEXT.md) — manual skill copying dies.

## Mode gate

Risk flags: **cross-platform** (script runs on Windows Git Bash / WSL / Linux; home-dir and
path semantics differ) + **existing covered behavior** (onboarding apply pipeline has a
dedicated suite) = 2 flags → standard territory. **Hard-gate flag present: data loss** — the
mirror semantics (D4) delete files inside the user's global `~/.claude/skills`, where non-bee
skills live and may exist nowhere else. Any hard-gate flag → **high-risk** lane. Smaller
modes are insufficient by rule, and honestly so: the one thing that must never happen (a
fence bug deleting a user's non-bee skills) is exactly what the full validating/review
ceremony exists to prove impossible.

## Discovery: L1

Verified in-session by reading the script: plan/apply split (`computePlan`/`applyPlan`),
source anchoring via `HIVE_DIR` (D2's rule is structural), `readBeeVersion()` regex,
`sha256`/atomic-write utilities, statuses `up_to_date`/`changes_needed`. No candidate
comparison needed — design fixed by D1–D5. Details and rejected alternatives: `approach.md`.

## Approach

See `docs/history/skill-sync/approach.md` (high-risk fan-out, post-panel revision): source
resolution anchored by realpath identity, target fixed to `os.homedir()/.claude/skills` with
**no override** (tests isolate via per-case fake HOME/USERPROFILE), three-version preflight
before any write, manifest-hash skill drift items, structural lstat-only bee-* fence with
per-skill `blocked_symlink` skip, CLI statuses `blocked_downgrade`/`blocked_no_source` +
`--force-downgrade` (resolved-versions-only, reports `forced_downgrade: true`).

## Slices

Single slice — the feature is one coherent script change; splitting sync from guard would
ship either an unguarded sync or a guard with nothing to guard.

Cells (restructured by the validating panel, F7 — isolation first, proof rides the
destructive cell):

0. **skill-sync-0** — suite isolation retrofit (per-case fake HOME/USERPROFILE), green
   against the CURRENT script, zero production changes.
1. **skill-sync-1** — implementation in `onboard_bee.mjs` (resolution incl. realpath
   identity anchor, preflight, plan items, mirror with lstat-only fence + blocked_symlink
   skip, flag, statuses) AND its safety-critical behavioral tests in the same cell (fence
   payload, zero-mutation refusal, nested + top-level symlink fail-closed, ancestor-overlap
   refusal, NOOP, fresh install). `behavior_change: true`. Depends on 0.
2. **skill-sync-2** — supplementary outcome-matrix tests in `test_onboard_bee.mjs` (the
   isolation seam comes from cell 0; safety-critical cases already live in cell 1): full
   version table incl. host-only/skills-only/source-unknown branches, force asymmetry with
   `forced_downgrade: true` asserted, deep mirror, manifest parity, idempotency. Depends
   on 1.
3. **skill-sync-3** — docs: bee-hive SKILL.md Onboarding section (new statuses + the
   one-command promise), README "How updating works" line. Kept as a cell for traceability
   in a high-risk feature. Depends on 1 and 2 — documents behavior that survived the suite.

## Test matrix (12 edge dimensions, lane depth: full)

- **Empty/missing**: no `~/.claude/skills` at all (first install) → full sync, no refusal;
  missing `bee-hive` in source → `blocked_no_source`.
- **Boundary**: skill dir with nested subdirs (references/, scripts/, templates/); file
  removed deep inside a kept skill (D5 file-level mirror).
- **Duplicates/conflict**: source == target (installed-copy run) → verify-only NOOP.
- **Ordering**: refusal fires before ANY write (helpers untouched too).
- **Permissions/IO**: unreadable installed state.mjs → version `unknown` → refuse.
- **Format**: unparsable BEE_VERSION → `unknown` → refuse.
- **Version skew**: source older / equal-version-different-bytes (drift, D5) / newer.
- **Platform**: path building via `path.join`/`os.homedir()` only; no shell copies.
- **Destructive**: non-bee sibling dir byte-identical after a sync that deletes a bee skill.
- **Idempotency**: second apply → `up_to_date`, zero plan items.
- **Force path**: `--force-downgrade` proceeds and reports it did.
- **Fail-closed**: unresolvable source aborts whole apply, exit 1, zero mutations.

## Out of scope

Per-project skill installs (D1), non-bee assets, marketplace/plugin-manager integration,
retro-protecting pre-guard launchers (D3 boundary).
