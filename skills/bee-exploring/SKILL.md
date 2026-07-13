---
name: bee-exploring
description: >-
  Turn a fuzzy feature request into locked decisions in docs/history/<feature>/CONTEXT.md. Use when a request has gray areas or unstated product decisions that would make planning guess. Not for implementation research, cell creation, or code.
metadata:
  version: '0.1'
  ecosystem: bee
  dependencies: []
---

# exploring

If `.bee/onboarding.json` is missing or stale, stop and invoke `bee-hive`.

Exploring turns fuzzy intent into locked decisions in `docs/history/<feature>/CONTEXT.md`. Scout bees find the flowers; they do not build the comb.

## Hard Gates

- Ask **one question per message**; wait for the user before asking the next.
- Do not answer your own question — even when you are sure of the answer.
- Do not research implementation, propose architecture, create cells, or write code — the sole exception is a throwaway SEE mock under `.bee/spikes/<feature>/mocks/` (P11, decision 0020; step 4).
- Do not invoke planning yourself. End by handing the user to `bee-planning`.
- Gather-altitude steps — step 1 scope reads, step 3 gray-area scout digest — delegate as I/O workers (extraction/generation tier) per the Delegation contract (D2/D3, `bee-hive/references/routing-and-contracts.md`); any other ad-hoc dispatch beyond the fresh-eyes reviewer's named review slot defaults to the generation slot, and ceiling requires the [bee-tier: ceiling] marker plus a one-line justification.

## Flow

1. **Scope**
   - Classify: `Quick`, `Standard`, or `Deep`.
   - Read `docs/history/learnings/critical-patterns.md` and `.bee/state.json` if present.
   - If the request spans independent subsystems, pick one and defer the rest.
   - **Backlog flip (D11a):** when this feature matches an existing `docs/backlog.md` row, flip that row to `in-flight` and add the feature slug, same turn; if the request never passed through the backlog, create the `proposed` row first, then flip it. This is the only place a row goes `in-flight` (table schema + merge rules live in the scribing reference; prose-ruled, never hook-enforced — D7).
   - If `.bee/config.json` lacks `commands` (setup/start/test/verify), run detection first: `node .bee/bin/lib/commands_detect.mjs` prints JSON candidates from the repo's manifests. Present the candidates as **one** pre-filled confirmation question (`key: value — source`), still skippable; fall back to the open question when detection finds nothing. Write only user-confirmed values to `.bee/config.json` `commands`. Never invent command values (docs/09 item 1, D3 of harness10).

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
   - **Materiality test (P20):** every candidate question passes three checks before it is asked — **material** (the answer changes scope, architecture, UX, data model, or acceptance criteria), **grounded** (cites scout evidence or a concrete uncertainty, never generic preference), **answerable** (the user can pick an option, approve a default, or supply a reference). A failing question is never asked: pin it as a labeled assumption for Context Assembly to write into CONTEXT.md, or hand it to planning if only the implementer cares about the answer.
   - **Blindspot pass — teach before asking (P9, decision 0020):** when the user signals unfamiliarity with a gray area's domain — says so, answers with guesses ("chắc là…"), or asks what the options mean — invert for that area: explain the 2–3 concepts needed to answer well (one short outcome-framed message, no jargon), *then* ask. A decision locked from a guessed answer is a fake decision. The user can also request a full "blindspot pass" by name: sweep the unknown-unknowns (what good looks like, common potholes, prior art in this repo) before locking begins.
   - **SEE mock — react instead of describe (P11, decision 0020):** for a `SEE` gray area the user knows-when-they-see-it but cannot describe, you MAY build a throwaway HTML mock (2–4 variants, fake data, zero wiring) under `.bee/spikes/<feature>/mocks/` and lock the decision from the user's reaction, citing the chosen variant. This is the ONE exception to "exploring never writes code": mock files only, only under `.bee/spikes/`, never imported by anything, never promoted to production (spike-code rule applies).
   - After each answer, confirm the decision back and assign a stable ID: `D1`, `D2`, `D3`…
   - When an answer settles the meaning of a fuzzy domain word, confirm the term back and pin it like a decision (P21); Context Assembly writes all pinned terms into CONTEXT.md's `Terms` section, and scribing inherits them into the spec's Data Dictionary.
   - If one answer contains several decisions: lock the one your question asked about, echo the others as candidate decisions to confirm one at a time.
   - Scope creep (new features, adjacent work): mark it deferred with one line, return to the current question.

5. **Context Assembly**
   - Write `docs/history/<feature-slug>/CONTEXT.md` from `references/context-template.md`.
   - Include boundary, domain types, locked decisions table with D-IDs, pinned terms, scout paths, canonical references, open questions, and deferred ideas.
   - **Deferred Ideas also feed the product backlog (D8):** each Deferred Ideas entry that is real future work appends a `proposed` row to `docs/backlog.md` in the same turn (announce-then-do) — the CONTEXT.md list is the record for this feature, the backlog row is the durable product-level intent. Do not wait to be asked.
   - Concrete language only. No placeholders, TODOs, or vague preferences.
   - **Fresh-eyes review:** spawn one reviewer with no conversation history (slot: `review`, decision 0021 — default opus on Claude, falls back to generation) — **in the background where the runtime supports it** (decision 0017): keep assembling CONTEXT.md, keep talking to the user; the review blocks nothing until Gate 1. Collect the verdict before presenting the gate — Gate 1 is never presented with the review still outstanding. It checks completeness, contradictions, vague decisions, missing D-IDs, and blockers. Fix findings and re-review — max two loops, then present remaining doubts to the user.

6. **State And Handoff**
   - Update state:
     ```
     node .bee/bin/bee.mjs state set --phase exploring-complete --feature "<feature>" --summary "Exploring complete. CONTEXT.md is ready for planning." --next-action "Gate 1, then invoke bee-planning."
     ```
   - Present **Gate 1** per the Gate Presentation Contract (bee-hive routing reference): plain-language layer in chat — what we decided / why trustworthy / cost if wrong / what you are deciding — in the user's language, CONTEXT.md linked not pasted; then verbatim: "Decisions locked. Approve CONTEXT.md before planning?"
   - CONTEXT.md is the source of truth for every downstream agent; decision IDs are stable and cited, never reinterpreted.

## Headless

With `mode:headless`: no Socratic dialogue. Lock only decisions the request states explicitly (still with D-IDs); write every gray area into the `Outstanding Questions` section of CONTEXT.md and of the terminal report instead of asking. Gate 1 is never self-approved — the report ends "awaiting Gate 1 approval".

## Red Flags

- bundled questions, or a question answered by the asker
- a question asked that fails the materiality test — immaterial, ungrounded, or unanswerable
- deep implementation analysis or architecture proposals during exploring
- creating cells or writing code (except a `.bee/spikes/<feature>/mocks/` SEE mock per decision 0020)
- a SEE mock imported by production code, or surviving outside `.bee/spikes/`
- teaching skipped when the user is visibly guessing — a decision locked from a guess
- locking a "decision" that is really an implementation choice
- scope creep absorbed instead of deferred
- CONTEXT.md with placeholders, or skipping the fresh-eyes review
- skipping decision locking because "the user seemed to imply it"

Violating the letter of the rules is violating the spirit of the rules.

References: `references/gray-area-probes.md`, `references/context-template.md`.

Decisions captured and CONTEXT.md written. Invoke bee-planning skill.
