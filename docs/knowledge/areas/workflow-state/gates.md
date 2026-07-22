---
type: bee.area
title: "Workflow State — starting a feature, the phase vocabulary, phase-owned routing, and closing"
description: "The guarded doors of a feature's life: the all-or-nothing start that can never inherit the previous feature's approvals, the closed phase vocabulary, the adviser consult high-risk execution approval demands, the phase-owned generic routing mutation, and the three-step tail that makes declaring a feature closed impossible."
timestamp: 2026-07-22
bee:
  id: workflow-state-gates
  lifecycle: active
  areas: [workflow-state]
  required_context: [areas/workflow-state/overview.md]
  decisions: ["chain-integrity D1-REVISED/D2/D3/D4 (the tail of the chain: learning capture is produced not asserted, the sync demands executed work, the close demands zero spec debt, the waiver is audited)", "AO3/AO13 (Gate 3 adviser precondition, event-based staleness, never a TTL — cells ao-4-1/ao-4-2 2026-07-17)", codex-hook-state-parity D4-D6 (pre-phase routing ownership and review isolation)]
  sources: ["chain-integrity cells ci-1/ci-2/ci-3 (traces in .bee/cells/, CONTEXT docs/history/chain-integrity/CONTEXT.md, 2026-07-14 — origin: an owner-supplied post-mortem of a real session in which the chain's tail was bypassed seven times)", "advisor-and-orchestration Slice 4 cells ao-4-1/ao-4-2 (adviser consult record + event-based staleness + high-risk execution precondition, live-throw verified, 2026-07-17)", "codex-hook-state-parity cell codex-hook-state-parity-1 (pre-phase routing ownership and review isolation; report and capped trace, 2026-07-16)", "docs/specs/workflow-state.md#B1", "docs/specs/workflow-state.md#B2", "docs/specs/workflow-state.md#B9a", "docs/specs/workflow-state.md#B19"]
  authoritative_for: "workflow-state: feature start, the phase vocabulary, phase-owned routing mutation, and the closing tail"
---

# Workflow State — starting a feature, the phase vocabulary, phase-owned routing, and closing

A feature's life is bounded at both ends by a guard. At the start, one
all-or-nothing write that refuses unless the previous feature really finished —
so a new feature can never inherit the previous one's approvals or bury its
unfinished work. At the end, a three-step tail in which each step must prove the
step before it happened. Between them sit the two rules that keep every routing
write honest: the phase vocabulary is closed, and a generic routing mutation is
owned by the phase it started from.

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

**B19 — A generic routing mutation is phase-owned.** Trigger: a caller changes
phase, mode, feature, summary, or next action through the generic state command.
The command first reads the selected default or lane record strictly. A missing,
invalid, or mismatched pre-change owner refuses the operation with the record
byte-identical. A matching owner changes only that selected record; the owner is
not persisted, and a phase change makes the new phase the owner of the next
change. Gate writes remain separate and require no owner. Independent review
keeps its findings and decision inside its review-session record and never uses
generic routing mutation to change execution readiness.

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

