# Codex Runtime Parity — Intake Audit

**Date:** 2026-07-11
**Mode:** read-only intake audit
**Local runtime:** Codex CLI 0.144.1; `hooks` reports stable/enabled
**Baseline:** 156 library checks passed; onboarding suite passed with 0 failures
and 1 filesystem-dependent skip when run outside the process-spawn sandbox.

## Bottom Line

Bee already contains a Codex manifest and project hook file, but the active Codex
distribution is not first-class. The installed skills and manifest are four releases
behind, the committed project hook commands resolve through an unset Claude-only
variable, runtime docs still claim Codex has no hooks, the dispatch reference names an
obsolete collaboration API, and the nested Codex presets bypass both approvals and
sandboxing. The shared helpers remain green, so the safe route is to repair the runtime
belt without weakening helper enforcement.

## Findings

| Severity | Finding | Concrete evidence | Required outcome |
|----------|---------|-------------------|------------------|
| P1 | Codex project hooks are effectively inert. | `.codex/hooks.json` invokes every wrapper through `$CLAUDE_PROJECT_DIR`; it is unset in the active Codex environment, so the path resolves outside the repo before the wrapper can fail open. The file is not managed or checked by onboarding. | Plugin-first hooks plus one tested repo fallback whose command resolves the actual project root; never activate both. |
| P1 | Codex skill/plugin versions drift independently. | Source, vendored helpers, Claude manifest, and Claude-installed hive are 0.1.22. `.codex-plugin/plugin.json` and the installed Codex hive are 0.1.18; the Codex install lacks `bee-evolving`. Repo-local onboarding reports up to date because it synchronizes only the Claude skills target. | Both runtime distributions and manifests participate in one version/parity contract with the same downgrade fences. |
| P1 | Nested Codex commands bypass the intended security boundary. | `.bee/config.json` contains `codex exec ... --yolo ... workspace-write`; `--yolo` disables approval/sandbox protection and `workspace-write` is positional prompt text rather than the sandbox option. | Explicit workspace-write sandbox, normal approvals, no blanket bypass. |
| P1 | Codex hook compatibility is unproved for the paths bee depends on. | Current write guard recognizes Claude tool names and does not establish an `apply_patch` target contract. Current close/chain wrappers print plain text, while Codex documents event-specific JSON requirements for `Stop`, `SubagentStop`, and ignored plain text on `PreCompact`. | A runtime matrix plus fixtures/live-fire proof for every event, matcher, input, output, block, and fail-open path. |
| P2 | Codex dispatch guidance is obsolete and can leak parent history. | `bee-swarming/references/swarming-reference.md` documents `agent_type`/`fork_context`; the active collaboration surface uses `task_name`, `message`, `fork_turns`, `followup_task`, and explicit wait/interrupt controls. The default forks context. | Current call shape, explicit clean-context behavior, continuation, tending, and no inert custom profiles. |
| P2 | Durable Codex guidance contradicts runtime reality. | README, INSTALL, runtime-integration docs, and the AGENTS block say Codex has no hooks or must honor all guards manually. `AGENTS.md` still has the onboarding placeholder `[unknown]` as its project description. | Small, current AGENTS guidance and docs that describe plugin hooks, fallback hooks, helper limits, trust, and actual project purpose. |
| P2 | Some installed-skill references escape the skill package. | Skill references point at repo-level contracts/model presets that are absent in arbitrary host repositories. | Pressure-test and then make each required runtime contract reachable from the installed skill package or a guaranteed host artifact. |
| P2 | The exploring handoff names an invalid phase. | `bee-exploring` requires `exploring-complete`, but `bee_state.mjs set` rejects it because it is outside the known-phase enum. The same check exposed stale approved gates inherited from the previous feature; they were reset through the CLI before Gate 1. | Align the skill/state contract RED-first and prove a new feature cannot inherit prior approvals. |

## Current Official Runtime Facts Used

- Codex loads hooks from user/project config layers and enabled plugins; all matching
  sources run, so duplicate definitions are additive rather than overriding.
- Project hooks require a trusted project layer; non-managed plugin hooks require the
  user to review and trust their definition.
- Codex supports `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`,
  `PreCompact`, `PostCompact`, `SubagentStart`, `SubagentStop`, and `Stop`, with
  event-specific output behavior.
- `PreToolUse` can observe Bash, `apply_patch`, and MCP paths, but hooks are documented
  as guardrails rather than a complete enforcement boundary.
- Codex plugins can bundle `skills/` and `hooks/hooks.json`; installed plugin hooks get
  `PLUGIN_ROOT` and compatibility aliases including `CLAUDE_PLUGIN_ROOT`.
- Codex discovers durable project guidance through the `AGENTS.md` chain; repo skills
  live under `.agents/skills`, and custom agent profiles live under `.codex/agents`.

Sources: [Codex hooks](https://learn.chatgpt.com/docs/hooks),
[advanced configuration](https://learn.chatgpt.com/docs/config-file/config-advanced),
[plugin structure](https://learn.chatgpt.com/docs/build-plugins),
[AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md), and
[subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents).

## Constraints Carried Forward

- No source implementation before Gate 3.
- Any `SKILL.md` edit obeys `bee-writing-skills`: checkpoint RED pressure evidence
  before editing, then rerun identical scenarios for GREEN.
- Helper-level enforcement remains authoritative even after full compatible hooks land.
- Existing dirty work (`fanout-delegation`, state counts, backlog changes) is preserved
  and not absorbed into this feature.
- Global skill/plugin cleanup is never silent or destructive; plan mode must show it and
  the human approves it separately.
