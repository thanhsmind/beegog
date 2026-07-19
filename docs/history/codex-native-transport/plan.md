---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: high-risk
---

# plan — codex-native-transport

Source of truth: `CONTEXT.md` (D1–D9, E1–E6). Do not reinterpret.

## Discovery

L1 — the external evidence was gathered and verified in-session (upstream issues
#32031/#20077, local `codex features list`, Codex-Orchestration source); the repo surface
was digested with anchors (gather digest 2026-07-19). No candidate-comparison needed: the
transport priority is locked by D1.

Key repo anchors:
- Canonical lib source: `skills/bee-hive/templates/lib/` mirrored byte-identical to
  `.bee/bin/lib/` (checked by `scripts/test_lib_mirror.mjs:198`).
- `resolveTier` `templates/lib/state.mjs:1243-1276`, `resolveAdvisor` `:1290-1303`.
- `dispatch-prepare.mjs` channels: `cli-exec:192`, `codex-native:201`, `claude-agent:216`.
- `dispatch-guard.mjs` exports `deriveEconomics:325`, `evaluateDispatch:339`; codex spawn
  branch recognizes only `{agent_type:'worker', message}` with anchored `[bee-tier:]`.
- Canary: `scripts/canary_codex.mjs` (CODEX_HOME isolation `:158-161`, skip-guard `:76-79`).
- Config validation: `scripts/test_config_validate.mjs` (covers all current slot shapes).

## Mode gate (mechanical)

Flags counted: **external systems/provider** (codex client behavior), **public contracts**
(config schema + dispatch payload contract), **existing covered behavior** (guard, resolver,
prepare — all heavily tested), **weak proof** (multi_agent_v2 under-development on the local
build), **multi-domain** (resolver + prepare + guard + doctor + canary). 5 flags incl. the
external-provider hard-gate ⇒ **high-risk**. Smaller modes are insufficient: a wrong guard
or resolver change can deny bee's own dispatches repo-wide (see critical-patterns 20260716).

## Slice 1 (current, whole feature) — 5 cells, 2 waves

Wave 1 (parallel): cnt-1 (config shape + resolution), cnt-2 (classification + probe record
+ doctor unlock).
Wave 2: cnt-3 (prepare native branch + economics) after 1+2; then cnt-4 (guard route-check,
deps 1,3) ∥ cnt-5 (canary probe leg + protocol doc, deps 2,3).

Per-cell files/verify are bounded in the cell records (post-Gate 2).

## Test matrix sketch (edge dimensions at high-risk depth)

- **Shape compat:** every pre-existing `models.codex` config shape resolves byte-identically
  (regression rows in test_config_validate + test_lib).
- **Absent/unknown:** unprobed client ⇒ `native_budget_only` ⇒ today's payload byte-stable
  (test_dispatch_prepare golden rows).
- **Refusal paths:** native requested + unavailable + no fallback ⇒ typed refusal with
  named reason; + explicit fallback ⇒ cli payload + reason recorded; never silent.
- **Guard:** override spawn matching config ⇒ allow; wrong model / wrong effort /
  fork_turns≠none ⇒ deny with named reason; no-override spawn ⇒ existing behavior rows
  unchanged (test_model_guard existing rows must stay green untouched).
- **Honesty:** economics rows assert `requested-accepted` sets `effective_model: null`;
  no path writes `used-and-confirmed` (nothing runtime-confirms today).
- **Canary:** skip-guard (no codex binary) exits 0; probe enables flags only inside the
  per-run CODEX_HOME (D4) — asserted by inspecting the isolated config path.
- **Mirror:** every lib edit lands in templates/lib and .bee/bin/lib in the same cell
  (test_lib_mirror).

## Advisor conditions (folded — binding on execution)

GO-WITH-CONDITIONS (reports/advisor-digest.md). Workers honor these as part of the cell:

- **R1 → cnt-4 (+cnt-3 golden row):** codex-branch-only marker constant additionally
  accepting `advisor`; claude branch regex untouched (generation-coercion trap,
  state.mjs:1247). cnt-3 adds a golden row proving the advisor native payload passes
  `evaluateDispatch`.
- **R2 → cnt-4:** route-check = membership against the union of configured native routes
  across all slots incl. advisor (`resolveAdvisor`); `evaluateCodexSpawn` gains a `root`
  param (hooks/bee-model-guard.mjs:183 already has root). Allow iff exact model+effort
  match AND fork_turns==='none'.
- **R3 → cnt-2/cnt-3:** cnt-2 exports `readNativeTransportClassification(root)` (validity
  legs applied; invalid/absent ⇒ `native_budget_only`); cnt-3 gates on that reader alone.
- **R4 → cnt-5:** create `--probe-selftest` (argv currently unparsed, canary main
  :262-270); selftest asserts the isolated-CODEX_HOME invariant; cap evidence must include
  the real probe run's recorded V1/V3 observation, not just the selftest.
- **R5 → cnt-3:** prepare-time status is named `native-requested` (not
  `requested-accepted`); keyed strictly on resolved.type==='native' +
  classification-confirmed; budget-only economics rows byte-identical; D7 wording updated
  at scribing.
- **Note → cnt-1:** insert the `kind:'native'` branch BEFORE the generic
  `value.model` string branch in both resolvers (state.mjs:1270,1297).
- **D3a + Δ2 (decisions c0cba64e, 760e9b05 — landed during cnt-2, authoritative):**
  classification triggers are positive-evidence — `external_cli_only` ⇔
  `multi_agent === false`; `native_model_override` requires `multi_agent_v2 === true`
  (not merely an accepted spawn); `config_scope_hash` covers all four
  verdict-determining flags {multi_agent, multi_agent_v2, hide_spawn_agent_metadata,
  tool_namespace}. cnt-2's landed implementation (4c42346) complies; downstream cells
  consume `readNativeTransportClassification(root)` as-is.

## Open questions for validating

- V1: does force-enabling `multi_agent_v2` on 0.144.4 actually accept an override spawn?
  (Either answer is handled — classification gates the feature — but the canary probe must
  produce the evidence, not a guess.)
- V2: exact `config.toml` key syntax for the flags inside the isolated CODEX_HOME
  (`[features] multi_agent_v2 = true` vs table form with `hide_spawn_agent_metadata`).
- V3: do override fields (`model`, `reasoning_effort`, `fork_turns`) arrive in the
  PreToolUse `tool_input` envelope where the guard can see them? (Guard route-check design
  assumes yes; canary must observe it.)
