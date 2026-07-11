---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: small
---

# onboard-statusline — vendor the statusline pair into opted-in hosts

## Problem

The statusline scripts (`.claude/statusline-command.sh` + `.claude/statusline-usage.mjs`)
are personal-workflow files copied by hand into host projects. They drift: anphabe-gogl
carried the 2026-06-22 script (1984 B, no usage/billing segment) and lacked
`statusline-usage.mjs` entirely while beegog shipped the updated pair (2422 B + 4586 B).
Manual copy fixed it once (this session); onboarding should keep it fixed.

## Discovery (L1 — mechanism confirmed in repo)

- Vendor pattern exists: `onboard_bee.mjs` plan stage 3 byte-compares template files and
  emits `copy_helper`/`copy_lib` items (lines 1093–1107); stage 5 shows the **conditional**
  variant (`copy_repo_hook` behind `--repo-hooks`, lines 1114–1131); apply switch handles
  each action (~1293); `buildManagedVersions` hashes vendored sets, `repo_hooks`
  conditionally (1168–1184).
- Host survey (fresh, this session): of 9 anphabe projects, exactly **2** opt in to a
  project-level statusline (`statusLine.command` referencing `.claude/statusline-command.sh`):
  anphabe-gogl, company-tasks-management. The rest use the user-level statusline or none.
- Precedent: decision c9c0bb4f (statusline-usage.mjs, tiny cell, today) defines what the
  pair does; standing release flow is decision 0083835c.
- Related learning (mandatory read, applied): [20260711] skill-sync — onboarding is
  mirror/overwrite logic; the post-implementation isolated diff review must not be skipped
  → small lane's 1 correctness reviewer is retained, never waived.

## Mode gate (mechanical)

Flags counted: **1** — *existing covered behavior* (onboard_bee.mjs is under
test_onboard_bee.mjs). No auth/data/external/public-contract/cross-platform/multi-domain
flags; additive plan-action, no hard-gate flag. Core change = 1 script + 1 test file
(+2 template assets that are byte-copies of existing files, +release version bumps per
standing flow). → **small** (not tiny: >2 files and mirror logic deserving its reviewer;
not standard: one flag, one direct task following an in-file pattern).

## Approach

**Chosen: opt-in sync (Option B).** During plan computation, when the host's
`.claude/settings.json` parses AND its `statusLine.command` string contains
`.claude/statusline-command.sh`, byte-compare each of the pair against
`skills/bee-hive/templates/statusline/<name>`; missing/drifted → plan item
`{ action: "copy_statusline", path: ".claude/<name>" }`. Apply writes via
`writeFileAtomic`. Never mutates settings.json; never creates the files on a host that
did not opt in.

- Source of truth moves to `skills/bee-hive/templates/statusline/{statusline-command.sh,
  statusline-usage.mjs}` (ships with the plugin). beegog's own `.claude/` pair becomes a
  vendored copy synced by self-onboard (beegog opts in, so stage runs there too).
- `buildManagedVersions` gains a conditional `statusline` hash set (mirroring the
  `repo_hooks` conditional) so drift shows in `.bee/onboarding.json` only for opted-in
  hosts; non-opted hosts see zero manifest change (their `up_to_date` is untouched).
- Drift guard: extend the standing vendor byte-equality test so
  `templates/statusline/*` must be byte-identical to beegog's `.claude/` siblings
  (same class as the templates↔.bee/bin sweep — a one-sided edit must go red).

**Rejected:**
- *Unconditional vendor* — imposes a personal statusline on 7 hosts that never asked;
  would also mutate their settings.json (out of bee's lane).
- *New CLI flag (`--statusline`)* — adds a knob nobody needs; the settings entry IS the
  opt-in signal, already present exactly where the files land.
- *Keep manual copy* — the drift already happened once; the ask is to mechanize.

**Risk map:** onboard plan/apply stage — LOW (follows copy_repo_hook shape, additive
action type; unknown action strings are ignored by old vendored helpers, and hosts run
the source script anyway). Managed-manifest change — MEDIUM (a wrong conditional would
flip every host to "changes_needed" or hide drift): proof = sandbox tests for opted-in
and non-opted hosts both directions. Host-local statusline edits get overwritten —
accepted by design (same contract as every vendored helper; source of truth is beegog).

## Test matrix (edge dimensions, lane-scaled)

- opted-in host, files missing → 2 copy_statusline items; apply writes both; recheck up_to_date
- opted-in host, one file drifted → exactly 1 item
- non-opted host (no settings.json / no statusLine / statusLine pointing at user-level
  path) → 0 items, manifest without `statusline` key, up_to_date preserved
- settings.json present but unparseable → treated as non-opted (fail-safe, no throw)
- statusLine.command of unexpected shape (object/missing/non-string) → non-opted, no throw
- idempotence: second apply → up_to_date, zero items

## Files (bounded)

1. `skills/bee-hive/scripts/onboard_bee.mjs` — plan stage + apply case + manifest
2. `skills/bee-hive/scripts/test_onboard_bee.mjs` — sandbox cases above
3. `skills/bee-hive/templates/statusline/statusline-command.sh` (copy of beegog/.claude)
4. `skills/bee-hive/templates/statusline/statusline-usage.mjs` (copy of beegog/.claude)
5. `skills/bee-hive/templates/tests/test_lib.mjs` — byte-equality sweep extension

Verify: `node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/scripts/test_onboard_bee.mjs`

## Post-merge (standing decision 0083835c — not cells)

Release flow: bump BEE_VERSION + plugin.json → self-onboard --apply --repo-hooks →
verify green → commit `release: bee 0.1.22` → tag v0.1.22 → push --tags → onboard
anphabe hosts except anphabe-crm.
