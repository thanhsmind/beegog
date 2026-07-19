# CONTEXT — codex-native-transport

Feature: native Multi-Agent V2 model-override transport for codex-runtime dispatches.
Mode: high-risk (external provider + guard/security surface + covered behavior + multi-domain).
Origin: user-directed design (2026-07-19 session), verified against upstream openai/codex
issues #32031/#20077/#31814 and the Cjbuilds/Codex-Orchestration plugin
(`configure_native_routing.py`).

## Problem

The codex runtime's only way to run a *different, stronger model* for advisor/review today
is the external CLI route (`{kind:'cli', command:'codex exec ...'}`). A separate process per
call is slow and fragile: new session/lifecycle, stdin/result-file protocol, cwd/auth/sandbox
re-init, exit-code-vs-task-failure ambiguity. Meanwhile codex Multi-Agent V2's `spawn_agent`
natively accepts `model`, `reasoning_effort`, `agent_type`, `service_tier`, `fork_turns` —
hidden from the visible tool schema by default (`hide_spawn_agent_metadata = true`) but real,
catalog-validated, and refused loudly when invalid. Bee's dispatch layer currently assumes
"spawn_agent has no per-agent model field at all" (`.bee/bin/lib/dispatch-prepare.mjs:202-205`)
— stale for V2-metadata clients.

## Verified constraints (evidence, not assumption)

- E1: `spawn_agent` V2 args parse+apply `model`/`reasoning_effort` even when hidden from the
  schema (openai/codex issue #32031). Hiding is discoverability, not capability.
- E2: full-history fork (default `fork_turns` when omitted) **rejects** overrides; overrides
  require `fork_turns:"none"` (issue #20077). So `fork_turns:"none"` is a *validity
  precondition*, not just context hygiene.
- E3: on the currently installed codex-cli 0.144.4: `multi_agent` = stable/true,
  `multi_agent_v2` = **under development / false**. The native-override surface is
  version- and config-dependent; nothing may be assumed from version strings alone.
- E4: namespace matters — Codex-Orchestration found the default namespace rejects extended
  metadata while the `agents`/configured `tool_namespace` accepts it. "Has spawn_agent" is
  not sufficient evidence.
- E5: custom agent types do not spawn on 0.144.4 (doctor evidence: only built-in
  default/explorer/worker). Custom-agent transport is therefore a later phase.
- E6: catalog validation is codex-side: wrong model id / unsupported effort → explicit
  refusal, never a silent fallback. Bee must surface that refusal, not mask it.

## Locked decisions

- **D1 — Transport priority (codex runtime):** (1) native V2 model override →
  (2) native custom agent with pinned model (deferred phase, see E5) →
  (3) external CLI, **explicit-only fallback**. CLI stops being a primary route. A native
  route that is requested but unavailable/refused reports its reason and falls back to CLI
  **only** when config explicitly permits it (`fallback_policy: "explicit-only"`); silent
  native→CLI switching is forbidden.
- **D2 — Config shape:** `models.codex.<slot>` (all slots incl. `advisor`) gains
  `{kind:'native', model, effort?, fork_turns?:'none', agent_type?}` and the composite
  `{primary:{kind:'native',...}, fallback:{kind:'cli',command}, fallback_policy:'explicit-only'}`.
  Existing shapes (string / `{model,effort}` / `{kind:'cli'}` / null) keep their exact
  current semantics — zero regression for existing configs. Model ids are exact catalog ids;
  bee never hard-codes display names.
- **D3 — Capability probe is schema/behavior-evidence, not version inference:** probe
  classifies the client as `native_model_override | native_budget_only | external_cli_only`,
  from observed evidence (feature-flag state via `codex features list`, plus an accepted
  override spawn in the g22-6 canary harness under isolated CODEX_HOME). Verdict is
  version+config-scoped and stored through the existing attest machinery (g22-3 pattern).
  Unprobed/unknown ⇒ `native_budget_only` (today's behavior) — the feature is inert until
  proven on the host's actual build.
- **D4 — Bee never flips codex feature flags silently.** Enabling
  `features.multi_agent_v2` / `hide_spawn_agent_metadata=false` on the user's real
  CODEX_HOME is a user-approved step (doctor names it as the unlock); the canary probe may
  enable them only inside its isolated per-run CODEX_HOME (R7, g22-6).
- **D5 — Marker contract unchanged:** the anchored `[bee-tier: …]` first-line marker stays
  the guard anchor (decision 0023 lineage). Role identity travels in `task_name` and the
  prepare-rendered prompt header, not by replacing the tier marker. (User's proposed
  `[bee-role:]` line may be *added after* the tier marker; the guard regex anchor does not
  move.)
- **D6 — Guard route-check:** `evaluateCodexSpawn` extends: when a spawn carries override
  fields, they must match the configured route for that purpose (model == configured,
  effort == configured, fork_turns == 'none'); mismatch ⇒ deny with a named reason.
  Spawns without override fields keep today's exact behavior (marker check only).
- **D7 — Honest confirmation vocabulary:** dispatch economics keeps
  `effective_model_status`; native-override adds `requested-accepted` (tool accepted the
  call — catalog+effort validated by codex) as distinct from `used-and-confirmed` (only if
  the runtime ever exposes effective metadata). `effective_model` stays null unless runtime-
  confirmed; a child's self-report ("I am Sol") is never evidence.
- **D8 — Slot rollout:** advisor and review are the first native-override consumers (the
  current CLI pain point); prepare supports all four kinds symmetrically. The gh22 rule
  "cli stays gather-only" is untouched — this feature narrows CLI usage, never widens it.
- **D9 — Default codex strategy once proven:** root + execution workers on the session
  model (budget-only), advisor/review on the configured stronger model via native override,
  `codex exec` disabled by default (explicit fallback config only).

## Out of scope

- Custom-agent (`bee_advisor` role file) transport — follow-up feature after E5 clears on a
  newer codex build.
- Cross-provider external models (Codex-Orchestration's external CLI providers).
- Any change to claude-runtime dispatch paths.
- Auto-upgrading or writing the user's real codex config (see D4).

## Success criteria

1. On a client where the probe confirms `native_model_override`, `bee dispatch prepare
   --runtime codex --kind advisor` emits a `spawn_agent` payload carrying
   `model/reasoning_effort/fork_turns:'none'` + anchored tier marker; guard accepts it and
   the dispatch record shows `requested-accepted` with `effective_model: null`.
2. On 0.144.4 as-is (probe ⇒ `native_budget_only`), every existing test and payload byte
   stays green/unchanged.
3. A native-unavailable + no-explicit-fallback advisor dispatch refuses with a named
   reason; it never silently runs CLI.
