# Harness Integration — Approach (Phase 1 slice)

**Feature slug:** harness-integration
**Mode:** high-risk (per CONTEXT.md — touches `hooks/bee-write-guard.mjs`, an `audit/security` hard-gate flag)

## Chosen path

Ship a single dispatcher `bee.mjs` that imports the same `lib/*.mjs` functions the 4 existing helper CLIs (`bee_status/cells/reservations/decisions.mjs`) already import — confirmed during validating (iteration 1) that all 4 are already thin wrappers over `lib/cells.mjs`/`lib/state.mjs`/`lib/reservations.mjs`/`lib/decisions.mjs`, so `bee.mjs` becomes a fifth thin wrapper over the same modules, never touching or importing the 4 CLI files themselves — backed by one shared command registry (`lib/command-registry.mjs`) that emits both a human `--help` and a machine `--help --json` in the same JSON-Schema tool-definition shape Claude Code's own tool surface already uses. Compliance is enforced, not just documented: a shared validator (`lib/validate-args.mjs`) checks every call against the registry, used both by `bee.mjs` at dispatch time and by the existing `hooks/bee-write-guard.mjs` hook at PreToolUse time (D3, D4 — CONTEXT.md).

Full requirement-level detail: `plans/260711-2055-harness-integration/phase-01-unified-cli-entrypoint.md`. Validation findings and the resolved delegation mechanism: `docs/history/harness-integration/reports/validation-phase-1.md`.

## Rejected alternatives

- **Rebase bee onto harness's Rust/SQLite substrate** — rejected per D1; see `docs/decisions/0024-harness-cross-pollination-analysis.md` §4 for the full cost comparison.
- **A bespoke JSON manifest shape** — rejected per D3; would require every consumer (including this very agent) to learn a new dialect instead of reusing the one it already parses.
- **A 7th hook for CLI-shape enforcement** — rejected per D4; bee's own anti-sprawl rule requires naming which of the six existing hooks a new one replaces, and this is squarely `bee-write-guard.mjs`'s existing PreToolUse job.
- **Mandatory `--help --json` call every session, hook-enforced** — rejected per D6 (deferred); a hash-based `manifest_changed` hint is cheaper and was judged sufficient absent dogfood evidence otherwise.
- **An MCP server wrapper now** — rejected per D6 (deferred); the manifest shape (D3) already makes this a thin future addition, not a redesign, so building it now would be a foundation-add without demonstrated need.

## Risk map

| Component | Risk | Proof needed |
|---|---|---|
| Extending `hooks/bee-write-guard.mjs` (shared, load-bearing hook) | HIGH — regressing its existing gate/reservation/secret-guard responsibilities would silently weaken bee's own enforcement | The existing hook's test suite must pass unchanged, plus new tests for the added check, before this cell can cap. No spike needed — the proof is the existing + new test run itself. |
| Manifest/validator drift from the 4 real helpers | MEDIUM — a hand-maintained registry could silently diverge from what the helpers actually accept | Every `examples[]` entry in the registry is executed by the test suite and asserted not to error (manifest-as-tested-contract, already specified in phase-01). |
| Backward compatibility of the 4 existing entrypoints | MEDIUM — any skill instruction still calling `bee_cells.mjs` directly must keep working | Parity test: `bee cells ready` output byte-identical to `bee_cells.mjs ready`. |
| Node version / runtime assumption | LOW | Already verified this session: Node v24.18.0 present, no new npm dependency introduced. |

No MEDIUM/HIGH item requires a `.spikes/` experiment — each has a concrete test-based proof achievable inside the cell itself, so `bee-validating` verifies via test execution, not a disposable spike.

## Likely files and order

1. `bin/lib/command-registry.mjs` — registry data (no behavior yet, unblocks everything else)
2. `bin/lib/validate-args.mjs` — validator (depends on registry shape)
3. `bee.mjs` — dispatcher (depends on 1, 2)
4. `hooks/bee-write-guard.mjs` — add the 4th check (depends on 2; must not touch the existing 3 checks' logic)
5. `skills/bee-hive/scripts/onboard_bee.mjs` — vendor wiring (depends on 1–3 existing as files to vendor)
6. `skills/bee-hive/templates/AGENTS.block.md`, `docs/02-architecture.md`, `docs/07-contracts.md` — documentation (last, describes the shipped shape)

Full file list with purpose: `phase-01-unified-cli-entrypoint.md` §Files.

## Relevant learnings

- `bin/lib/inject.mjs`'s "one source feeds many surfaces" pattern (docs/02-architecture.md) is the direct precedent for the `--help` / `--help --json` split — reused, not reinvented.
- Decision 0018 rejected worktree-per-worker as a foundation swap "without demonstrated need" — the same reasoning is cited (D6) to defer the MCP wrapper here.

## Open questions for validating

- Confirm the exact set of existing `bee-write-guard.mjs` tests (location, count) so the "unchanged" regression bar is a concrete, checkable number, not an assumption.
- Confirm no other skill or hook currently greps for the literal string `bee_cells.mjs` (etc.) in a way that a new `bee.mjs` co-existing file name could confuse (unlikely, but a 2-minute grep is cheap proof).
