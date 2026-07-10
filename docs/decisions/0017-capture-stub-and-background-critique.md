# 0017 — Capture stubs + background critique (flow speed off the hot path)

- **Status:** active — owner-approved 2026-07-10; building in 0.1.16.
- **Date:** 2026-07-10
- **Source:** owner dogfood friction: in a live session, bee spends noticeable wall-clock mid-flow on critique (fresh-eyes, plan-checker) and on recording (full scribing sync at every settlement), stretching simple tasks and breaking the human–agent chat rhythm. Owner asked for a way to *stay focused on the work* and record near the end / before clear / in a fresh session — without losing the guarantees of decisions 0003/0007/0011. Cross-checked against the LOOP survey (2026-07-10): every mature orchestrator keeps expensive passes off the hot path and makes durability a cheap append, not a blocking ritual.
- **Confidence:** 0.7 (the mechanism is simple and additive; the flush-discipline is prose and needs dogfooding).

## The tension being resolved

Decision 0003 exists because *deferred capture = lost capture*: sessions die, context compacts, humans forget. But 0003's guarantee is about **durability at the moment of settlement**, not about **when the expensive BA-grade merge happens**. Splitting those two lets both sides win:

- the *settlement* is still recorded in the same turn (cheap, seconds),
- the *elaboration* (spec merge, reading-map refresh, rebuild self-check) moves to a flush point.

## Decision

Three mechanisms, one package:

### 1. Capture stub — durable now, elaborate later

When a settlement lands mid-flow in a `tiny`/`small`/`standard` lane, the same-turn obligation becomes:

1. Log the decision as today (`bee_decisions.mjs log`) — the durable anchor, unchanged.
2. Append **one stub line** to `.bee/capture-queue.jsonl` via `node .bee/bin/bee_capture.mjs add --outcome "..." [--did <D-IDs>] [--area <area>] [--files a,b]` — ~2 seconds, no spec reading, no merge.
3. Keep working.

The full spec merge happens at **flush**. **High-risk lane is exempt**: a `high-risk` settlement still gets the full same-turn sync inline — that is the one lane where a spec lagging behavior even briefly is dangerous.

### 2. Flush points — three exits, hook-backed

The queue is drained (oldest first, full scribing merge per stub, scribing run recorded) at whichever comes first:

- **Wrap-up:** end of the working session — one consolidated scribing pass instead of N scattered ones.
- **Before compact/clear:** a `PreCompact` hook entry (reusing the session-close script) warns loudly when the queue is non-empty; the Stop-hook warning covers plain session end.
- **Next session:** bee-hive's session start surfaces a non-empty queue and offers the flush before new work — the "fresh session does the recording" path the owner described.

Pending stubs are surfaced mechanically everywhere scribing debt already is: session preamble, `bee_status`, session-close warning. A stub is never silently dropped; the queue is append-only JSONL (stub + flush records), so a crash between add and flush loses nothing.

### 3. Critique runs in the background, blocks only at the gate

Fresh-eyes review (exploring) and the plan-checker (validating) are spawned as **background subagents**: the main loop keeps working/chatting and collects the verdict at the moment it is actually needed — the gate presentation. The pass itself is unchanged (same prompts, same max-loop rules); only its *blocking position* moves. For simple work the review usually finishes before the gate is reached; for complex work the gate was always the wait point anyway.

## What this does NOT change

- The decision log stays same-turn. "Chốt" with no `bee_decisions.mjs log` in that turn is still a red flag.
- High-risk lane keeps full inline sync.
- Scribing debt (0011) keeps counting; the queue count is added beside it, not replacing it.
- Gates still block on their evidence. Background critique that has not returned by gate time = the gate waits, exactly as today.

## Alternatives considered

- **Defer everything to feature close.** Rejected — that is the pre-0003 world; capture demonstrably dies there.
- **Skip critique for simple lanes instead of backgrounding it.** Rejected — tiny lane already collapses ceremony; the pain reported was in lanes that legitimately need the pass. Backgrounding keeps the pass and removes the wait.
- **A separate "flow mode" toggle (like gate-bypass).** Rejected for now — this should be the default behavior, not an opt-in; a toggle would mean the slow path stays the default.

## Follow-up (recorded, not built here)

- **Routing audit:** verify with dogfood friction traces that simple requests are actually routed `tiny` — if the mode gate over-classifies, that is a separate fix to the rubric in 03-workflow.
- Orchestration hardening package (goal-check at orchestrator, frozen-judge, external dispatch) — backlog P12–P14, from the LOOP survey.

## Scope (this build)

- `lib/capture.mjs` (append/pending/flush over `.bee/capture-queue.jsonl`) + `bee_capture.mjs` CLI; version 0.1.15 → 0.1.16.
- `bee_status.mjs` + `inject.mjs` preamble: pending-stub surfacing.
- `hooks/hooks.json`: `PreCompact` entry running `bee-session-close.mjs`; the close script warns on a non-empty queue.
- Skill prose: `bee-scribing` (stub path in capture mode + flush mode), `bee-hive` (session-start flush offer), `bee-exploring`/`bee-validating` (background critique), `docs/03-workflow.md` (rule 9 wording + stage contracts).
- Tests: capture-queue fixtures in `test_lib.mjs`.
