---
area: workflow-state
updated: 2026-07-12
sources: [codex-runtime-parity Safety foundation — cell codex-parity-5 (trace in .bee/cells/), report docs/history/codex-runtime-parity/reports/codex-parity-5.md]
decisions: [codex-runtime-parity D2]
coverage: partial
---

# Workflow State (phases, gates, feature lifecycle)

## Purpose

A bee-managed project carries one durable record of where the workflow stands:
which feature is active, which phase it is in, which human approvals (gates)
have been granted, and which workers are registered. This area describes the
rules that keep that record trustworthy — above all, that **a new feature can
never inherit the previous feature's approvals or bury its unfinished work**.

## Entry Points & Triggers

- The workflow record changes only through its command-line verbs (set phase,
  record a gate, register/update/clear workers, record a scribing run, start a
  feature). Direct edits to the record are denied by the write guard.
- **Starting a feature** is a single guarded operation, invoked when new work
  begins after the previous feature has fully closed.

## Data Dictionary

| Element | Meaning |
|---|---|
| phase | Where the active feature stands. Closed vocabulary: idle, exploring, planning, validating, swarming, reviewing, scribing, compounding, grooming, and the terminal alias compounding-complete. Any other value is rejected. |
| gate | One of four named human approvals (context, shape, execution, review). Granted per feature; all four reset to ungranted when a feature starts. |
| terminal state | idle or compounding-complete — the only phases from which a new feature may start. |
| nonterminal cell | A unit of work still open, claimed, or blocked. Its existence blocks a new feature start until it is capped or explicitly dropped on the record. |
| handoff record | A pause snapshot left by a session that stopped mid-work. Its existence blocks a new feature start until resumed or resolved. |

## Behaviors & Operations

**B1 — Guarded feature start.** Starting a feature fails closed — with zero
changes to the record — unless ALL of: the prior phase is terminal; no handoff
record exists; no worker is registered; no file reservation is active; and the
prior feature has no nonterminal cell. An intentionally abandoned cell must
first be dropped through the explicit drop verb, which records the reason —
the start operation never clears work as a side effect. When the preconditions
hold, one atomic write sets the feature, its mode, a valid phase, resets all
four gates to ungranted, and updates the summary/next-action. Observers (the
next session's preamble, the status command) see either the old record intact
or the new feature fully reset — never a mixture.

**B2 — Closed phase vocabulary.** Every phase write is validated against the
closed list; historical skill wording that used other names (e.g.
"exploring-complete", "validated") is invalid at the record layer.

## Actors & Access

- **The agent** runs every verb itself; the human never runs workflow
  commands. The human's actions are gate approvals and decision answers.
- **Workers** touch only cell claim/verify/cap and reservations — never phase,
  gates, or feature identity.

## Business Rules

- R1 — A new feature can never inherit gate approvals: all four gates reset in
  the same atomic write that sets the feature (codex-runtime-parity D2;
  plan-review P1 repair).
- R2 — Feature start never destroys evidence of unfinished work; abandonment
  is a separate, recorded act (drop verb) (codex-runtime-parity D2).
- R3 — Phase values outside the closed vocabulary are rejected at the record
  layer, whatever a skill's prose says.

## Edge Cases Settled

- A capped prior-feature cell never blocks a new start; an expired-by-TTL
  reservation never blocks a new start (only active ones do).
- Refused starts are proven side-effect-free: the record is byte-identical
  after a refusal.

## Open Gaps

- The rest of the workflow record's semantics (worker registry lifecycle,
  scribing-run stamps and debt counting, reservation TTL policy) are not yet
  specced here — contracts live in the CLI usage comments and
  `docs/history/cli-mutations/walkthrough.md`.
- Skill prose still references invalid phase names in places; aligning the
  skills to the closed vocabulary is owned by the codex-runtime-parity
  Dispatch-and-skills slice.

## Pointers (implementation)

- Record: `.bee/state.json` (CLI-owned). Verbs: `bee_state.mjs`
  (`start-feature` — new; set/gate/worker/scribing-run — existing);
  `startFeature()` + `isKnownPhase` in `skills/bee-hive/templates/lib/state.mjs`
  (byte-mirrored to `.bee/bin/lib/state.mjs`).
- Tests: 15 start-feature rows in `skills/bee-hive/templates/tests/test_lib.mjs`.
- Evidence: commit `928abf1`; trace `.bee/cells/codex-parity-5.json`.
