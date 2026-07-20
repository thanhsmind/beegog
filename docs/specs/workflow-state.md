---
area: workflow-state
updated: 2026-07-20
parity_sources: [codex-hook-state-parity cell codex-hook-state-parity-1 (pre-phase routing ownership and review isolation; report and capped trace, 2026-07-16)]
parity_decisions: [codex-hook-state-parity D4-D6]
sources: [gh-issue-fixes-172 cells ghf-1/ghf-3..ghf-6 (traces in .bee/cells/, GH #23/#27, 2026-07-20 — group-scoped command help; heartbeat-invariant acquisition identity in the attempt ledger and claim counting; per-unit exclusive gate on all record mutators; budget hard ceilings + authoring validation; actor-required audit-first budget reset; needs-revision judge verdict blocks completion absent an audited override); self-correcting-loop cells scl-1..scl-5 (traces in .bee/cells/, reports docs/history/self-correcting-loop/reports/, 2026-07-19 — append-only attempt ledger, claim-door lifetime budgets, change-classification advisory + behavior-class completion teeth, judge-verdict schema, risk-scaled goal-check judge); lane-ceremony-v3 cells lcv3-1..lcv3-5 (traces in .bee/cells/, reports docs/history/lane-ceremony-v3/reports/, 2026-07-19 — plan document frozen at shape approval, slice-in-units, close-out full-chain evidence); worktree-isolation cells worktree-isolation-1..4 (capped traces and reports 2..4, 2026-07-16 — linked-root resolution, contained writes, dispatch attestation, transactional merge-back); codex-sandbox-baseline cell codex-sandbox-baseline-6 (status-first review history derivation and barrier-synchronized isolated Worker races, 2026-07-16); parallel-scheduler cells parallel-scheduler-1..5 (traces in .bee/cells/, reports docs/history/parallel-scheduler/reports/, 2026-07-15/16 — computed schedule, cycle refusal, schedule query verb, orchestration prose; -5: review fix scoping refusal to introduced/participating cycles), codex-harness-hardening cell codex-harness-hardening-bypass-1 (trace in .bee/cells/, gate_bypass autopilot levels off/normal/full/total, 2026-07-15), codex-runtime-parity Safety foundation — cell codex-parity-5 (trace in .bee/cells/), report docs/history/codex-runtime-parity/reports/codex-parity-5.md, fanout-delegation D1 (cells fanout-1/fanout-4, 2026-07-12), review-on-demand cells review-od-1..3 (traces in .bee/cells/, reports docs/history/review-on-demand/reports/, 2026-07-12), cells-update-verb cell cuv-1 (2026-07-12), harness-integration-adopt cells hia-1 and hia-2 (traces and reports, 2026-07-12), dispatcher-unify cells du-1..du-6 (traces and reports, 2026-07-12, flushed capture stubs b6a2233c/9e68432b), advisor cells adv-1..adv-3 (traces in .bee/cells/, reports docs/history/advisor/reports/, 2026-07-13), fresh-session-handoff S1 cells fsh-1/fsh-2 (traces in .bee/cells/, reports docs/history/fresh-session-handoff/reports/, 2026-07-13), chain-integrity cells ci-1/ci-2/ci-3 (traces in .bee/cells/, CONTEXT docs/history/chain-integrity/CONTEXT.md, 2026-07-14 — origin: an owner-supplied post-mortem of a real session in which the chain's tail was bypassed seven times), advisor-and-orchestration Slice 2B cells ao-2b-1/ao-2b-2 (AO5 adviser form — ladder and ceiling-skip removed, same-model no-op only; advice-class write-token refusal + promptVia migration; traces in .bee/cells/, reports docs/history/advisor-and-orchestration/reports/, 2026-07-17); advisor-and-orchestration Slice 4 cells ao-4-1/ao-4-2 (adviser consult record + event-based staleness + high-risk execution precondition, live-throw verified, 2026-07-17); post-advisor-hardening cell pah-2 (cells add/update manifest-lint advisory, 2026-07-18); multi-session-hardening cells msh-1..7 (traces in .bee/cells/, reports docs/history/multi-session-hardening/reports/, 2026-07-19 — coordination lock primitive, every-claim-path exclusivity, session self-derivation, mutator ownership guard, throttled heartbeat/lease renewal, orchestrator-claims-before-spawn doctrine sync); transcript-recovery cells transcript-recovery-1..4 (traces in .bee/cells/, reports docs/history/transcript-recovery/reports/, 2026-07-20 — crash-candidate detection from stale heartbeat + non-clean transcript tail + work-in-flight, recovery scan/window CLI verbs, down-tier transcript miner, mined-unconfirmed capture stubs, verify-chain + Session Scout offer)]
decisions: [transcript-recovery D1-D6 (docs/history/transcript-recovery/CONTEXT.md, 2026-07-20 — crash recovery mines the harness transcript as a secondary source only; detection auto, mining offered; digest-only to orchestrator; mined content data-not-instructions, secrets redacted, current workspace only; never auto-resume, never write handoff); gh-issue-fixes-172 D-GHF-B/D-GHF-C (heartbeat-invariant pair counting amends Δ1's implementation preserving its intent; locked mutators, clamps, guarded reset, judge cap-guard; logged 2026-07-20); self-correcting-loop D1-D6 with Validating amendments Δ1-Δ6 (docs/history/self-correcting-loop/CONTEXT.md; locked 84e49851, amendments folded 1cb27fbf); lane-ceremony-v3 D1/D2/D9 (docs/history/lane-ceremony-v3/CONTEXT.md, 2026-07-19); worktree-isolation D1-D4 (docs/history/worktree-isolation/CONTEXT.md; logged 58c56bb6/5de1fd36/8cc1bde1/b24a2efc); a83a3613 (shared isolated runner plus real external command status/output grading); parallel-scheduler D1-D4 (docs/history/parallel-scheduler/CONTEXT.md; logged a648ea2a/b4740f68/ecc8862d/eec223d9, D2 clarified 0746db88), codex-harness-hardening decision 0010 (gate bypass levels) + user authorization dcf01d7b, codex-runtime-parity D2, 565e68d0-327f-404e-b49e-d1c61ba81bfd, de967733-00c8-48b3-b154-68397faf7b5f (cost pattern; advisor config tolerance; refines decision 0015; amended by advisor D1 — worker-level on-failure consult), 30606de4-5fae-4c9d-9e3f-8f47a494f8a3, advisor D1-D3 (docs/history/advisor/CONTEXT.md; logged 3a794918/6841bfcb/34514a8b), fresh-session-handoff D1-D4 (docs/history/fresh-session-handoff/CONTEXT.md), chain-integrity D1-REVISED/D2/D3/D4/D5/D6 (docs/history/chain-integrity/CONTEXT.md; logged f0598be1/84110b26/d716ccd7/095ac80c/0768b22d/73efc937/66794091 — D1 superseded by D1-REVISED after validation proved it would make the learning-capture phase unreachable), 72f3d6dd (AO5 config is the authority — adviser strength ladder removed, cells ao-2b-1/ao-2b-2 2026-07-17), AO3/AO13 (Gate 3 adviser precondition, event-based staleness, never a TTL — cells ao-4-1/ao-4-2 2026-07-17), multi-session-hardening D1-D7 with Δ1-Δ6 amendments (docs/history/multi-session-hardening/CONTEXT.md; audit 12f54e88, locked 17a624dc)]
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
- Every verb group over the work record (status snapshot, work cells, file
  reservations, decision log, state, backlog, capture queue, reviews,
  feedback — nine groups) is additionally reachable through
  one **unified command entry point** that dispatches by command name and
  publishes a machine-readable catalog of every command it accepts — name,
  invocation, description, parameter schema, examples, deprecation — so an
  automated assistant discovers exact call shapes without reading code.
- **Starting a feature** is a single guarded operation, invoked when new work
  begins after the previous feature has fully closed.
- A generic phase, mode, feature, summary, or next-action change must name the
  selected default or lane record's valid phase from immediately before the
  change. That pre-change phase is the routing owner for this mutation only.

## Data Dictionary

| Element | Meaning |
|---|---|
| phase | Where the active feature stands. Closed vocabulary: idle, exploring, planning, validating, swarming, reviewing, scribing, compounding, grooming, and the terminal alias compounding-complete. Any other value is rejected — including plausible-sounding stage-completion names, which are not phases: completion is carried by the granted gate, never by a phase name. |
| active routing owner | The selected default or lane record's valid phase immediately before a generic routing change. It is supplied for that change only, is never stored as a separate field, and rolls forward automatically when the phase changes. |
| tail of the chain | The final stretch a feature must pass through to be closed: execution → a recorded knowledge sync → learning capture → the terminal state. Its three steps are the only route to a closed feature; each demands proof that the step before it actually happened, so a feature cannot be declared closed by asserting the closure. |
| knowledge sync record | The durable stamp that the settled behavior of the current feature has been merged into its area specs. It carries the feature, the areas synced, and a precise timestamp. Recording it is the ONLY way to enter the learning-capture phase — that phase can never be asserted directly. |
| spec debt | Every completed unit of work that changed observable behavior and was completed *after* the last knowledge sync for this feature. Zero while idle. It is advisory wherever it is displayed (status, session preamble, worker-return nudge — none of them block), and binding at exactly one moment: the close. |
| debt waiver | The sanctioned way to close a feature whose spec debt is genuinely spec-irrelevant. It permits the close, but it is never silent: it records a durable decision naming every unit of work whose behavior was left out of the specs. |
| gate | One of four named human approvals (context, shape, execution, review). Granted per feature; all four reset to ungranted when a feature starts. The review gate is granted only through a user-invoked review session that covers the feature — a feature closes normally with it ungranted. |
| adviser consult record | The durable stamp that the orchestrator consulted the configured adviser before asking to open execution on high-risk work. Carries when it happened, who was consulted, the head of the advice digest, and three machine-stamped anchors — the active feature, the newest active decision id, and a fingerprint of the plan document — recorded by the verb itself, never supplied by the caller. |
| consult staleness | A consult record is stale when any of four real events occurred after it: the active feature changed; a newer decision became active; the plan document changed; or the execution gate was revoked. Never a time limit — staleness is event-based by rule. A stale record simply stops satisfying the precondition; nothing deletes it. |
| gate bypass level | The opt-in autopilot setting that decides *who* approves gates 1-3 — the human, or the agent recording the choice the human would recommend. Four levels, each a strictly wider floor than the last. `off` — every gate stops for the human (absent/false reads as `off`). `normal` (the legacy `true`/`on`) — gates 1-3 auto-approve for tiny/small/standard work only; high-risk and hard-gate work, secret-file reads, and the review Gate 4 still stop. `full` — also auto-approves high-risk/hard-gate gates 1-3; only secret-file reads and a review's P1 findings still stop. `total` — auto-approves everything and stops for nothing: every gate at every risk level, secret-file reads, and review P1 findings all auto-proceed. The status boolean stays true for any level other than `off`; the level string carries which floor is in force. No level ever creates or approves a review session (R11). |
| terminal state | idle or compounding-complete — the only phases from which a new feature may start. |
| nonterminal cell | A unit of work still open, claimed, or blocked. Its existence blocks a new feature start until it is capped or explicitly dropped on the record. |
| handoff record | The baton one session leaves for the next, in exactly two kinds. **pause** — a mid-work snapshot (today's meaning): surfaced and WAITED on, never auto-resumed; blocks a default feature start until resolved. **planned-next** — a deliberate task handover written only through its guarded verb: the previous unit is finished with green verification, the next unit's claim is carried inside the record, and the writing session is named (`writer_session`). A record with a missing or unknown kind is treated as pause everywhere — the fail-safe for every legacy record. |
| review session | The durable record of one user-requested independent review: who asked and when, the scope as the user described it, the exact included and excluded work (each exclusion carries a reason), the two immutable range anchors (baseline and head), the reviewer manifest actually dispatched, the pre-dispatch evidence check result, findings, user-acceptance items, and the decision. Identifiers are stable and never reused. |
| review candidate | One completed change set awaiting (or holding) review coverage: the feature, the range anchor at close, and the feature's lane. Recorded once at feature close in an append-only ledger; prior entries are never rewritten. |
| review status | Derived at read time, never stored. `verified` — completion evidence exists (every completed change). `unreviewed` — no approved session covers it (including every legacy feature with no record). `in review` — an open, not-yet-approved session includes it. `reviewed` — an approved session covers exactly its range anchor. `review stale` — an approved session covered it, but newer changes landed after that session's head; the old coverage keeps its audit trail while the newer delta is unreviewed. |
| baseline / head | The two immutable anchors a review session's diff is built from. Coverage attaches only to these — never to a feature name or a date. |
| command catalog | The machine-readable inventory of commands exposed through the unified entry point. Each entry names the command, its invocation, purpose, accepted parameters, runnable examples, and whether it is deprecated. |
| adviser | An optionally configured, stronger assistant a dispatched worker may ask for guidance after a failed verification attempt. Configured per runtime beside the reviewer role; may point at a different provider entirely. Unset means no adviser exists — nothing substitutes for it. |
| consult | One evidence-backed question from a stuck worker to the adviser plus the reply. Budgeted: at most two per claim of a work unit; a re-dispatch of the same unit grants a fresh budget. |
| degenerate consult | A consult that would ask literally the same model the worker itself runs on — the one honest no-op, and the only consult the dispatcher skips (72f3d6dd/AO5: the configured adviser is the adviser; no family test, no strength test, no self-judged skip — a strength ladder was removed by AO5). An external-command adviser is never the same model, so it is always offered. |
| catalog fingerprint | A local fingerprint of the command catalog from the previous invocation. It detects that the discoverable surface changed without altering a command's normal result. |
| working session | One terminal's live occupancy of the project, recorded durably with its start time and a heartbeat that renews itself automatically on activity, throttled to a short minimum interval between writes so routine work does not spam the shared store. Claims and file holds name their owning session, and the same automatic renewal carries both of their leases forward at the same moment. |
| claim | Exclusive ownership of one unit of work by one working session, with a lifetime (TTL) and the owner's heartbeat. Created atomically through the SAME exclusive-creation primitive on every path that claims a unit — a direct claim by identity as well as the cross-session picker — so among any number of simultaneous claimants exactly one wins; every loser receives a typed refusal, never a crash. A claim with no owning session (a single-user, ownerless claim) remains a legal, supported shape. |
| typed refusal | The uniform "no" every coordination operation answers with on contention: a structured result carrying a refusal code and reason, never an exception. Codes and meanings: `SESSION_EXISTS` — the session record already exists; `SESSION_MISSING` — the named owner has no session record; `CLAIMED` — another live session owns the unit, naming it and its expiry; `GATE_HELD` — someone is mid-mutation on this claim, try again; `NOT_OWNER` — the caller is not the claim's owner; `NOT_FOUND` — no such claim exists; `LOCK_BUSY` — a shared coordination store's lock is held by another process past the wait budget, naming the holder. |
| coordination lock | The bounded-wait mutual-exclusion primitive guarding a shared coordination store's (holds, the durable workflow record) read-modify-write body against a second concurrent writer. A command-line verb waits for it (bounded retry); a lifecycle checkpoint never waits — it tries once and skips its own update silently when busy, the same fail-open discipline every checkpoint already follows. A holder that goes stale (far past the time any real read-modify-write body could still be running) is taken over by an atomic handoff — staleness is re-verified at every retry, never cached, so at most one process ever believes it holds the lock at once. |
| adoption | Ownership transfer of a live claim to a successor session (the fresh-session handoff, D1). Performed under the claim's own exclusive gate while the claim record stays continuously present — at no instant does the unit look unclaimed, so no third session can seize it mid-transfer. An automatic lease renewal (the heartbeat above) never fires against a claim mid-transfer — it is skipped that cycle rather than risk reverting the transfer. |
| reclaim (sweep) | Taking back an abandoned claim. Permitted only when BOTH the claim's lifetime has expired AND its owner's heartbeat is stale, re-verified while holding the claim's gate. A stall signal alone never justifies stealing live work. |
| lane | One feature's own pipeline record — its feature name, mode, phase (same closed vocabulary), all four gates, summary and next action — living beside the default record so several features can be active at once. The default record is itself a lane: the one every unbound session sees. |
| lane binding | The lane named on a working session's record. Resolution order is fixed: the session's bound lane when it names an existing lane, otherwise the default record — never a guess, never a scan. A binding to a missing or corrupt lane answers with a typed refusal (`LANE_MISSING`/`LANE_CORRUPT`/`LANE_INVALID`). While unbound, the session record simply omits the binding. |
| computed schedule | The mechanically derived dispatch plan for a feature's units of work: numbered waves plus diagnostics (dependency cycles, unsatisfiable dependencies, units declaring no touched paths). Derived on demand from each unit's declared dependencies and declared touched paths; never stored, so it can never go stale. Advisory-but-default: orchestration follows it unless a reason for deviating is stated. |
| wave | One numbered set of units safe to work concurrently: every dependency of every member is either satisfied or in an earlier wave, and no two members' declared touched paths overlap. Waves contain only units that are open or actively claimed. |
| declared-path overlap | Two units collide when any pair of their declared touched paths overlaps, judged by the SAME path-overlap meaning the runtime write refusal uses — one semantics for prediction and enforcement, so the schedule can never call parallel-safe what the guard would deny. A unit declaring no paths overlaps nothing. |
| worktree resolution | `ordinary` — no accepted linked relationship, so existing single-checkout behavior applies. `linked-valid` — both Git pointers agree, so the physical checkout remains the work root while the validated main checkout supplies the shared store. `linked-invalid` — linked-shaped metadata fails validation, so coordination and writes refuse rather than use a local store. |
| work root / store root / logical path | The work root is the canonical physical checkout containing the target. The store root is the validated main checkout containing the single coordination store. The logical path is the repository-relative reservation key shared across physical worktrees. |
| control-plane attestation | The orchestrator-owned pre-dispatch record of canonical common Git location, worktree path and identity, initial symbolic ref, base revision, declared paths, and reserved paths. Worker output cannot supply or amend it. |
| merge-back | The orchestrator-owned transaction that integrates an attested worker revision into main, verifies committed main with provenance, and disposes of clean reachable worker state or preserves its recovery identity. |
| auto-serialize | The scheduler's answer to a legal collision: the colliding unit moves to a later wave. Overlap is never refused and never dispatched concurrently "carefully". |
| unsatisfiable dependency | A declared dependency that can never be satisfied as things stand: it names a unit that does not exist (`missing`), or one that is `blocked` or `dropped`. The dependent unit is excluded from every wave and reported in diagnostics with its reason — never a crash, never silently scheduled. |
| attempt history | An append-only record on a unit of work: every verification (pass or fail) and every block appends one entry — a sequence number, when it happened, the owning session and the moment it acquired its claim, the worker, the outcome, and a failure signature. The acquisition moment is stamped once when the claim is created and never changes afterwards — lease renewals (heartbeats) update only the claim's expiry clock, so a long-lived claim's entries all carry the same acquisition identity. All appends to a unit's record run under that unit's own exclusive gate, so simultaneous verifications or blocks never lose an entry; distinct units never wait on each other. Entries survive completion and can never be edited or removed by any update path; a unit with no history yet (every legacy unit) behaves exactly as before. |
| failure signature | A short fingerprint of a failure: either supplied directly by the worker or derived mechanically from the recorded verification output, with timestamps, absolute paths, and hex runs stripped before fingerprinting, so two runs of the same underlying failure produce the same signature. |
| lifetime budget | A unit of work's ceiling — on how many times it may be claimed, how many verification attempts may fail, and how many of those failures may share an identical failure signature — measured over the unit's whole life, never reset by a fresh claim. Claim usage is counted by distinct acquisitions (owning session + immutable acquisition moment), so lease renewals never inflate the count. Unstated defaults (3 claims, 4 failed attempts, 2 identical-signature failures) apply whenever a unit declares none of its own. Declared budgets must be whole numbers of at least 1 and are refused at authoring when malformed or above the hard ceiling (three times each default: 9 claims, 12 failed attempts, 6 identical-signature failures); no path — authoring, update, or resolve — can take a budget above that ceiling. |
| budget exhaustion | The typed refusal a claim attempt receives once a unit's lifetime budget is spent, naming which budget ran out, a summary of the attempt history, and the one sanctioned door back in. Two failed attempts sharing an identical failure signature exhaust a unit immediately, regardless of the claim-count budget — the signal is that the approach must change, not that another try is warranted. |
| budget reset | The one audited door that reopens an exhausted unit: it requires a stated reason AND a named actor (an explicit operator name, or the acting agent's ambient identity — with neither, the reset is refused), and it is refused outright when the unit is not actually budget-blocked (a healthy unit has nothing to reset). The durable audit decision — naming the actor — is recorded BEFORE the unit's record is rewritten, so even a crash mid-reset leaves the audit trail; the reset marker appended to the unit carries the actor. It never edits or removes a prior attempt-history entry. |
| change classification | The category of change a unit of work makes — formatting, bug fix, behavior change, API change, security change, or migration — set explicitly at authoring or, when absent, derived only from the behavior-change flag (a behavior-changing unit is classified as a behavior change; anything else is left unclassified). |
| minimum verification standard | An advisory expectation of what "enough" verification looks like for each change classification, checked at authoring time and reported as a warning naming the missing minimum — never a refusal, and never folded into the machine-parseable result of the write. |
| proof-of-red requirement | The one classification with teeth at completion: a behavior-changing unit's recorded proof that the change actually fixed something real must be substantial (not a token placeholder) and must not duplicate another unit's recorded proof word-for-word; falling short refuses completion, naming the missing minimum or the colliding unit. A unit riding the existing deliberate-exceptions door keeps that door's original contract, with an advisory noting it took that door instead. |
| judge verdict | A structured record — pass or needs-revision, with one entry per checked truth and its evidence, whether a needs-revision finding looks automatically fixable or needs a person, and how confident the judge is — attached append-only to a unit of work. It stamps which model built the change and which model judged it, and an honest independence status: `confirmed` only when both models were pinned to a specific identity and genuinely differ, `same-model` when they match, `unverified` otherwise — never a guess. Free-form prose is not a verdict; it is a failed judge run, re-dispatched once, then recorded `unverified`. A verdict is not log-only: while a unit's LATEST judge verdict is needs-revision, completion (capping) is refused with a typed error naming the way back — rework and record a passing verdict, or complete with an explicit override reason. An override is always audited twice (an append-only override marker on the unit carrying when, why, and the verdict it overrode, plus a durable decision recorded before the unit is rewritten); a unit with no judge verdicts completes exactly as before. |
| goal-check judge | A read-only semantic check dispatched during the swarming goal-check, scaled by the lane's risk: tiny and small lanes stay mechanical-only; standard lanes get one judge per completed behavior-changing unit, checking its claimed truths against the actual change, its cited decisions, and whether the task and the change actually match; high-risk lanes get the same judge with a preference for a model independent from the builder, recording the outcome honestly either way. This judge is part of finishing a unit, never the user-invoked independent review — it can never open, approve, or substitute for a review session. |

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

**B7 — Cell plans are revisable in place, execution records never.** A unit of
work's PLAN fields (title, action, scope files, reading list, dependencies,
cited decisions, acceptance contracts, verify command, lane, behavior flag)
can be revised after creation through one guarded operation — the normal path
when a pre-execution review prescribes a fix. The door: only open or blocked
units accept revision (claimed = a live worker owns it; capped/dropped = the
frozen audit record); identity (id, feature), status, the execution trace, and
the model tier are refused by name with a hint at the owning operation; an
unknown field refuses the whole patch (the updatable list is derived from the
validator map, so a forgotten field is a refusal, not a leak); a
present-but-corrupt record refuses loudly with the file untouched; a revision
that would leave a standard/high-risk unit without acceptance truths is
refused. Observers see either the old plan or the fully revised plan — never a
partial merge.

**B8 — Unified command discovery and dispatch.** Every workflow operation — all
nine verb groups — is available both through its specialized entry point and
through one unified entry point, and the unified side owns the single
implementation: each specialized entry point is a thin forwarder whose output
is byte-identical to the unified path, and a new verb is added exactly once
(one catalog entry plus one handler), never re-implemented in a forwarder.
The unified entry
point publishes the complete command catalog in human-readable and
machine-readable forms. It validates required parameters and their value shapes
before dispatch, then invokes the same underlying operation as the specialized
entry point; it does not run one command-line program from another. For the same
valid request, observers receive the same result and exit outcome through either
surface. This includes revising an open or blocked work cell's allowed plan
fields. An unknown command is refused with the nearest known command when one is
available. A malformed request is refused with the command, field, and reason,
without executing the operation. After a catalog change, observers receive a
separate diagnostic signal while the requested command's normal output keeps its
stable shape.

**B9 — A stuck worker may consult a configured adviser, inside its own turn.**
When the dispatcher assigns a work unit to a worker, it first resolves the
configured adviser. The configured adviser IS the adviser — no family test, no
strength test, no self-judged skip (72f3d6dd/AO5); the dispatch omits it only
when the adviser resolves to literally the same model the worker runs on (the
one honest no-op — an external-command adviser is never the same model, so it
is always offered, workers on the session's strongest tier included). If an
adviser is offered, the dispatch names it and exactly how to reach it. The worker may consult
only after its first serious failed verification attempt, sending an evidence
bundle: the exact check it ran, the failing output, its diagnosis, the relevant
excerpts, and where the locked feature decisions live — never secrets or
credential values. The canonical loop: first failure → consult → advised retry
→ (second failure) → one follow-up consult → final retry → blocked, with every
consult summarized in the worker's report (count, adviser identity, one-line
question/answer digest). Each consult also lands one recognizable, attributable
entry in the dispatch audit log naming the work unit and the adviser. What
observers see: a worker with no adviser named in its dispatch behaves exactly
as before (two failures → blocked); the orchestrator's rescue ladder is
unchanged except that it knows an arriving blocked unit already spent its
consult budget.

**B9a — High-risk execution approval requires a live adviser consult.** Opening
the execution gate on a record in the high-risk mode refuses — typed error,
zero mutation, the corrective message naming every failed condition and the
exact consult flow — unless a non-stale adviser consult record exists. The
consult itself is orchestrator machinery, not a human checkpoint: it runs under
every autopilot level (autopilot lifts human stops, never mechanical
preconditions). The orchestrator resolves the configured adviser, runs it
**read-only** with an evidence bundle (plan summary, risk map, validation
findings — never session history, never secrets), and records the consult; a
workspace with no adviser configured records that fact and proceeds — the rule
adds one trigger, not a dependency on configuration. Revoking the execution
gate stamps the revocation moment, which makes any earlier consult stale.
Non-high-risk modes, the other three gates, and revocation writes are
untouched. Advice never approves a gate and never overrides a locked decision.
What each actor observes: the assistant sees either a clean approval or the
refusal with its fix; the audit trail gains the consult record; a worker's own
mid-flight consult loop (B9) is unchanged.

**B10 — A whole slice of work units is created in one all-or-nothing call.**
Creating the current slice's units accepts the full batch in a single request;
every unit is validated (including duplicate identifiers within the batch)
before any is written, so one invalid unit means zero units created. A
single-unit request still works the same way. After a successful create or
amend, the verb also lints each written unit for one known authoring trap: a
verification command that checks the release manifest while the unit's file
list omits the manifest itself (a cold implementer would end red with no
sanctioned fix). The lint is a loud advisory line naming the trap and the fix —
it never refuses the write, never changes the outcome, and tolerates malformed
shapes silently (cells pah-2, 2026-07-18).

**B11 — Concurrent sessions coordinate through atomic claims, on every claim
path, not only the cross-session picker.** Trigger: a working session wants
exclusive ownership of a unit of work while other sessions may want the same
unit at the same moment — whether it asks for a specific unit by identity or
pulls the next available one. What happens: the claim is created by exclusive
creation — a storage-level operation that cannot succeed twice — so exactly one
claimant wins; every other claimant receives the typed refusal `CLAIMED`,
naming the winner and its expiry, and remains free to pick other work. The
winning claim carries its owner, lifetime, and heartbeat; a claim with no
owning session (a single-user, ownerless claim) is a legal, supported shape.
The exclusive token behind a claim is released on EVERY transition that clears
it — completion, hand-back, block, drop, or reopen — not only the
cross-session-picker's own unwind, so a same-session round trip (claim, block,
reopen, claim again) never self-refuses against its own prior claim. Mutating a
live claim (adoption to a successor session; reclaim of an abandoned one)
happens only under that claim's own exclusive gate, with the claim record
continuously present throughout — an observer polling at any instant sees the
unit owned by exactly one session, never unowned mid-transfer. Reclaim
additionally re-verifies, while holding the gate, that the lifetime is expired
AND the heartbeat is stale. Single-winner behavior is proven by repeated
multi-process races on both supported platforms (Linux/WSL2 and Windows),
exercised through every claim path, not only the picker. What each actor
observes today: the full flow is wired — sessions and lane bindings are
commandable (B12), the readers consult them (B13), cross-session holds are
enforced at write time (B14), a finished task hands itself to a fresh session
(B15) which can then pull further approved work (B16), a shared coordination
store never silently drops a concurrent write (B21), a session's identity is
never handed down by another party (B22), mutating a claimed unit checks
ownership (B23), and a live session's heartbeat and leases renew themselves
(B24).

**B12 — A feature can start as its own lane, and every lane mutation is
commandable.** Trigger: new work begins while other features are mid-flight.
What happens: starting a feature *as a lane* creates that feature's own
pipeline record and resets exactly its four gates in one atomic write, leaving
the default record and every other lane byte-identical. Its preconditions are
lane-scoped, with attribution **derived from existing records, never new
fields**: an unfinished unit blocks only if it belongs to this feature; a
pause snapshot blocks only if it names this feature; a registered worker
blocks only if its unit belongs to this feature; and — globally — declared
intended paths refuse when they overlap another session's live holds. The
default (non-lane) feature start keeps its original whole-repo semantics
unchanged. Every lane mutation has a command verb: the state mutation verbs
accept a lane selector routing the write to that lane's record (with a safety
refusal when a mutation would silently rename a lane's identity), lanes are
listable with their phases/gates/bindings, and sessions are listable and
bindable/unbindable to a lane. Every published command example is executed by
the suite against the real operation. What each actor observes: an agent in a
zero-lane repo sees exactly the pre-lane behavior of every verb; an agent
using lanes sees per-feature pipelines whose gates never bleed into each
other.

**B13 — Readers resolve through the acting session's lane.** Trigger: any
read of "where does the workflow stand" while lanes exist. What happens, per
reader: **claim authorization** — a unit of work is claimable only under its
own feature-lane's execution approval when such a lane exists; an unapproved
lane refuses even though the default gate is granted, an approved lane
authorizes even though it is not, and a corrupt lane record refuses loudly
rather than falling back (the lane never borrows the default pipeline's
authority — fresh-session-handoff D2). **Write gating** — the production write
guard passes the acting session's identity (carried on every guard event) into
the check, so a bound session is judged by its own lane's phase and gates; an
event without the identity is judged exactly as before. **Presentation** — the status surface lists every
lane with its phase, gates, and bound sessions; the session preamble, given a
bound session, shows that lane's view plus a one-line count of other active
lanes; the two lifecycle guardrails (mid-work warning, session-close warning)
judge the acting session's own lane. What each actor observes in a zero-lane
repo: byte-identical output everywhere — the entire migration is invisible
until a lane exists.

**B14 — A write into another live session's held path is refused at write
time.** Trigger: any write attempt while the acting session's identity is
known. What happens: when the path overlaps a hold owned by a *different*
session that is still live (within its lifetime), the write is refused with a
typed message naming the holder — its session and its worker name — and when
the hold expires. What never blocks: the acting session's own holds, expired
holds, and legacy holds that predate session ownership (they carry no owning
session and keep their original worker-level meaning). The refusal is
unconditional on workflow phase — it fires in every phase, including mid-
execution. When the hold ledger exists but cannot be read, a session-aware
write is refused (fail-closed, as a returned refusal that survives the
guard's fail-open crash handling — never a thrown error, which the guard
would swallow into an allow); a ledger that simply does not exist blocks
nothing. What each actor observes: the blocked session gets the who-and-until
message and stays healthy (free to pick other work); the holding session is
undisturbed; a repo with no session-owned holds behaves exactly as before
(fresh-session-handoff D3).

**B15 — A finished task hands itself to a fresh session through the two-kind
handoff.** Trigger: a session finishes a unit (finished = capped with green
verification) and a next unit has been claimed for it. What happens: the
planned-next handoff is written through its guarded verb — the verb itself
refuses (typed, zero mutation) when the previous unit is unfinished, its
verification did not pass, or the carried claim is absent or not owned by the
writer; the owner then starts a fresh session (types the clear command). At
session start, only on the **fresh-session boundaries** (a cleared or newly
started session) does the runtime adopt the carried claim for the new session
— ownership transfers through the claim's gate, the record staying present
throughout, so a third session racing for the same unit loses with a typed
failure — and the new session's opening context replaces the wait-block with
a start-now instruction naming the adopted unit, its verification command,
and its lane. On a **resumed or memory-compacted** session the runtime never
adopts: the handoff stays on disk untouched and is shown as pending — those
events are not a fresh session, and auto-resume authority exists only at the
fresh-session boundary (D1). A pause handoff — and every legacy record
without a kind — renders exactly today's present-and-wait block. A failed
adoption never fabricates a start-now instruction; the reason is shown and
the wait presentation applies. Clearing the record happens after adoption and
recovers idempotently if interrupted (never claimed as atomic across files).

**B16 — A session out of work pulls the next approved unit itself.** Trigger:
a session asks for its next unit (typically right before writing a
planned-next handoff). What happens, in order: expired claims are swept first
— a unit claimed by a dead session (lifetime expired AND heartbeat stale) is
reclaimed in the same pass, so "no work" is never reported while such a unit
exists; then selection prefers the session's own lane's ready units (its
execution gate approved), then ready units of OTHER lanes **whose execution
gate a human approved** — an unapproved lane is never touched even when its
units are the only ready ones (the puller never widens authority, D2); a lane
**actively owned by another live session** — some other session is bound to it
and its heartbeat is still fresh (the same staleness rule that governs claim
reclaim) — is never pulled from either, even when its units are the only ready
ones anywhere: the planner keeps the work it just planned (GH #20), and only a
stale-heartbeat owner leaves its lane reclaimable again (steal-after-death is
preserved). The default pipeline record carries no session binding, so this
ownership guard applies to lanes only, deliberately; the acting session's own
binding never blocks its own pull, and explicitly claiming a named unit stays
possible (orchestrator assignment is intent, the guard governs only automatic
selection). Units whose files overlap another session's live holds are skipped;
cross-lane order follows the product backlog's ranking (by the lane's feature
row), falling back to lane age. Nothing qualifies → the typed answer "no
approved work left", and the session stops honestly. Claiming the chosen unit is
crash-safe: the cross-session claim file is taken first, the work record
second, and a failure of the second releases the first (no orphaned claim).

**B17 — The schedule is computed, not guessed.** Trigger: anyone asks for a
feature's dispatch plan (a read-only schedule query, filtered to one feature or
spanning all work). What happens: the schedule is derived fresh from the
declared record — dependency layering first (a dependency on a completed unit
counts as satisfied), then collision packing (declared-path overlap within a
layer defers the colliding unit to a later wave, in deterministic id order) —
and answered as numbered waves plus diagnostics: dependency cycles, unsatisfiable
dependencies with their reasons, and units declaring no paths. The query never
writes anything. What each consumer observes: the orchestrator dispatches wave
by wave and deviates only with a stated reason; feasibility validation of a
multi-unit slice requires the diagnostics to be clean before execution is
approved; a planner sees that overlapping declared paths are legal but cost a
wave, so partitioning quality is visible at plan time instead of surfacing as
mid-flight write refusals. The runtime write refusal stays in place unchanged —
the schedule predicts it; it never replaces it (parallel-scheduler D1/D2/D4).

**B18 — A dependency cycle is refused at the door.** Trigger: any write that
creates or changes a unit's declared dependencies — adding one unit, adding a
batch, or updating an existing unit's dependencies. What happens: the write is
checked against the union of the existing record and the incoming change; the
refusal is scoped to cycles the write itself introduces or participates in
(self-dependency included) — if any member of a resulting cycle is part of the
incoming change, the entire write is refused before anything lands — a batch
is all-or-nothing — and the refusal names the cycle's member ids. The
structural check spans units of every status. A cycle that exists only among
untouched pre-existing records never blocks an unrelated write: a legacy store
with a cycle is reported by the schedule query's diagnostics, and the only
writes it refuses are ones that would keep one of its own members inside the
cycle — a change that breaks the cycle is always allowed. What the caller
observes: an immediate, specific "no" at write time, so an impossible plan is
impossible to record; pre-existing records are never mutated by the check
(parallel-scheduler D2; scope sharpened by review fix parallel-scheduler-5).

**B19 — A generic routing mutation is phase-owned.** Trigger: a caller changes
phase, mode, feature, summary, or next action through the generic state command.
The command first reads the selected default or lane record strictly. A missing,
invalid, or mismatched pre-change owner refuses the operation with the record
byte-identical. A matching owner changes only that selected record; the owner is
not persisted, and a phase change makes the new phase the owner of the next
change. Gate writes remain separate and require no owner. Independent review
keeps its findings and decision inside its review-session record and never uses
generic routing mutation to change execution readiness.

**B20 — Eligible workers may execute in isolated linked worktrees.** Trigger: an
enabled Claude multi-worker wave has at least two workers and the orchestrator
opts into isolation; shared checkout remains the default, with one explicitly
defined single-worker validation run as the sole acceptance exception. Before
dispatch, the orchestrator validates both Git pointers and captures the
control-plane attestation. A valid link keeps the physical work root and routes
all state, claims, and reservations to one main store. Missing or inconsistent
attestation makes the mode ineligible; linked-shaped invalid metadata produces
a typed refusal and never falls back to a local coordination store.

Every write-capable operation proves canonical physical containment before
logical normalization and reservation lookup. Existing targets use their
canonical location; new targets use the nearest existing ancestor. Traversal,
outside absolute paths, symlink escapes, and unresolvable targets are refused
before mutation, while owner and foreign-reservation semantics stay unchanged.

On completion, the orchestrator independently rechecks identity, symbolic ref,
common Git location, base ancestry, and that every changed path is reserved.
Only then may it begin merge-back without finalizing a commit. A conflict or
targeted red check aborts with main history unchanged. Targeted green permits
the merge commit, followed by exact full verification on committed main with
working directory, pre/post revisions, ancestry, command, and output recorded.
Unexpected post-commit red creates a non-destructive revert before any later
work and preserves worker state. Automatic cleanup requires a clean worker
checkout, green committed-main verification, and a worker revision reachable
from main; removal and branch deletion are non-force. Every other outcome
preserves recovery identity. Destructive disposal requires explicit operator
authorization plus captured status, diff, revision, reachability, and a
recovery reference or patch.

**B21 — A shared coordination store serializes its own concurrent writes.**
Trigger: two or more sessions attempt a read-modify-write against the same
shared coordination store (a hold ledger, the durable workflow record) at the
same moment. What happens: each read-modify-write body runs inside that
store's coordination lock (Data Dictionary) — acquired by exclusive creation
with bounded retry, and a stale holder is taken over by an atomic handoff
rather than an unconditional removal, so a waiter can never delete a fresh
holder's lock out from under it; staleness is re-verified at every retry,
never cached. A command-line verb waits for the lock, bounded; a lifecycle
checkpoint never waits — it tries once and, if busy, skips its own update
silently, preserving the checkpoint's existing fail-open discipline. On a
genuine timeout the caller receives the typed `LOCK_BUSY` refusal naming the
current holder — never a silent fall-through to an unlocked write, because
mutual exclusion is the entire point. What each actor observes: no hold and no
coordination-record write is ever silently dropped by a second concurrent
writer; a checkpoint that loses the race simply skips one opportunistic
refresh, with the next one along shortly (D2).

**B22 — A session's identity is derived automatically, never handed to it by
another party.** Trigger: any operation that records or checks a session's
ownership — claiming, holding, or renewing. What happens: the acting session's
identity is resolved from its own runtime environment at the moment of the
operation, in a fixed order of preference, with an explicit override reserved
for tests; nothing else ever substitutes a different party's stated identity
for the caller's own. What each actor observes: an operation with no
resolvable identity still records an ownerless (sessionless) entry exactly as
it always could; every other operation is now attributed to the real acting
session by default rather than only when a caller opted in, so cross-session
holds and claims become visible without any special handling (D3).

**B23 — Mutating a claimed unit of work requires the caller to own it, with an
audited rescue door.** Trigger: any operation that would change a claimed
unit's state — recording verification, completing it, blocking it, releasing
it, or reopening it. What happens: the operation compares the caller's own
derived identity (B22) against the unit's live claim. A live claim owned by a
different session refuses — typed, naming the owner and when its claim
expires. An expired claim, an absent claim, an ownerless claim, or a claim the
caller itself owns all proceed exactly as before — a single working session
never encounters this refusal. An explicit forced override exists for genuine
rescue: it proceeds regardless of ownership and always appends a permanent,
append-only audit entry to the unit's own record — never silently — and that
entry survives the unit's own completion, kept apart from any other audit
trail the unit already carries so a later mutation can never overwrite it. A
forced release of a claim also clears or hands off the underlying claim
record, so the rescued unit is not left unclaimable by anyone. What each actor
observes: normal single-session work is unaffected; a session that tries to
mutate another live session's claimed work gets a clear refusal instead of
silently overwriting it; a deliberate rescue always leaves a trace (D4).

**B24 — A live session's heartbeat renews itself, throttled, and carries its
claims and holds forward with it.** Trigger: a working session performs any
tracked activity while it is already known to the coordination store. What
happens: the session's heartbeat record refreshes automatically, at most once
per a short throttle window (well under the staleness threshold that governs
reclaim), so routine work does not spam the shared store with writes. In the
same moment, every claim and hold the session owns has its lease renewed —
except a claim currently gated by an in-flight ownership transfer (B11
adoption), which is skipped rather than rewritten, so an automatic renewal can
never revert a transfer that is mid-flight. This automatic renewal is
opportunistic, not authoritative: it runs through the same never-wait,
try-once discipline as any other lifecycle-triggered write (B21), and a
failure to renew never blocks or delays the session's own primary work. What
each actor observes: a session that stays genuinely active never goes stale,
so its claims and holds are not mistakenly reclaimed out from under it; the
accepted residual is that a session idling in unrelated activity still
renews — the audited forced door (B23) and release on any claim-clearing
transition (B11) remain the rescue; the staleness threshold itself is
unchanged, so real silence that long still genuinely means the session is
gone (D5).

### Closing a feature — the tail of the chain

Closing is the one stretch of the pipeline where each step must *prove* the step
before it happened. The phase vocabulary alone never granted that proof: the
names asserted history ("both the knowledge sync and the learning capture have
run"), while nothing checked whether either had. A feature could therefore be
marked closed straight from execution, and this is exactly what happened
repeatedly — the settled behavior of six completed units never reached the
specs, and the only trace was a knowledge-sync record that stayed empty.

Three rules now hold the tail together. Together they make "declare it closed"
impossible; the only way to close is to actually close.

**Entering learning capture is never an assertion.** The learning-capture phase
cannot be set directly, from any phase. It is *produced* — and only produced —
by recording a knowledge sync. Attempting to set it names the recording step as
the way. This means the phase is reachable if and only if a real sync was
stamped, because stamping it is the sole door.

**Recording a knowledge sync demands that work was executed.** The recording
step is refused unless the feature currently stands in a phase where execution
has actually happened (execution, independent review, or the sync itself). It is
not possible to sync the knowledge of work that was never done.

**Reaching the terminal state demands the phase before it AND zero spec debt.**
The terminal state may be entered only from learning capture, and only while no
completed behavior-changing unit is still missing from the specs. The refusal
names *every* such unit by identity — not a count — and discloses the waiver.
A refused close is side-effect-free: the phase is left exactly as it was.

**The waiver is a door, not a hole.** A feature whose settled behavior genuinely
belongs in no spec may still be closed, by waiving the debt explicitly. The
waiver permits the close and simultaneously records a durable decision naming
every unit whose behavior was left out. Nothing about it is silent, and nothing
about it is the default. It exists because a guard with no door gets a hole
punched in it — a fail-close with no sanctioned exit teaches its user to work
around the guard instead of through it.

Everything outside the tail stays permissive: moving backward to an earlier
phase is always legal (a failed feasibility check or a negative proof must be
able to return to planning), and returning to idle — the way an abandoned
exploration is dropped — is unaffected.

**What each actor observes.** The agent attempting a dishonest close gets a
refusal that says which step was skipped and how to perform it, and the record is
untouched. The human sees a feature that cannot be reported as finished until
its knowledge actually landed — the state and the specs can no longer disagree.

**B25 — The approved plan document is frozen; the current slice lives only in
work units.** Trigger: shape approval is granted for a feature whose lane keeps
a plan document (lane-ceremony-v3 D1/D2/D9). What happens: from that moment the
plan document's content is immutable — the only permitted post-approval write
is an approval stamp (status and time). Preparing execution never rewrites the
plan into a different readiness state; the current slice is represented solely
by the feature's open work units (each carrying its own touched paths,
acceptance contract, and verification command), and "next slice" means the next
batch of units created by planning — no slice document exists anywhere. What
consumers observe: the artifact the approver reviewed stays byte-identical
through execution; the plan fingerprint anchoring the adviser consult record
can change only before approval (or through a human superseding a decision);
implementation-plan projections drift — and demand re-rendering — only when
work units change, never because the plan moved after its gate. Lanes without a
plan document (tiny always; small by default) are untouched by this rule: their
work shape is the unit itself (doctrine-layer R13).

**B26 — Every verification or block appends one entry to a unit's attempt
history.** Trigger: recording a verification result (pass or fail) or blocking
a unit of work. What happens: exactly one entry is appended — a sequence
number, when, the owning session and the moment it acquired its claim, the
worker, the outcome, a failure signature (worker-supplied or mechanically
derived from the verification output), and an optional note. The history is
append-only: no revision path may edit or remove an entry, and entries survive
completion — the same execution-trace freeze that already refuses a plan
revision touching the trace (B7) covers the whole history. What each actor
observes: a unit with no history yet (every legacy unit) behaves exactly as it
always did (self-correcting-loop D1, Δ1).

**B27 — A unit's lifetime budget is enforced at the moment of claiming, inside
the same exclusive operation that decides ownership (B11).** Trigger: a
session claims a unit, whether by identity or through the automatic picker.
What happens: the claim is granted first, then its budgets are checked against
the attempt history; exceeding the claim-count or failed-attempt ceiling, or
two failed attempts sharing an identical failure signature, refuses the claim
and releases the just-granted claim in the same operation, so the caller never
ends up holding a claim it was refused — the enforcement therefore lands at
the very next claim attempt, bounded to at most one attempt of overrun. The
refusal names the exhausted budget (or the repeated signature), a summary of
the attempt history, and the sanctioned door (a budget reset). The automatic
work picker skips a budget-exhausted or repeated-failure unit when selecting
the next unit, so one looping unit never bricks the whole pool of ready work —
only claiming a unit by its identity surfaces the refusal directly. No
autopilot level ever overrides either refusal: these are loop-safety stops on
a unit's own history, not human approval gates, and they answer the same "no"
whether a human or the agent is driving. A unit with no attempt history
(legacy) is measured against the unstated defaults and behaves exactly as
before until it actually starts looping. What each actor observes: normal
single-attempt work is unaffected; a unit that keeps failing the same way
stops being reclaimable until someone explicitly resets it with a reason
(self-correcting-loop D2, Δ1-Δ3).

**B28 — A budget reset is the sole door back into an exhausted unit, and it is
never silent.** Trigger: an operator decides a unit's approach has genuinely
changed and it deserves a fresh budget. What happens: the reset requires a
reason, records a durable decision, and appends a reset marker to the unit's
own record; it never rewrites or removes a prior attempt-history entry. What
each actor observes: after a reset, lifetime-budget accounting (B27) resumes
counting from the marker forward, so attempts before the reset stop being held
against the unit's new attempts (self-correcting-loop D2).

**B29 — Authoring a unit of work classifies its change, and an insufficient
verification plan is a warning, never a block.** Trigger: creating or revising
a unit of work. What happens: the unit's change classification is set
explicitly or derived only from the behavior-change flag; the recorded
verification plan is checked against that classification's minimum standard
and, if it falls short, a warning names the missing minimum on the same
advisory channel authoring warnings already use — it never fails the write and
never appears in the machine-parseable result. What each actor observes:
authoring behavior is otherwise unchanged; an author who ignores the warning
is informed, not stopped (self-correcting-loop D3, Δ4).

**B30 — Completing a behavior-changing unit requires substantial,
non-duplicated proof that the bug was real.** Trigger: completing a unit
classified as a behavior change. What happens: the recorded proof-of-red
evidence must exist, be long enough to be a real account rather than a
placeholder, and must not be identical to another unit's recorded proof;
falling short refuses completion, naming the missing minimum or the colliding
unit — the duplicate check tolerates an unreadable sibling record by skipping
it rather than failing the whole scan. A unit riding the existing
deliberate-exceptions door keeps that door's contract unchanged, with an
advisory noting it took that door instead. What each actor observes: every
other change classification stays advisory-only in this version — only a
behavior change gets a hard door at completion (self-correcting-loop D3, Δ5).

**B31 — A judge verdict is a structured, append-only record with an honest
independence stamp.** Trigger: a judge examines a unit of work and renders a
verdict. What happens: the verdict is validated against one fixed shape before
it is accepted — free-form prose is not a verdict and is treated as a failed
judge run, re-dispatched once and then recorded as unverified rather than
accepted as free text. A valid verdict is appended to the unit's own record,
stamped with the builder's and judge's models as supplied by the dispatching
orchestrator at record time, and an independence status: `confirmed` only when
both models were pinned and genuinely differ, `same-model` when they match,
`unverified` otherwise — never a guess. What each actor observes: the verdict
history on a unit only ever grows; a malformed verdict never corrupts the
record, it simply fails validation with a named reason (self-correcting-loop
D5, Δ6).

**B32 — The goal-check's semantic judge scales with the lane's risk, and stays
inside the loop that finishes a unit, never the review gate.** Trigger: the
swarming goal-check evaluates a completed unit of work. What happens: tiny and
small lanes run mechanical checks only, unchanged; standard lanes dispatch one
judge per completed behavior-changing unit; high-risk lanes dispatch the same
judge with a preference for model independence from the builder, recording the
outcome honestly either way (B31). A needs-revision verdict whose finding
looks automatically fixable means the unit is not yet done — it is
re-dispatched with the exact failing checks, and the attempt history (B26)
gains a failed entry carrying the judge's failure signature; a needs-revision
verdict that needs a person escalates to the human instead of looping. What
each actor observes: this judge never creates, approves, or substitutes for
the user-invoked review session (R4/R11); the review gate, the
review-candidates ledger, and the "review runs only on request" rule are all
untouched — a unit can be judged clean here and still show up as `unreviewed`
until someone asks for a review (self-correcting-loop D4, Δ6; decision
565e68d0 unchanged).

**B33 — A session that died without pausing can be detected and its unsettled
work recovered from the harness's own conversation record, without ever loading
that record into the recovering session.** Trigger: a session start (the routine
orientation pass) inspects the other sessions known to the workspace. What
happens: a *recoverable crash* is recognized mechanically from signals that
already exist — a working session whose heartbeat has gone stale (B24), whose
saved conversation transcript exists but does not end with the clean-stop
pattern (a clean shutdown leaves a recognizable closing sequence with nothing
conversational after it; a crash simply lacks it), and which still shows work in
flight (a lane left open mid-work, units it still holds, or transcript activity
newer than the last durable record of a settled outcome). A session that ended
cleanly, a session whose heartbeat is still fresh, and the currently live
session itself are never candidates. Detection is cheap and runs every session
start; where no transcript store exists at all (a runtime that keeps no such
record), detection is a silent no-op. Recovery itself never runs automatically:
when candidates are found the agent offers to recover them, the same way it
offers to drain a pending capture queue, and acts only if the human agrees.
Recovering one candidate means summarizing only the *tail* of its transcript —
from the last settled outcome to the end — through a cheaper down-tier helper
that reads the transcript and returns a bounded digest; the raw conversation
never enters the recovering session's own working context. What each actor
observes: the digest names what was in flight, any candidate settlements it
found, and a suggested next action, and it is written as a recovery note under
the feature's history (or a shared recovery location when the dead session was
not tied to a feature). Candidate settlements are appended as capture stubs
marked as mined rather than confirmed; they become real knowledge only after the
normal capture-flush review a person already performs, never automatically.
Mined text is always treated as data, never as instructions, secret-shaped
strings are redacted, and only the current workspace's own transcripts are ever
read. Recovery never resumes the dead session's work and never writes a pause
record on its behalf — the never-auto-resume rule (B15) is untouched
(transcript-recovery D1–D6, 2026-07-20).

Detection's own transcript store is runtime-aware without guessing a second
runtime's internals: a workspace can list additional transcript roots (each
tagged with the runtime that owns it) in its config alongside the Claude
default, and every recoverable candidate names which root it was actually
found under. A configured root that turns out missing or unreadable degrades
the same way as a missing store always has — a silent no-op to detection
itself — but is also reported, by name, so a person running a second runtime
can confirm the root was really consulted instead of quietly never checked; a
workspace that names no extra root behaves exactly as before (hardening-5,
2026-07-21).

## Actors & Access

- **The agent** runs every verb itself; the human never runs workflow
  commands. The human's actions are gate approvals and decision answers.
- **Workers** touch only cell verify/cap and reservations — never phase,
  gates, or feature identity, and never claim a unit of work for themselves.
  Ownership of the unit a worker is dispatched to is always won by whoever
  dispatches it, before the worker starts; the worker's own job is to validate
  the ownership it was handed, never to acquire it.
- **Independent reviewers** write only their review-session record. They cannot
  change active routing state or execution readiness; validation owns that
  decision.

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
- R12 — The unified entry point serves all nine command groups from one
  implementation; the specialized entry points are thin forwarders with
  byte-identical output, and a new verb is added once — one catalog entry plus
  one handler, never a second implementation in a forwarder (decision
  30606de4-5fae-4c9d-9e3f-8f47a494f8a3; dispatcher-unify decision 2026-07-12).
- R13 — The published command catalog and executable dispatch surface describe
  the same command set. Every published example is exercised against the real
  operation, so a documented but unusable command is a verification failure
  (decision 30606de4-5fae-4c9d-9e3f-8f47a494f8a3).
- R7 — The workflow runs one cost pattern: the session's own model
  orchestrates every phase and is always the ceiling tier, never a configured
  value; the cheaper configured tiers (extraction, generation, review) take
  retrieval, implementation, and review work; steps that are mostly gathering
  content dispatch down-tier and return digests rather than raw content
  (decision de967733; the ceiling-is-the-session-model principle it refines
  stands unchanged, decision 0015). Amended, not reversed, by advisor D1
  (2026-07-13): a dispatched worker that fails its first serious verification
  attempt may consult a configured stronger adviser from inside its own turn —
  advice only, on failure only; the orchestration pattern and the retired
  gate-time advisory mode stay exactly as this rule states them.
- R14 — The adviser is a per-runtime configured role beside the reviewer role;
  it may name a different provider. Unset, invalid, or not stronger than the
  worker means no adviser: nothing is silently substituted, and no fallback to
  another configured role ever happens (advisor D2).
- R15 — Consult triggers are objective, never self-assessed: only after the
  first serious failed verification attempt, at most two consults per claim,
  and blocks the adviser has no standing to resolve — an ambiguous work unit,
  unmet dependencies, an architectural change, a software installation, a
  conflict with a locked decision — block immediately without consulting
  (advisor D3).
- R16 — Advice is advice: it never approves gates or installations, never
  widens a worker's file scope, and never substitutes for fresh verification
  output; advice that contradicts a locked decision turns into a block citing
  both the decision and the advice (advisor D1/A1; goal-check unchanged).
- R19 — A planned-next handoff's preconditions live in its verb, never in
  prose: finished previous unit with passing verification and a carried,
  writer-owned claim, or the write refuses with zero mutation
  (fresh-session-handoff D1).
- R20 — Auto-resume authority exists only at the fresh-session boundary
  (cleared or newly started session); resumed and memory-compacted sessions
  never adopt a handoff, and a kindless record is pause everywhere
  (fresh-session-handoff D1; validation-s4 C11).
- R21 — The work puller never widens authority: cross-lane pull selects only
  from lanes whose execution gate a human approved, and the "no approved work
  left" stop may only be answered after the stale-claim sweep ran
  (fresh-session-handoff D2; validation-s4 C10).
- R17 — Concurrent ownership is decided by atomic exclusive creation, never by
  check-then-write; a live claim is mutated only under its own exclusive gate;
  reclaim requires expired lifetime AND stale heartbeat, re-verified under that
  gate (fresh-session-handoff D1/D3; critical pattern 20260710 — never release
  another agent's holdings on a stall signal alone).
- R18 — Contention is answered with a typed refusal carrying a code and reason,
  never an exception; a refused claimant is healthy and free to take other work
  (fresh-session-handoff S1, validation repair).
- R8 — A workflow configuration file that still carries the retired advisor
  setting loads successfully: the setting is stripped from the parsed view
  and surfaced as one warning by both the status command and the onboarding
  report; it never errors, and the status display renders no advisor line
  (decision de967733).
- R19 — The learning-capture phase is never settable. It is produced only by
  recording a knowledge sync, which is its sole door; any attempt to set it
  directly is refused and names the recording step as the way. Consequently the
  phase is reachable if and only if a knowledge sync was truly stamped
  (chain-integrity D1-REVISED).
- R20 — Recording a knowledge sync is refused unless the feature stands in a
  phase where execution has happened (execution, independent review, or the sync
  itself). Knowledge of work that was never done cannot be synced
  (chain-integrity D3).
- R21 — The terminal state may be entered only from learning capture, and only
  while spec debt is zero. The refusal names every completed behavior-changing
  unit still missing from the specs, by identity, and leaves the phase untouched.
  A close whose debt is genuinely spec-irrelevant proceeds only through an
  explicit waiver, which records a durable decision naming every waived unit —
  never silently, never by default (chain-integrity D2/D4).
- R22 — Spec debt is advisory everywhere it is displayed and binding only at the
  close. Debt is a signal throughout the work and a wall at the door: blocking on
  it mid-work would fire while the sync is not yet due, and never blocking on it
  at all is precisely what allowed a feature to be closed with its settled
  behavior absent from every spec (chain-integrity D2).
- R24 — A configured external assistant whose reply is free prose is proven live
  only by a **known-answer probe** — a question whose correct answer is already
  known — never by its exit status alone. The command string is a contract with
  an argument grammar: whether the assistant can even *receive* the question is
  part of what must be validated. An assistant that exits zero while never having
  been handed the prompt looks healthy and is silently useless, forever.
- R23 — No instruction anywhere in the workflow may name a phase outside the
  closed vocabulary. A documented command that names a non-existent phase fails
  every time it is followed, and an agent whose documented command fails begins
  improvising the state machine — which is how the tail came to be bypassed in
  the first place. This rule is machine-checked, not remembered
  (chain-integrity D6).
- R25 — The gate bypass level is a strict ladder of floors, each honored
  literally: `off` stops for every gate; `normal` lifts only the
  tiny/small/standard gates 1-3; `full` additionally lifts high-risk and
  hard-gate gates 1-3; `total` lifts everything, including secret-file reads and
  a review's P1 findings, leaving no human checkpoint. A human who set `full` or
  `total` deliberately removed the high-risk floor — the workflow never
  re-erects a stop the human lifted at their chosen level. When bypass is active
  the agent does not pause: it records the recommended choice, logs a one-line
  audit decision, and continues. Whenever any level other than `off` is in
  force, the status surface and the session preamble print a loud level-specific
  banner (`NORMAL` / `FULL AUTOPILOT` / `TOTAL AUTOPILOT — ZERO STOPS`) so the
  lifted floor is never silent (decision 0010; user authorization dcf01d7b).
  This ladder is applied at **every** gate step, not just some: each
  gate-presenting step reads the active level and self-approves before it would
  present, so a runtime that follows a step literally (rather than inferring the
  rule from doctrine elsewhere) still honors the level. A machine-check asserts
  every gate surface carries the level-aware rule and none carries a stale
  floor-is-absolute phrasing, so the per-gate application cannot silently
  regress (decision 5aedc024; cell codex-bypass-per-skill-1). Bypass suppresses
  **approvals**, never genuine **information-gathering**: under `full`/`total`
  the agent never asks merely to be approved (it takes its own confident best
  answer and proceeds), but a question whose answer only the human holds — a
  preference or knowledge the agent cannot settle from evidence — is still asked,
  including during exploring. The litmus is "do I already have a confident best
  answer?": yes proceeds, no-and-only-the-human-knows still asks (decision
  a93994d3; cell bypass-info-vs-approval-1).
- R26 — No dependency cycle can ever be recorded: every write that creates or
  changes declared dependencies is refused, all-or-nothing and naming the
  cycle, when the union of the record and the change would contain one. A
  cycle that predates the rule is surfaced by the schedule query's
  diagnostics, never silently scheduled around (parallel-scheduler D2,
  decisions b4740f68/0746db88).
- R27 — One overlap semantics, two consumers: the computed schedule judges
  declared-path collisions with exactly the same meaning the runtime write
  refusal enforces. Collision between ready units is legal and auto-serializes
  into a later wave — it is never refused, and never dispatched concurrently.
  The computed schedule is the default dispatch order; deviating requires a
  stated reason, and execution of a multi-unit slice is not validated while
  the schedule's diagnostics report cycles (parallel-scheduler D1/D2/D3,
  decisions a648ea2a/ecc8862d).
- R28 — When review status is derived from change history, a conclusive
  repository answer remains authoritative even if the execution environment
  also attaches an auxiliary launch warning. Only an inconclusive answer
  degrades the result to `review stale` with an unresolvable-range note
  (codex-sandbox-baseline-6; decision a83a3613).
- R29 — Every generic routing mutation is authorized by the selected record's
  valid pre-change phase. Default and lane records follow the same rule.
- R30 — Routing ownership is derived, never persisted. A successful phase
  change transfers authority to the new phase for the next mutation.
- R31 — Gate mutation is a dedicated operation; review owns no active pipeline
  state, and validation alone decides execution readiness.
- R32 — Worktree isolation removes Git index contention only; reservations
  remain the ownership primitive. Isolation is opt-in for enabled Claude
  multi-worker waves, never a new default (worktree-isolation D1).
- R33 — All linked worktrees share exactly one validated main coordination
  store. Onboarding markers are neither consent nor proof, and invalid linked
  metadata always fails closed (worktree-isolation D2).
- R34 — Same-user workers are cooperative and fallible, not security
  principals. Git metadata is consistency evidence; authoritative attestation,
  integration, verification, and cleanup remain orchestrator-owned goal checks
  (worktree-isolation D3).
- R35 — Canonical physical containment always precedes logical path
  normalization and authorization. When safe resolution is impossible,
  worktree mode is refused rather than run unguarded (worktree-isolation D4).
- R36 — Every claim path — a direct claim by identity as well as the
  cross-session picker — acquires the same exclusive token before any claim
  state changes, and that token is released on every transition that clears a
  claim (completion, hand-back, block, drop, reopen), so a same-session round
  trip never self-refuses against its own prior claim (multi-session-hardening
  D1, Δ2-amended).
- R37 — A shared coordination store's read-modify-write body always serializes
  through its coordination lock: a command-line verb waits (bounded), a
  lifecycle checkpoint tries once and skips silently on contention — never a
  fall-through to an unlocked write (multi-session-hardening D2, Δ1/Δ3-amended).
- R38 — A session's identity is always self-resolved at the moment of the
  operation from its own runtime environment, never accepted as handed down by
  another party except an explicit test override; an operation with no
  resolvable identity still proceeds, recorded as ownerless
  (multi-session-hardening D3).
- R39 — Mutating a claimed unit of work is refused when a live claim names a
  different session, naming the owner and expiry; an expired, absent,
  ownerless, or matching claim proceeds unchanged, and a forced override
  always appends a permanent audit entry that survives the unit's own
  completion (multi-session-hardening D4, Δ5-amended).
- R40 — A worker never establishes its own ownership of a unit of work; the
  dispatching orchestrator wins the claim before the worker starts, and the
  worker only validates the ownership it was handed (multi-session-hardening
  D1 worker-execution-contract amendment).
- R41 — A unit's lifetime budget is checked inside the same exclusive
  operation that grants its claim, not before or after it; exceeding it
  releases the just-granted claim in the same step and answers with a typed
  refusal naming the exhausted budget, the attempt history, and the reset
  door — enforcement is therefore bounded to at most one attempt of overrun
  (self-correcting-loop D2, Δ2).
- R42 — Two failed attempts sharing an identical failure signature exhaust a
  unit immediately: the signal is that the approach must change, not that
  another try is warranted (self-correcting-loop D2).
- R43 — The automatic work picker skips a budget-exhausted or
  repeated-failure unit rather than surfacing the refusal, so one looping
  unit never bricks the pool of ready work; only claiming a unit by identity
  gets the typed refusal directly (self-correcting-loop D2, Δ3).
- R44 — No autopilot level ever overrides a budget or repeated-failure
  refusal: these are loop-safety stops on a unit's own history, not human
  approval gates (self-correcting-loop D2).
- R45 — A budget reset is the only door back into an exhausted unit: it
  requires a stated reason, records a durable decision, and appends a marker
  without ever touching the attempt history itself (self-correcting-loop D2).
- R46 — A unit's change classification is set explicitly or derived only from
  the behavior-change flag — never any richer auto-derivation — and an
  insufficient verification plan is reported as an authoring-time warning on
  the advisory channel, never a refusal (self-correcting-loop D3, Δ4).
- R47 — A behavior-changing unit's completion requires substantial (not
  placeholder), non-duplicated proof-of-red evidence; every other change
  classification stays advisory-only in this version (self-correcting-loop D3).
- R48 — A judge verdict is accepted only in its one structured shape;
  free-form prose is a failed judge run, re-dispatched once, then recorded
  unverified — never accepted as the verdict itself (self-correcting-loop D5).
- R49 — A verdict's model-independence status is derived, never asserted:
  `confirmed` requires both models pinned and different; anything else is
  recorded honestly as `same-model` or `unverified` (self-correcting-loop D5,
  Δ6).
- R50 — The goal-check's semantic judge is verification inside the loop that
  finishes a unit, scaled by lane risk — it is never the user-invoked
  independent review, never opens or approves a review session, and never
  touches the review-candidates ledger or Gate 4 (self-correcting-loop D4;
  decision 565e68d0-327f-404e-b49e-d1c61ba81bfd unchanged).
- R51 — A crashed session's unsettled work is recovered only through its
  harness transcript as a secondary source, never by promoting mined content to
  settled knowledge on its own: detection is automatic and cheap, mining is
  offered not forced, the raw transcript is read only by a down-tier helper and
  never loaded into the recovering session, mined settlements enter as
  unconfirmed capture stubs that still pass the normal flush, and recovery never
  resumes work or writes a pause record (transcript-recovery D1–D6, 2026-07-20).

## Edge Cases Settled

- A capped prior-feature cell never blocks a new start; an expired-by-TTL
  reservation never blocks a new start (only active ones do).
- Refused starts are proven side-effect-free: the record is byte-identical
  after a refusal.
- A configuration file carrying the retired advisor setting → parses
  normally with the setting stripped from the parsed view; the status
  command and the onboarding report each surface one identical warning line
  naming it safe to delete, never an error (decision de967733).
- A stale-heartbeat session whose transcript tail carries the clean-stop
  sequence is not a crash candidate — it stopped cleanly, it simply stopped;
  and a genuinely clean-ended session that queued nothing at stop (no closing
  prompt echo) is still excluded because it also shows no work in flight.
- A stale session whose transcript is missing entirely is reported as a session
  with no transcript, never as a recoverable crash.
- When the dead session had no bound feature, its mining window keys on the last
  global settled outcome and its recovery note is written to the shared recovery
  location instead of a feature's history.
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
- A catalog fingerprint change never appears inside the requested command's
  ordinary result. Consumers that parse normal output therefore remain stable
  while diagnostics can still report that discovery metadata changed.
- A missing required parameter, a value with the wrong shape, or an unknown
  command is rejected before any workflow record changes.
- A consult attempt that fails at the transport level (the adviser is
  unreachable, errors, or hangs past the external-work timeout discipline) is
  not advice: it spends at most one budget slot in total and is never retried
  in a storm; the worker proceeds toward blocked exactly as it would without an
  adviser.
- A workflow whose configuration names no adviser dispatches byte-identical
  worker instructions to before the adviser existed.
- One invalid unit in a batch slice-creation request → zero units written; a
  duplicate identifier inside the batch is refused the same way.
- Linked pointers may be absolute or relative and may use supported Windows
  path forms. Corrupt, forged, outside-namespace, missing-reverse, or backlink-
  mismatched metadata fails closed. Ordinary repositories, submodules, and
  legitimate separate-Git-directory layouts keep ordinary behavior.
- Traversal, outside-main absolute paths, symlink escapes, and separator/case
  escapes are denied across every write-capable operation. A new contained
  target is authorized only through a contained existing ancestor.
- Detached/ref/identity/common-location mismatch, non-descendant revisions,
  and out-of-reservation diffs halt integration. Conflict or pre-commit red
  aborts; post-commit red reverts. Blocked, handed-off, abandoned, mismatched,
  conflicted, or red worktree state is preserved and never auto-cleaned.
- Transaction behavior is proven in deterministic temporary Git repositories
  because the live checkout's Git metadata is read-only; no live-checkout
  commit is claimed by that acceptance evidence.

- Project directories on network file systems are declared unsupported for
  session coordination: exclusive creation is not reliable there. The
  supported topologies are a local Linux/WSL2 disk and a local Windows disk
  (both race-proven).
- A same-session round trip on one unit of work — claim, block, reopen, claim
  again — never self-refuses: the exclusive token is released on every
  claim-clearing transition, not only completion (multi-session-hardening
  D1, Δ2-amended).
- A forced ownership override always leaves a permanent audit trace naming the
  verb, who forced it, whose ownership was bypassed, and when — kept apart
  from any other audit trail on the unit so a later mutation can never
  overwrite it — and a forced release of the claim leaves the unit claimable
  again, never stuck self-refusing (multi-session-hardening D4, Δ5-amended).
- A single-user workspace with no session identity anywhere in the
  environment behaves exactly as before: claims and holds are recorded
  ownerless, and the new ownership check never fires against an ownerless
  claim (multi-session-hardening D3/D4).
- A unit with no attempt history yet (every legacy unit) is measured against
  the default lifetime budgets and behaves exactly as it always did — until it
  actually loops (self-correcting-loop D2, D6).
- An autopilot level set to `total` still does not waive a budget or
  repeated-failure refusal — proven by a dedicated test row exercising that
  exact combination (self-correcting-loop D2).
- A behavior-changing unit riding the existing deliberate-exceptions door for
  its proof-of-red keeps that door's original contract untouched, with an
  advisory noting it took that door instead of meeting the length/duplicate
  floor (self-correcting-loop D3, Δ5).

## Hardening 1.7.9 settlements (2026-07-21)

- **Session identity is runtime-neutral.** One resolver chain everywhere a
  session id is read: explicit flag > `BEE_SESSION_ID` > the first runtime's
  own env var > null. The store-lock holder label derives from the same chain
  (inlined — the lock module stays import-light, with the resolver named as
  canonical in a comment).
- **Sessionless writes refuse under concurrency.** When at least one OTHER
  session record has a live heartbeat, a claim or reservation attempted with
  no resolvable session id is refused with a typed `SESSION_REQUIRED` error
  naming both the flag and the env var. Solo (single-session) sessionless
  behavior is byte-identical to before.
- **Every cell mutator is lock-serialized.** All eleven mutators run their
  read-check-write inside the per-cell store lock (the six previously
  unlocked — claim, update, drop, unclaim, reopen, set-tier — joined the
  five that already were). A forked-process racer proved the pre-fix
  interleave (an update silently reverting a concurrent claim) and its
  closure.
- **A swept claim reopens its cell.** Claim expiry sweep, after removing the
  expired claim file, resets the cell record claimed→open — guarded by an
  exact `claim_session` match and audited with a decision line per reset.
- **Worktree admin is a mutex.** Grant write/remove, worktree create, the
  whole staged merge transaction, and cleanup serialize under one
  `worktree-admin` main-store lock per operation. (Side discovery: the lock
  directory itself must be gitignored, or the admin lock's own lockfile
  makes every worktree operation self-refuse as git-dirty.)
- **Dispatch prepare checks claim ownership.** Preparing a cell dispatch
  requires the worker name, refuses an unclaimed or foreign-claimed cell
  with a typed refusal naming the actual owner/status, and offers an
  audited `--force-ownership` door (same pattern as the mutator ownership
  guard).
- **Machine-local config lives in a gitignored overlay.** `readConfig`
  deep-merges `.bee/config.local.json` over the tracked config (overlay
  wins, arrays replace); machine paths (dogfood repos) belong in the
  overlay, never in the tracked file; the config CLI writes it via
  `--local`.
- **Recovery transcript roots are configurable.** `recovery.transcript_roots`
  entries ({runtime, path}) are scanned beside the first runtime's default
  root; candidates carry a runtime tag; missing/unreadable configured roots
  degrade visibly (per-root scanned/skipped in the JSON result), never
  crash. No config = prior behavior byte-identical.

## Open Gaps

- Real-terminal UAT of the fresh-session flow is outstanding: the two-session
  behavior is proven by suite fixtures and real-hook-child rows, but the
  literal two-terminals + `/clear` walk-through on this machine has not been
  performed by the owner yet.
- The remaining workflow-record semantics not yet specced here: worker registry
  lifecycle and reservation TTL policy. (The knowledge-sync stamp and spec-debt
  counting were on this list and are now specced above — closing them is what
  chain-integrity did.)
- Spec debt is counted against the default record only, so a feature run in its
  own lane has its debt measured against the wrong record. The close guard is
  therefore weaker for lane-scoped work than for the default pipeline. Known,
  filed, not yet fixed.
- The workflow record can still be written with any phase by a caller that
  bypasses the command layer entirely — the tail guard lives at the command
  layer, and the record writer itself validates nothing. Today this is safe only
  because direct edits to the record are separately blocked, i.e. a guard is
  load-bearing for what should be an invariant of the store. Known, filed, not
  yet fixed.
- The review-session flow inside a running review (delta re-review after a
  fix, batch cumulative-diff mechanics) is contract-specced in the reviewing
  skill's own reference, not here; this area owns only the records and their
  derived truth.
- No wall-clock ceiling exists on a unit's lifetime yet — attempts are the
  only budget unit for now, deferred until a reliable clock source is chosen
  (self-correcting-loop non-goal).

## Pointers (implementation)

- Worktree isolation (B20/R32-R35): root resolution in
  `skills/bee-hive/templates/lib/state.mjs`; hook transport and containment in
  `hooks/adapter.mjs` and `hooks/bee-write-guard.mjs`; dispatch, attestation,
  merge-back, recovery, and disposal contracts in `skills/bee-swarming/SKILL.md`,
  `skills/bee-swarming/references/swarming-reference.md`, and
  `skills/bee-executing/references/worker-details.md`. Evidence: capped cells
  `.bee/cells/worktree-isolation-{1..4}.json`, reports
  `docs/history/worktree-isolation/reports/`, 333 passing library checks, and
  the green configured repository verify on 2026-07-16.

- Record: `.bee/state.json` (CLI-owned). Verbs: `bee.mjs state`
  (`start-feature` — new; set/gate/worker/scribing-run — existing);
  `startFeature()` + `isKnownPhase` in `skills/bee-hive/templates/lib/state.mjs`
  (byte-mirrored to `.bee/bin/lib/state.mjs`).
- Phase-owned routing: generic `state set --owner <pre-phase>` in
  `skills/bee-hive/templates/bee.mjs` and `.bee/bin/bee.mjs`; required-owner
  metadata in both command registries; phase-aware callers in exploring,
  planning, validating, and compounding. Review stays local to its review
  record. Proof: state/CLI suites, `.bee/cells/codex-hook-state-parity-1.json`,
  and `docs/history/codex-hook-state-parity/reports/codex-hook-state-parity-1.md`.
- Tests: 15 start-feature rows in `skills/bee-hive/templates/tests/test_lib.mjs`.
- Evidence: commit `928abf1`; trace `.bee/cells/codex-parity-5.json`.
- Unified dispatcher and catalog: `skills/bee-hive/templates/bee.mjs`,
  `skills/bee-hive/templates/lib/command-registry.mjs`, and
  `skills/bee-hive/templates/lib/validate-args.mjs`, mirrored under `.bee/bin/`.
  Evidence: `.bee/cells/hia-1.json`, `.bee/cells/hia-2.json`, and
  `docs/history/harness-integration-adopt/reports/`.
- Cost pattern / tier resolution: `modelForTier`, `MODEL_TIERS`,
  `CONFIGURABLE_TIERS` in `skills/bee-hive/templates/lib/state.mjs` (ceiling
  never configured; extraction/generation/review are the configurable tiers).
- Adviser (worker consult): `resolveAdvisor` + `MODEL_NORMALIZE_SLOTS` in
  `skills/bee-hive/templates/lib/state.mjs` (byte-mirrored to `.bee/bin/lib/`);
  slot `models.<runtime>.advisor` in `.bee/config.json`; worker protocol in
  `skills/bee-executing/SKILL.md` (Advisor Consult section); dispatch-time
  same-model no-op + Advisor line (AO5 form, ladder removed by ao-2b-1) in
  `skills/bee-swarming/SKILL.md`
  and `references/swarming-reference.md`; consult record = `advisor-consult
  <cell-id>: <advisor>` description prefix in `.bee/logs/dispatch.jsonl`.
  Evidence: commits 14e0e1b, 68d3a0d, 33aaad7; traces `.bee/cells/adv-{1,2,3}.json`;
  transport proofs `docs/history/advisor/reports/validation-advisor-consult.md`.
- Batch slice creation: `addCells` in `skills/bee-hive/templates/lib/cells.mjs`,
  CLI `bee.mjs cells add --stdin` (JSON array). Evidence: dispatcher-unify
  cells-batch-add suite rows (v0.1.27).
- Unified dispatcher (all nine groups): `skills/bee-hive/templates/bee.mjs` owns
  registry + handlers; dispatcher-unify (`.bee/cells/du-{1..6}.json`,
  `docs/history/dispatcher-unify/`) first made every legacy per-group script a
  2-line forwarder with byte-identical output, then shim-retire (D1, decision
  bbc6bcea; `.bee/cells/shim-retire-{1..6}.json`) deleted those forwarders
  outright — `bee.mjs` is now the sole shipped CLI, no forwarders remain.
- Advisor config tolerance: `STALE_ADVISOR_KEY_WARNING` (copy names the
  top-level key; the nested `models.<runtime>.advisor` slot is separate and
  valid), `hasStaleAdvisorKey`
  in `skills/bee-hive/templates/lib/state.mjs` (byte-mirrored to
  `.bee/bin/lib/state.mjs`); surfaced by `skills/bee-hive/templates/bee.mjs`
  (`status` group) and `skills/bee-hive/scripts/onboard_bee.mjs` (`staleAdvisorNotices`).
  Evidence: fanout-delegation cells fanout-1/fanout-4 (commits 0056eda,
  79d96df).
- Cell revision: `updateCell` + `UPDATE_FIELD_VALIDATORS`/`UPDATE_FROZEN_HINTS`
  in `skills/bee-hive/templates/lib/cells.mjs`; CLI `bee.mjs cells update --id ID
  --file patch.json | --stdin` (byte-mirrored to `.bee/bin/`). Evidence: cell
  `.bee/cells/cuv-1.json` (commit 127abb0), 7 suite checks.
- Session coordination (B11/R17/R18): `skills/bee-hive/templates/lib/claims.mjs`
  (byte-mirrored to `.bee/bin/lib/`) — sessions under `.bee/sessions/`, claims
  under `.bee/claims/`, per-claim gate `<cell>.adopting`; race orchestrator
  `skills/bee-hive/templates/tests/race_claims_child.mjs` (3 scenarios using
  barrier-synchronized isolated Worker racers in `test_lib.mjs`). Evidence:
  traces `.bee/cells/fsh-{1,2}.json` (win32 +
  linux probe PASS lines), commits 0224f6c, edfac87; validation
  `docs/history/fresh-session-handoff/reports/validation-s1.md`.
- Lanes (B12): lane store + `resolvePipeline` + lane-mode `startFeature` in
  `skills/bee-hive/templates/lib/state.mjs`; `bindSessionLane`/`unbindSessionLane`
  in `lib/claims.mjs`; CLI: `--lane` on `state.set/gate/scribing-run`,
  `--as-lane/--session-id/--paths` on `state.start-feature`, `state.lanes`,
  `state.session.list/bind/unbind` (`lib/command-registry.mjs` + `bee.mjs`,
  runExample rows in `test_bee_cli.mjs`). Evidence: traces
  `.bee/cells/fsh-{3,4}.json`, commits 257d6b5, 6fa4f89;
  `docs/history/fresh-session-handoff/reports/validation-s2.md`.
- Hold enforcement (B14): `findSessionConflicts` + optional `session` field in
  `skills/bee-hive/templates/lib/reservations.mjs`; phase-independent deny +
  fail-closed corrupt-store branch in `lib/guards.mjs` `checkWrite`;
  `payload.session_id` threaded at `hooks/bee-write-guard.mjs`; `--session` on
  the reservations verb. Evidence: traces `.bee/cells/fsh-{7,8}.json`, commits
  255757d, 4969e8c; `docs/history/fresh-session-handoff/reports/validation-s3.md`.
- Fresh-session flow (B15/B16): two-kind handoff (`readHandoff` normalization,
  strict `writeHandoff`, `adoptHandoff`) in `skills/bee-hive/templates/lib/state.mjs`;
  CLI `state.handoff.write/adopt/show`; source-gated adoption + session
  registration in `hooks/bee-session-init.mjs`; pure kind-branch rendering in
  `lib/inject.mjs` (`handoffOutcome` param); `claimNextCell`/`claimCellCrossSession`
  in `lib/cells.mjs` + `featureBacklogRank` in `lib/backlog.mjs`; CLI
  `cells.claim-next` (the production `sweepExpiredClaims` trigger); live-owner
  lane guard in the cross-lane fallback pool (`listSessionRecords` in
  `lib/claims.mjs` + `heartbeatStale` membership check in `claimNextCell`,
  GH #20, trace `.bee/cells/cnlg-1.json`). Evidence:
  traces `.bee/cells/fsh-{9,10,11}.json`, commits 79e800e, d419e0e, 9931fc6;
  `docs/history/fresh-session-handoff/reports/validation-s4.md` (incl. the
  orchestrator's retro-RED probe for fsh-11).
- Review records: `.bee/reviews/<id>.json` (sessions) + `.bee/review-candidates.jsonl`
  (ledger), CLI `bee.mjs reviews` (create/list/show/record/candidate add/
  candidates/status), lib `skills/bee-hive/templates/lib/reviews.mjs`
  (`deriveCandidateStatus`, `readReviewStrict`; byte-mirrored to `.bee/bin/`).
  Status surface: `review` block in `skills/bee-hive/templates/bee.mjs` (`status` group).
  Coverage derivation uses status-first `git merge-base --is-ancestor` +
  `git rev-list --count`: a concrete Git answer wins over an attached auxiliary
  launch warning, while missing/inconclusive output yields `review stale`.
  Tests: review-od checks in `skills/bee-hive/templates/tests/test_lib.mjs`
  (including codex-sandbox-baseline-6 coverage). Evidence: commits cc1c34d,
  e4f51a2, da2e165; traces
  `.bee/cells/review-od-{1,2,3}.json`; acceptance map
  `docs/history/review-on-demand/reports/uat-scenarios.md`.
- Multi-session hardening (B11/B21-B24, R36-R40): coordination lock primitive
  `withStoreLock` in `skills/bee-hive/templates/lib/lock.mjs` (byte-mirrored
  to `.bee/bin/lib/`), O_EXCL acquire with stale-holder takeover by atomic
  rename, forked-racer suite `scripts/test_store_lock.mjs`; `cells claim --id`
  re-backed by the same claim-file gate `claim-next` uses
  (`claimCellCrossSession` in `lib/cells.mjs`), forked-racer suite
  `scripts/test_claim_race.mjs`; session id self-derivation `resolveSessionId`
  in `lib/claims.mjs`; claim-clearing release on cap/unclaim/block/drop/reopen
  via `clearClaim` in `lib/claims.mjs`; reservation read-modify-write and
  session auto-derive under the lock in `lib/reservations.mjs`
  (`reserve`/`release`/`sweepExpired`), forked-racer suite
  `scripts/test_reservation_race.mjs`; ownership guard on cell mutators
  (`checkClaimOwnership`/`guardClaimOwnership`, `--force-ownership`, the
  `trace.ownership_overrides` audit key kept apart from `trace.deviations`)
  in `lib/cells.mjs`; throttled heartbeat-and-lease renewal
  (`heartbeatTouch`, `renewClaimTTL` in `lib/claims.mjs`,
  `renewHoldsBySession` in `lib/reservations.mjs`) wired into
  `hooks/bee-prompt-context.mjs` and `hooks/bee-state-sync.mjs` in try-once
  mode, suite `scripts/test_heartbeat_touch.mjs`; state logical
  read-modify-write verbs (`startFeature` in `lib/state.mjs`;
  `handleStateSet`/`handleStateGate`/`stateWorkerMutate`/
  `handleStateScribingRun` in `bee.mjs`) serialized under the same lock,
  waiting normally. Orchestrator-claims-before-spawn doctrine in
  `skills/bee-executing/SKILL.md` + `references/worker-details.md` and
  `skills/bee-swarming/SKILL.md` + `references/swarming-reference.md`; the
  four new suites added to `.bee/config.json` `commands.verify`. Evidence:
  `docs/history/multi-session-hardening/CONTEXT.md` (D1-D7, Δ1-Δ6); traces
  `.bee/cells/msh-{1..7}.json`; reports
  `docs/history/multi-session-hardening/reports/msh-{1..7}.md`.
- Computed schedule (B17/B18, R26/R27): `skills/bee-hive/templates/lib/schedule.mjs`
  (`computeSchedule`, `detectCycles` — pure, Kahn layering + greedy `pathsOverlap`
  packing, Tarjan SCC for cycles; byte-mirrored to `.bee/bin/lib/`); cycle refusal
  wired in `cells.mjs` `addCell`/`addCells`/`updateCell` via `assertNoCycle`;
  CLI verb `bee cells schedule` (`command-registry.mjs` `cells.schedule`,
  `handleCellsSchedule` in both dispatcher copies); consumer prose in
  `skills/bee-swarming/SKILL.md` (wave analysis), `skills/bee-validating/SKILL.md`
  (feasibility matrix), `skills/bee-planning/references/planning-reference.md`
  (files-authoring note). Tests: schedule + cycle-refusal rows in
  `templates/tests/test_lib.mjs` (321 passing), verb example in
  `templates/tests/test_bee_cli.mjs` (132 passing). Evidence: commits 390165a,
  9e2156e, 5003503, 79217ae; traces `.bee/cells/parallel-scheduler-{1..4}.json`.
- Self-correcting loop (B26-B32, R41-R50): attempt ledger `appendAttempt` /
  exported `normalizeFailureSignature` in
  `skills/bee-hive/templates/lib/cells.mjs` (byte-mirrored to `.bee/bin/lib/`),
  invoked from `recordVerify` (both outcomes) and `blockCell`; lifetime
  budgets `checkCellBudgets` runs inside `claimCellCrossSession`'s O_EXCL
  critical section with unwind-on-refusal, typed `CELL_BUDGET_EXHAUSTED` /
  `REPEATED_FAILURE`, skip-on-select wired into `claimNextCell`, reset verb
  `resetCellBudget` / CLI `cells reset-budget --id --reason`; change
  classification `deriveChangeClass`, authoring advisory
  `JUDGE_STANDARD_INSUFFICIENT` (STDERR only via the `bee.mjs` handler layer,
  pah-2 precedent), behavior-class completion teeth (evidence length +
  tolerant duplicate scan) in `capCell`; judge-verdict schema
  `validateJudgeVerdict` / `deriveModelIndependence` in new
  `skills/bee-hive/templates/lib/judge.mjs` (byte-mirrored to
  `.bee/bin/lib/`), recorder `recordJudgeVerdict` in `cells.mjs`, CLI verb
  `cells judge-record --id --file <verdict.json> [--builder-model]
  [--judge-model]`; goal-check judge-tier table single-homed in
  `skills/bee-hive/references/routing-and-contracts.md` with a one-line
  565e68d0-scoping clause mirrored onto the seven adjacent surfaces
  (`bee-swarming` SKILL + reference, `bee-hive` SKILL x2 sites, go-mode,
  `AGENTS.md` + `templates/AGENTS.block.md`, `bee-scribing` SKILL). Evidence:
  `docs/history/self-correcting-loop/CONTEXT.md` (D1-D6, Validating
  amendments Δ1-Δ6, decisions 84e49851/1cb27fbf); traces
  `.bee/cells/scl-{1..5}.json`; reports
  `docs/history/self-correcting-loop/reports/scl-{1..5}.md`.
