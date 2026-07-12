# Codex Runtime Parity — Context

**Feature slug:** codex-runtime-parity
**Date:** 2026-07-11
**Exploring session:** complete
**Scope:** Deep
**Domain types:** CALL | RUN | READ | ORGANIZE

## Feature Boundary

Make Codex a first-class bee runtime: distribute the shared skills and compatible
lifecycle enforcement through a Codex plugin, keep one tested project-local fallback,
repair the current dispatch and executor contracts, and refresh Codex-facing project
guidance. The feature does not add custom Codex agent profiles, a Codex status display,
new gate semantics, or a new external model/provider.

## Locked Decisions

These are fixed. Planning must implement them exactly — cited, never reinterpreted.
Changing one requires the user, a new D-ID or an explicit supersession note, never
a silent edit.

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Codex distribution is plugin-first. The Codex plugin bundles the shared bee skills and compatible hooks; project-local Codex hook wiring remains a fallback/dogfood route. Exactly one hook source is active for one installation. | Codex loads matching hooks from every active source, so duplicate plugin and project wiring would run events twice. Durable decision: `4cc1c355`. |
| D2 | Codex receives full hook parity on every compatible event and tool path: session bootstrap, prompt reminder, write/privacy/reservation guard, state sync, subagent-chain nudge, and session-close hygiene. Shared helpers remain the final enforcement belt; unsupported paths fail open with visible limits and runtime-specific tests. | The goal is Claude-like understanding and enforcement without pretending hooks are a complete security boundary. Durable decision: `b7af1bf9`. |
| D3 | Nested Codex executors and reviewers default to an explicit workspace-write sandbox with normal approvals. Bee never uses `--yolo` or another blanket approval-and-sandbox bypass; broader access requires a separate human approval for the named command. | The current preset grants machine-wide bypass and only mentions `workspace-write` as prompt text. Durable decision: `73ed41d6`. |
| D4 | This feature updates the shared dispatch contract and skill references to the current Codex collaboration interface, including explicit clean-context spawning and continuation. It does not ship custom Codex agent profiles until swarming can select and verify them. | Unselectable profiles would be inert, drifting configuration. Durable decision: `d7d5f459`; future profiles are P25. |

### Agent's Discretion

- Choose the smallest adapter/file structure that keeps one canonical hook behavior
  while satisfying the distinct Claude Code and Codex payload/output contracts.
- Choose the migration mechanics, subject to these constraints: report changes before
  applying them; never silently delete user/global configuration; never activate two
  hook sources; preserve the existing downgrade, symlink, overlap, and idempotency
  protections.
- Organize tests and release artifacts, but every edited `SKILL.md` must follow
  `bee-writing-skills`: recorded failing pressure scenarios before skill content is
  changed, then the same scenarios passing with the change.

## Specific Ideas And References

- Owner request: “review lại các skill và config agents, hooks thêm vào những gì giúp
  codex hiểu nhất giống bên claude code”. The intended outcome is behavioral parity,
  not merely updated prose.
- The four option answers were each the explicit reply `a`; D1–D4 preserve the exact
  outcome selected in the preceding question.

## Existing Code Context

From the bounded intake audit. Downstream agents read these before planning.

### Reusable Assets

- `skills/bee-hive/scripts/onboard_bee.mjs` — report-before-apply onboarding,
  idempotent vendoring, installed-skill mirror, downgrade/symlink/overlap fences.
- `skills/bee-hive/scripts/test_onboard_bee.mjs` — sandboxed onboarding and deep-mirror
  contract suite.
- `hooks/*.mjs` — thin fail-open wrappers over the host project's vendored shared
  libraries.
- `hooks/hooks.json` — current plugin hook event catalog.
- `skills/bee-hive/templates/AGENTS.block.md` — repo-native fallback contract loaded by
  Codex even when a plugin or hook is unavailable.

### Established Patterns

- Canonical source → planned copies → explicit apply → byte/hash parity → immediate
  up-to-date recheck.
- Enforcement lives in shared helpers first; lifecycle hooks are a second mechanical
  belt, never the only correctness boundary.
- A destructive or global migration is previewed and human-approved; an unknown or
  downgrade state refuses without mutation.
- Plugin and vendored/runtime copies are versioned together in every tagged release.

### Integration Points

- `.codex-plugin/plugin.json` — stale Codex distribution manifest; currently skills
  only.
- `.codex/hooks.json` — project fallback present but not managed by onboarding and
  currently resolves through a Claude-only project variable.
- `.claude-plugin/plugin.json`, `.claude/settings.json`, `hooks/hooks.json` — current
  Claude distribution and fallback surfaces that Codex parity must not regress.
- `skills/bee-swarming/references/swarming-reference.md` and the fresh-eyes/reviewer
  call sites — current Codex dispatch prose uses an obsolete call shape.
- `.bee/config.json` model/reviewer executor presets — current Codex commands use a
  blanket bypass and do not set the intended sandbox flag.
- `README.md`, `INSTALL.md`, `docs/06-runtime-integration.md`, `docs/07-contracts.md`,
  and the managed AGENTS block — active guidance still says Codex has no hooks or
  otherwise describes the old runtime belt.

## Canonical References

- `docs/history/codex-runtime-parity/reports/intake-audit.md` — evidence and prioritized
  gaps captured before planning.
- `docs/specs/onboarding.md` — state-layer rules R5–R8, all marked not implemented
  under P24.
- `docs/06-runtime-integration.md` — current runtime model; must be reconciled with
  Codex hook support.
- `docs/07-contracts.md` — helper, onboarding, and hook contracts.
- `https://learn.chatgpt.com/docs/hooks` — current Codex lifecycle events, payloads,
  outputs, trust behavior, and limitations.
- `https://learn.chatgpt.com/docs/build-plugins` — Codex plugin manifest, bundled
  skills/hooks, and plugin-root compatibility variables.
- `https://learn.chatgpt.com/docs/agent-configuration/agents-md` — durable project
  instruction discovery and precedence.
- `https://learn.chatgpt.com/docs/agent-configuration/subagents` — current Codex
  collaboration and custom-agent surfaces.

## Outstanding Questions

### Deferred To Planning

- Build the exact Claude↔Codex event, matcher, input, output, and blocking matrix from
  the current runtime contracts; prove every mapped path with fixtures or a live-fire
  check.
- Determine the smallest one-source hook catalog/rendering scheme that supports both
  plugin and project-fallback commands without duplicate activation.
- Shape the plugin-first migration from stale manually copied Codex skills and hooks
  without silent deletion or downgrade; define how plan mode exposes every global and
  project mutation.
- Decide which skill edits are required after RED pressure scenarios expose actual
  Codex failures; do not pre-author skill prose from the audit alone.
- Extend release validation so the shared bee version and both plugin manifests cannot
  drift, then include the standing tagged-release and host-onboarding sequence.
- Reconcile the exploring handoff contract with the actual state enum: the current
  skill names `exploring-complete`, while the state CLI rejects that value. Preserve
  CLI-owned state and add a RED-first contract test before changing skill prose or
  phase semantics.
- Define the live Codex trust/restart/UAT procedure; hook trust remains a human action.

## Deferred Ideas

- P25 — generated `bee-explorer`, `bee-worker`, and `bee-reviewer` Codex profiles once
  swarming can select and verify a named role. Profiles are not shipped inertly in P24.

## Handoff Note

CONTEXT.md is the source of truth. Decision IDs are stable. Planning reads locked
decisions, code context, canonical references, and deferred-to-planning questions.
Validating and reviewing use locked decisions for coverage and UAT.
