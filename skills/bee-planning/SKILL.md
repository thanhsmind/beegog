---
name: bee-planning
description: >-
  Research the work, pick the smallest honest mode, and shape an executable plan. Use when exploring has locked CONTEXT.md, or a clear-scope task needs a mode decision and work shape before validation.
metadata:
  version: '0.1'
  ecosystem: bee
  dependencies: []
---

# planning

If `.bee/onboarding.json` is missing or stale, stop and invoke `bee-hive`.

Planning is the waggle dance: it turns locked `CONTEXT.md` decisions into the smallest believable path to execution — mode, approach, one unified `plan.md`, and (only after approval) current-slice cells.

Load `references/planning-reference.md` for artifact templates and cell quality rules; `references/edge-dimensions.md` for the test matrix.

## Hard Gates

- `CONTEXT.md` is the source of truth. Locked decisions are cited (`per D2`), never reinterpreted, never scope-reduced.
- **Stop at Gate 2.** No cell creation, no prep artifacts before the shape is approved.
- Cells for the **current slice only**. Future-slice cells are prohibited.
- Handoff only to `bee-validating`.

## 1. Bootstrap

Read, in order:

1. `docs/history/<feature>/CONTEXT.md` (or the hive scoping synthesis for surface-scope-earlier work).
2. `docs/history/learnings/critical-patterns.md` — mandatory.
3. Recent decisions: `node .bee/bin/bee_decisions.mjs active --recent 3` and a tag-matched search for this feature's area (`node .bee/bin/bee_decisions.mjs search --text <tag>`).
4. Tag-matched precedent in `docs/history/learnings/` (grep for the feature's domain keywords). Inject hits as "we've solved X before: <file>" — precedent beats research.
5. Session scout: `node .bee/bin/bee_status.mjs --json`.

## 2. Discovery (research levels)

Pick the lowest level that removes real uncertainty:

- **L0 — skip:** pattern already exists in repo or learnings; cite it.
- **L1 — quick verify:** confirm one API/version/behavior with a command or doc check.
- **L2 — standard:** compare 2–3 candidate approaches; note trade-offs.
- **L3 — deep dive:** unfamiliar territory, external systems, or hard-gate flags.

At L2+, frame candidates through **three layers of knowledge**: tried-and-true (what the repo/ecosystem already trusts), new-and-popular (current mainstream, verify version claims), first-principles (what the problem actually requires). Recommend from evidence, not novelty.

## 3. Mode Gate (mechanical)

Count risk flags — do not vibe it:

> auth · authorization · data model · audit/security · external systems · public contracts · cross-platform · existing covered behavior · weak proof around the area · multi-domain

- **0–1 flags** → `tiny` (≤2 files, one direct task) or `small` (≤3 files, no gray areas)
- **2–3 flags** or story-sized behavior → `standard`
- **4+ flags or any hard-gate flag** (auth, authorization, data loss, audit/security, external provider, validation removal) → `high-risk`
- One yes/no proof decides whether the plan is real → `spike` (regardless of flags)

Record the count and the flags in `plan.md`. Above `small`, state why smaller modes are insufficient. Use the least workflow that honestly protects the work.

## 4. Synthesis — approach.md

Write `docs/history/<feature>/approach.md`: chosen path and rejected alternatives, risk map (component / LOW–MEDIUM–HIGH / proof needed), likely files and order, relevant learnings, and open questions for validating. MEDIUM/HIGH unknowns need a validating proof or a spike before execution cells exist.

## 5. Shape — plan.md (STOP at Gate 2)

Write **one** `docs/history/<feature>/plan.md` with frontmatter:

```yaml
artifact_contract: bee-plan/v1
artifact_readiness: requirements-only
mode: tiny | small | standard | high-risk | spike
```

Body scaled to mode: direct note, spike question, small plan, phase plan, or epic map (templates in `references/planning-reference.md`). Sketch the test matrix against the 12 edge dimensions at a depth matching the lane.

Present **Gate 2**: "Work shape is ready. Approve before current-work preparation?" — then **stop**. No pseudo-cells in markdown, no prep, no cells.

## 6. Prep (after Gate 2 approval only)

1. Enrich the **same** `plan.md` in place to `artifact_readiness: implementation-ready`: current slice selected, files bounded, verification commands named.
2. Create cells for the current slice only:
   ```bash
   node .bee/bin/bee_cells.mjs add --file <cell.json>
   ```
   Every cell is an executable prompt: `files`, `read_first`, directive `action` citing D-IDs, `must_haves` (truths / artifacts / key_links / prohibitions), a runnable `verify` command, and `behavior_change: true` whenever the cell changes observable behavior. Cell quality rules and a schema example live in `references/planning-reference.md`.
3. Update `.bee/state.json`: `phase: planning-complete`, `next_action: "Invoke bee-validating."`

## Scope-Reduction Prohibition

If the shape cannot fit the budget or context, **never** quietly shrink a locked decision or drop a must-have. Answer `SPLIT RECOMMENDED`: propose slice boundaries, each slice honoring every locked decision it touches, and let the user choose. Cheaper alternatives found in research are *noted* alongside the honored decision — swapping them in requires the user superseding the D-ID.

## Headless

With `mode:headless`: run bootstrap, discovery, mode gate, and synthesis without questions. Write `plan.md` as `requirements-only` and stop — Gate 2 is never self-approved. Ambiguities (mode borderline, conflicting decisions, missing CONTEXT.md sections) go to an `Outstanding Questions` section of the structured terminal report.

## Red Flags

- skipping critical-patterns, active decisions, or `CONTEXT.md`
- skipping the mode gate, or choosing a mode without counting flags
- defaulting to phases without proving the work needs them
- cells or prep artifacts before Gate 2 approval
- future-slice cells · pseudo-cells in markdown
- vague exit states, missing deps, or a `verify` that cannot run
- silently swapping a locked decision for a "better" research finding
- shrinking scope instead of answering SPLIT RECOMMENDED

Violating the letter of the rules is violating the spirit of the rules.

Plan shaped and current-slice cells prepared. Invoke bee-validating skill.
