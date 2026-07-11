# Phase 3 — Tool registry

## Context

- [docs/decisions/0024-harness-cross-pollination-analysis.md](../../docs/decisions/0024-harness-cross-pollination-analysis.md) (tool-registry finding, discussed in conversation, not yet written into 0024's file body)
- harness source: `docs/TOOL_REGISTRY.md` (full mechanics); `query_tools(responsibility, capability)` in `crates/harness-cli/src/infrastructure.rs`
- Verified bee gap (2026-07-11): `.bee/tools.json` is named in `docs/02-architecture.md`'s layout, `docs/08-harness-adoption.md`'s "already covered" table ("designed; helper still minimal"), and `docs/05-roadmap.md` — but a repo-wide grep for `bee_tools`, `tool register`, `tool check` returns **zero results**. No implementation exists; only a reserved file name.

## Requirements

- Distinguish **outbound** (bee's own subcommands, always present — covered by Phase 1's registry) from **inbound** (project-equipped optional tools: linters, gkg, browser-testing, beads adapter — three already named in `docs/05-roadmap.md`).
- Register a tool: `{name, kind: cli|binary|mcp|skill|http, capability (kebab-case), command|scan_target, description, responsibility}`.
- `bee tool check` probes presence per kind — `cli`/`binary` via `PATH` resolution, `mcp`/`skill` via `scan_target` path existence, `http` via short-timeout TCP reachability — and persists `{status, checked_at}`. Never fails the process; a missing tool is a fact, not an error.
- `bee tool query --capability <x>` — steps ask by capability, never hardcode a tool name. This indirection is the entire point of the registry.
- `--json` output for agent consumption.

## Files

- Create: `bin/lib/tools.mjs` (registry logic) + a `bee tool` verb group on the Phase 1 dispatcher
- Modify: `docs/02-architecture.md` (specify `.bee/tools.json`'s actual schema — currently just named, never defined)
- Modify: `skills/bee-grooming/references/grooming-reference.md` (wire the existing `broken_tools` entropy term to the real registry instead of an always-zero placeholder)
- Modify: `docs/09-harness-course-adoption.md` reference to the capability registry (already anticipates this for browser tooling — point it at the real implementation)

## Implementation steps

1. Define the registry schema and `register` / `remove` verbs writing to `.bee/tools.json`.
2. Implement `check` with the 3 probe strategies — all non-throwing, always returning a status.
3. Implement `query --capability <x>`, normalizing capability strings to kebab-case at registration time (matches harness's exact rule: `Impact Analysis` / `impact_analysis` / `impact-analysis` all register as `impact-analysis`).
4. Wire `bee-grooming`'s existing `broken_tools` entropy term to read from the real registry.
5. Document (not force-register) bee's own known optional integrations — gkg, beads adapter, browser testing — as examples in the reference doc.

## Tests / validation

- Unit tests: register/remove round-trip, kebab-case normalization, each probe kind against a fixture (present/absent command, present/absent path, reachable/unreachable port).
- Integration: `bee tool check --json` on a scratch repo with one registered-but-absent tool confirms `status: absent` with a zero exit code.

## Risks / rollback

- Risk: the `http` probe could hang — mitigate with the same short timeout harness uses (2s).
- Rollback: additive file + verbs. Grep-confirmed that nothing in bee currently depends on `.bee/tools.json`, so removing it regresses nothing.
