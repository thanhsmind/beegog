---
name: bee-briefing
description: >-
  Render one human-readable implementation plan per feature so the human and the agent review and agree on the same document before code is touched. Use when planning has shaped work that needs Gate 2/3 approval, when a feature's implement plan must be (re)generated, or when the terse per-feature artifacts need consolidating into one reviewable doc. Do NOT use to originate decisions, scope, or approach — those come from exploring/planning.
metadata:
  version: '0.1'
  ecosystem: bee
  dependencies:
    nodejs-runtime:
      kind: command
      command: node
      missing_effect: degraded
      reason: Reads cell traces and gate/status state via the vendored .bee/bin helpers.
---

# Briefing (the beekeeper's brief)

`bee-planning` is the waggle dance — precise, terse, bee-to-bee. Briefing translates the dance for the beekeeper. It renders **one** artifact per feature:

```
docs/history/<feature>/implement-plan.md
```

**Briefing is a consolidator, not a second planner.** It renders the brief FROM the truth artifacts (`CONTEXT.md` decisions, `approach.md`, `plan.md`, cells, validating reports) and authors only the two sections the chain does not already produce: the **Technical Design** narrative and the **Rollback Plan**. It never originates a decision, an approach, a scope boundary, or a cell — those live in the truth artifacts and are only projected here. Inventing content to fill a template section is the one failure this skill exists to prevent.

If `.bee/onboarding.json` is missing or stale, stop and invoke `bee-hive`.

## Lane forms (ceremony scales with risk)

Match the brief to the lane the plan already chose. A tiny fix wearing a 12-section brief is the same red flag as a tiny fix wearing epic ceremony. Briefing is **invoked conditionally** — `bee-planning` only calls it where the fan-out table (decision 0009) earns a brief; below high-risk the caller may skip it entirely, and briefing NOOPs when not called. Do not treat a brief as automatic for every feature.

| Lane | Brief |
|---|---|
| `tiny` / `spike` | **none** — the Gate chat layer and `plan.md`'s direct note are the record. Do not create the file. |
| `small` | **none by default**; render the ~15-line **mini-brief** (Goal · Scope in/out · Affected files · Validation · one-line Risk · one-line Rollback, template in the reference) only when the user asks for a consolidated doc |
| `standard` | **on-demand** — default is `plan.md` + the Gate 2 chat layer; render the **full template (empty sections dropped**, never "N/A") when the user asks or the slice spans multiple domains. Do not auto-generate it for a single-slice standard fix |
| `high-risk` | **mandatory** — full template; **Rollback and Security/Permissions sections are mandatory** and must have real content |

## Modes

| Mode | Trigger | Does |
|---|---|---|
| **render** (chain) | `bee-planning` invokes briefing before Gate 2 — for high-risk always, for standard/small only when a consolidated doc is warranted (decision 0009) | build `implement-plan.md` from the artifacts; `Status: Ready for Review`; the Gate 2 message links it as the review document |
| **refresh** (chain) | after Gate 2 prep (cells created) and after `bee-validating` produces evidence | re-project the changed sections in place (Affected Files & Steps from cells; Validation Plan from the validating report) — never a second file |
| **walkthrough** (chain) | `bee-reviewing` passed Gate 4 on a `standard`/`high-risk` feature | write `docs/history/<feature>/walkthrough.md` — what shipped, how it was verified (real evidence), how to test it; set the implement plan `status: Shipped` |
| **on-demand** | user asks to (re)generate or read the implement plan or walkthrough for a feature | render / refresh / walkthrough as above, any phase |

## 1. Section → Source Map (the render procedure)

Every section is projected from a named source. If the source is silent, the section is an **Open Question**, never a guess.

| Section | Source of truth | Rule |
|---|---|---|
| Review Status | `.bee/state.json` gates | mirror the gate state; never assert Approved before the gate fires |
| Goal / Success | `CONTEXT.md` boundary + locked decisions | restate the user outcome; cite D-IDs |
| Current State | exploring scout + `approach.md` findings | what was inspected and how it behaves today |
| Scope (in/out) | `CONTEXT.md` decisions + `plan.md` Out of scope | deferred ideas stay deferred |
| Proposed Approach + alternatives | `approach.md`, or `plan.md`'s `## Approach` section when the approach was folded in (decision 0009) | render as written; do not substitute a "better" idea |
| **Technical Design** | **authored** from `approach.md` + cells | narrative of the flow/data/API/UI/security *as the artifacts imply*; anything beyond them → Open Question |
| Affected Files | `approach.md` files + cell `files` | after prep, project from the cells (authoritative) |
| Implementation Steps | `plan.md` shape + cells | project cell titles/deps after prep |
| Validation Plan | cell `verify` commands + validating report | describe what WILL be checked; link evidence from the report — never assert a result that has not run |
| Risks & Mitigation | `approach.md` risk map | as written |
| **Rollback Plan** | **authored** | how to revert *this* work; if genuinely undecided → Open Question, not a plausible invention |
| Open Questions | `approach.md` questions + anything the sources did not cover | the honest home for every gap and every guess |

Full template with per-section prose: `references/implement-plan-template.md`.

**Delegation:** the section→source projection walk and walkthrough reconstruction delegate as generation-tier I/O workers per the Delegation contract (D2/D3, `bee-hive/references/routing-and-contracts.md`); the two authored sections (§2) stay on the session model.

## 2. The Two Authored Sections

These are the only sections briefing writes from its own judgment — and even here, judgment means *reading what the artifacts imply*, not designing anew.

- **Technical Design:** a readable narrative of the flow the chosen approach produces — components touched, data shape, API/UI/security surface *the approach already implies*. A design choice the artifacts do not contain is a proposal, not a rendering: it goes to Open Questions for the human, and if it should change the plan, it flows back through `bee-planning` (never smuggled into the brief).
- **Rollback Plan:** how this specific change is undone (revert the cells' commits, disable a flag, reverse a migration). bee has no rollback discipline elsewhere, so this is real new content — but when rollback is genuinely undecided, write "Not yet decided — OPEN QUESTION: …", never a plausible-sounding procedure nobody agreed to. `high-risk` lanes must resolve it before Gate 3, not leave it open.

## 3. Projection & Status Lifecycle

The brief is the human-layer **projection** of the truth artifacts (extends D12, the Projection Rule). Truth stays in `CONTEXT.md` / `plan.md` / cells / validating reports; the brief never overrides them.

- **Approval happens on the brief, but the brief is never the sole change site.** When the human comments on `implement-plan.md` ("change decision X", "add XLSX"), the change flows into the truth artifacts first — `bee-planning` revises `plan.md`; a locked decision is superseded via `node .bee/bin/bee.mjs decisions supersede` and `CONTEXT.md` updated — THEN the brief re-renders so all documents agree. Hand-editing the brief alone creates a render that disagrees with its own source.
- **Review Status is real state.** Frontmatter `status` mirrors the gates: `Draft` (rendering) → `Ready for Review` (presented at a gate) → `Approved` (gate passed) → `Needs Revision`, and → `Shipped` when the walkthrough is written after Gate 4. Approved at Gate 2 covers the shape; the Validation Plan section is patched with real evidence after validating, before Gate 3.
- **Drift rule (prose in v1).** If a source artifact changes after the brief was approved, set `status: Needs Revision` and re-render before the next gate. (A mechanical `bee_status` warning on source-hash drift is a recorded follow-up, not required for v1.)

## 4. Gate Presentation

Briefing does not present gates — `bee-planning` and `bee-validating` do. But the brief is the document their Gate 2/3 messages **link** (per the Gate Presentation Contract). The chat message stays the plain-language layer; the brief is the durable review object; the mechanical reports in `docs/history/<feature>/reports/` stay the machine layer. Never paste the whole brief into the gate chat message — link it.

## 5. Walkthrough Mode (post-Gate-4)

After `bee-reviewing` passes Gate 4 on a `standard`/`high-risk` feature, write `docs/history/<feature>/walkthrough.md` — the human's "here's what we did and how to check it" capstone. `tiny`/`spike`/`small` skip it (the cap trace and commit are the record).

**Reconstruct from execution reality, never from the plan.** The implement plan and `plan.md` describe *intent*; the walkthrough describes what *shipped*. Its sources are the capped cells' traces (outcome, `files_changed`, `deviations`, the recorded `verify` output), the review findings, and the UAT record — not `implement-plan.md`. Where they differ, the shipped reality wins and the difference is *named*.

Sections (full template in `references/walkthrough-template.md`):

- **What shipped** — the observable outcome delivered, present tense, from capped cells.
- **How it was verified** — the *actual* recorded evidence: real `verify` command outputs and UAT results. Never assert "works end-to-end" beyond what the evidence covers; an unrun or skipped check is stated as an outstanding gap, not smoothed over.
- **How to test it yourself** — manual steps for the human, from the UAT / SEE·CALL·RUN decisions.
- **Deviations from plan** — what execution changed from the implement plan and why (from cell `deviations`); silent divergence misleads the next reader.
- **Known limitations / follow-ups** — deferred P2/P3 findings with their backlog links, and open gaps. Polished means honest, not curated to look finished.

**Quiz offer (P10, decision 0020):** when presenting the walkthrough, offer a 3–5 question quiz on the change — what behavior changed, what each actor observes now, what was NOT verified, what deviated from plan. Questions derive only from the walkthrough's own sections; the user opts in; a miss means walking that section together. It mechanizes the gate litmus ("a gate the user cannot restate is dead") — never forced, never a blocker. Protocol in `references/walkthrough-template.md`.

Then set the implement plan's `status: Shipped`.

## Hard Gates

- **Never invent to fill a section.** Source silent → Open Question. A plausible Rollback or Technical Design nobody decided is a fabrication wearing a professional face.
- **Walkthrough reconstructs from execution records, not the plan.** Summarizing `implement-plan.md` in past tense hides deviations and un-run checks — a walkthrough must reflect what shipped and what was actually verified.
- **Never claim broader verification than the evidence shows.** Unit checks passing ≠ end-to-end verified; a skipped UAT is an outstanding gap, stated plainly.
- **Never omit known findings or deviations from the walkthrough** to make it look clean — list them with links.
- **Never originate.** Decisions, scope, approach, and cells come from exploring/planning. Briefing projects; it does not plan.
- **Never hand-edit the brief as the sole change.** Feedback flows to the truth artifacts, then the brief re-renders.
- **Never assert a validation result that has not run.** The Validation Plan describes and links evidence; it does not claim green.
- **Respect the lane.** No brief for `tiny`/`spike`; no full template for `small`. Drop empty sections rather than pad them.
- Secrets and PII never appear in the brief.

## Headless

`mode:headless`: render/refresh the brief from the artifacts mechanically, set `status` from the gate state, and drop empty sections. Never self-approve a gate. Any section that would require inventing content, and any human-feedback item that needs a decision superseded, goes to an `Outstanding Questions` section of the structured terminal report — never guessed into the brief.

## Red Flags

- a Technical Design or Rollback section containing a decision the truth artifacts never made
- a section filled with plausible content because "a blank section looks unprofessional" — the honest home for a gap is Open Questions
- editing `implement-plan.md` directly in response to gate feedback, leaving `CONTEXT.md`/`plan.md` stale
- a brief auto-generated for a `tiny`/`small`/single-slice `standard` fix that nobody asked to consolidate; a full 12-section brief for a small fix; `N/A` placeholder sections
- a Validation Plan that states results ("142 passing") before anything ran
- the whole brief pasted into a gate chat message instead of linked
- a `-v2`/`-new`/dated implement-plan file, or a fresh brief created without checking for the feature's existing one
- `status: Approved` set before the gate actually passed, or left stale after a source changed
- a walkthrough written by summarizing `implement-plan.md` in past tense instead of reconstructing from cell traces / review / UAT
- a walkthrough claiming "verified end-to-end" when the UAT was skipped, or omitting deferred findings to look clean

Violating the letter of these rules is violating the spirit of these rules.

## Handoff

- **render / refresh** (Gate 2/3): implement plan rendered (`<lane>`, `status: <status>`), linked for the gate. Return to the calling skill (`bee-planning` for Gate 2, `bee-validating` for Gate 3).
- **walkthrough** (post-Gate-4): walkthrough written, implement plan `status: Shipped`. Invoke bee-scribing skill.

| Reference | When to Load |
|---|---|
| `references/implement-plan-template.md` | full section-by-section template and the agent writing guide |
| `references/mini-brief-template.md` | the `small`-lane ~15-line form |
| `references/walkthrough-template.md` | post-Gate-4 walkthrough sections and the reconstruct-from-reality rules |
