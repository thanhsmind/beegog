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

Load `references/planning-reference.md` for artifact templates and cell quality rules; `references/edge-dimensions.md` for the test matrix. Discovery at L2/L3 runs through `bee-xia`.

## Hard Gates

- `CONTEXT.md` is the source of truth. Locked decisions are cited (`per D2`), never reinterpreted, never scope-reduced.
- **Stop at Gate 2.** No cell creation, no prep artifacts before the shape is approved.
- Cells for the **current slice only**. Future-slice cells are prohibited.
- Handoff only to `bee-validating`.

## 1. Bootstrap

Read, in order:

1. `docs/history/<feature>/CONTEXT.md` (or the hive scoping synthesis for surface-scope-earlier work).
2. `docs/history/learnings/critical-patterns.md` — mandatory.
3. Recent decisions: `node .bee/bin/bee.mjs decisions active --recent 3` and a tag-matched search for this feature's area (`node .bee/bin/bee.mjs decisions search --text <tag>`).
4. Tag-matched precedent in `docs/history/learnings/` (grep for the feature's domain keywords). Inject hits as "we've solved X before: <file>" — precedent beats research.
5. Session scout: `node .bee/bin/bee.mjs status --json`.

## 2. Discovery (research levels)

Pick the lowest level that removes real uncertainty:

- **L0 — skip:** pattern already exists in repo or learnings; cite it.
- **L1 — quick verify:** confirm one API/version/behavior with a command or doc check.
- **L2 — standard:** compare 2–3 candidate approaches; note trade-offs.
- **L3 — deep dive:** unfamiliar territory, external systems, or hard-gate flags.

At L2+, invoke `bee-xia` in-chain: local truth → local reuse → upstream patterns → version-aware docs, evidence labels on every claim, and the anti-reinvention ladder (reuse → built-in → adapt upstream → build) for the recommendation; its findings merge into the approach (see §4), never a standalone research file. §1 Bootstrap (CONTEXT, critical-patterns, decisions, learnings grep, status) delegates as an extraction-tier I/O worker per the Delegation contract (D2/D3, `bee-hive/references/routing-and-contracts.md`); other ad-hoc research dispatches during discovery (including bee-xia) default to the generation slot model; ceiling requires the [bee-tier: ceiling] marker plus a one-line justification. Frame candidates through **three layers of knowledge**: tried-and-true (what the repo/ecosystem already trusts), new-and-popular (current mainstream, verify version claims), first-principles (what the problem actually requires). Recommend from evidence, not novelty.

**Artifact fan-out (decision 0009).** Only **L2/L3** discovery earns a separate `docs/history/<feature>/discovery.md` (a real multi-candidate comparison worth reading alone). At **L0/L1**, record the finding in `plan.md`'s `## Discovery` note and cite it — do not spawn a discovery file that just restates the current state `plan.md` already carries. The full fan-out table (which artifacts become separate files, when) is in `references/planning-reference.md`.

## 3. Mode Gate (mechanical)

Count risk flags — do not vibe it:

> auth · authorization · data model · audit/security · external systems · public contracts · cross-platform · existing covered behavior · weak proof around the area · multi-domain

- **Every touched file is knowledge, not runtime** (docs/, specs, README, sample/example configs, plans) → `docs` lane: exit planning — announce one line, write it, format-check, capture per bee-hive. No plan.md, no cells, no gates.
- **0–1 flags** → `tiny` (≤2 files, one direct task) or `small` (≤3 files, no gray areas)
- **2–3 flags** or story-sized behavior → `standard`
- **4+ flags or any hard-gate flag** (auth, authorization, data loss, audit/security, external provider, validation removal) → `high-risk`
- One yes/no proof decides whether the plan is real → `spike` (regardless of flags)

Record the count and the flags in `plan.md`. Above `small`, state why smaller modes are insufficient. Use the least workflow that honestly protects the work.

**Greenfield init lane (P1, docs/09 item 6):** when the repo has no build and the init-lane offer was accepted at onboarding, the first slice is **one init cell** — `must_haves`: setup succeeds from scratch, one passing test exists, standard commands recorded in `.bee/config.json`, clean first commit — before any feature cell. Infrastructure first; the init cell's verify command is the recorded `test` command itself.

## 4. Synthesis — approach (section by default, file when earned)

Produce the approach: chosen path and rejected alternatives, risk map (component / LOW–MEDIUM–HIGH / proof needed), likely files and order, relevant learnings, and open questions for validating. MEDIUM/HIGH unknowns need a validating proof or a spike before execution cells exist.

Write it as an `## Approach` section **inside `plan.md`** by default. Graduate it to a standalone `docs/history/<feature>/approach.md` only for **high-risk** lanes or **L2+** discovery, where the rejected alternatives and risk map are substantial enough to read on their own (decision 0009 / fan-out table in the reference). Do not spawn `approach.md` for a small or standard fix whose approach is a paragraph — that just restates `plan.md`.

## 5. Shape — plan.md (STOP at Gate 2)

Write **one** `docs/history/<feature>/plan.md` with frontmatter:

```yaml
artifact_contract: bee-plan/v1
artifact_readiness: requirements-only
mode: tiny | small | standard | high-risk | spike
```

Body scaled to mode: direct note, spike question, small plan, phase plan, or epic map (templates in `references/planning-reference.md`). Sketch the test matrix against the 12 edge dimensions at a depth matching the lane.

Render `docs/history/<feature>/implement-plan.md` via `bee-briefing` only where the fan-out table calls for it (decision 0009): **high-risk** always; **standard** on-demand (default: `plan.md` + the Gate 2 chat layer are the review record — render the brief only when the user asks or the slice spans multiple domains); **small** optional mini-brief on request; **tiny**/**spike** none. When a brief is rendered, the Gate 2 message links it as the review document; when not, the Gate 2 message links `plan.md` directly. Present **Gate 2** per the Gate Presentation Contract (bee-hive routing reference): plain-language layer in chat — what I plan to build / why this size / cost if the shape is wrong / what you are deciding — in the user's language, the review document linked not pasted; then verbatim: "Work shape is ready. Approve before current-work preparation?" — then **stop**. No pseudo-cells in markdown, no prep, no cells.

**Tiny/small merged gate (fast path).** For `tiny` and `small`, run the validating reality check inline first — MODE FIT / REPO FIT / ASSUMPTIONS / SMALLER PATH / PROOF SURFACE, each with one line of file/command evidence, 2 minutes not a report — then present **one merged question** in place of Gates 2 and 3: "Work shape + execution: I'm about to do [X] via [Y], verified by [Z]. Approve?" Approval records **both** `approved_gates.shape` and `approved_gates.execution`. A reality-check FAIL is presented before asking, never buried. `bee-validating` is not separately invoked for these lanes; its subagents (plan-checker, cell reviewer) do not run — the plan is one direct task a stranger could pick up from `plan.md` alone, and the cold-pickup criteria are self-checked when writing the cell.

## 6. Prep (after Gate 2 approval only)

1. Enrich the **same** `plan.md` in place to `artifact_readiness: implementation-ready`: current slice selected, files bounded, verification commands named.
2. Create cells for the current slice only — the whole slice in **one** call, a JSON array piped straight to stdin (never one scratchpad file + one `add` per cell):
   ```bash
   node .bee/bin/bee.mjs cells add --stdin <<'EOF'
   [ { ...cell 1... }, { ...cell 2... } ]
   EOF
   ```
   The batch is all-or-nothing: every cell is validated before any is written. A single object (no array) still works for a one-cell slice; `--file` remains for pre-existing files.
   Every cell is an executable prompt: `files`, `read_first`, directive `action` citing D-IDs, `must_haves` (truths / artifacts / key_links / prohibitions), a runnable `verify` command, and `behavior_change: true` whenever the cell changes observable behavior. You may leave the model `tier` unset — the orchestrator judges each cell's difficulty and assigns the tier when it dispatches (decision 0016); set `tier` only as a hint when a cell is obviously mechanical (`extraction`) or obviously a hard integration/architecture call (`ceiling`), and even then swarming may override it. Cell quality rules and a schema example live in `references/planning-reference.md`.
3. If an implement plan was rendered at §5 (high-risk, or a standard/small feature where one was produced on request), invoke `bee-briefing` in refresh mode so its Affected Files and Implementation Steps re-project from the created cells. If no brief exists, skip — there is nothing to refresh.
4. Update state and hand off by lane: `tiny`/`small` (merged gate already approved) → `node .bee/bin/bee.mjs state set --phase validated --next-action "Invoke bee-swarming (solo execution)."`; every other lane → `node .bee/bin/bee.mjs state set --phase planning-complete --next-action "Invoke bee-validating."`

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

Plan shaped and current-slice cells prepared. `tiny`/`small`: invoke bee-swarming skill (solo execution — the merged gate already covers execution approval). All other lanes: invoke bee-validating skill.
