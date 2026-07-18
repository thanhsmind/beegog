---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: small
---

# p49-force-downgrade-blast-radius — plan

**Source:** PBI P49 (docs/backlog.md) — "`--force-downgrade` names its blast radius before acting. The flag's confirmation does not enumerate the copy_lib/copy_helper paths it will overwrite; the operator consents to a downgrade without seeing what it touches. List the exact files in the prompt" (v1.1.0 review P2, promoted 2026-07-17).

## Discovery (L1 — code facts gathered by I/O worker, anchors verified)

- **The gap:** the refused-`--apply` payload (built at `applyPlan()` `skills/bee-hive/scripts/onboard_bee.mjs:2388-2397`, emitted at `main()` `:2839-2856`) carries `{blocked, versions, skills.targets, beeVersion}` — **no `plan` key**. `skills.targets[].items` holds only skill-dir actions; `copy_lib`/`copy_helper` items never appear. For the runtime-lib guard (`hostLibDowngradeBlock` `:933-965`) per-target items stay `[]`, so the operator sees *nothing* about which `.bee/bin/**` files a forced apply overwrites.
- Dry-run (plan mode, `main()` `:2795-2834`) already includes `plan` (`:2810`) with `copy_helper` (`:2106`) / `copy_lib` (`:2121`) items — repoRoot-relative `{action, path}`, no `scope` field.
- `--force-downgrade` (`:2703`, `applyPlan()` `:2367-2399`) applies the **whole** pre-built plan including copy_lib/copy_helper — its blast radius is broader than skills, which is exactly what P49 wants surfaced.
- **Precedent to mirror:** D2 forced-apply transparency for skills (`computeSkillSyncTarget()` `:743-896`, comments `:885-894`, `:2381-2387`), and test "10v. forced-apply transparency" (`test_onboard_bee.mjs:3260-3328`) — three-step shape: dry-run enumerates → refused apply enumerates → forced apply touches exactly the previewed set.

## Mode gate

Flags counted: **1** — existing covered behavior (onboard flow is heavily tested; `test_onboard_bee.mjs`). No auth/data-model/security/external/public-contract change — the edit is payload/presentation-only, the guard's decision logic is untouched. 2 hand-edited files. → **small**.

## Approach

Add a `host_items` array (repoRoot-relative `{action: "copy_lib"|"copy_helper", path}` items, filtered from the already-computed `plan`) to the refused-`--apply` blocked response, only when the block is forceable — mirroring the D2 skills precedent. No change to guard logic, block conditions, or the applied plan itself.

- Rejected: enumerating paths inside `blocked.reason` prose (unstructured, breaks the "typed payload" pattern).
- Rejected: rebuilding the plan at refusal time (it already exists in scope — reuse).
- Risk map: `applyPlan` refusal shape — LOW (additive field; existing tests assert fields present, not absence of others — tolerant-net pattern per critical-patterns 20260716). Test fixture drift — LOW (follow 10v's own fixture).

## Test matrix (edge dimensions, lane-scaled)

- Forceable blocked_downgrade with pending lib/helper drift → `host_items` lists exactly those repoRoot-relative paths in the refused apply.
- Non-forceable block (`unknown` version) → no force possible; `host_items` absent or empty (assert it does not invite a force).
- No lib/helper drift, skills-only block → `host_items` empty array (present but empty is acceptable and asserted).
- Forced apply → files actually touched ⊇/= the previewed `host_items` set (10v three-step shape).

## Slice (current)

One cell: implement `host_items` in the refused-apply payload + the three-step test following 10v; then self-onboard `--apply` re-syncs the two projected skill-tree copies (`.claude/skills/...`, `.agents/skills/...`) — generated, not hand-edited.

Verify: `node skills/bee-hive/scripts/test_onboard_bee.mjs`
