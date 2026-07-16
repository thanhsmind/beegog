# Codex Hook And State Parity — Context

**Feature slug:** codex-hook-state-parity
**Date:** 2026-07-16
**Exploring session:** complete
**Scope:** Deep
**Domain types:** RUN | ORGANIZE

## Feature Boundary

Make Codex enforce the same bee lifecycle policy as Claude through the strongest runtime-specific mechanical adapter available, and prevent an independent review session from overwriting an active feature's routing state; this slice does not add native Codex capabilities that the current hook API does not expose.

## Locked Decisions

These are fixed. Planning must implement them exactly — cited, never reinterpreted.
Changing one requires the user, a new D-ID or an explicit supersession note, never
a silent edit.

| ID | Decision | Rationale (only if it changes implementation) |
|----|----------|-----------------------------------------------|
| D1 | Claude and Codex derive lifecycle enforcement from one semantic hook policy. Runtime projections may differ only where a documented platform capability differs, and every difference is explicit and tested. | “Same template” means one policy source, not byte-identical inert hook files. |
| D2 | Codex receives every mechanically effective hook adapter available today. One shared native-subagent handler is projected onto both mandatory events: `SubagentStart` bootstraps and audits after start, while `SubagentStop` closes the audit. Neither event is described as pre-spawn blocking. Codex `PreToolUse` enforcement is limited to the tool paths the runtime actually presents to it; current native collaboration and incompletely surfaced `unified_exec`/shell paths remain explicit, tested capability gaps rather than claimed coverage. | Avoids both a silent enforcement gap and a false security claim. |
| D3 | On the repo-hook fallback/dogfood path, Codex-only installation wires repo hooks exactly as `both` does, and install/onboarding tests cover `claude`, `codex`, and `both` independently. Plugin-first installation remains canonical and an installation activates exactly one hook source, never plugin plus repo hooks together. | Fixes the current `--runtime codex` omission without violating the exactly-one-source contract. |
| D4 | The current valid `phase` is the active routing owner; no owner field is persisted. Every generic `state set` mutation of `phase`, `mode`, `feature`, `summary`, or `next_action` requires an explicit `--owner` equal to the **pre-mutation** phase of the selected default state or lane. A successful phase change makes the new phase the owner of the next mutation. Gate approval remains outside generic routing and is writable only through the dedicated `state gate` command and its existing approval/bypass rules. An out-of-band independent review owns no active pipeline state and must never call generic `state set` on it. | Covers every generic routing field, makes authority checkable, and avoids a state-schema migration. |
| D5 | Review decisions may block review approval or merge only. They may inform plan repair, but only validating's own checks and baseline evidence decide execution readiness. | Gate 4 and Gate 3 remain independent. |
| D6 | Existing state files and zero-lane repositories remain backward compatible because ownership is derived from their existing valid `phase`; there is no owner migration or ownerless-record special case. The same pre-mutation check applies to default state and per-feature lanes. A missing/invalid phase is corrupt under the existing strict reader, while a missing or mismatched `--owner` on a protected mutation fails closed before write. | Prevents the repair from breaking existing hosts or lane isolation. |
| D7 | The one-time operational recovery of the default `.bee/state.json` record is separate from feature implementation and is already applied: `feature=worktree-isolation`, `phase=validating`, `execution=false`, with routing limited to the configured full baseline plus the named final cold-pickup proof and no independent delta-review dependency. No implementation cell may manufacture or relax either proof. | Repairs the concrete corrupted state without turning recovery metadata into a code deliverable. |
| D8 | Tests must exercise canonical policy plus generated Claude/Codex projections. A green canonical-only census is insufficient. | Prevents same-version projection drift from reading green. |
| D9 | Plugin-capable installation treats the plugin package as the runtime distribution source: canonical `skills/**` is exposed by the plugin skills entry and Codex loads the catalog-derived `hooks/hooks.json` from the plugin root. Project-root `.agents/**` and `.codex/hooks.json` are development/repo-fallback projections, not release outputs that plugin reinstall must overwrite. | Release + reinstall updates the package Codex actually loads instead of trying to mutate protected source-checkout projections. |
| D10 | The installer exposes plugin-first and explicit repo-copy fallback modes. Plugin-first cleanup is permitted only after the installed package is reported enabled **and** its installed skills/hooks content matches the release inventory; command exit success alone is insufficient. A failed proof leaves every fallback untouched. | Prevents a nominally successful install from deleting the only proven working source. |
| D11 | A proven plugin-first migration removes duplicate bee skills **and** installer-managed bee hook entries from the target repository. Skill cleanup is fenced to plain directories named `bee-*` inside `.claude/skills`, `.agents/skills`, and `.codex/skills`; hook cleanup removes only catalog-recognized bee commands from `.claude/settings.json` and `.codex/hooks.json`, preserving all user entries and deleting no container file that still has user content. Symlinks, aliases, files, unknown targets, and paths outside these roots make the cleanup refuse before any mutation. | Enforces D3's exactly-one-source rule for both skills and hooks without deleting runtime configuration owned by the user. |
| D12 | The reverse transition is symmetric: repo-copy fallback first disables/uninstalls the bee plugin and verifies it inactive, then vendors managed project skills/hooks. If plugin deactivation cannot be proven, fallback refuses with zero project mutation. Plugin-first never creates repo copies; fallback never leaves the plugin active. | Makes exactly-one-source ownership true in both directions, not only during migration to plugins. |
| D13 | Release verification inventories canonical plugin skills, the Codex/Claude hook projections, plugin manifests, and installer migration behavior. A local update uses one cachebuster and reinstall; installed-package hashes/status gate cleanup, while a fresh thread is the post-install runtime acceptance proof. Checked-in root projections may be tested as fallbacks but cannot stand in for package proof. | Makes “fix → release → install again → updated runtime” mechanically observable and separates destructive preconditions from fresh-session UAT. |
| D14 | User-runtime cleanup requires an installer ownership ledger naming the exact managed root and bee directories; basename matching alone never authorizes deletion outside the target repository. Missing, corrupt, mismatched, or symlinked ownership metadata fails closed with zero cleanup. | Prevents one project's installer from deleting a manually maintained or foreign global bee copy. |

### Agent's Discretion

The Codex audit payload format is delegated to implementation, provided it is backward compatible, fail closed where the runtime offers a blocking surface, and keeps D1–D8 observable in tests.

## Terms

| Term | Meaning in this feature |
|------|-------------------------|
| Semantic hook policy | One runtime-neutral declaration of the lifecycle rule, compiled into supported Claude and Codex hook events. |
| Active routing owner | The selected record's valid pre-mutation `phase`, which must be supplied explicitly to change any generic routing field on a default state or lane. |
| Independent review | An out-of-band immutable review session whose records never become active feature state. |
| Plugin-first | The runtime loads bee skills and hooks from the installed plugin package; no project skill copy is required. |
| Repo-copy fallback | Explicit non-plugin distribution that vendors managed skills/hooks into a target repository. |
| Legacy skill copy | A plain `bee-*` directory in a runtime skill root that duplicates plugin-delivered content. |

## Specific Ideas And References

- The owner requires Claude and Codex to share one policy model even when raw event adapters differ.
- Official Codex Hooks documentation: `PreToolUse` can cover surfaced simple shell, `apply_patch`, and MCP calls, but current `unified_exec` interception is incomplete; `SubagentStart` runs after start and cannot block native spawn.

## Existing Code Context

### Reusable Assets

- `hooks/catalog.mjs` — already renders runtime projections from a shared catalog and records allowed differences.
- `.bee/bin/lib/state.mjs` and its template mirror — existing strict state/lane readers and phase-transition guards.
- `.bee/bin/lib/reviews.mjs` — review store already writes session files without mutating active state.
- `hooks/bee-prompt-context.mjs` and `.bee/bin/lib/inject.mjs` — expose why an incorrect `next_action` becomes a repeated Codex instruction.

### Established Patterns

- Default state and lane behavior are tested for zero-lane byte parity.
- Runtime mirrors must remain byte-identical through `test_lib_mirror.mjs`.
- Hook differences are catalogued and contract-tested instead of hand-maintained in projections.
- A state name or transition that asserts history must have a mechanical guard.

### Integration Points

- `scripts/install.sh` — runtime-specific installer flag routing.
- `hooks/catalog.mjs` — semantic hook declarations and projections.
- `.bee/bin/bee.mjs` — state mutation CLI and owner enforcement.
- `skills/bee-reviewing/SKILL.md` — independent-review state immutability contract.
- `skills/bee-validating/SKILL.md` — sole owner of execution-readiness decisions.

## Canonical References

- `AGENTS.md` — bee workflow law and independent-review boundary.
- `docs/specs/onboarding.md` — runtime installation and projection contract.
- `docs/specs/workflow-state.md` — active state and lane behavior.
- `docs/history/review-on-demand/SPEC.md` — review is user-invoked and not an execution prerequisite.
- `https://learn.chatgpt.com/docs/hooks` — current Codex hook events and limitations.
- `https://learn.chatgpt.com/docs/build-plugins` — plugin structure and package-loaded
  skills/hooks contract.

## One-Time Recovery Proof (D7)

The recovered record is the default `.bee/state.json`, not the
`codex-hook-state-parity` lane. Its required post-state is:

- `feature=worktree-isolation`
- `phase=validating`
- `approved_gates.execution=false`
- `summary`: validation is pending only on the exact full baseline and final
  cold-pickup proof; independent review remains separate and does not gate execution
- `next_action`: run those two proofs in a child-process-capable environment and
  approve `worktree-isolation-1` only if both are green

The authoritative baseline is `.bee/config.json` `commands.verify`, currently:

```sh
node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/scripts/test_onboard_bee.mjs && node scripts/test_portable_paths.mjs && node hooks/test_model_guard.mjs && node hooks/test_write_guard.mjs && node hooks/test_hook_contracts.mjs && node skills/bee-hive/templates/tests/test_bee_cli.mjs && node scripts/test_verify_manifest.mjs && node scripts/test_release_tuple.mjs && node scripts/test_lib_mirror.mjs && node skills/bee-hive/scripts/test_split_brain_regression.mjs && node scripts/release_manifest.mjs --selftest && node scripts/release_manifest.mjs --check && node scripts/test_gate_bypass_doctrine.mjs
```

The final cold-pickup proof is the fresh-eyes cell review defined by
`skills/bee-validating/references/validation-reference.md`: inspect the clean schedule,
then give a fresh generation-tier agent only `worktree-isolation`'s `CONTEXT.md`,
`plan.md`, and cell records 1–4. It passes only when all four cells appear in the
`CELL REVIEW REPORT` and `0 CRITICAL` remain open. The exact reviewer prompt and report
schema are lines 87–112 of that reference; the runnable inputs are `bee cells schedule
--feature worktree-isolation --json` and `bee cells show --id worktree-isolation-N
--json` for N=1..4.

## Outstanding Questions

None. The owner representation, compatibility rule, Codex subagent event topology,
plugin distribution boundary, two-way source arbitration, and safe cleanup fence are locked above; planning may
choose only implementation details that preserve them.

## Deferred Ideas

- True Codex pre-spawn denial for native collaboration — requires a future Codex hook input that exposes native dispatch before execution, or a bee-owned dispatch boundary that can actually invoke native agents.

## Handoff Note

CONTEXT.md is the source of truth. Decision IDs are stable. Planning reads locked
decisions, code context, canonical references, and deferred-to-planning questions.
Validating uses its own proof surface; independent reviewing never owns active routing.
