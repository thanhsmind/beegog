---
artifact_contract: bee-implement-plan/v1
feature: codex-native-transport
lane: high-risk
status: Approved
updated: 2026-07-19
sources: [CONTEXT.md, approach.md, plan.md, .bee/cells/cnt-1.json, .bee/cells/cnt-2.json, .bee/cells/cnt-3.json, .bee/cells/cnt-4.json, .bee/cells/cnt-5.json]
decisions: [D1, D2, D3, D4, D5, D6, D7, D8, D9]
---

# Implementation Plan: codex-native-transport

> Human-layer projection of the truth artifacts. Truth lives in CONTEXT.md
> (decisions), plan.md + cells (work), and the validating report (evidence).
> Feedback on this document flows back to those artifacts, then this re-renders.

## 1. Review Status

Gate 1 (context) approved. Gate 2 (shape) approved — `.bee/state.json` `approved_gates: {context: true, shape: true, execution: false, review: false}`. Gate 3 (execution) has not fired yet; `bee-validating` must answer V1–V3 (§11) and produce a validation report before cells can be claimed. Gate 4 (review) not applicable until execution closes.

## 2. Goal

Give the codex runtime a native way to run a *different, stronger model* for advisor/review dispatches, replacing the fragile external-CLI route (`codex exec ...`) as the primary transport wherever the client proves it supports Multi-Agent V2 model override (CONTEXT Problem section).

**Success looks like**
- A client where the probe confirms `native_model_override` gets a `spawn_agent` payload carrying `model`/`reasoning_effort`/`fork_turns:'none'` plus the anchored tier marker; the guard accepts it and the dispatch record shows `requested-accepted` with `effective_model: null` (D1, D7).
- On the currently installed codex-cli 0.144.4 (probe ⇒ `native_budget_only`), every existing test and payload byte stays green/unchanged (D3).
- A native-unavailable dispatch with no explicit fallback configured refuses with a named reason — it never silently runs CLI (D1).

## 3. Current State

The codex runtime's only way to run a stronger model today is the external CLI route (`{kind:'cli', command:'codex exec ...'}`): a separate process per call, its own session/lifecycle, stdin/result-file protocol, cwd/auth/sandbox re-init, and exit-code-vs-task-failure ambiguity. Codex Multi-Agent V2's `spawn_agent` natively accepts `model`, `reasoning_effort`, `agent_type`, `service_tier`, `fork_turns` — hidden from the visible tool schema by default (`hide_spawn_agent_metadata = true`) but real and catalog-validated (E1). Bee's dispatch layer currently assumes "spawn_agent has no per-agent model field at all" (`.bee/bin/lib/dispatch-prepare.mjs:202-205`) — stale for V2-metadata clients.

Verified constraints, evidence not assumption (CONTEXT E1–E6):
- E1: V2 args parse+apply even when hidden from the schema (upstream issue #32031).
- E2: full-history fork (the default when `fork_turns` is omitted) **rejects** overrides; `fork_turns:"none"` is a validity precondition, not just context hygiene (issue #20077).
- E3: on the installed codex-cli 0.144.4, `multi_agent` = stable/true, `multi_agent_v2` = under development / false — the surface is version- and config-dependent.
- E4: namespace matters — the default namespace rejects extended metadata while `agents`/a configured `tool_namespace` accepts it.
- E5: custom agent types do not spawn on 0.144.4 (doctor evidence: only built-in default/explorer/worker).
- E6: catalog validation is codex-side — wrong model id / unsupported effort refuses explicitly, never falls back silently.

Repo anchors (plan.md Discovery): canonical lib source `skills/bee-hive/templates/lib/` mirrors byte-identical to `.bee/bin/lib/` (checked by `scripts/test_lib_mirror.mjs:198`); `resolveTier` at `templates/lib/state.mjs:1243-1276`, `resolveAdvisor` at `:1290-1303`; `dispatch-prepare.mjs` channels `cli-exec:192`, `codex-native:201`, `claude-agent:216`; `dispatch-guard.mjs` exports `deriveEconomics:325`, `evaluateDispatch:339` — the codex spawn branch today recognizes only `{agent_type:'worker', message}` with the anchored `[bee-tier:]` marker; canary isolation at `scripts/canary_codex.mjs:158-161` (CODEX_HOME) and `:76-79` (skip-guard).

## 4. Scope

**In scope**
- Resolver + config: new `{kind:'native', ...}` slot shape and the explicit-fallback composite shape, additive-only over existing shapes (D2, cnt-1).
- Capability classification (`native_model_override | native_budget_only | external_cli_only`) from observed evidence, a version+config-scoped probe record, and a doctor row that names the unlock without applying it (D3, D4, cnt-2).
- Dispatch-prepare native-override branch and honest economics status `requested-accepted` (D1, D5, D7, cnt-3).
- Guard route-check for override spawns — model/effort/`fork_turns` must match the configured route or the spawn is denied with a named reason (D6, cnt-4).
- Canary probe leg that flips the V2 flags only inside its isolated per-run `CODEX_HOME`, observes acceptance/refusal, and records evidence answering V1–V3 (D3, D4, cnt-5).

**Out of scope** (CONTEXT.md)
- Custom-agent (`bee_advisor` role file) transport — deferred follow-up once E5 clears on a newer codex build.
- Cross-provider external models (the Codex-Orchestration plugin's external CLI providers).
- Any change to claude-runtime dispatch paths.
- Auto-upgrading or writing the user's real codex config (D4) — bee only names the unlock; the human runs it.

## 5. Proposed Approach

Extend the existing dispatch stack in place — resolver (`templates/lib/state.mjs`), prepare (`templates/lib/dispatch-prepare.mjs`), guard (`templates/lib/dispatch-guard.mjs`), doctor (`bee.mjs`), canary (`scripts/canary_codex.mjs`) — with a probe-gated native-override route (D1–D9). No new subsystem: the g22 features (prepare registry, economics record, attest, canary) are exactly the mounting points this feature needs.

**Why this approach** — the g22 lineage already provides the registry/economics/attest/canary machinery this feature only needs to extend, and CLI-per-call fragility is structural, not tunable.

**Alternatives considered**
- Keep CLI primary and tune it — rejected: the fragility (per-call process, stdin protocol, auth/cwd/sandbox re-init, exit-code ambiguity) is structural.
- Silent native→CLI auto-fallback — rejected (D1): masks codex's explicit catalog refusals, which are the honest signal.
- Custom-agent transport first — rejected (E5): custom agent types do not spawn on 0.144.4; deferred.
- Version-inferred capability (enable when `codex --version` ≥ X) — rejected (D3): the surface is config- and namespace-dependent (E3/E4); only observed evidence counts.
- Bee writes the user's codex config via app-server RPC (Codex-Orchestration's way) — rejected (D4): bee never flips the user's feature flags; doctor names the unlock, the human runs it.

## 6. Technical Design

```text
dispatch request -> resolveTier/resolveAdvisor (config shape) -> classification lookup
  (native_model_override | native_budget_only | external_cli_only)
  -> dispatch-prepare native branch
       -> native_model_override: spawn_agent{model, reasoning_effort, fork_turns:'none', [bee-tier:] marker}
       -> lower + explicit fallback configured: cli payload + recorded reason
       -> lower + no fallback: typed refusal {reason:'native_unavailable', detail:<classification>}
  -> dispatch-guard evaluateCodexSpawn route-check (override fields must match configured route)
  -> economics record: effective_model_status ('requested-accepted' | today's existing values)
```

**Data model** — `models.codex.<slot>` (all slots including `advisor`) gains `{kind:'native', model, effort?, fork_turns?:'none', agent_type?}` and the composite `{primary:{kind:'native',...}, fallback:{kind:'cli',command}, fallback_policy:'explicit-only'}`. Existing shapes (string / `{model,effort}` / `{kind:'cli'}` / null) keep their exact current semantics — additive-only, zero regression (D2). No migration: new shapes are opt-in config, absent by default.

**API / contract** — `spawn_agent` payload gains `model`/`reasoning_effort`/`fork_turns:'none'` on the native-override path; the anchored `[bee-tier:]` first-line marker is unchanged (D5) — role identity travels in `task_name` and the prepare-rendered prompt header, never by replacing the marker. `deriveEconomics` gains the `requested-accepted` status distinct from `used-and-confirmed` (only if the runtime ever exposes effective metadata); `effective_model` stays null unless runtime-confirmed (D7). A refused dispatch returns a typed `{type:'refused', reason:'native_unavailable', detail:<classification>}` object rather than falling back silently.

**Security / Permissions** *(mandatory, high-risk lane)* — bee never flips codex feature flags on the user's real `CODEX_HOME`; enabling `multi_agent_v2`/`hide_spawn_agent_metadata=false` there is a user-approved step named by doctor, never applied by bee (D4). The canary probe may enable those flags only inside its own isolated per-run `CODEX_HOME` (cnt-5). The guard route-check (D6) is the security-relevant surface: an override spawn whose model/effort/`fork_turns` don't match the configured route is denied with a named reason, closing the gap where a spawned agent could otherwise request an unconfigured (and potentially more expensive or less trusted) model. No secrets or PII are introduced; no new external network surface beyond the existing codex CLI/tool boundary.

## 7. Affected Files

| Action | File / Component | Purpose | Cell(s) |
|--------|------------------|---------|---------|
| Modify | `skills/bee-hive/templates/lib/state.mjs` | `resolveTier`/`resolveAdvisor` accept `kind:'native'` + composite shapes | cnt-1 |
| Modify | `.bee/bin/lib/state.mjs` | mirror of the above | cnt-1 |
| Modify | `scripts/test_config_validate.mjs` | golden rows for existing shapes + new native/composite validation rows | cnt-1 |
| Modify | `skills/bee-hive/templates/tests/test_lib.mjs` | resolver regression coverage | cnt-1 |
| Modify | `docs/config-reference.md` | slot-shape table updated for `kind:'native'` + composite | cnt-1 |
| Modify | `skills/bee-hive/templates/lib/dispatch-guard.mjs` | `classifyNativeTransport` export (cnt-2) + `evaluateCodexSpawn` route-check (cnt-4) + honest economics wiring (cnt-3) | cnt-2, cnt-3, cnt-4 |
| Modify | `.bee/bin/lib/dispatch-guard.mjs` | mirror of the above | cnt-2, cnt-3, cnt-4 |
| Modify | `skills/bee-hive/templates/bin/bee.mjs` | doctor row naming the unlock (informational only) | cnt-2 |
| Modify | `.bee/bin/bee.mjs` | mirror of the above | cnt-2 |
| Create | `scripts/test_native_probe.mjs` | classification table + probe-record validity legs; wired into `commands.verify` | cnt-2 |
| Modify | `skills/bee-hive/templates/lib/dispatch-prepare.mjs` | native-override branch, fallback/refusal paths, stale comment at `:202-205` rewritten | cnt-3 |
| Modify | `.bee/bin/lib/dispatch-prepare.mjs` | mirror of the above | cnt-3 |
| Modify | `scripts/test_dispatch_prepare.mjs` | golden payload rows for native / fallback / refusal outcomes | cnt-3 |
| Modify | `hooks/bee-model-guard.mjs` | wired through the extended `evaluateCodexSpawn` | cnt-4 |
| Modify | `hooks/test_model_guard.mjs` | allow+deny row pairs per override field; existing no-override rows frozen green first | cnt-4 |
| Modify | `scripts/canary_codex.mjs` | probe mode: isolated-`CODEX_HOME` flag flip + minimal override spawn attempt | cnt-5 |
| Modify | `docs/decisions/ab-tiny-protocol.md` | probe leg documented | cnt-5 |
| Create | `docs/history/codex-native-transport/reports/probe-evidence.md` | version-scoped observed evidence (V1–V3) | cnt-5 |

## 8. Implementation Steps

**Wave 1** (parallel, independent foundations)
- [ ] cnt-1 — resolver + config: `kind:'native'` slot shape and explicit-fallback composite (D2), deps: none
- [ ] cnt-2 — capability classification + probe record + doctor unlock naming (D3/D4), deps: none

**Wave 2**
- [ ] cnt-3 — dispatch prepare native-override branch + honest economics (D1/D5/D7), deps: cnt-1, cnt-2

**Wave 2 (continued, parallel after cnt-3)**
- [ ] cnt-4 — guard route-check for override spawns (D6), deps: cnt-1, cnt-3
- [ ] cnt-5 — canary native-probe leg + A/B protocol update (D3 evidence, V1–V3), deps: cnt-2, cnt-3

Order rationale (approach.md): cnt-1 & cnt-2 first (independent foundations), cnt-3 depends on both, cnt-4/cnt-5 last. Every lib edit mirrors `templates/lib` ↔ `.bee/bin/lib` in the same cell (`test_lib_mirror`).

## 9. Validation Plan

No validating report exists yet — all five cells are `status: "open"` with `trace.verify_output: null`. The commands below describe what WILL be checked; nothing here has run.

**Automated**
- cnt-1 — `node scripts/test_config_validate.mjs && node skills/bee-hive/templates/tests/test_lib.mjs && node scripts/test_lib_mirror.mjs` → expected: every pre-existing config shape resolves byte-identically; new native/composite rows pass, including rejection rows.
- cnt-2 — `node scripts/test_native_probe.mjs && node scripts/test_verify_manifest.mjs && node scripts/test_lib_mirror.mjs` → expected: classification table correct (unknown ⇒ `native_budget_only`); verify manifest updated.
- cnt-3 — `node scripts/test_dispatch_prepare.mjs && node scripts/test_lib_mirror.mjs` → expected: budget-only payload byte-identical to today; golden rows for native/fallback/refusal outcomes green.
- cnt-4 — `node hooks/test_model_guard.mjs && node scripts/test_lib_mirror.mjs` → expected: existing no-override rows byte-unchanged; new allow/deny row pairs per override field.
- cnt-5 — `node scripts/canary_codex.mjs --probe-selftest` → expected: skip-guard exits 0 without a codex binary; flags written only inside the isolated `CODEX_HOME`; probe outcome recorded even when negative.

**Manual** — [ ] none identified beyond the automated legs; the canary probe (cnt-5) is itself the manual-evidence-gathering step for V1–V3.

**Evidence** — pending; will link `docs/history/codex-native-transport/reports/` once `bee-validating` runs.

## 10. Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Resolver new shapes (`state.mjs`) — every dispatch resolves through it; a bad branch denies repo-wide | High | Freeze existing-shape golden rows green *before* the edit (critical-patterns 20260716 discipline); additive-only branches |
| Guard route-check (`dispatch-guard.mjs`) — false DENY locks bee out of its own dispatches | High | No-override envelope rows byte-unchanged; new deny reasons only fire on spawns that carry override fields |
| Prepare native branch — payload contract consumed by live sessions | Medium | Golden payload tests for the budget-only path stay unchanged; native branch only fires behind confirmed classification |
| Probe/classification — wrong classification silently disables/enables the route | Medium | Unknown ⇒ `native_budget_only` (inert default); verdict is version+config-scoped via the attest pattern |
| Canary probe leg | Low | Isolated `CODEX_HOME`, skip-guarded; V1–V3 answered by observation, not assumption |
| Economics status value | Low | Additive enum value; test rows assert `requested-accepted` ⇒ `effective_model: null` |

## 11. Rollback Plan

One commit per cell (critical rule 8) → `git revert <commit>` per cell id, in reverse dependency order (cnt-5 → cnt-4 → cnt-3 → cnt-2 → cnt-1) to respect the wave-2 dependency chain. Because every new config shape is additive-only (D2) and the native route only activates for hosts that explicitly configure `kind:'native'` in `models.codex.<slot>`, a partial or full revert leaves every pre-existing config shape and dispatch payload byte-identical — no data migration to undo. The mirrored lib files (`templates/lib/*.mjs` ↔ `.bee/bin/lib/*.mjs`) revert together in the same commit per cell, so no drift window opens between the two copies. No feature flag or external state is written outside disposable, isolated locations (cnt-5's per-run `CODEX_HOME`; cnt-2's probe record), so there is nothing on the user's real `CODEX_HOME` to unwind (D4).

## 12. Open Questions

- **V1** — does force-enabling `multi_agent_v2` on codex-cli 0.144.4 actually accept an override spawn? Either answer is handled (classification gates the feature), but the cnt-5 canary probe must produce the evidence, not a guess.
- **V2** — exact `config.toml` key syntax for the flags inside the isolated `CODEX_HOME` (`[features] multi_agent_v2 = true` vs. table form with `hide_spawn_agent_metadata`).
- **V3** — do override fields (`model`, `reasoning_effort`, `fork_turns`) arrive in the PreToolUse `tool_input` envelope where the guard can see them? The cnt-4 guard route-check design assumes yes; the cnt-5 canary must observe it.

All three are assigned to `bee-validating` before Gate 3 can approve execution.
