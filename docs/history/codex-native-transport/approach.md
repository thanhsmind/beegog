# approach — codex-native-transport

## Chosen path

Extend the existing dispatch stack in place — resolver (`templates/lib/state.mjs`), prepare
(`templates/lib/dispatch-prepare.mjs`), guard (`templates/lib/dispatch-guard.mjs`), doctor
(`bee.mjs`), canary (`scripts/canary_codex.mjs`) — with a probe-gated native-override route
(D1–D9). No new subsystem: the g22 features (prepare registry, economics record, attest,
canary) are exactly the mounting points this feature needs.

## Rejected alternatives

- **Keep CLI primary, tune it** — rejected: fragility is structural (per-call process,
  stdin protocol, auth/cwd/sandbox re-init, exit-code ambiguity). CONTEXT Problem section.
- **Silent native→CLI auto-fallback** — rejected (D1): masks codex's explicit catalog
  refusals, which are the honest signal.
- **Custom-agent transport first** — rejected (E5): custom agent types do not spawn on
  0.144.4; deferred to a follow-up feature.
- **Version-inferred capability** (enable when `codex --version` ≥ X) — rejected (D3):
  the surface is config- and namespace-dependent (E3/E4); only observed evidence counts.
- **Bee writes the user's codex config via app-server RPC** (Codex-Orchestration's way)
  — rejected for bee (D4): bee never flips user feature flags; doctor names the unlock,
  the human runs it. The canary may flip flags only inside its own CODEX_HOME.

## Risk map

| Component | Risk | Proof needed |
|---|---|---|
| resolver new shapes (state.mjs) | HIGH — every dispatch resolves through it; a bad branch denies repo-wide | freeze existing-shape golden rows green BEFORE the edit (critical-patterns 20260716 discipline); additive-only branches |
| guard route-check (dispatch-guard.mjs) | HIGH — false DENY locks bee out of its own dispatches | no-override envelope rows byte-unchanged; new deny reasons only on spawns that carry override fields |
| prepare native branch | MEDIUM — payload contract consumed by live sessions | golden payload tests for budget-only path unchanged; native branch only behind confirmed classification |
| probe/classification | MEDIUM — wrong classification silently disables/enables the route | unknown ⇒ `native_budget_only` (inert default); verdict version+config-scoped via attest pattern |
| canary probe leg | LOW — isolated CODEX_HOME, skip-guarded | V1–V3 in plan.md answered by observation |
| economics status value | LOW — additive enum value | test rows assert `requested-accepted` ⇒ `effective_model: null` |

## Order

cnt-1 & cnt-2 first (independent foundations), cnt-3 on both, cnt-4/cnt-5 last. Every lib
edit mirrors templates/lib ↔ .bee/bin/lib in the same cell (test_lib_mirror).

## Relevant learnings

- critical-patterns 20260716: tolerant regression net frozen green before editing a
  load-bearing resolver — applies verbatim to state.mjs and dispatch-guard.mjs here.
- g22 advisor conditions (decision 2026-07-18): guard logic lives in the exported lib
  (`evaluateDispatch`), prepare-time economics record, attest static validity — all reused.
