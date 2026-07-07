---
name: exploring
description: >-
  Use when a feature request needs user-facing decisions captured in
  history/<feature>/CONTEXT.md before planning. Clarifies fuzzy scope without
  implementation research or cell creation.
metadata:
  version: '0.1'
  ecosystem: bee
  dependencies: []
---

# exploring

If `.bee/onboarding.json` is missing or stale, stop and invoke `bee:hive`.

Exploring turns fuzzy intent into locked decisions in `history/<feature>/CONTEXT.md`. Scout bees find the flowers; they do not build the comb.

## Hard Gates

- Ask **one question per message**; wait for the user before asking the next.
- Do not answer your own question — even when you are sure of the answer.
- Do not research implementation, propose architecture, create cells, or write code.
- Do not invoke planning yourself. End by handing the user to `bee:planning`.

## Flow

1. **Scope**
   - Classify: `Quick`, `Standard`, or `Deep`.
   - Read `history/learnings/critical-patterns.md` and `.bee/state.json` if present.
   - If the request spans independent subsystems, pick one and defer the rest.

2. **Domain**
   - Classify each applicable type:
     - `SEE`: user-visible surface
     - `CALL`: API, CLI, webhook, SDK, service interface
     - `RUN`: job, script, service, or pipeline
     - `READ`: docs, emails, reports, notifications
     - `ORGANIZE`: data model, file layout, taxonomy, config
   - Load `references/gray-area-probes.md` and pick only relevant probes.

3. **Gray Areas**
   - Generate 2–4 unstated *product* decisions that would otherwise make planning guess.
   - Do a **quick scout only** — one keyword pass, then read 2–3 relevant files:
     ```bash
     rg "<feature-keyword>" src app packages --glob "*.{ts,tsx,js,jsx,py,md}" | head -20
     ```
   - Cite the existing patterns you found in your questions ("today, exports go through `src/report/csv.ts` — should this follow that?").
   - Exclude implementation choices, performance tuning, and new scope. If a candidate question only matters to the implementer, it belongs to planning, not here.

4. **Socratic Locking**
   - One concise question per message, preferably single-choice, **outcome-framed** ("what breaks for users if…"), using the standard CONTEXT / QUESTION / RECOMMENDATION / options format.
   - Start broad, then narrow into constraints.
   - After each answer, confirm the decision back and assign a stable ID: `D1`, `D2`, `D3`…
   - If one answer contains several decisions: lock the one your question asked about, echo the others as candidate decisions to confirm one at a time.
   - Scope creep (new features, adjacent work): mark it deferred with one line, return to the current question.

5. **Context Assembly**
   - Write `history/<feature-slug>/CONTEXT.md` from `references/context-template.md`.
   - Include boundary, domain types, locked decisions table with D-IDs, scout paths, canonical references, open questions, and deferred ideas.
   - Concrete language only. No placeholders, TODOs, or vague preferences.
   - **Fresh-eyes review:** spawn one reviewer with no conversation history (tier: `generation`). It checks completeness, contradictions, vague decisions, missing D-IDs, and blockers. Fix findings and re-review — max two loops, then present remaining doubts to the user.

6. **State And Handoff**
   - Update `.bee/state.json`:
     ```json
     {
       "phase": "exploring-complete",
       "feature": "<feature>",
       "summary": "Exploring complete. CONTEXT.md is ready for planning.",
       "next_action": "Gate 1, then invoke bee:planning."
     }
     ```
   - Present **Gate 1**: "Decisions locked. Approve CONTEXT.md before planning?"
   - CONTEXT.md is the source of truth for every downstream agent; decision IDs are stable and cited, never reinterpreted.

## Headless

With `mode:headless`: no Socratic dialogue. Lock only decisions the request states explicitly (still with D-IDs); write every gray area into the `Outstanding Questions` section of CONTEXT.md and of the terminal report instead of asking. Gate 1 is never self-approved — the report ends "awaiting Gate 1 approval".

## Red Flags

- bundled questions, or a question answered by the asker
- deep implementation analysis or architecture proposals during exploring
- creating cells or writing code
- locking a "decision" that is really an implementation choice
- scope creep absorbed instead of deferred
- CONTEXT.md with placeholders, or skipping the fresh-eyes review
- skipping decision locking because "the user seemed to imply it"

Violating the letter of the rules is violating the spirit of the rules.

References: `references/gray-area-probes.md`, `references/context-template.md`.

Decisions captured and CONTEXT.md written. Invoke bee:planning skill.
