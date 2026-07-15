---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: standard
feature: codex-harness-hardening
slice: 0 — Freeze reality
context_source: docs/history/codex-harness-hardening/SPEC.md
decisions: ed0b2920 (§15 D-01..D-14 locked)
---

# Slice 0 — Freeze reality

## Purpose

Pin today's harness reality as **executable, observable freezes** *before* any mirror /
installer / guard logic is touched (SPEC §13.1 safe order, §14 Slice 0). Nothing in this
slice fixes a defect; it captures the current defects as red-now artifacts and adds the one
green release-gate wiring the spec already ratified (D-14 / TEST-11).

**CONTEXT source of truth:** `SPEC.md` (§15 decisions locked, decision `ed0b2920`). No separate
CONTEXT.md — Gate 1 is satisfied by the logged decision lock.

## Mode gate

Risk flags counted: **cross-platform** (census/snapshot, Windows `/tmp` fixture trap),
**weak-proof-around-area** (this slice *is* the proof scaffolding), **public-contracts**
(`commands.verify` is the release gate). = 3 flags, story-sized, multi-file → **standard**.
No hard-gate flag (no auth / data-loss / external-provider / validation-removal): this slice
adds tests, a data snapshot, a census, and one suite to `verify` — it removes nothing and
mutates no product behavior. Smaller modes rejected: >3 files and it touches the release gate,
so not `small`; it is not a single yes/no proof, so not `spike`.

Held to **human gates** regardless of the bypass switch: Slice 0 opens a high-risk program.

## Discovery (L1 — verified against repo)

- Fixture harness lives in `skills/bee-hive/scripts/test_onboard_bee.mjs`: helpers
  `makeFakeSkillsRoot({version})` (source tree), `seedRepoSkillTargets(repo, version)` (seeds
  BOTH `.claude`+`.agents` projections), `makeInstalledSkills`, `runOnboardAt(launcher,args,home)`,
  `hashTree(dir)` (full lstat digest for zero-mutation proof). These are **internal** to that
  file today. **Resolved:** the regression fixture is **self-contained** — it builds its tree by
  **recursively copying the real `skills/bee-hive` and `.bee/bin/lib` dirs** (via `readdirSync`,
  never a hand-kept file list) then patching only the version markers. This avoids both the refactor
  risk of extracting helpers out of the green suite AND the hand-kept-fixture rot of
  critical-patterns 20260714 (the rot was about hand-enumerated lib lists; whole-tree copy has none).
- Drift/status decision: `onboard_bee.mjs` `computeSkillSyncTarget` (:625-778) records
  `versions {source, host_helpers, installed_skills}` and sets `blocked_downgrade` only when a
  resolved target is **older than source** (:740-763); top-level `status` at :2247-2251. The
  vendored-helper (`copy_lib`) path that would push `0.1.43` libs over the `0.1.44` runtime is a
  **separate** plan path with no downgrade guard — that is the E-03 hole.
- `test_bee_cli.mjs` confirmed at `skills/bee-hive/templates/tests/test_bee_cli.mjs` (121 checks,
  `node`-run, `exitCode = failed>0?1:0`). Currently **green** (121/0). No mirror under `.bee/bin/`.
  No existing test asserts the content of the real repo's `commands.verify` → this slice adds the
  first frozen assertion.
- No doc-lint / syntax-census script exists anywhere. Closest structural precedent:
  `runPluginCensusRow()` in `hooks/test_hook_contracts.mjs:2152-2197` (scan → detect forbidden
  entry → pass/fail row + note). Model the stale-spawn census on that shape.

## Approach

Five deliverables, split into red-now freezes vs green wiring:

**Green (join `commands.verify`, baseline stays green):**
1. Add `node skills/bee-hive/templates/tests/test_bee_cli.mjs` to `.bee/config.json` `commands.verify`
   (D-14/TEST-11). It already passes, so the baseline stays green.
2. A **frozen assertion** test that reads this repo's real `.bee/config.json` and asserts
   `commands.verify` contains every mandatory suite **including `test_bee_cli.mjs`** — fails loudly
   if a future edit drops it. Added to `verify` too (green).

**Red-now freezes (NOT in `commands.verify` — run on-demand, observable; fold into verify only when
Slices 1–2 / Slice 5 make them green):**
3. Regression freeze `test_split_brain_regression.mjs` reproducing E-02/E-03: fixture with source/
   launcher `0.1.43`, `.bee` runtime `0.1.44`, projections `0.1.43`, ledger `drift:false`. Asserts
   the *target* behavior — status RED + `--apply` zero-mutation (`hashTree` before==after). Current
   code returns `changes_needed` and would mutate, so the fixture is RED. Its **cell verify** wraps
   it: run the fixture, require it to report the defect signature (`OBSERVED changes_needed/drift:false,
   EXPECTED blocked_downgrade + zero-mutation`) and exit nonzero — a passing wrapper proving the
   freeze observes the real defect.
4. Doc-schema census `census_stale_spawn_syntax.mjs`: greps operative skill docs for stale Codex
   spawn syntax (`spawn_agent(agent_type=`, `fork_context`, `re-spawn`). Currently flags
   `skills/bee-swarming/references/swarming-reference.md` (E-06). RED now; enforced (added to verify)
   in Slice 5 after the docs are fixed. Cell verify: census flags the known swarming-reference
   violation.

**Data (green):**
5. Capability snapshot under `docs/history/codex-harness-hardening/snapshots/`: records `codex 0.144.4`
   + the documented tool surface (outer `functions.exec`, nested `tools.exec_command`/`apply_patch`
   per E-12) and the Claude profile, each field labelled `documented` vs `live-probed`. Honest: live
   nested-event probe is L6 (needs a fresh Codex task) and is explicitly deferred, not asserted.

**Explicitly out of scope (SPEC §14):** no change to mirror logic, source resolver, installer
shell/PS, or any guard. Those are Slices 1–5.

## Risk map

| Component | Risk | Proof needed |
|---|---|---|
| Self-contained fixture (whole-tree copy, no extraction) | LOW — does not touch test_onboard_bee.mjs; risk is copy-completeness | copy via readdirSync recursive; assert fixture onboard runs (not ENOENT) before asserting the defect |
| Red-now fixture's wrapper verify | MEDIUM — a fixture that fails for the *wrong* reason is a false freeze | wrapper asserts the exact defect signature, not just nonzero exit |
| `.bee/config.json` verify edit surviving onboarding | LOW — onboarding may re-render config | confirm config.commands is repo-owned, not overwritten (validating) |
| Census over-matching (archaeology docs, this plan) | LOW-MEDIUM | census scopes to operative refs, excludes docs/history + this SPEC |

## Test matrix (sketch, scaled to standard)

- Happy: verify green with test_bee_cli added; frozen assertion passes; snapshot parses.
- Freeze-red: regression fixture red-for-right-reason; census flags swarming-reference.
- Negative/guard: frozen assertion FAILS if test_bee_cli removed from verify (prove it bites);
  census does NOT flag this SPEC or docs/history archaeology (scope fence).
- Portability: fixture uses stdin/scratchpad paths, not `/tmp` string to node (critical-pattern 20260708).

## Open questions for validating

1. ~~Extract fixture helpers vs import?~~ **RESOLVED (validating):** self-contained fixture,
   whole-tree `readdirSync` copy, and `hashTree` re-implemented **inline** in the regression file
   (`test_onboard_bee.mjs` exports nothing; do NOT extract from the green suite).
2. ~~Is `.bee/config.json` `commands` re-rendered by onboarding `--apply`?~~ **RESOLVED (validating):**
   NO — `onboard_bee.mjs:1610-1621` lists `.bee/config.json` as create-if-missing only; existing config
   is never overwritten. The frozen assertion targets the live `.bee/config.json`.
3. ~~Home for the frozen assertion?~~ **RESOLVED:** standalone `scripts/test_verify_manifest.mjs`,
   itself listed in `commands.verify`, with an internal self-test proving its checker flags a
   verify-string missing `test_bee_cli` (so the assertion demonstrably bites).
4. **Census scope fence (decide before Slice 5):** the census scans `skills/**/{SKILL.md,references/**/*.md}`
   only, and excludes `*-LOG.md` (so `skills/bee-swarming/CREATION-LOG.md` — a build log, not operative
   guidance — is out), `docs/history/**`, and the SPEC. Precedent to model on:
   `skills/bee-hive/templates/tests/test_lib.mjs:7032` ("retired phrasing" census that already excludes
   archaeology), NOT the plugin-census row.

## Cells (current slice only — created after Gate 2)

- C0-1: verify wiring + frozen assertion (green)
- C0-2: split-brain regression freeze (red-now, wrapper-verified)
- C0-3: stale-spawn-syntax census (red-now, flags swarming-reference)
- C0-4: capability snapshot (data)
