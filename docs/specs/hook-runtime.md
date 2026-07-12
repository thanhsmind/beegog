---
area: hook-runtime
updated: 2026-07-12
sources: [codex-runtime-parity Safety foundation — cells codex-parity-2, 2b, 3, 4 (traces in .bee/cells/), reports in docs/history/codex-runtime-parity/reports/]
decisions: [codex-runtime-parity D1, D2; 0023]
coverage: partial
---

# Hook Runtime (lifecycle guardrails)

## Purpose

While an AI assistant works inside a bee-managed project, a set of lifecycle
checkpoints runs around it: session start context, per-prompt reminders, write
protection, dispatch auditing, state refresh, worker nudges, and close-time
hygiene. This area describes what those checkpoints guarantee, on which
assistant runtime, and what happens when input is hostile or a path is
unsupported. The guardrails are a safety net, not a security boundary — the
durable project instructions and the shared helper checks remain the final
belt for anything a checkpoint cannot see.

## Entry Points & Triggers

- A supported assistant runtime (two are supported today) fires a checkpoint at
  each lifecycle event: session start, user prompt submitted, before a tool
  runs, after tracked task updates, before context compaction, when a child
  agent stops, and when the session stops.
- Which checkpoints are active comes from one **catalog of record** rendered
  into one **projection per runtime**. Each runtime consumes only its own
  projection; the projections differ only by an explicitly named allowed list
  (today exactly one difference: the dispatch model-tier audit runs only on the
  runtime that exposes agent dispatch at the before-tool checkpoint).

## Data Dictionary

| Element | Meaning |
|---|---|
| catalog of record | The single logical definition of every checkpoint: event, matcher, handler. Both runtime projections are rendered from it deterministically — rendering again must reproduce both byte-for-byte. |
| projection | The runtime-specific checkpoint list a given assistant actually loads. One per runtime, checked in, never hand-divergent. |
| allowed difference | A named, exported exception explaining why one projection carries a checkpoint the other lacks. Any un-named difference between projections is a defect. |
| fail-open | On unreadable/hostile input or an internal crash, the checkpoint permits the action and logs the gap visibly. It never silently swallows the event. |
| fail-closed (deny) | The checkpoint blocks the action with a corrective message telling the actor how to proceed correctly. |
| advisory | A checkpoint message that informs the assistant without blocking or continuing any turn — delivered as a parseable structured message, never as a turn-control verdict. |
| coverage gap | A named event/path the runtime cannot intercept, logged visibly at runtime and listed here — never claimed as protected. |

## Behaviors & Operations

**B1 — Hostile-input immunity (every checkpoint).** Whatever arrives on a
checkpoint's input — empty, garbage bytes, null, a list where an object was
expected, a wrong-typed working directory, or a multi-megabyte payload — the
checkpoint normalizes it before touching any field. It never crashes the
assistant's turn. The decision it would have made is never *flipped* by an
internal failure: a crash in logging or loading support code ends in fail-open
with a visible log entry, not in a new allow or a new deny. Every actor
observes either the normal outcome or a logged fail-open — never a stack trace
ending the turn.

**B2 — Advisories never steer the conversation.** Close-time, compaction, and
child-stop checkpoints only inform: their output is a structured message the
runtime displays/parses. They never emit a turn-control verdict, because on
those events a verdict would resume a stopped child or loop the main turn.

**B3 — Batch file-change requests are guarded per target.** When the runtime
announces a batch file-change request (the patch-style tool), the write guard
parses every add/update/delete/move target and runs each one through the same
gate, direct-edit, and reservation decisions that govern single writes.
- All targets provable → each target decided on its own; one denied target
  denies the request with a corrective message.
- Request intercepted but targets NOT provable (no parsable change lines, a
  blank path, a target resolving outside the project) → **deny** with a
  corrective message. An intercepted-but-unreadable batch is never waved
  through.
- The outer event itself malformed (no batch envelope present at all) →
  fail-open, logged: the guard cannot know a write was intended.

**B4 — Worker nudges reach the right worker.** The child-stop nudge matches a
returning worker by its registered identity (the same identity workers use to
reserve files); an unregistered child still gets the generic nudge.

**B5 — Two projections, one truth.** Changing the catalog of record and
re-rendering updates both projections in the same change; the parity check in
the installation suite compares the assistant-facing settings against the
correct projection for that runtime and fails on any un-allowed drift.

## Actors & Access

- **The assistant** (either runtime) — subject of every checkpoint; observes
  context injections, denials with corrective messages, and advisories.
- **The human owner** — sees deny messages surfaced by the assistant and the
  visible gap log; approves anything the guardrails escalate (privacy reads,
  gates).
- **Workers (child agents)** — same write rules as the main assistant;
  additionally matched by registered identity for nudges.

## Business Rules

- R1 — One catalog of record; projections are rendered, never hand-edited;
  differences must be exported by name (codex-runtime-parity D1).
- R2 — A checkpoint failure never flips an allow/deny decision; fail-open is
  visible, never silent (codex-runtime-parity D2).
- R3 — An intercepted batch change with unprovable targets is denied, not
  fail-opened (codex-runtime-parity D2, strengthening).
- R4 — Advisory events never emit turn-control verdicts (codex-runtime-parity D2).
- R5 — Every dispatch of a subagent carries an explicit model-tier transport
  and is audit-logged (decision 0023; the audit checkpoint is an allowed
  difference — it exists only where the runtime exposes dispatch).

## Edge Cases Settled

- A change line with a whitespace-only path counts as unprovable → deny (found
  and pinned during matrix construction).
- Regenerating the RED-baseline evidence report is timestamp-stable in content;
  only noise fields differ.
- Simultaneously requesting the evidence-baseline and catalog-only test modes
  is rejected as contradictory.

## Open Gaps

- Native (non-shell) file reads and the incomplete unified-shell path on the
  second runtime cannot be intercepted — governed by the durable instructions
  and helper checks; logged as coverage gaps at runtime.
- Live proof that the second runtime loads the plugin-delivered projection in a
  real trusted session is owned by the Distribution slice (installation area).
- Child-agent event payloads on the second runtime may not carry a correlatable
  identity for reservation ownership; until proven, those paths rely on the
  helper checks (named fallback, codex-runtime-parity validation).

## Pointers (implementation)

- Catalog + renderer: `hooks/catalog.mjs` (exports `ALLOWED_DIFFERENCES`);
  projections `hooks/hooks.json` (Codex default), `hooks/claude-hooks.json`
  (Claude; `.claude-plugin/plugin.json` points here).
- Shared adapter: `hooks/adapter.mjs`; the seven handlers `hooks/bee-*.mjs`.
- Batch guard: `hooks/bee-write-guard.mjs` (`extractApplyPatchTargets`).
- Suites: `hooks/test_hook_contracts.mjs` (modes: default, `--baseline`,
  `--catalog-only`), `hooks/test_write_guard.mjs`, `hooks/test_model_guard.mjs`;
  parity check in `skills/bee-hive/scripts/test_onboard_bee.mjs`.
- Evidence: `docs/history/codex-runtime-parity/` (red-baseline.md, cell reports);
  commits `d1777ed`, `5458b34`, `cf1ce51`, `a30fb0c`.
