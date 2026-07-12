---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: small
---

# Plan — grill-deltas (P20 + P21)

**Feature slug:** grill-deltas
**Date:** 2026-07-11
**Backlog rows:** P20 (materiality test), P21 (CONTEXT.md glossary)
**Source of truth:** `docs/history/research/grill-for-unknowns.md` (standalone xia brief, 2026-07-11) + backlog CoS. No CONTEXT.md — scope arrived clear from the research brief; no product gray areas (both stories prescribe the exact edit).

## Discovery

L0 — the research brief already did the comparison work (upstream skill read, local coverage mapped, both gaps verified as genuinely missing by checking template/exploring/scribing). Cited, not re-run. Precedent: decision 0020 shipped P9–P11 into the same insertion point (exploring step 4) as prose-only branches — this follows that exact pattern.

## Mode Gate

Flags counted: **0** (no auth, no data model, no external systems, no public contracts, no covered-behavior risk — prose edits to two skills and one template). 3 files > tiny's 2-file cap → **small**. Not docs lane: `skills/*/SKILL.md` are bee's runtime — they change agent behavior.

## Approach

Chosen path (rung: adapt-upstream, per the brief's Inference section — the only two deltas worth taking):

1. **P20** — in `skills/bee-exploring/SKILL.md` step 4 (Socratic Locking), add the three-part materiality filter every candidate question must pass before being asked: **material** (the answer changes scope, architecture, UX, data model, or acceptance), **grounded** (cites scout evidence or concrete uncertainty, not generic preference), **answerable** (the user can choose an option, approve a default, or supply a reference). A question failing the test is not asked — it becomes a labeled assumption or moves to planning.
2. **P21** — add a `## Terms` section to `references/context-template.md` (optional section, removed when unused); add one pin rule to exploring (when Socratic locking settles the meaning of a fuzzy domain word, pin it in Terms the same turn); add one inheritance line to `skills/bee-scribing/SKILL.md`'s input table (CONTEXT.md Terms seed the spec's Data Dictionary).
3. Re-sync the installed copies (`~/.claude/skills/bee-*`) — verified identical to repo source today, so a plain copy of the changed files preserves that invariant.

Rejected: installing the upstream skill (pipeline duplicate, gate bypass — brief's risk section); importing the four-quadrant taxonomy as a named step (ceremony; bee routes each quadrant to a mechanism already).

Risk map: all LOW — prose in three files, no machinery, no config, test suite doesn't cover skill prose so the proof surface is grep-markers + repo↔installed diff + suite still green.

## Slice & Cells (current slice = whole feature)

- `grill-deltas-1` (P20): exploring SKILL.md materiality filter + installed sync.
- `grill-deltas-2` (P21): context-template Terms section + exploring pin rule + scribing inheritance line + installed sync. Depends on cell 1 (same file touched).

## Verification

Per cell: grep the new markers in repo source, `diff -q` repo vs installed copy, then `node skills/bee-hive/templates/tests/test_lib.mjs` green. Baseline run this session: PASS, 0 failures.

## Edge dimensions (small-lane depth)

Relevant ones only: **idempotency** (re-running install.sh recopies — safe); **compat** (existing CONTEXT.md files without Terms stay valid — section is optional-remove-if-unused, matching template convention); **docs drift** (scribing line and template must name the section identically — key_link in cell 2).

## Reality check (small fast path)

- MODE FIT: 3 prose files, 0 flags → small. PASS.
- REPO FIT: insertion points verified — exploring step 4 already hosts P9/P11 branches (`SKILL.md:52-56`); template has optional-section convention (`context-template.md:3`); scribing input table row at `SKILL.md:43` is the inheritance point. PASS.
- ASSUMPTIONS: installed skills mirror repo — verified (`diff -q` clean today); suite doesn't gate prose — verified (tests cover helpers/onboard only). PASS.
- SMALLER PATH: tiny fails on file count; dropping the scribing line would leave inheritance unstated (P21's CoS names it). Small is honest. PASS.
- PROOF SURFACE: markers + diff + suite, all runnable. PASS.

## Gate record

Merged Gate 2+3 presented under gate-bypass (small lane): recommended approval auto-recorded per bypass policy — "Work shape + execution: add materiality test to exploring and Terms glossary to context-template/scribing, verified by marker-grep + repo↔installed diff + green suite."
