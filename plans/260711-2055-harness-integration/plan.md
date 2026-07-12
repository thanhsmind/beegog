# Harness Integration Plan — bring repository-harness mechanisms into bee

- **Status:** proposed — not started, not yet routed through bee's own `bee-hive → bee-exploring → Gate 1` chain (authored directly in a research conversation)
- **Base decision:** integrate on top of bee's codebase, port harness's *behavior* in — not the reverse. Full rationale: [docs/decisions/0024-harness-cross-pollination-analysis.md](../../docs/decisions/0024-harness-cross-pollination-analysis.md) §4.
- **Background:** [plans/reports/research-260711-1622-bee-harness-system-overview-report.md](../reports/research-260711-1622-bee-harness-system-overview-report.md) — initial system survey (bee architecture, orchestrator, cook --parallel comparison).

This plan does not duplicate the comparative analysis — each phase links back to the relevant section of 0024 or to harness source for the "why". This file is the executable shape only.

## Phases

| # | Phase | Goal | Depends on | Status |
|---|---|---|---|---|
| 1 | [Unified CLI entrypoint](phase-01-unified-cli-entrypoint.md) | Collapse 4 helpers behind one `bee.mjs` dispatcher + dual-audience `--help` / `--help --json` | — | proposed |
| 2 | [Intervention log](phase-02-intervention-log.md) | Durable typed record of what a human actually did at each gate/review | 1 | proposed |
| 3 | [Tool registry](phase-03-tool-registry.md) | Capability-indirected registry for optional project tools | 1 | proposed |
| 4 | [Task-management index](phase-04-task-management-index.md) | Cross-feature/epic/slice matrix query, derived from existing JSON | 1 | proposed |
| 5 | [Input-type classification](phase-05-input-type-classification.md) | Harness-style classify step ahead of `bee-exploring`, durable intake row | 1 | proposed |
| 6 | [Worktree isolation for swarming](phase-06-worktree-isolation.md) | `--isolation worktree` flag on `bee-swarming` for high-risk/wide-blast waves | — | proposed (already scoped in docs/08 #7) |

Phase 1 is the prerequisite for 2–5 (each adds a subcommand to the same dispatcher rather than another standalone file). Phase 6 is independent and can run any time.

## Acceptance criteria (overall)

- Every new mechanism is additive: bee's existing cap-requires-proof, goal-check, frozen-judge, gates, and event-sourced decisions/friction discipline are never weakened or replaced.
- No new mechanism breaks "curl \| bash" install — Node 18+ ESM; any new runtime dependency (e.g. an embedded DB in Phase 4) needs explicit owner sign-off, not a default assumption.
- Each phase ships its own tests before being marked done (mirrors the existing `test_lib.mjs` pattern).
- This plan itself is routed through bee's real chain before Phase 1 begins — see risk below.

## Risks (plan-level)

- This is bee-on-bee work — `bee-grooming`'s own scope rule says `.bee/` is never project debt, so this plan sits outside grooming's normal hunt. Flag explicitly at Gate 1 that this is harness-plumbing work, not a product feature.
- 6 phases is real scope. Each phase must be independently shippable and independently gated — never batch two phases into one Gate 3 execution wave.

## Open questions (carried from docs/decisions/0024)

1. Phase 4: embedded SQLite vs a simpler derived JSON aggregate for the index?
2. Phase 1: bake the `--help --json` manifest into AGENTS.md at onboard time, or discover it live every session?
3. Who runs this plan through bee's own decision pipeline (`bee_decisions.mjs log`), since neither this plan nor 0024 was produced via an active bee phase?
