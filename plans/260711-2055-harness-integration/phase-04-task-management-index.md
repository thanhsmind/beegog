# Phase 4 — Task-management index

## Context

- [docs/decisions/0024-harness-cross-pollination-analysis.md](../../docs/decisions/0024-harness-cross-pollination-analysis.md) §2 (task-management substrate gap) and Scope bullet 1
- harness source: `query_matrix`, `query_sql` in `crates/harness-cli/src/infrastructure.rs`
- Verified bee gap: `.bee/state.json.feature` is a single scalar (one feature in flight, by design); `docs/backlog.md` is hand-maintained markdown; cells are scattered `.bee/cells/*.json` files with no cross-feature query command.

## Requirements

- A **derived, rebuildable** index — NOT a new source of truth. Cells and `docs/backlog.md` stay authoritative (same policy-vs-operations split bee already has for everything else).
- `bee index rebuild` — recompute from `.bee/cells/*.json` across all `docs/history/*/` features, `docs/backlog.md` rows, and (once Phase 2 lands) `.bee/interventions.jsonl`.
- `bee index matrix [--feature X]` — tabular status across every feature/epic/slice/cell, or scoped to one.
- Storage choice open: embedded SQLite (e.g. Node's `node:sqlite` if the supported Node version has it) vs a simpler derived JSON aggregate — see plan.md open question 1.

## Files

- Create: `bin/lib/index.mjs` + `bee index` verb group on the Phase 1 dispatcher
- Modify: `docs/02-architecture.md` — add the new derived-state file (e.g. `.bee/index.db` or `.bee/index.json`), explicitly marked derived/rebuildable, not authoritative
- Modify: `skills/bee-hive/templates/bee_status.mjs` — surface index staleness (last rebuilt vs. latest cell mtime)

## Implementation steps

1. Resolve the storage open question with the owner before implementation starts — this phase has the highest chance of needing a real Gate 1 discussion, not a rubber-stamp (see Risks).
2. Write the rebuild function: walk cells across *all* features (not just the current in-flight one), parse `docs/backlog.md` rows, merge into the index.
3. Implement the `matrix` query, optionally filtered by feature.
4. Wire `bee_status.mjs` to warn when the index is stale relative to the newest cell file.

## Tests / validation

- Unit: rebuild from a fixture set of cells spanning 2+ fake features produces a correct matrix.
- Integration: modify a cell, confirm `bee index rebuild` picks up the change; confirm the staleness warning fires when rebuild is skipped.

## Risks / rollback

- Risk: an embedded DB is a heavier dependency than bee's current zero-deps posture, even bundled — needs explicit owner sign-off before starting, not an assumption baked into this plan.
- Rollback: derived-only. Deleting the index file is always safe; cells and `docs/backlog.md` remain the untouched source of truth.
