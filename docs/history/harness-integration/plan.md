---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: high-risk
---

# Harness Integration — Plan

## Shape

**Shape form:** phase plan, not epic map — deviates from high-risk's default (epic map) because this work has clear, independently-demoable milestones in a fixed order (each phase ships something observable: "`bee --help` now works", "`bee intervention log` now works"), matching the explicit rule "use phases only when the work has observable milestones a user could demo in order" (`planning-reference.md`).

**Mode gate (mechanical, recorded once — already established in CONTEXT.md, carried here unchanged):** `high-risk`. Flags: `audit/security` (hard-gate flag — Phase 1 modifies `hooks/bee-write-guard.mjs`), `existing covered behavior` (the hook has its own test suite today), `multi-domain` (CLI, hook, onboarding, AGENTS.md).

| Phase | What Changes | Why Now | Demo | Unlocks |
|---|---|---|---|---|
| **1 — Unified CLI entrypoint** *(current slice)* | One `bee.mjs` dispatcher + shared registry; `--help` / `--help --json` in Claude-tool-schema shape; `bee-write-guard.mjs` gains CLI-shape validation | Prerequisite — phases 2–5 each add a subcommand to this dispatcher | `bee --help --json` returns a valid, schema-shaped manifest; a malformed `bee.mjs` call is denied by the hook before it runs | Unblocks 2–5 |
| 2 — Intervention log | Durable typed record of gate/review corrections | Closes a named gap (docs/08 #2), never built | `bee intervention log ...` records an event; grooming clusters repeats | Feeds future `propose`-style tooling |
| 3 — Tool registry | Capability-indirected registry for optional project tools | Closes a named gap (docs/08 §Tool Registry), zero prior implementation | `bee tool register/check/query --capability X` | Unblocks `broken_tools` entropy term reading real data |
| 4 — Task-management index | Cross-feature/epic/slice matrix query | Closes the task-management gap (0024 §2) | `bee index matrix` lists every feature's cells in one call | — |
| 5 — Input-type classification | Classify step ahead of `bee-exploring`, durable intake row | Closes the intake-sequencing gap (0024 §3) | A `tiny` request skips the Socratic dialogue when unambiguous | — |
| 6 — Worktree isolation | `--isolation worktree` opt-in flag for `bee-swarming` | Already scoped (docs/08 #7), independent of 1–5 | A `high-risk` wave runs each worker in its own worktree | — |

**Slice queue and feasibility status:** Phase 1 — ready (no blocking unknown; see `approach.md` risk map, no spike required). Phases 2–6 — not yet planned; each returns to `bee-planning` as its own slice after Phase 1 ships, per "cells for the current slice only."

**Current slice to prepare:** Phase 1 only.

## Test matrix (edge dimensions, high-risk depth — probed per dimension)

- **Malformed input:** a call missing a required parameter → structured `{ok:false, error}`, never a stack trace.
- **Unknown command:** a typo'd command name → nearest-match suggestion, never a bare "not found."
- **Concurrent/legacy access:** the 4 existing entrypoints keep working unchanged, byte-identical output to their `bee.mjs`-routed equivalents.
- **Drift over time:** a renamed command → `deprecated.use_instead` redirect, not a cold failure; a changed registry hash → `manifest_changed` hint on the next call.
- **Security boundary:** a Bash call shaped like a `bee`/`bee_*.mjs` invocation that doesn't match the registry → denied by the extended `bee-write-guard.mjs`, before the shell executes it.
- **Regression:** `bee-write-guard.mjs`'s existing gate/reservation/secret-guard test suite passes unchanged.
- **Fabricated evidence:** every `examples[]` entry in the registry is executed by the test suite and asserted not to error — a manifest can never advertise a broken example.

## Current slice

**Phase 1 — Unified CLI entrypoint.** Entry state: 4 independent, undiscoverable, unvalidated CLI entrypoints. Exit state: one `bee.mjs` dispatcher + registry (Claude-tool-schema shaped) + shared validator, enforced both at dispatch time and by the extended `bee-write-guard.mjs`, onboarding-vendored and documented, with zero regression to the 4 existing entrypoints or to `bee-write-guard.mjs`'s existing checks.

Files bounded: see each cell's `files`. Verify commands: `node skills/bee-hive/templates/tests/test_bee_cli.mjs` (new), `node skills/bee-hive/templates/tests/test_bee_write_guard_hook.mjs` (new, hook-level integration), `node skills/bee-hive/templates/tests/test_lib.mjs` (regression, currently 124 passing), `node skills/bee-hive/scripts/test_onboard_bee.mjs` (regression, confirms generic vendoring — no `onboard_bee.mjs` code change in this slice).

## Cells

| ID | Title | Deps | Status |
|---|---|---|---|
| `harness-integration-1` | Shared command registry + args validator | — | open |
| `harness-integration-2` | `bee.mjs` unified dispatcher | `-1` | open |
| `harness-integration-3` | Extend `bee-write-guard.mjs` (4th check) | `-1` | open |
| `harness-integration-4` | Onboarding vendoring + docs | `-1`, `-2`, `-3` | open |

Wave 1: `harness-integration-1` alone (no deps). Wave 2: `harness-integration-2` and `harness-integration-3` in parallel (both depend only on `-1`, touch disjoint files — no reservation conflict). Wave 3: `harness-integration-4` (depends on all three).

## Out of scope (this slice)

- Phases 2–6 (see slice queue above) — explicitly deferred to their own future slices, not this cell set.
- MCP server wrapper, mandatory-every-session discovery call — deferred per D6 (CONTEXT.md), not revisited in this slice.
