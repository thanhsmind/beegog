---
area: workflow-state
updated: 2026-07-12
sources: [codex-runtime-parity Safety foundation — cell codex-parity-5 (trace in .bee/cells/), report docs/history/codex-runtime-parity/reports/codex-parity-5.md, fanout-delegation D1 (cells fanout-1/fanout-4, 2026-07-12), review-on-demand cells review-od-1..3 (traces in .bee/cells/, reports docs/history/review-on-demand/reports/, 2026-07-12)]
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
| gate | One of four named human approvals (context, shape, execution, review). Granted per feature; all four reset to ungranted when a feature starts. The review gate is granted only through a user-invoked review session that covers the feature — a feature closes normally with it ungranted. |
| terminal state | idle or compounding-complete — the only phases from which a new feature may start. |
| nonterminal cell | A unit of work still open, claimed, or blocked. Its existence blocks a new feature start until it is capped or explicitly dropped on the record. |
| handoff record | A pause snapshot left by a session that stopped mid-work. Its existence blocks a new feature start until resumed or resolved. |
| review session | The durable record of one user-requested independent review: who asked and when, the scope as the user described it, the exact included and excluded work (each exclusion carries a reason), the two immutable range anchors (baseline and head), the reviewer manifest actually dispatched, the pre-dispatch evidence check result, findings, user-acceptance items, and the decision. Identifiers are stable and never reused. |
| review candidate | One completed change set awaiting (or holding) review coverage: the feature, the range anchor at close, and the feature's lane. Recorded once at feature close in an append-only ledger; prior entries are never rewritten. |
| review status | Derived at read time, never stored. `verified` — completion evidence exists (every completed change). `unreviewed` — no approved session covers it (including every legacy feature with no record). `in review` — an open, not-yet-approved session includes it. `reviewed` — an approved session covers exactly its range anchor. `review stale` — an approved session covered it, but newer changes landed after that session's head; the old coverage keeps its audit trail while the newer delta is unreviewed. |
| baseline / head | The two immutable anchors a review session's diff is built from. Coverage attaches only to these — never to a feature name or a date. |

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

**B3 — Feature close adds a review candidate.** When a feature finishes its
closing pass, one candidate entry is appended to the append-only ledger:
feature, range anchor at close, and the feature's lane. The lane is required —
the status surface uses it to warn prominently about high-risk work that has
not passed independent review. Observers see the candidate counted as
`unreviewed` immediately.

**B4 — Review session lifecycle.** A session is created only from an explicit
user request. Creation freezes the scope: included work in progress (open or
claimed) is automatically moved to the exclusions with the reason "in
progress" — never silently included; a pre-dispatch evidence check inspects
every included behavior-changing change for recorded completion evidence and,
on any gap, the creation fails with zero records written — review never
substitutes for missing verification. After creation, the baseline, head,
included, and excluded sets can never change; an attempted change is refused
and the record is left byte-identical. Reviewer manifest, findings,
user-acceptance items, and the decision (pending → blocked | approved) are
recorded onto the session as the review proceeds. A session id that already
exists cannot be created again.

**B5 — Coverage and staleness are derived, never stored.** Each candidate's
review status is computed at read time from the session records plus the
repository's actual change history. A candidate covered by an approved session
at its exact anchor reports `reviewed`; one newer change after that session's
head flips it to `review stale` while the session record itself stays
unchanged (the audit trail survives). When the change history cannot be
resolved (rewritten history, missing tooling), the answer degrades toward
honesty: `review stale` with a "range unresolvable" note when a covering
session exists, plain `unreviewed` when none does — the read path never fails.

**B6 — Status surfaces tell the review truth.** The session status summary
carries the candidate counts by derived status and any open sessions. A
feature that closed without review produces an informational completion line
("completed and verified; independent review not requested; N candidates
awaiting review") — not a warning, because closing unreviewed is the normal
truthful state. An unreviewed or stale high-risk candidate produces a
prominent warning that it has not passed independent review and that review
runs only on user request. The recommended-next-step line never proposes
starting a review by itself. A range already covered by an approved, unchanged
session is answered "reviewed (covered by that session)" so no second review
is dispatched for unchanged content.

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
- R4 — Full independent review starts only after an explicit user request;
  completing a cell, slice, or feature never spends reviewer tokens by itself,
  and a merge/ship/release request is answered with the review status plus one
  explicit question, never a silent review dispatch (decision
  565e68d0-327f-404e-b49e-d1c61ba81bfd).
- R5 — Verification and review are separate: verification evidence remains
  mandatory for completion, while a completed feature closes truthfully as
  unreviewed and joins a later user-selected review batch (decision
  565e68d0-327f-404e-b49e-d1c61ba81bfd).
- R6 — Review approval covers only the immutable change set inspected by that
  review session; later changes never inherit the earlier approval — they
  surface as an unreviewed delta and the overall status reads `review stale`
  (decision 565e68d0-327f-404e-b49e-d1c61ba81bfd).
- R9 — A review session's scope is frozen at creation; the pre-dispatch
  evidence check fails closed with zero records written, and in-progress work
  is excluded with a recorded reason, never silently included (decision
  565e68d0-327f-404e-b49e-d1c61ba81bfd; SPEC A6/A10).
- R10 — Review status is always derived from records plus actual change
  history, never stored; legacy features with no review record derive
  `unreviewed` — no session records are ever fabricated for history (decision
  565e68d0-327f-404e-b49e-d1c61ba81bfd; SPEC §11.3).
- R11 — The final human approval of a review (its Gate 4) exists only inside a
  review session; gate bypass never creates or approves one (decision
  565e68d0-327f-404e-b49e-d1c61ba81bfd; SPEC R8).
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
- Review coverage edge cases: exact-anchor coverage → `reviewed`; one newer
  change → `review stale` with the session record byte-unchanged; rewritten
  history / unknown anchor → `review stale` + "range unresolvable" (with a
  covering session) or `unreviewed` (without); change-history tooling absent →
  the status surface still renders, degraded, exit-clean.
- A corrupt review record: read paths skip it with a warning; write verbs
  refuse loudly with the record untouched (same strict-read discipline as the
  workflow record itself).
- The old "past reviewing but Gate 4 still pending" staleness warning is
  retired: closing through scribing/compounding without a review session is
  the normal state, reported informationally, never as drift. The
  unknown-phase warning is unchanged.

## Open Gaps

- The rest of the workflow record's semantics (worker registry lifecycle,
  scribing-run stamps and debt counting, reservation TTL policy) are not yet
  specced here — contracts live in the CLI usage comments and
  `docs/history/cli-mutations/walkthrough.md`.
- Skill prose still references invalid phase names in places; aligning the
  skills to the closed vocabulary is owned by the codex-runtime-parity
  Dispatch-and-skills slice.
- The review-session flow inside a running review (delta re-review after a
  fix, batch cumulative-diff mechanics) is contract-specced in the reviewing
  skill's own reference, not here; this area owns only the records and their
  derived truth.

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
- Review records: `.bee/reviews/<id>.json` (sessions) + `.bee/review-candidates.jsonl`
  (ledger), CLI `bee_reviews.mjs` (create/list/show/record/candidate add/
  candidates/status), lib `skills/bee-hive/templates/lib/reviews.mjs`
  (`deriveCandidateStatus`, `readReviewStrict`; byte-mirrored to `.bee/bin/`).
  Status surface: `review` block in `skills/bee-hive/templates/bee_status.mjs`.
  Coverage derivation uses `git merge-base --is-ancestor` + `git rev-list --count`.
  Tests: review-od checks in `skills/bee-hive/templates/tests/test_lib.mjs`
  (208 passing). Evidence: commits cc1c34d, e4f51a2, da2e165; traces
  `.bee/cells/review-od-{1,2,3}.json`; acceptance map
  `docs/history/review-on-demand/reports/uat-scenarios.md`.
