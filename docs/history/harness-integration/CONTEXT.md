# Harness Integration — Context

**Feature slug:** harness-integration
**Date:** 2026-07-11
**Exploring session:** complete (surface-scope-earlier path — requirements and acceptance criteria already existed in a pre-written plan; see Handoff Note)
**Scope:** Standard
**Domain types:** RUN | ORGANIZE

## Feature Boundary

Bring select `repository-harness` mechanisms into bee — CLI unification with agent-integration compliance, an intervention log, a tool registry, a task-management index, input-type intake classification, and opt-in worktree isolation for swarming — built on bee's own codebase and workflow discipline, never a rebase onto harness's Rust/SQLite substrate. This feature ends when all 6 phases in `plans/260711-2055-harness-integration/plan.md` are shipped or explicitly descoped; the current slice is **Phase 1 only** (unified CLI entrypoint).

## Locked Decisions

| ID | Decision | Rationale (only if it changes implementation) |
|----|----------|-----------------------------------------------|
| D1 | Base = bee's own codebase. Port harness's *behavior* in; never rebase bee onto harness's Rust/SQLite runtime. | Bee's workflow discipline (gates, cap-requires-proof, goal-check, frozen-judge) is dogfooded and hard to safely re-derive in another language; harness's DB/CLI structure is cheap to replicate with existing Node tooling. Full comparison: `docs/decisions/0024-harness-cross-pollination-analysis.md` §4. |
| D2 | Phase 1 (unified `bee.mjs` dispatcher + shared command registry) ships before any other new subcommand group (intervention log, tool registry, task-management index). | Phases 2–5 each add a subcommand to the same dispatcher; building them first would mean retrofitting 3 standalone files into one dispatcher later. `plans/260711-2055-harness-integration/plan.md` dependency table. |
| D3 | The `--help --json` manifest emits each command in the same JSON-Schema tool-definition shape Claude Code's own tool/subagent surface already uses (`{name, description, parameters}`), not a bespoke ad-hoc format. | Zero-translation integration for any Claude-based agent; forward-compatible with an optional future MCP wrapper without reshaping. `phase-01-unified-cli-entrypoint.md` §Manifest shape. |
| D4 | CLI-shape compliance is enforced by extending the existing `bee-write-guard.mjs` hook — no 7th hook. | Bee's own rule: any new hook must name which of the six it replaces; this is squarely write-guard's existing PreToolUse job (it already gates Bash pre-Gate-3). `phase-01-unified-cli-entrypoint.md` §Enforcement. |
| D5 | The 4 existing entrypoints (`bee_status/cells/reservations/decisions.mjs`) keep working unchanged; `bee.mjs` is additive, not a replacement — mechanically: `bee.mjs` imports the same `lib/*.mjs` functions the 4 entrypoints already import (confirmed during validating: all 4 are already thin wrappers over `lib/cells.mjs`/`lib/state.mjs`/etc.), and never imports or edits the 4 CLI files themselves. | No breaking change for any skill instruction that still references the old paths. Mechanism resolved 2026-07-11 after validating iteration 1 found the original "delegate to the helper's handler" framing unbuildable (the 4 CLI files export nothing) — the fix needed no refactor since the reusable logic already lives in `lib/`. `plans/260711-2055-harness-integration/plan.md` acceptance criteria; `docs/history/harness-integration/reports/validation-phase-1.md`. |
| D6 | An MCP server wrapper and a mandatory every-session `--help --json` discovery call are explicitly deferred out of this feature. | Foundation-add without demonstrated need — same reasoning bee already applied rejecting worktree-as-default-primitive (decision 0018) and skipping harness's changeset machinery (docs/08 #7). Revisit only if dogfood shows real need. `phase-01-unified-cli-entrypoint.md` §Deferred. |

### Agent's Discretion

Implementation details inside each phase file (exact function names, internal module boundaries) are left to the executing worker, provided the locked decisions above and each phase's own Requirements/Files sections are honored.

## Existing Code Context

### Reusable Assets

- `skills/bee-hive/templates/bee_status.mjs`, `bee_cells.mjs`, `bee_reservations.mjs`, `bee_decisions.mjs` — the 4 existing helpers `bee.mjs` routes to.
- `.bee/bin/lib/` (`state.mjs`, `cells.mjs`, `reservations.mjs`, `guards.mjs`, `inject.mjs`, `backlog.mjs`, `commands_detect.mjs`) — shared logic the helpers and hooks already both depend on.

### Established Patterns

- `bin/lib/inject.mjs` — one module feeds the session-init hook, the AGENTS.md block, and `bee_status` output, "so the runtimes can never drift" (docs/02-architecture.md). Phase 1's `--help`/`--help --json` split reuses this exact pattern for command discovery instead of session state.
- `hooks/bee-write-guard.mjs` + `.bee/bin/lib/guards.mjs` — the existing PreToolUse enforcement surface (gate guard, reservation guard, privacy/scout guard) that Phase 1 extends with a 4th check (CLI-shape validation), per D4.

### Integration Points

- `hooks/bee-write-guard.mjs` — gains the registry-shape validation check.
- `skills/bee-hive/scripts/onboard_bee.mjs` — vendors `bee.mjs` + the registry + validator with managed-hash drift detection.
- `skills/bee-hive/templates/AGENTS.block.md` — bootstrap step referencing `bee --help --json`.

## Canonical References

- `plans/260711-2055-harness-integration/plan.md` — the 6-phase plan (this feature's execution shape).
- `plans/260711-2055-harness-integration/phase-01-unified-cli-entrypoint.md` — full detail for the current slice.
- `docs/decisions/0024-harness-cross-pollination-analysis.md` — full comparative analysis backing D1–D6.
- `docs/decisions/0018-orchestrator-goal-check-and-frozen-judge.md` — precedent for rejecting a foundation swap without demonstrated need (cited by D6).

## Outstanding Questions

### Deferred To Planning

- [ ] Exact registry entry format for existing helpers' subcommands (full enumeration) — mechanical, resolved during Phase 1 implementation, not a planning blocker.

## Deferred Ideas

- Phases 2–6 (intervention log, tool registry, task-management index, input-type classification, worktree isolation) — out of this CONTEXT's current slice; each returns to `bee-planning` as its own slice per the plan's dependency table.
- MCP server wrapper, mandatory-every-session discovery call — deferred per D6.

## Handoff Note

This CONTEXT was written via the **surface-scope-earlier** path (`bee-hive/SKILL.md` §Routing): the user's request ("Triển khai plan plans/260711-2055-harness-integration/") already carried concrete acceptance criteria and file references from a plan authored and reviewed in a prior session — no fresh Socratic gray-area dialogue was needed, only distillation into cited, D-ID'd decisions above.

**Mode gate result (mechanical, not a preference call): `high-risk`.** Phase 1 modifies `hooks/bee-write-guard.mjs`, one of bee's own gate-enforcement hooks — this trips the `audit/security` flag, which is on bee-hive's explicit hard-gate list (auth, authorization, data loss, **audit/security**, external provider, validation removal). Per the mode-gate rule ("4+ flags **or any hard-gate flag**"), this alone forces `high-risk`, regardless of the total flag count. Also present: `existing covered behavior` (write-guard has its own test suite today) and `multi-domain` (CLI, hook, onboarding, AGENTS.md).

**Gate-bypass does not apply.** `.bee/config.json` has `gate_bypass: true` for this repo, but the safety floor is absolute: "high-risk / hard-gate work always stops for you" regardless of the bypass switch. Gates 1–4 must each be asked individually and answered by the human for this feature.
