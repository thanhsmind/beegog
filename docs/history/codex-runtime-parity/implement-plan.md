---
artifact_contract: bee-implement-plan/v1
feature: codex-runtime-parity
lane: high-risk
status: Needs Revision
updated: 2026-07-12
sources: [CONTEXT.md, discovery.md, approach.md, plan.md, reports/diagnosis-codex-stop-hooks.md, reports/validation-codex-repo-fallback.md, reports/validation-safety-foundation.md, .bee/cells/codex-parity-6a.json, .bee/cells/codex-parity-6b.json]
decisions: [D1, D2, D3, D4, 5e6582af-57b7-442f-9ded-b3eda61f5543, d91a8398-2d63-426b-a133-341568453200]
---

# Implementation Plan: Codex Runtime Parity

> Human-layer projection of the truth artifacts. Truth lives in CONTEXT.md
> (decisions), plan.md + cells (work), and the validating report (evidence).
> Feedback on this document flows back to those artifacts, then this re-renders.

## 1. Goal

Make Codex a first-class bee runtime: one install provides the current shared
skills and every lifecycle guardrail Codex can support, while unsupported paths
remain honestly visible and helper-enforced rather than being described as safe.

**Success looks like**

- A fresh Codex thread loads the release's bee skills and ends migration with
  exactly one configured, active bee hook source (D1).
- Session context, write/privacy/reservation checks, state refresh, worker
  nudges, and close hygiene behave correctly on every compatible Codex event;
  unsupported paths are named and tested (D2).
- Every nested Codex executor keeps normal approvals and workspace-scoped write
  access, with no blanket bypass (D3).
- Native workers start without parent history, continue through the same agent,
  and external rescues resume the assigned session; no inert profile is shipped
  (D4).

## 2. Current State

Safety foundation is merged and reviewed. In the live Codex 0.144.1 project,
hooks are enabled by default and the repository is trusted, but no bee plugin
is installed. The only active Codex bee source is `.codex/hooks.json`; all nine
trusted project commands use `$CLAUDE_PROJECT_DIR`, which Codex project hooks do
not provide. The two Stop commands therefore resolve to `/.bee/...` and exit
`1` before a wrapper starts. Codex's official contract states that commands use
the session cwd, recommends git-root resolution, and skips changed definitions
until human review. The exact causal chain is recorded in
[diagnosis-codex-stop-hooks.md](reports/diagnosis-codex-stop-hooks.md).

## 3. Scope

**Current slice in scope**

- Deterministically render the source-repository `.codex/hooks.json` fallback
  from the shared Codex catalog (D1).
- Resolve each command from the git root to the current shared wrapper without
  any Claude project environment variable (D1, D2).
- Execute the actual configured commands from root and nested working
  directories, including valid JSON output for Stop advisories (D2).
- Keep changed-definition review visible as a Gate-4 human UAT step; never
  rewrite or bypass persisted hook trust (decision `d91a8398`).

**Out of scope**

- Custom Codex agent profiles (P25), fanout-delegation (P23), a Codex status
  display, new gate semantics, or new model/provider integration.
- Plugin installation/migration, global skill synchronization, source selector,
  legacy cleanup, E3 dispatch/skill work, and E4 documentation/release work.
  These stay with the remaining feature slices and receive no cell here.
- Native Windows `commandWindows` and non-POSIX login-shell transport; these
  remain with the broader cross-platform Distribution slice.
- Silent global install, persisted trust mutation/bypass, release, push, or
  host rollout. These retain separate human approval boundaries.

## 4. Proposed Approach

Keep the existing shared catalog and wrapper implementations. First add a
target-parameterized renderer and regenerate the active `.codex/hooks.json`
from its Codex repo target. Then add a separate process harness that parses and
executes those active commands. Repo commands resolve the git root and execute
`hooks/bee-*.mjs` with source identity `repo`; the existing plugin-target Codex
projection and Claude projection remain unchanged.

**Why this approach** — it fixes the route Codex actually executes, reuses the
already-reviewed shared adapter, and makes hand divergence of the active config
an executable test failure rather than another copied catalog.

**Alternatives considered**

- One union catalog — hides inert/wrong matchers and broadens hook firing.
- Forked Codex wrappers/plugin — duplicates logic and recreates version drift.
- Editing only `$CLAUDE_PROJECT_DIR` — reveals the stale vendored wrapper's
  invalid plain-text Stop output and leaves the active catalog hand-authored.
- Removing `.codex/hooks.json` now — leaves this project with zero bee hooks
  because no bee plugin is installed.
- Forking Codex wrappers — duplicates seven implementations and violates D1.

## 5. Technical Design

```text
Codex project event -> .codex/hooks.json (catalog-rendered repo transport)
                    -> git-root-resolved hooks/bee-*.mjs
                    -> hooks/adapter.mjs -> .bee/bin/lib helper
                    -> context / deny / JSON advisory
```

The catalog remains the single event/matcher/handler definition. Its existing
plugin-target renderer stays the default and continues to produce
`hooks/hooks.json`; `target: "repo"` changes command transport and source
identity only, then reproduces `.codex/hooks.json` byte-for-byte. Each generated
repo command resolves the git root from the session cwd, validates its launch
prerequisites, emits a stable visible fail-open diagnostic with exit `0` when
pre-wrapper setup is unavailable, and otherwise preserves wrapper exit `0` or
deliberate deny exit `2`.

Process tests parse the active file and run each command through
`${SHELL:-/bin/bash} -lc`, only inside an isolated temporary git fixture with
both Claude root variables removed. Root, nested, and spaces/Unicode path rows
prove quoting and cwd stability; a non-git cwd proves transport fail-open. Stop
rows force a warning so non-empty stdout must parse as a JSON `systemMessage`,
never `decision: "block"`. A configured PreToolUse row must deny a gated patch
with exit `2`. The same assertions run against the pinned pre-fix config to
prove RED sensitivity. The harness pins the live repository's bee state,
injection cache, and hook logs byte-for-byte so fixture execution cannot alter
orchestration state.

### Security / Permissions

- Editing `.codex/hooks.json` changes its trusted definition hash. Codex skips
  the changed definitions until the human reviews them through `/hooks`; the
  implementation never edits persisted trust state or bypasses hook trust.
- No plugin, user-level hook, global Codex/Claude configuration, or installed
  skill is changed in this slice.
- Concurrent `.bee/config.json`, dispatch-log, and `q3-cmdsubst` spike changes
  belong to another workstream and remain untouched; execution reserves only
  the three current-cell files and aborts on overlap.
- Hooks remain guardrails, not a security boundary. Native reads and incomplete
  unified shell paths that Codex cannot intercept remain governed by AGENTS,
  helper checks, and explicit user privacy approval.
- Dispatch artifacts carry bounded contracts and session IDs, never parent
  transcripts or provider secrets.

## 6. Affected Files

| Action | File / component | Purpose |
|---|---|---|
| Modify | `hooks/catalog.mjs` | Add deterministic Codex repo-target command transport while preserving both existing projections |
| Modify | `.codex/hooks.json` | Replace Claude-variable commands with the generated source-repo fallback |
| Modify | `hooks/test_hook_contracts.mjs` | Cell 6a adds repo-config drift proof; dependent cell 6b adds the isolated installed-route process harness |

## 7. Implementation Steps

- [x] **Safety foundation** — merged, reviewed, and accepted at Gate 4.
- [ ] **Render the active source-repo fallback** (`codex-parity-6a`) — add the
  target-parameterized renderer, checkpoint the drift row RED, regenerate the
  project config, and mechanically preserve both existing projections.
- [ ] **Prove the installed route** (`codex-parity-6b`, depends on 6a) — parse
  and execute all nine active command handlers in an isolated fixture, with a
  RED run against the pinned pre-fix config.
- [ ] **Remaining E2/E3/E4 work** — intentionally unprepared; no cells exist in
  this slice.

## 8. Validation Plan

**Automated** — cell 6a runs the catalog suite, checks the two existing
projection files with `git diff --exit-code`, and runs the repository baseline.
Cell 6b runs `--repo-route-only`, then the full hook suite and repository
baseline. The route rows parse all nine handlers from `.codex/hooks.json`, run
them with Claude root variables unset under the login-shell contract, require
valid non-blocking Stop JSON, preserve PreToolUse deny exit `2`, prove visible
no-root exit `0`, and keep live bee state/cache/logs byte-identical.

**Live / manual**

- Human reviews/trusts the changed project-hook definitions in `/hooks`, starts
  a fresh lifecycle event, and confirms the two Stop failures no longer appear.
- `/hooks` continues to show the project fallback as the only bee source.

**Evidence** — fresh validation is pending. The historical
[validation report](reports/validation-codex-repo-fallback.md) rejects the old
overloaded cell and now records the official-doc correction: cwd/git-root and
default-enable are established contracts, while human re-trust is Gate 4. The
before-state remains in
[diagnosis-codex-stop-hooks.md](reports/diagnosis-codex-stop-hooks.md).

## 9. Risks & Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| Active command still differs from tested command | High | Parse and execute commands from `.codex/hooks.json` itself; byte-render assertion |
| Stop hook loops or fails output parsing | High | Force non-empty Stop output; require JSON `systemMessage`; forbid `decision:block` |
| Transport fails before wrapper fail-open | High | Missing-root process row must emit a diagnostic and exit `0`; deny exit `2` remains intact |
| Regression tests mutate live workflow state | High | Execute only in a copied temp git fixture and assert live state/cache/log byte equality |
| Shared catalog change regresses plugin or Claude | High | Existing plugin-Codex and Claude projections must remain byte-identical |
| Future/concurrent plugin install creates duplicate bee sources | High | Parseable before/after source census; unknown or second bee source blocks with zero edits |
| Nested cwd or unavailable repo root breaks resolution | Medium | Root/nested and non-git-cwd process rows exercise the fail-open branch; a physically missing `git` executable is the same branch but remains a named unexercised environment case |
| Changed definitions stay skipped after merge | High | Gate-4 `/hooks` review plus a fresh lifecycle event; no automated trust mutation or bypass |
| Native Windows or a non-POSIX login shell uses incompatible syntax | Medium | Explicitly deferred to the Distribution cross-platform slice; do not claim coverage in this WSL/bash incident |

## 10. Rollback Plan

Revert `codex-parity-6b` first, then `codex-parity-6a`. The first revert removes
only the added process harness; the second restores the prior catalog and
project config together. Codex can require review of the restored definition as
well. No plugin/global configuration or application data changes, so rollback
has no external cleanup step. If fresh-event UAT fails, Gate 4 stays closed and
both commits are reverted in dependency order.

## 11. Open Questions

No product decision is open. Fresh validation must still prove that each cell
is cold-pickup executable, its verify command is exit-code honest, and the
configured transport can meet the declared setup-fail-open/deny-preservation
contract. Native Windows/PowerShell, non-POSIX login shells, a physically
missing `git` executable, and live firing after the new definition is trusted
remain explicit limitations or Gate-4 UAT, never inferred passes.
