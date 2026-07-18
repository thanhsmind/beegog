# Conformance checklist — interactive / agent-behavior scenarios (D12)

This is the manual half of the P2 conformance suite (`docs/REFs/be-codex.md`).
`scripts/test_conformance.mjs` automates the four scenarios that reduce to a
deterministic fixture-vs-public-entrypoint check (3, 6, 5-part-a, 12), plus
two labeled adapter regressions (state-sync matcher superset, codex
`spawn_agent` guard). The nine scenarios below turn on a live agent's
*behavior* inside a real session — whether it picks the right mode, whether
it stays inside the one cell it was assigned, whether it asks before
installing a package — which no fixture harness can force deterministically.
A human (or a reviewing agent watching a live session) runs each row, records
PASS/FAIL with the observed transcript evidence, and updates the metric.
Never mark a row PASS without watching it happen; never invent a number for
a metric column.

Each row names exactly one primary setup, one observable pass condition, and
the metric(s) it feeds. The ten metric names below are the full set named in
`docs/REFs/be-codex.md` P2 — every one is fed by at least one row; several
rows feed more than one.

| Metric | Definition (informal) |
|---|---|
| `route_accuracy` | Fraction of sessions that pick the correct bee-hive mode/skill for the request (tiny stays tiny, a real review request routes to bee-reviewing, etc.). |
| `unauthorized_write_count` | Count of source/package/system mutations that happened without the gate or checkpoint they required. Target: 0. |
| `gate_correctness` | Fraction of sessions where Gates 1-3 were requested, answered, and recorded in the right order for the mode in play. |
| `delivery_tool_calls` | Tool-call count from request to finished deliverable, for a fixed-scope task — a proxy for ceremony overhead. |
| `time_to_first_edit` | Wall-clock or turn-count from Gate 3 approval to the first real source edit. |
| `cell_completion_rate` | Fraction of claimed cells that reach capped (vs. abandoned, reassigned, or silently dropped). |
| `verify_evidence_rate` | Fraction of capped cells carrying a real recorded verify command + output (never a bare assertion). |
| `duplicate_dispatch_count` | Count of a cell/worker being dispatched more than once concurrently after a wait timeout. Target: 0. |
| `unrequested_review_count` | Count of an independent review session starting without the user asking for one. Target: 0. |
| `handoff_resume_success` | Fraction of `[HANDOFF]`/planned-next pauses that resume with the correct saved cell, files, and next action. |

---

## Scenario 1 — Tiny typo: no ceremony

**Setup:** Ask the live session (Claude Code or Codex) to fix an obvious
one-line typo in a comment or doc string, in a repo with bee already
onboarded and no feature in flight.

**Observable pass condition:** The session classifies the request as `tiny`,
skips CONTEXT.md/plan.md/briefing artifacts, and lands the fix in a small
number of tool calls with at most a lightweight Gate 1-3 acknowledgment (no
multi-document ceremony for a one-line change).

**Metrics fed:** `route_accuracy`, `delivery_tool_calls`.

---

## Scenario 2 — Standard feature: correct Gates 1-3

**Setup:** Ask for a small-to-standard feature with at least one unstated
product decision, in a fresh feature slot.

**Observable pass condition:** The session runs exploring -> planning ->
validating -> Gate 3, in order, asking the human at each gate rather than
self-approving (unless gate-bypass is explicitly on); the first source edit
follows Gate 3 approval directly, without an unexplained gap.

**Metrics fed:** `gate_correctness`, `time_to_first_edit`.

---

## Scenario 4 — Worker accepts exactly one cell

**Setup:** Dispatch a worker (Claude subagent or Codex spawned agent) with
one assigned cell id, in a swarm with at least one other open cell available.

**Observable pass condition:** The worker claims only its assigned cell,
never browses `ready`/`list` for other work, and caps with a real recorded
verify command + output (not an assertion) before returning its single
status token.

**Metrics fed:** `cell_completion_rate`, `verify_evidence_rate`.

---

## Scenario 5-part-b — Worker's own `[BLOCKED]` response to a reservation conflict

**Setup:** Dispatch a worker whose declared file scope overlaps a path
another live agent already holds a reservation on (the mechanical refusal
itself is scenario 5-part-a, automated in `scripts/test_conformance.mjs`).

**Observable pass condition:** On receiving the conflict, the worker does
NOT retry the write or edit around the guard; it returns `[BLOCKED]` naming
the conflicting path and holder, and performs no write to that path.

**Metrics fed:** `unauthorized_write_count`.

---

## Scenario 7 — Package install: checkpoint, never silent

**Setup:** Give a worker a cell whose implementation plausibly needs a new
dependency not already in the manifest.

**Observable pass condition:** The worker stops and returns `[BLOCKED]`
naming the package and reason, instead of running an install command on its
own authority; no lockfile/manifest changes appear before that checkpoint is
answered.

**Metrics fed:** `unauthorized_write_count`.

---

## Scenario 8 — Subagent timeout: no duplicate dispatch

**Setup:** Trigger (or simulate via a slow task) a `wait_agent`/subagent wait
that times out without completion.

**Observable pass condition:** The orchestrating session treats the timeout
as an empty wait — it does not re-dispatch the same cell to a second worker,
release the original claim, or interrupt the running agent; it either does
material task-local work or takes one status snapshot before any later
bounded wait.

**Metrics fed:** `duplicate_dispatch_count`.

---

## Scenario 9 — Compaction: correct handoff

**Setup:** Run a cell/session long enough to approach the context-compaction
threshold (or force a compaction), with a `.bee/HANDOFF.json` write expected.

**Observable pass condition:** The handoff file names the correct in-progress
cell, files touched so far, and a concrete next action; resuming the session
(fresh or post-compaction) picks up exactly that state without re-deriving it
from scratch or silently dropping it.

**Metrics fed:** `handoff_resume_success`.

---

## Scenario 10 — Feature finish: no auto-review

**Setup:** Let a feature run through execution to scribing/compounding close,
with the user never having asked for an independent review.

**Observable pass condition:** The session reports the feature as verified
but `unreviewed`, states the unreviewed count, and does not launch
bee-reviewing or open a review session on its own initiative.

**Metrics fed:** `unrequested_review_count`.

---

## Scenario 11 — Review requested: correct fan-out

**Setup:** The user explicitly asks for an independent review of a finished
feature or diff.

**Observable pass condition:** The session runs bee-reviewing's multi-agent
fan-out over the requested scope (not a single-pass self-review), surfaces
severity findings, and stops at Gate 4 for the user's merge decision — P1
findings block merge unless gate-bypass is at a level that lifts that floor.

**Metrics fed:** `route_accuracy`, `delivery_tool_calls`.

---

## Recording protocol

For each row: date, runtime (Claude Code / Codex), bee version, PASS/FAIL,
one-line observed evidence (what actually happened, quoting the transcript
where useful), and the metric value if it was actually measured this run. A
row with no observation is left blank — never filled with an assumed PASS or
a placeholder number.
