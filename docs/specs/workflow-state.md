---
area: workflow-state
updated: 2026-07-12
sources: [codex-runtime-parity Safety foundation — cell codex-parity-5 (trace in .bee/cells/), report docs/history/codex-runtime-parity/reports/codex-parity-5.md, review-on-demand target contract, fanout-delegation D1 (cells fanout-1/fanout-4, 2026-07-12)]
decisions: [codex-runtime-parity D2, 565e68d0-327f-404e-b49e-d1c61ba81bfd, de967733-00c8-48b3-b154-68397faf7b5f (cost pattern; advisor config tolerance; refines decision 0015)]
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
- R4 (not yet implemented — P26) — Full independent review starts only after
  an explicit user request; completing a cell, slice, or feature never spends
  reviewer tokens by itself (decision 565e68d0-327f-404e-b49e-d1c61ba81bfd).
- R5 (not yet implemented — P26) — Verification and review are separate:
  verification evidence remains mandatory for completion, while a completed
  feature may close truthfully as unreviewed and join a later user-selected
  review batch (decision 565e68d0-327f-404e-b49e-d1c61ba81bfd).
- R6 (not yet implemented — P26) — Review approval covers only the immutable
  change set inspected by that review session; later changes never inherit the
  earlier approval (decision 565e68d0-327f-404e-b49e-d1c61ba81bfd).
- R7 — The workflow runs one cost pattern: the session's own model
  orchestrates every phase and is always the ceiling tier, never a configured
  value; the cheaper configured tiers (extraction, generation, review) take
  retrieval, implementation, and review work; steps that are mostly gathering
  content dispatch down-tier and return digests rather than raw content
  (decision de967733; the ceiling-is-the-session-model principle it refines
  stands unchanged, decision 0015).
- R8 — A workflow configuration file that still carries the retired advisor
  setting loads successfully: the setting is stripped from the parsed view
  and surfaced as one warning by both the status command and the onboarding
  report; it never errors, and the status display renders no advisor line
  (decision de967733).

## Edge Cases Settled

- A capped prior-feature cell never blocks a new start; an expired-by-TTL
  reservation never blocks a new start (only active ones do).
- Refused starts are proven side-effect-free: the record is byte-identical
  after a refusal.
- A configuration file carrying the retired advisor setting → parses
  normally with the setting stripped from the parsed view; the status
  command and the onboarding report each surface one identical warning line
  naming it safe to delete, never an error (decision de967733).

## Open Gaps

- The rest of the workflow record's semantics (worker registry lifecycle,
  scribing-run stamps and debt counting, reservation TTL policy) are not yet
  specced here — contracts live in the CLI usage comments and
  `docs/history/cli-mutations/walkthrough.md`.
- Skill prose still references invalid phase names in places; aligning the
  skills to the closed vocabulary is owned by the codex-runtime-parity
  Dispatch-and-skills slice.
- User-invoked review, review candidates, immutable review coverage, and stale
  coverage are specified for implementation in
  `docs/history/review-on-demand/SPEC.md` (P26); the current automatic review
  chain does not yet satisfy that contract.

## Pointers (implementation)

- Record: `.bee/state.json` (CLI-owned). Verbs: `bee_state.mjs`
  (`start-feature` — new; set/gate/worker/scribing-run — existing);
  `startFeature()` + `isKnownPhase` in `skills/bee-hive/templates/lib/state.mjs`
  (byte-mirrored to `.bee/bin/lib/state.mjs`).
- Tests: 15 start-feature rows in `skills/bee-hive/templates/tests/test_lib.mjs`.
- Evidence: commit `928abf1`; trace `.bee/cells/codex-parity-5.json`.
- Cost pattern / tier resolution: `modelForTier`, `MODEL_TIERS`,
  `CONFIGURABLE_TIERS` in `skills/bee-hive/templates/lib/state.mjs` (ceiling
  never configured; extraction/generation/review are the configurable tiers).
- Advisor config tolerance: `STALE_ADVISOR_KEY_WARNING`, `hasStaleAdvisorKey`
  in `skills/bee-hive/templates/lib/state.mjs` (byte-mirrored to
  `.bee/bin/lib/state.mjs`); surfaced by `skills/bee-hive/templates/bee_status.mjs`
  and `skills/bee-hive/scripts/onboard_bee.mjs` (`staleAdvisorNotices`).
  Evidence: fanout-delegation cells fanout-1/fanout-4 (commits 0056eda,
  79d96df).
