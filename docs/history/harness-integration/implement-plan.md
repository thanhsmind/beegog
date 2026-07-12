---
artifact_contract: bee-implement-plan/v1
feature: harness-integration
lane: high-risk
status: Shipped
updated: 2026-07-11
sources: [CONTEXT.md, approach.md, plan.md, cells]
decisions: [D1, D2, D3, D4, D5, D6]
---

# Implementation Plan: Harness Integration — Phase 1 (Unified CLI Entrypoint)

> Human-layer projection of the truth artifacts. Truth lives in CONTEXT.md
> (decisions), plan.md + cells (work), and the validating report (evidence).
> Feedback on this document flows back to those artifacts, then this re-renders.

## 1. Goal

Bring bee's own CLI surface to the point where an AI agent can both *discover* what bee's helpers can do and *reliably comply* when calling them — today an agent must know 4 separate file names by memory, has no schema to validate a call against, and gets a bare stack trace on a malformed call instead of a correction it can act on.

**Success looks like**
- `bee --help --json` returns a manifest in the same JSON-Schema shape Claude Code's own tool surface already uses (D3).
- A malformed CLI call is denied *before* it executes, with a structured, actionable reason (D4).
- The 4 existing entrypoints keep working, byte-identical, with zero breaking change (D5).

## 2. Current State

Bee ships 4 independent `.mjs` entrypoints (`bee_status.mjs`, `bee_cells.mjs`, `bee_reservations.mjs`, `bee_decisions.mjs`), each invoked separately via `node .bee/bin/bee_*.mjs <args>`. There is no `package.json`, no unified `--help`, and no schema an agent (or a hook) can validate a call against before it runs. `hooks/bee-write-guard.mjs` already gates Bash calls (gate guard, reservation guard, privacy/scout guard) but has no CLI-shape check today.

## 3. Scope

**In scope**
- One dispatcher `bee.mjs` + shared command registry (D2 — ships before any other new subcommand group).
- `--help` (human) and `--help --json` (Claude-tool-schema shaped, D3).
- Argument validation shared by the dispatcher and by `hooks/bee-write-guard.mjs` (D4).
- Manifest versioning (`schema_version`, `deprecated`/`use_instead`) and a `manifest_changed` staleness hint.
- Onboarding vendoring of the new files.

**Out of scope**
- Phases 2–6 (intervention log, tool registry, task-management index, input-type classification, worktree isolation) — each is its own future slice (plan.md slice queue).
- An MCP server wrapper and a mandatory every-session discovery call — deferred (D6).

## 4. Proposed Approach

Ship a thin dispatcher that imports the same `lib/*.mjs` functions the 4 existing helper CLIs already import (all 4 are already thin wrappers over `lib/cells.mjs`/`lib/state.mjs`/`lib/reservations.mjs`/`lib/decisions.mjs` — confirmed during validating iteration 1), never touching or importing the 4 CLI files themselves, backed by one shared registry file that both the dispatcher and `bee-write-guard.mjs` validate calls against (D3, D4). The registry speaks the same `{name, description, parameters: JSON-Schema}` shape this very agent already parses for its own tools — zero translation, and it makes a future MCP wrapper a thin pass-through rather than a redesign, though that wrapper is explicitly not built now (D6).

**Why this approach** — reuses bee's own existing anti-drift pattern (`bin/lib/inject.mjs`: one module feeds many surfaces) instead of inventing a new one; keeps the compliance mechanism (validation + hook enforcement) inside bee's existing enforcement surface rather than adding new infrastructure.

**Alternatives considered**
- Rebase bee's CLI onto a compiled tool (Rust/clap, mirroring harness) — rejected (D1): the workflow discipline bee already has is the expensive part to re-derive; a Node dispatcher is the cheap part to add.
- A bespoke manifest shape — rejected (D3): would require every consumer to learn a new dialect instead of the one already understood.
- A new, 7th hook for CLI-shape enforcement — rejected (D4): bee's own rule requires naming which of the six existing hooks a new one replaces; this is `bee-write-guard.mjs`'s job.

## 5. Technical Design

```text
agent (this session or a future one)
  -> Bash tool call: node .bee/bin/bee.mjs <group> <args>
  -> hooks/bee-write-guard.mjs (PreToolUse; existing gate/reservation/privacy checks run first,
                                 sharing one try/catch + one `denial` variable in main())
       -> PREREQUISITE: validate-args.mjs must already be vendored to .bee/bin/lib/ (onboarding's
          generic template scan does this automatically once it exists on disk)
       -> NEW 4th check: validate-args.mjs (imported via the hook's existing libModuleUrl pattern,
          same as guards.mjs) checks the call against command-registry.mjs
       -> mismatch -> deny, structured correction on stderr (never executes) — additive only,
          must never overwrite/discard a denial already set by checks 1-3
       -> match -> allow
  -> bee.mjs dispatcher
       -> validate-args.mjs (same validator, same registry) re-checks at dispatch time
       -> mismatch -> {ok:false, error:{field, reason, command}}
       -> deprecated (non-null) entry -> redirect naming use_instead
       -> match -> calls the matching lib/*.mjs function directly (the SAME function the
          corresponding existing CLI file already imports), formats output to match that
          CLI's existing output exactly
  -> lib/cells.mjs / lib/state.mjs / lib/reservations.mjs / lib/decisions.mjs — unchanged,
     already exported, already the real logic behind bee_status/cells/reservations/decisions.mjs
```

**Data model** — no stored data model changes; `command-registry.mjs` is a static, versioned data file (top-level `schema_version`), not persisted state. `bee.mjs`'s manifest-hash tracking (for `manifest_changed`) does introduce one small new persisted file (name/location decided by the implementing cell, documented there) since the dispatcher runs as a fresh process per call with no built-in session concept.

**API / contract** — the 4 existing entrypoints' argument contracts and output are unchanged; `bee.mjs` is a fifth thin wrapper over the same `lib/*.mjs` modules, never importing or editing the 4 CLI files.

**Security / Permissions** *(mandatory, high-risk)* — the only security-relevant surface this phase touches is `hooks/bee-write-guard.mjs`, and the change is strictly additive: one new check (CLI-shape validation) appended after the three existing checks (gate guard, reservation guard, privacy/scout guard), sharing the same deny-with-reason / fail-open-on-crash discipline the hook already uses. Because `main()` shares one try/catch and one `denial` variable across all checks (found during validating), the new check's `must_haves` explicitly require it can never overwrite or discard a denial already set by checks 1–3 — proven by a dedicated hook-level integration test (`test_bee_write_guard_hook.mjs`), not just by re-running the existing `test_lib.mjs` (which tests `guards.mjs`'s functions directly and never exercises the hook script itself). No existing check's logic is modified. The validator itself only reads the static registry and the parsed argv, and error responses only ever name registry-public field/command names — never a raw command string or argument value.

## 6. Affected Files

*(Projected from cell `files`, authoritative post-prep.)*

| Action | File / Component | Purpose | Cell |
|--------|------------------|---------|------|
| Create | `skills/bee-hive/templates/lib/command-registry.mjs` | Shared registry (JSON-Schema `parameters` per command) | `harness-integration-1` |
| Create | `skills/bee-hive/templates/lib/validate-args.mjs` | Shared validator (dispatcher + hook) | `harness-integration-1` |
| Create | `skills/bee-hive/templates/tests/test_bee_cli.mjs` | New CLI test suite (registry, validator, dispatcher — isolated temp-repo examples) | `harness-integration-1`, `-2` |
| Create | `skills/bee-hive/templates/bee.mjs` | Unified dispatcher | `harness-integration-2` |
| Modify | `hooks/bee-write-guard.mjs` | Add the 4th check (CLI-shape validation) | `harness-integration-3` |
| Create | `skills/bee-hive/templates/tests/test_bee_write_guard_hook.mjs` | Hook-level integration test (spawns the real hook script) | `harness-integration-3` |
| Modify | `skills/bee-hive/templates/AGENTS.block.md` | Bootstrap step referencing `bee --help --json` | `harness-integration-4` |
| Modify | `docs/02-architecture.md`, `docs/07-contracts.md` | Document the new CLI surface | `harness-integration-4` |

## 7. Implementation Steps

*(Projected from cell titles + deps, authoritative post-prep. Full detail per cell in `plan.md` §Cells.)*

- [ ] Shared command registry + args validator (`harness-integration-1`) — no deps
- [ ] `bee.mjs` unified dispatcher (`harness-integration-2`) — deps: `-1`
- [ ] Extend `bee-write-guard.mjs` with the 4th check (`harness-integration-3`) — deps: `-1` (parallel wave with `-2`, disjoint files)
- [ ] Onboarding vendoring + docs (`harness-integration-4`) — deps: `-1`, `-2`, `-3`

## 8. Validation Plan

**Automated**
- `node skills/bee-hive/templates/tests/test_lib.mjs` → expected: all existing 124 tests still pass unchanged (pure regression — this file tests `lib/guards.mjs`'s functions directly, not `hooks/bee-write-guard.mjs` itself).
- `node skills/bee-hive/templates/tests/test_bee_cli.mjs` (new) → registry JSON-Schema validity, validator rejection shape, `--help --json` schema, nearest-match suggestion, `deprecated` redirect, `manifest_changed` hint, `bee cells ready` parity — examples run only inside an isolated temp repo.
- `node skills/bee-hive/templates/tests/test_bee_write_guard_hook.mjs` (new) → spawns the real hook script with crafted stdin: malformed-call denial, zero regression to the 3 existing checks, and the new check cannot overwrite an existing denial even when forced to throw.
- `node skills/bee-hive/scripts/test_onboard_bee.mjs` → confirms the existing generic vendoring scan picks up the 3 new files with no `onboard_bee.mjs` code change.

**Manual** — [ ] onboard a scratch repo, confirm `.bee/bin/bee.mjs` vendors correctly and `bee --help --json` is well-formed.
**Evidence** — `docs/history/harness-integration/reports/validation-phase-1.md` (iteration 1: NOT READY — RETURN TO PLANNING, 6 findings; iteration 2: READY, all 6 confirmed resolved against source, 2 informational notes applied). Feasibility verdict only — Gate 3 approval is separate and still pending.

## 9. Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Extending `bee-write-guard.mjs` regresses its existing gate/reservation/secret-guard behavior | High | Existing hook test suite must pass unchanged before this cell caps; new check is additive and isolated |
| Registry/validator drifts from what the 4 real helpers actually accept | Medium | Every `examples[]` entry executed by the test suite, asserted not to error |
| Backward compatibility of the 4 existing entrypoints | Medium | Byte-identical parity test (`bee cells ready` vs `bee_cells.mjs ready`) |
| Node version / runtime assumption | Low | Verified this session: Node v24.18.0 present, zero new npm dependency |

## 10. Rollback Plan

Every file this phase touches is either newly created (`bee.mjs`, `command-registry.mjs`, `validate-args.mjs`) or additively modified (`bee-write-guard.mjs`'s new check is a single, isolated hunk appended after the three existing checks; `onboard_bee.mjs`, `skills/bee-hive/templates/AGENTS.block.md`, and the docs are additive references). Rollback is: revert the cells' commits for this slice. Because `bee-write-guard.mjs`'s change does not touch the three existing checks' logic, a partial revert (drop only the new 4th check) is also safe if the new check alone is found to be the problem — the existing gate/reservation/privacy enforcement is unaffected either way.

## 11. Open Questions

**Resolved during validating iteration 1:**
- ~~Confirm the exact existing test coverage for write-guard behavior~~ — resolved: `test_lib.mjs` tests `lib/guards.mjs` directly (124 tests), never the hook script itself; closed by adding `test_bee_write_guard_hook.mjs` (cell `harness-integration-3`).
- ~~Delegation mechanism for `bee.mjs`~~ — resolved: import the same `lib/*.mjs` functions the 4 existing CLIs already import (no refactor needed, no subprocess spawn needed).
- ~~Cell 3 / cell 4 vendoring order~~ — resolved: cell 3 re-runs the existing generic onboarding vendoring step itself before testing (per Blocker 5, vendoring is automatic and safe to re-run).

**Still open:**
- Exact name/location for the manifest-hash persistence file (cell `harness-integration-2`'s implementer chooses and documents it — no existing convention to follow since `bee.mjs` is stateless per invocation).
- Confirm no other skill or hook currently greps for the literal string `bee_cells.mjs` in a way a new co-existing `bee.mjs` file name could confuse (approach.md — cheap grep, not yet run).
