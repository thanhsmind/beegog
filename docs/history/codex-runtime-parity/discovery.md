# Discovery: Codex Runtime Parity

**Level:** L3 (deep, version-sensitive, security-adjacent)
**Date:** 2026-07-11

## Bottom Line

Bee does not need a second implementation for Codex. It needs a Codex-correct
runtime shell around the business logic it already has: separate Claude and
Codex hook projections, shared wrapper/helper behavior, plugin-first
distribution, and an updated dispatch contract. The existing repository root
is already a Codex-discoverable plugin marketplace; the missing work is version
parity, safe migration, event-specific input/output adaptation, and proof.

## Stack Ledger

- **Local** — mixed plugin/CLI/automation repository; Node.js 24.14.1 is
  installed and the project requires Node.js 18+ with zero npm dependencies.
- **Local** — Codex CLI 0.144.1 reports `hooks`, `plugins`, `multi_agent`, and
  `unified_exec` as stable.
- **Local** — the standing verification surface is
  `node skills/bee-hive/templates/tests/test_lib.mjs && node
  skills/bee-hive/scripts/test_onboard_bee.mjs`; the session baseline was 156
  library checks passed plus onboarding PASS with zero failures.
- **Local** — source, host helpers, Claude manifest, and installed Claude skills
  are 0.1.22; the Codex manifest and installed Codex skills are 0.1.18.

## What Already Exists And Is Reusable

- **Local** — `lib/inject.mjs` already builds the session preamble and prompt
  reminder; `lib/guards.mjs` already owns gate, privacy, scout, reservation,
  and shell-write decisions.
- **Local** — the seven lifecycle wrappers already find the host repository,
  load vendored helpers, respect per-hook toggles, and crash-log best effort.
- **Local** — onboarding already implements report-before-apply, atomic writes,
  backups, idempotency, downgrade refusal, symlink/case-alias detection, and
  source/target overlap fences for its hardened mirror.
- **Local** — the legacy `.claude-plugin/marketplace.json` points at the shared
  repository root, which contains both runtime manifests and the common skills
  tree.
- **Local** — process-fixture patterns in `hooks/test_model_guard.mjs` and
  `hooks/test_write_guard.mjs`, plus onboarding's structural catalog-parity
  tests, are reusable for a complete Codex matrix.

## Proved Gaps

- **Local** — `.codex/hooks.json` resolves every command through the unset
  Claude-only `$CLAUDE_PROJECT_DIR`, is unmanaged, and omits model-guard.
- **Local** — a planning-phase Codex `apply_patch` payload targeting a source
  file exits 0 because the wrapper ignores canonical `tool_name: "apply_patch"`
  and `tool_input.command`.
- **Local** — six of seven wrappers exit 1 for top-level `null` or an object
  `cwd`; only model-guard implements the promised malformed-input fail-open
  boundary.
- **Local** — chain-nudge reads `name|agent|worker`, while the state CLI stores
  `nickname`, so registered-worker matching is broken outside the generic
  swarming fallback.
- **Local** — current Codex reviewer commands use the blanket bypass alias and
  pass `workspace-write` as prompt text. CLI parsing proves the safe ordering is
  `codex --ask-for-approval on-request exec --sandbox workspace-write ...`.
- **Local/runtime** — native collaboration uses
  `spawn_agent({task_name,message,fork_turns:"none"})`; continuation uses
  `followup_task`. `task_name` is an identifier, not a profile selector, and
  `send_message` does not trigger an idle agent.
- **Local** — `resume --last` selects the newest Codex session. In a parallel
  wave that can resume the wrong worker; rescue must capture and use the launch's
  exact session UUID.
- **Local** — `bee-exploring` and `bee-planning` name
  `exploring-complete`, `planning-complete`, and `validated`, but the closed
  state enum rejects all three; starting this feature also exposed inherited
  approvals from the preceding feature.

## Current Codex Contracts

- **Docs** — Codex loads all matching user, project, and plugin hook sources;
  higher-precedence layers do not replace lower ones, and matching commands may
  launch concurrently. One installation therefore needs one active bee source.
- **Docs** — project hooks require a trusted project; non-managed plugin hooks
  require review/trust of the current hook hash.
- **Docs** — `SessionStart` and `UserPromptSubmit` accept plain stdout as
  developer context. `PreToolUse` can block supported Bash, `apply_patch`, and
  MCP calls with exit 2. `PreCompact` ignores plain stdout, while
  `SubagentStop` and `Stop` require JSON when stdout is non-empty.
- **Docs** — `decision: "block"` on `SubagentStop` continues the child and on
  `Stop` continues the main turn; neither is an advisory parent notification.
  Non-blocking bee nudges therefore belong in JSON `systemMessage` output.
- **Docs** — plugin hooks can use the default `hooks/hooks.json`; Codex provides
  `PLUGIN_ROOT` and the compatibility alias `CLAUDE_PLUGIN_ROOT`.
- **Docs** — Codex accepts the repository's existing
  `.claude-plugin/marketplace.json` as a legacy-compatible marketplace.
- **Docs** — hooks do not intercept every equivalent path, including incomplete
  unified shell interception and ordinary non-shell reads. Hooks remain a
  guardrail; helpers and durable AGENTS instructions remain the final belt.

Official references: [hooks](https://learn.chatgpt.com/docs/hooks),
[plugins](https://learn.chatgpt.com/docs/build-plugins),
[advanced configuration](https://learn.chatgpt.com/docs/config-file/config-advanced),
[AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md), and
[subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents).

## Candidate Approaches

| Candidate | Evidence | Trade-off | Verdict |
|---|---|---|---|
| One union hook catalog with runtime-aware wrappers | **Inference** — lowest file count | Inert matchers, overly broad state-sync triggers, and permissive parity tests hide runtime differences | Reject |
| One logical catalog rendered to Claude and Codex projections; shared wrappers/helpers | **Local + Docs + Inference** — reuses current logic while encoding exact host contracts | Adds a small renderer/adapter and generated-artifact checks | **Choose** |
| Fork Codex-only wrappers and marketplace/plugin tree | **Inference** — locally simple | Duplicates seven wrappers and recreates the version drift already observed | Reject |
| Keep project hooks primary and use the plugin for skills only | **Docs + Inference** | Contradicts D1, requires every project to carry/trust updates, and duplicates when the plugin is enabled | Reject |

## Recommendation Ladder

1. **Reuse** the current marketplace, plugin root, skills, wrappers, helpers,
   mirror fences, and fixture patterns.
2. Use Codex's **built-in** plugin hooks, hook trust, event schemas,
   `apply_patch` interception, sandbox, and session-id resume.
3. **Adapt** catalogs, payload normalization, output encoding, root resolution,
   installer migration, and collaboration call shapes.
4. **Build** only the missing patch-target parser, logical catalog renderer,
   source-arbitration/exclusivity audit, guarded state-transition start
   operation, and tests.

This path beats a separate Codex implementation because every behavior remains
owned once, while every runtime difference is explicit and testable. Evidence
that Codex cannot load the legacy marketplace/default hook path, or that its
live payload cannot support a required guard, would send the affected item back
to validating rather than silently widening the implementation.

## Proof Obligations For Validating

- Isolated `CODEX_HOME` install from the existing marketplace, manifest
  validation, exact version, skill discovery, reinstall idempotency, and one
  active hook source.
- Full wrapper malformed-input table and Codex event output parsing.
- `apply_patch` Add/Update/Delete/Move, multi-target, Unicode/space, escape,
  malformed, gate, and reservation rows. Once Codex has intercepted a patch,
  an unprovable target denies; only malformed outer hook payloads fail open.
- Actual child-hook payload capture to determine whether reservation ownership
  can be correlated; if not, record the path as a visible helper-enforced gap.
- RED pressure scenarios for every skill/reference edit, checkpointed before
  GREEN edits, with exact agent rationalizations.
- Two parallel Codex sessions whose captured UUIDs are resumed independently.
- Workspace write versus out-of-workspace approval/denial proof with normal
  approval policy and no blanket bypass.
- Linux plus Windows/path review, Claude catalog regression, full project
  verification, and new-thread plugin/fallback UAT run separately.
