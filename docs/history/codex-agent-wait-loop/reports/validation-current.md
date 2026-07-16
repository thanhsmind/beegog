# Validation: Codex Agent Wait Loop

Date: 2026-07-15  
Verdict: READY WITH ENVIRONMENT CONSTRAINT

## Reality gate

- The screenshot's `Waiting for agents`, `Finished waiting`, and
  `No agents completed yet` strings are not emitted by repository runtime code.
  The only repository occurrence outside this feature history is the P42 backlog
  row that records the user's report.
- The live Codex collection contract permits
  `wait_agent(..., timeout_ms=60000)` when a result is needed, but does not define
  what the orchestrator must do after an empty timeout. That ambiguity directly
  permits the repeated native calls rendered in the screenshot.
- Native completion already returns into the parent thread; no Codex UI or tool
  implementation change is required. The smallest owned repair is instruction
  doctrine plus an executable drift census and pressure proof.
- This source checkout's onboarding reports `self_skip` for `.agents` and
  `.claude`. An external authoritative-tree sync would deep-mirror every bee
  skill and absorb unrelated existing drift. The cell therefore owns only the
  12 matching projection files and permits only this feature's hunks.

## Feasibility matrix

| Requirement | Repository proof | Execution proof |
|---|---|---|
| D1 timeout is not failure | Existing swarming doctrine already says silence is not failure. | New census must pin preservation of agents, claims, and reservations and forbid interrupt/redispatch. |
| D2 no immediate re-wait | RED selected immediate `wait_agent` in all three frozen pressure scenarios. | New always-loaded anchor plus GREEN replay must select B in all three. |
| D3 exact interval | CONTEXT and repaired plan name task-local work, exactly one `list_agents` fallback, then commentary naming live state and next action. | Cell action and truths carry the same exact sequence; no-op, repeated reads, hidden reasoning, and generic commentary fail. |
| D4 all native bee flows | Swarming-only wording would miss ordinary gathers. | Root/master doctrine plus routing and swarming surfaces cover ordinary and swarm collection; `.agents`/`.claude` copies are explicit. |
| D5 polling reconciliation | Critical pattern 20260711 bans scratchpad polling for native agents. | New wording preserves external process/artifact polling as a separate carve-out instead of banning all waits. |
| Reproducible skill TDD | RED prompt, A/B/C options, loaded guidance, exact output, and old rubric are frozen in `pressure-tests.md`. | One fresh review-tier child at a time loads the amended surfaces and replays all three unchanged scenario blocks; exact prompt/output/scoring lands in the creation log. |

## Independent checks

- Plan checker: READY after confirming live projection ownership, exact D3
  acceptance, full-verify ownership, and preservation of unrelated projection
  drift.
- Cold cell reviewer: READY; no remaining scope, replay, or execution blocker.
- The narrow cell command
  `node skills/bee-hive/templates/tests/test_lib.mjs && git diff --check` is
  runnable and green before execution.

## Environment constraint

The configured repository-wide verify contains suites that spawn nested child
processes. In this Codex sandbox those suites can return empty output with an
underlying `EPERM`; this matches the established 20260712 sandbox-denial critical
pattern and is not evidence of a product regression. The unchanged core suite is
green (`321 passed, 0 failed` from the session baseline), and the exact narrow
cell verify is green. Execution must still attempt the configured full command,
retain its exact output/denial evidence, and must not label that attempt green if
the sandbox denies it.

### Execution-repair validation

The first dispatch proved a second sandbox boundary before any feature wording
changed: `.agents/**` is read-only for both the worker and parent, while root
`AGENTS.md`, canonical `skills/**`, and `.claude/**` are writable. The original
cell was dropped with its RED checkpoint preserved. Replacement cell
`codex-agent-wait-loop-2` therefore:

- enforces the live Codex behavior through always-loaded root `AGENTS.md`;
- updates canonical skills as the authoritative future-sync payload;
- updates only the writable `.claude` feature surfaces;
- records `.agents` as unsynchronized/read-only and forbids any parity claim;
- preserves the exact census, GREEN replay, narrow verify, and full-verify
  evidence requirements.

The plan checker and cold cell reviewer independently rechecked this delta and
both returned READY with no blockers. The repaired narrow verify is runnable and
green.

## Decision

The repaired plan is implementation-ready. It changes no Codex UI/runtime API, does not
interrupt or duplicate agents, and does not reconcile unrelated projection
drift. The implementation may proceed with the RED-before-wording order frozen
in the cell.
