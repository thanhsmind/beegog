---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: standard
approved_gate2: 2026-07-19 (bypass total, audit-logged)
---

# lane-ceremony-v3 — Plan

Implements CONTEXT.md D1–D10 (fresh-eyes PASS, Gate 1 approved). Doctrine-layer rewrite of the tiny/small lane ceremony and the plan/slice contract.

## Mode Gate (mechanical)

Flags counted: **public contracts** ✓ (bee's skill doctrine is the product's public contract), **multi-domain** ✓ (planning/hive/briefing/validating/swarming skills + go-mode/routing references + AGENTS block + README + render pipeline), **existing covered behavior** ✓ (test_gate_bypass_doctrine pins Gate-2 tokens; test_agents_budget pins AGENTS byte-sync). **= 3 flags → `standard`.** No hard-gate flag: no auth/data-loss/audit-security/external-provider, and no validation removal — every gate and reality check is preserved, only reordered (D5) or re-homed (D3/D4).

Why smaller modes are insufficient: story-sized behavior across 10+ files in two doctrine layers plus tests and the render pipeline. Why not high-risk: 3 flags, no hard-gate flag, strong existing mechanical net (doctrine/budget/render/manifest tests), prose-layer-only scope locked by D10.

## Discovery — L1 (verified inventory; no separate discovery.md per decision 0009)

Precedent exists in-repo: doctrine changes ship as skill-text edits + doctrine-test updates + projection re-render + manifest regen (critical-patterns "Shipping a lib file means shipping the manifest" :514-530; learnings/20260712-skill-metadata-projection). Full old-doctrine surface scan with anchors: `reports/doctrine-inventory.md`. Load-bearing findings:

- Test pins are light: test_gate_bypass_doctrine pins only the `gate_bypass_level` + `full` tokens (and two banned phrases) per gate file; conformance and skill-render tests pin no prose. The rewrite must preserve those tokens in the rewritten gate sections.
- AGENTS.block.md is a template whose root-AGENTS.md projection must be re-rendered byte-identical (test_agents_budget) — template edit and `onboard --apply` belong to the same step.
- Render pipeline after skill edits: `render_plugin_skill_trees.mjs` + `release_manifest.mjs --write` (same cell — critical-patterns :514-530) + `onboard_bee.mjs --apply`.

## Approach

**Chosen path:** one slice, five sequential steps, innermost doctrine first — (1) bee-planning, (2) bee-hive + references, (3) chain skills (validating/briefing/swarming), (4) AGENTS template + README, (5) render + manifest + full verify. Each doctrine step is **RED-first**: extend `scripts/test_gate_bypass_doctrine.mjs` with assertions pinning the NEW invariants (they fail against the old text — recorded), then rewrite the text to GREEN. This mechanizes the new doctrine per critical-patterns :242 ("prose-only constraints get stripped; mechanize") and honors bee-writing-skills' RED→GREEN discipline (decision ff26725d) with real, permanent tests instead of throwaway scenarios.

**Rejected:** (a) a new standalone doctrine test file — would touch `commands.verify` + verify-manifest wiring for zero assertion gain over extending the existing suite; (b) one big-bang cell — un-reviewable diff, breaks one-commit-per-cell granularity; (c) machine-enforced plan freeze now — explicitly deferred (D10, backlog P53).

**Risk map:**

| Component | Risk | Proof |
|---|---|---|
| bee-planning §5/§6 restructure (D1/D3/D4/D5/D8) | MEDIUM — largest semantic change; must keep bypass tokens + phase-enum sentence | new doctrine assertions + test_gate_bypass_doctrine green + validating cold-read |
| bee-hive lane tables + fast path (D3–D7) | LOW-MED — dense restatements in 3 files must stay mutually consistent | same assertions grep all three files |
| AGENTS block byte-sync + 20 KiB budget | LOW-MED — template edit must not grow block past budget | test_agents_budget in the same step, onboard --apply re-render |
| chain skills gate-in/drift updates (D9) | LOW | assertion + validating cold-read |
| render + manifest | LOW — mechanical, direct precedent | full recorded verify chain |

**Open question for validating — RESOLVED (validation finding, 2026-07-19):** test_plugin_distribution.mjs is fixture-sandboxed (no real-repo parity check), BUT `scripts/release_manifest.mjs` hashes the **canonical `skills/` tree** ("plugin_skill" role, release_manifest.mjs:44-52), so any skill edit without a manifest regen turns `--check` — part of the shared verify chain — red until the close-out step. Exactly the critical-patterns :514-530 recurrence. Repair applied to cells lcv3-1…lcv3-4: each runs `render_plugin_skill_trees.mjs` + `release_manifest.mjs --write` in the same cell and its verify appends `release_manifest.mjs --check`; rendered trees + manifest ride each cell's single commit. Step 5 remains the idempotency + full-chain close.

## Slice outline (single slice — the whole feature)

1. **bee-planning core** — SKILL.md: §1↔§3 inverted to intake-classification-first with lane-scaled bootstrap, critical-patterns mandatory in every lane (D8); mode-gate text gets product-files-only caps (D6) + narrowed flags (D7); §5/§6 rebuilt: tiny = request + cell, no plan.md (D3); small = logged scoping synthesis + 1–3 cells, plan.md opt-in (D4); preview → reality check → merged gate → persist ordering (D5); plan frozen at Gate 2, approval stamp only, enrichment instruction removed (D1). references/planning-reference.md: plan template loses the implementation-ready mutation, gains the freeze contract; fan-out table + trace-of-shapes updated; mode-gate record homes per D3.
2. **bee-hive surfaces** — SKILL.md flag list (D7), caps (D6), lane table rows + fast-path paragraph (D3/D4/D5); references/go-mode.md line-7 paragraph + STEP lines + Gate 2 script; references/routing-and-contracts.md planning/briefing rows + working-files tree (plan.md now conditional by lane).
3. **Chain skills** — bee-validating gate-in keys off frozen approved plan + existing cells instead of `artifact_readiness` (D1/D2); bee-briefing sources = frozen plan + cells, drift rule fires on cell changes only (D9); bee-swarming worker-prompt line cites the cell (not plan.md) for tiny, next-slice return wording aligned to D2.
4. **AGENTS + README** — AGENTS.block.md template chain/lane lines + docs-tree note; `onboard --apply` re-renders root AGENTS.md byte-identical; README mode-gate table + flag list aligned.
5. **Render + close** — plugin trees re-rendered, release manifest regenerated (same cell), full recorded verify chain green.

## Test matrix (12-edge sketch, scaled to standard)

New RED-first doctrine assertions (permanent, in test_gate_bypass_doctrine.mjs): "Enrich the **same**" absent from bee-planning; freeze wording present; intake-first ordering present; product-files carve-out present in hive; narrowed flag wordings present, old wordings absent (both files + README); tiny row contains no plan.md; merged-gate-after-preview wording present; briefing drift = cells-only. Existing pins preserved: bypass tokens per gate file; banned phrases stay banned; AGENTS ≤20 KiB + byte-identical block; render idempotency; manifest --check green. Edge dimensions that bite here: **consistency across restatements** (3 hive surfaces + AGENTS + README say the same thing), **ordering** (no step edits a file a later step also edits), **budget boundary** (AGENTS block near 20 KiB), **tooling refusals** (render refuses on marker errors — assert clean render post-edit).

## Current Slice (implementation-ready additions, after Gate 2)

One slice = the whole feature, cells `lcv3-1`…`lcv3-5`, strictly sequential (each depends on the previous — three hive surfaces, the doctrine test file, and AGENTS/README must never be edited by two concurrent workers).

Bounded files per step (steps 1–4 each ALSO touch `.claude-plugin/skills/**`, `.codex-plugin/skills/**`, and the release manifest — same-cell render + `--write`, per the resolved finding above):

1. `lcv3-1`: `skills/bee-planning/SKILL.md`, `skills/bee-planning/references/planning-reference.md`, `scripts/test_gate_bypass_doctrine.mjs`
2. `lcv3-2`: `skills/bee-hive/SKILL.md`, `skills/bee-hive/references/go-mode.md`, `skills/bee-hive/references/routing-and-contracts.md`, `scripts/test_gate_bypass_doctrine.mjs`
3. `lcv3-3`: `skills/bee-validating/SKILL.md`, `skills/bee-briefing/SKILL.md`, `skills/bee-swarming/SKILL.md`, `scripts/test_gate_bypass_doctrine.mjs`
4. `lcv3-4`: `skills/bee-hive/templates/AGENTS.block.md`, `AGENTS.md`, `README.md`, `scripts/test_gate_bypass_doctrine.mjs` (+ managed-root refresh via onboard --apply)
5. `lcv3-5`: render idempotency re-check + `release_manifest.mjs --check` + full recorded verify chain (close-out; no skill edits).

## Verification

Per-step: `node scripts/test_gate_bypass_doctrine.mjs` (steps 1–3), plus `node scripts/test_agents_budget.mjs` (step 4). Close (step 5): the full recorded `commands.verify` chain, green, output recorded.
