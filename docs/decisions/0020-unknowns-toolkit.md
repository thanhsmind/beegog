# 0020 — Unknowns toolkit: blindspot pass, Gate-4 quiz, SEE mock (backlog P9–P11)

- **Status:** active — owner-approved 2026-07-10 ("thực hiện toàn bộ các backlog"); built in 0.1.17.
- **Date:** 2026-07-10
- **Source:** Thariq's map-vs-territory article (2026-07-10 session): the quality of agentic work is bottlenecked by the human's ability to clarify their unknowns. Three techniques mapped onto real bee gaps: the Socratic loop assumes the user can answer (fails in unfamiliar territory); the gate litmus ("a gate the user cannot restate is dead") had no mechanism; text questions are the wrong tool for visual know-it-when-I-see-it decisions.
- **Confidence:** 0.7 (all three are prose-level, additive, opt-in at the interaction level; no machinery changed).

## Decision

### P9 — Blindspot pass (bee-exploring)

Socratic locking gains a **teach-before-ask branch**: when the user signals unfamiliarity with the domain — says so outright, answers with guesses ("chắc là…", "I think maybe"), or asks the agent what the options even mean — exploring inverts direction for that gray area: explain the 2–3 concepts needed to answer well (one short message, outcome-framed, no jargon), *then* ask the question. A decision locked from a guessed answer is a fake decision that validating cannot catch. The user can also request it by name ("blindspot pass"): a quick sweep of the unknown-unknowns in the area — what good looks like, common potholes, prior art in the repo — before any locking begins.

### P10 — Gate-4 quiz (bee-briefing walkthrough)

The walkthrough gains an **optional quiz section**: 3–5 questions about the shipped change (what behavior changed, what each actor now observes, what was NOT verified, what deviated from plan), answers derived only from the walkthrough's own evidence sections. Offered, never forced — the user opts in at walkthrough presentation. This mechanizes the existing gate litmus: passing the quiz IS restating the change in your own words.

### P11 — SEE mock (bee-exploring, deliberate no-code exception)

For a gray area of domain type `SEE` where the user cannot describe what they want but would recognize it: exploring MAY build a **throwaway HTML mock** (2–4 variants, fake data, zero wiring) under `.spikes/<feature>/mocks/`, present it, and lock the decision from the user's *reaction*. Bounded exception to "exploring never writes code": mock files only, only under `.spikes/`, never imported by anything, never promoted to production code (same rule as spike code). The locked decision cites the chosen variant.

## Rationale

- All three attack the same failure: a locked decision whose answer the user never actually possessed. Blindspot pass fixes it before the question, the mock fixes it for visual questions, the quiz catches it after shipping.
- Prose-only, no new skills, no config — consistent with "lanes scale ceremony": each engages only when its trigger appears.

## Alternatives considered

- **A separate bee-teaching skill.** Rejected — hits the skill-cap gate (decision 0002 pattern); the branch lives inside exploring where the trigger is observed.
- **Mandatory quiz at Gate 4.** Rejected — forcing it re-creates the ceremony-tax problem decision 0017 just removed; the offer is the mechanism.
- **Mock via external design tools.** Rejected — a single HTML file with fake data is the cheapest reaction surface and stays inside the repo's spike discipline.
