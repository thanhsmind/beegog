---
feature: skill-sync
lane: high-risk
status: Shipped
sources: [CONTEXT.md, approach.md, plan.md]
rendered: 2026-07-11
---

# Implement Plan — skill-sync

## Review Status

Gate 1 (context) approved 2026-07-11. Gate 2 (shape) **approved** 2026-07-11. Gate 3
(execution): **pending** — this document plus the validation report are its review objects.
Re-rendered after the validating persona panel + cell review (11 + 6 findings folded).

## Goal / Success

One `onboard_bee.mjs --apply` run leaves the host repo's vendored helpers AND the global bee
skill set (`~/.claude/skills/bee-*`) consistent at the same version — manual skill copying
is dead (D1, D2). Success is observable: after apply, a recheck reports `up_to_date` with
content-hash parity across all bee skills (D5); a run from an older bee checkout refuses
with zero mutations (D3); a bee skill deleted from source disappears from the install while
non-bee skills are untouched, provably (D4).

## Current State

- `onboard_bee.mjs` (772 lines) vendors `.bee/bin` helpers, the AGENTS block, and optional
  hooks into a HOST repo. It has **zero skill awareness**; the global skill set is updated
  by hand-copy today.
- Two same-day failures motivate this feature: the global set drifted far behind the repo
  (missing `bee-evolving`, stale protocols) until hand-rsynced, and a stale 0.1.18 installed
  plugin's apply overwrote committed 0.1.19 vendored helpers (regression, fixed in 5437f82).
- Source anchoring already exists structurally: the script derives its tree from its own
  location (`HIVE_DIR`), so "the tree the running script belongs to" (D2) is how the code
  already thinks.
- Versions live as `BEE_VERSION` in `templates/lib/state.mjs`; `readBeeVersion()` already
  parses it from the source tree.

## Scope

**In:** the skill-sync stage inside `onboard_bee.mjs` (plan + apply + recheck), the
three-version preflight, `--force-downgrade`, new CLI statuses, hermetic tests, operator
docs (bee-hive SKILL.md Onboarding section, README line).

**Out (deferred/locked):** per-project skill installs (D1), non-bee global assets,
marketplace integration, retro-protection of pre-guard launchers (D3 compatibility
boundary).

## Proposed Approach

As locked in `approach.md`: extend the existing plan/apply pipeline — no second script.
Rejected alternatives (standalone sync script, version-bump-only sync, marker file, rsync
shell-out) with reasons in `approach.md`.

## Technical Design

**Flow.** `computePlan` gains a skill stage after the existing six: resolve source skills
root = `path.dirname(HIVE_DIR)`, proven by realpath identity with the script's own
`bee-hive` (panel F2 — a misplaced launcher never adopts a sibling tree); resolve target =
`os.homedir()/.claude/skills` with **no override of any kind** — tests isolate via fake
HOME/USERPROFILE (panel F5: a production override would widen D1's deletion root). Shapes:
(a) `realpath(source) === realpath(target)` (both existing) → verify-only NOOP items;
ancestor overlap → fail-closed; absent target → fresh install; (b) identity failure →
`blocked_no_source`; (c) normal → per-`bee-*` manifest comparison (sorted relative paths +
sha256 per file) emitting `sync_skill`/`remove_skill` plan items.

**Preflight (D3).** A single function resolves three versions — source (a **fallback-free**
reader; the existing `readBeeVersion()` silently defaults to `0.1.0` and would let
`--force-downgrade` override a resolution failure — advisor consult), host helpers
(`BEE_VERSION` regex over `<repo>/.bee/bin/lib/state.mjs` — the physical bytes, because
`.bee/onboarding.json` proved it can lie), installed skills (same regex over
`<target>/bee-hive/templates/lib/state.mjs`). Numeric-triple compare (git history of
BEE_VERSION is plain `x.y.z` — code-verified). `refuse iff source < host_helpers OR source
< installed_skills`. Absent-vs-corrupt (Gate-3-presented clarification of D3): an ABSENT
tree (no target, no vendored state.mjs) is a fresh install/first onboard and proceeds; only
an EXISTING tree whose version cannot be read is `unknown` = refuse, and `unknown` is never
forceable — `--force-downgrade` requires all three versions resolved numeric and a forced
apply reports `forced_downgrade: true`. In apply mode the preflight runs at
the top of `applyPlan` — code-verified clean pre-write point, with one trap the cell must
honor: the unconditional `onboarding.json` rewrite after the item loop must be unreachable
on refusal. Refusal returns `blocked_downgrade` with `versions: {source, host_helpers,
installed_skills}`, exit 1, zero mutations on either side. `--force-downgrade` bypasses the
version refusal only — never `blocked_no_source`.

**Delete fence (D4).** The mirror's deletion domain is constructed as: entries of the
TARGET dir whose names match `/^bee-/` and are directories (plus files inside those dirs
absent from the source manifest). Non-bee paths are never enumerated, so they are
structurally unreachable — the fence is the iteration domain, not a guard clause. All
walks/deletions are `lstat`-based, symlinks never followed; a symlinked skill entry (or a
symlink inside a managed dir) marks that skill **skipped with a loud `blocked_symlink`
report** — never written through, unlinked, or deleted, because a symlinked skill dir is
plausibly a developer's live checkout. Temp files inside the managed namespace get
unpredictable names. Ancestor overlap of source/target roots fails closed.

**CLI surface.** Plan mode may now return `status: blocked_downgrade | blocked_no_source`
(exit 0 — reporting is not failing) alongside `up_to_date`/`changes_needed`; apply mode
exits 1 on either blocked status. JSON gains `versions` and a one-line `reason` when
blocked, and skill items appear in `plan` like every other action.

## Affected Files

Projected from `approach.md`/`plan.md` (cells will re-project after prep):

- `skills/bee-hive/scripts/onboard_bee.mjs` — the feature.
- `skills/bee-hive/scripts/test_onboard_bee.mjs` — hermetic suite extension.
- `skills/bee-hive/SKILL.md` — Onboarding section: new statuses, one-command promise.
- `README.md` — one "how updating works" line.

## Implementation Steps

Reordered by the validating panel (F7 — destructive code never lands before isolation and
its own proof):

1. `skill-sync-0` — suite isolation retrofit (fake HOME/USERPROFILE sentinel), green
   against the CURRENT script, zero production changes.
2. `skill-sync-1` — implementation AND its safety-critical behavioral tests in the same
   cell (fence payload, zero-mutation refusal, symlink fail-closed, NOOP, fresh install);
   verify = the isolated suite. `behavior_change: true`. Depends on 0.
3. `skill-sync-2` — supplementary outcome-matrix tests (full version table incl.
   host-only/unknown branches, force asymmetry incl. `forced_downgrade: true` reporting,
   deep mirror, manifest parity, idempotency). Depends on 1.
4. `skill-sync-3` — docs (SKILL.md + README). Depends on 1 and 2 — documents behavior that
   survived the suite.

## Validation Plan

What WILL be checked (nothing has run yet):

- Full `test_onboard_bee.mjs` — isolation lands FIRST as its own cell (fake
  HOME/USERPROFILE sentinel, snapshot-asserted), because the existing cases run real
  `--apply` and would otherwise touch the developer's `~/.claude`; then safety-critical
  cases ride the implementation cell, then the matrix cell — plus `test_lib.mjs`. These are
  the recorded verify commands of the cells. Native workers only: the suite spawns child
  processes, which the codex sandbox forbids (panel F8).
- The two `approach.md` open questions are already code-verified by the advisor consult
  (apply's pre-write point incl. the post-loop onboarding.json trap; plain `x.y.z` version
  history); validating re-confirms them as part of the persona panel.
- Hermetic guarantee: every test builds its own temp source/target trees (node-native temp
  dirs; never MSYS `/tmp` strings — critical pattern 20260708); the real `~/.claude` is
  never read or written by tests.

## Risks & Mitigation

As written in `approach.md`: delete path = HIGH (structural fence + payload test);
preflight ordering and version parsing = MEDIUM (byte-identical-tree refusal test, unknown
matrix); platform paths = LOW (node-native only); regression of existing onboarding = LOW
(existing assertions preserved through the isolation retrofit, suite green).

## Security / Permissions

- **Blast surface:** writes/deletes under `~/.claude/skills` only, and only inside `bee-*`
  directory names by construction (D4 fence); host-repo writes remain the existing vendored
  set. No network, no shell-outs, no elevation.
- **Refusal-first:** the D3 preflight is the security posture — an older source cannot
  mutate anything without an explicit `--force-downgrade` (valid only when all three
  versions resolve numeric), and an unidentifiable source cannot mutate anything at all —
  `unknown`/`blocked_no_source` are never forceable.
- **Tests never touch the real home dir** — every spawned process receives a per-case fake
  HOME/USERPROFILE (no production override exists); a test that reads/writes the real
  `~/.claude` is a review-blocking finding.
- Secrets: none read, none written; the script continues to handle only bee's own files.

## Rollback Plan

- **Code rollback:** revert the feature commits (cells commit individually; `git revert` of
  `skill-sync-0..3` restores the pre-feature script and suite, cell 0's isolation retrofit
  included — no data migration exists).
- **Install-state rollback:** the global install carries no unique state (D5: it is a mirror
  of source). Any bad sync is recovered by re-running `--apply` from a known-good bee
  checkout — including recovering a wrongly deleted bee skill. The one irrecoverable case
  the design must prevent (and tests prove impossible) is deletion OUTSIDE `bee-*`; that is
  why the fence is structural, not checked.
- **Guard rollback:** `--force-downgrade` is the operator escape hatch when the guard
  blocks a legitimate rollback to an OLDER bee version — it works only when all three
  versions resolve numeric; an unidentifiable tree (`unknown`/`blocked_no_source`) is never
  forceable and must be repaired (or removed) by hand first.

## Open Questions

None outstanding — the two validating questions were code-verified by the advisor consult
(recorded above); validating re-confirms them at Gate 3.
