---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: high-risk
---

# plan — codex-native-runtime-v2

## Mode gate

Flags counted (mechanical): **external systems** (Codex CLI runtime), **public contracts** (plugin manifests + skill distribution consumed by host repos), **cross-platform** (two runtimes must stay in lockstep), **existing covered behavior** (onboarding/distribution/hook suites cover every touched surface), **multi-domain** (docs, hooks, skill distribution, CLI, installer) → 5 flags → **high-risk**. No hard-gate flag (no auth/data-loss/security/provider-secret surface). Smaller modes are insufficient: the adapter split (D9) rewires how skills are rendered into both managed roots — a distribution-machinery change with repo-wide blast radius.

## Discovery

L1 (verified findings already in hand): two gather digests + direct checks confirmed every structural claim of `docs/REFs/be-codex.md` (see CONTEXT.md "Verified problem statement"). The remaining unknowns are exactly the D2 capability questions — they are answered by slice S2's spike, not by more planning research. Precedent: `docs/history/codex-runtime-parity/` (P24) for hook parity mechanics; `docs/history/model-tier-guard/` for guard patterns; critical-pattern 20260716 (regression net frozen green before touching load-bearing machinery) governs S5.

## Epic map (slices)

| Slice | Content | D-IDs | Gated on |
|---|---|---|---|
| S1 | Truth cleanup, matcher superset, Claude hook-manifest convergence + parity test | D3 D4 D5 | nothing |
| S2 | Codex capability spike → capability matrix + gating decisions | D2 | nothing |
| S3 | Plugin hooks bundling + XOR rule; approval_policy out of distributed default + profiles | D6 D7 | S2 |
| S4 | Codex custom agents + developer_instructions; runtime-native advisor transport | D8 D10 | S2 |
| S5 | Adapter split for 5 runtime-sensitive skills (render at onboarding sync) | D9 | S2 (informs adapter content), regression net first |
| S6 | `bee doctor --runtime codex` (and `claude`) | D11 | S2 (knows what "observed" means) |
| S7 | Conformance suite (automatable subset) + AGENTS.md dedupe budget | D12 D13 | S1–S6 |

**Slice 1 (S1+S2): COMPLETE** — cnr2-1/2/4/5 capped, goal-checked, judge-intact; spec synced (hook-runtime). Matrix verdicts (decision logged): DEFER D6 (plugin hooks removed/false on 0.144.4) and D8 (custom agents not discovered; P25 stays deferred); PROCEED D7, D10, S6 doctor; observed bonus — `update_plan` reaches PostToolUse and `spawn_agent` fires PreToolUse with `tool_input.agent_type`.

**Current slice (slice 2 = S3+S4 revised):**
1. **cnr2-6 (D7, docs):** approval_policy is NOT distributed (verified: repo-local only) — document the Codex-permission-vs-gate-bypass distinction + `bee-safe`/`bee-autopilot` profiles in INSTALL.md and docs/06-runtime-integration.md.
2. **cnr2-7 (drift regen):** bee's own `.codex/hooks.json` fully regenerated from the catalog repo-target render (restores AskUserQuestion + SubagentStart/Stop audits, keeps the cnr2-2 superset matcher) + a drift assertion pinning repo file == catalog render.
3. **cnr2-8 (Codex agent guard, deps cnr2-7):** PreToolUse `spawn_agent` guard entry in the Codex projections (catalog + host renderer) + bee-model-guard extended for the observed Codex spawn ABI (`tool_input.agent_type`) so bare/unmarked dispatches are denied on Codex as they are on Claude (decision 0023 parity).

**Slice 2 (S3+S4 revised): COMPLETE** — cnr2-6 (profiles/distinction docs + 8-event rider), cnr2-7 (manifest regen + byte pin), cnr2-8 (Codex spawn_agent guard, isolated branch, fail-open boundary) capped, goal-checked, judge-intact; specs synced (hook-runtime directional-differences, reading-map).

**Slice 3 rev2 (reshaped after advisor RETURN-TO-PLANNING + panel ITERATE — decisions logged):** four repairs govern the reshape: (a) rendered projections carry provenance metadata and are refused as cross-runtime onboarding sources (source-identity.mjs:65 / onboard_bee.mjs:401 lossy-source blocker); (b) plugin pre-render moves INTO the slice (new cnr2-12) — plugin manifests point at rendered per-runtime trees, closing raw-source bleed; (c) three integrity contracts: release hash = canonical bytes incl. markers, per-target drift = render(canonical, target) at BOTH hash sites (onboard_bee.mjs:693 computeSkillItems + :1233 applySyncSkill fast-skip), downgrade stays version-based; (d) paired per-runtime restructuring is PERMITTED for horizontally interleaved prose (the 3-column runtime table swarming-reference.md:116-128, interwoven bullets like bee-swarming/SKILL.md:94) — semantic preservation proven against a frozen pre-tag baseline, with the D10 delta the only allowed semantic change. Attribution rule: classify by who must act, not who is mentioned (AO11 budget mechanics → codex-only; cross-runtime contrast notes → non-loaded docs). The actual repo-mirror mechanism is applySyncSkill via self-onboard (mode "sync" — the self_skip claim at bee-hive/SKILL.md:31 is stale and gets fixed in-slice).

**Current slice (slice 3 rev3 = S5), serialized cnr2-9 → cnr2-12 → cnr2-10 → cnr2-11:**
1. **cnr2-9 (renderer + provenance + net, ceiling):** strict marker grammar (full-line, fence-forbidden, whole-tree pre-validation, zero writes on any malformed file), filter in `applySyncSkill`/`computeSkillItems` with rendered-bytes hashing at both sites, byte-preserving zero-marker passthrough, provenance metadata + rendered projections refused as onboarding sources for ANY target (canonical or plugin source required), `test_skill_render.mjs` + wiring of it and `test_state_write_concurrency.mjs` into `commands.verify` + the mandatory-suite guard, stale `self_skip` doc line fixed.
2. **cnr2-12 (plugin rendered trees, deps cnr2-9):** LOCKED topology — committed `render(canonical, claude)` at `.claude-plugin/skills/` and `render(canonical, codex)` at `.codex-plugin/skills/`, manifests repointed, release inventory covers them, `test_plugin_distribution` pins tree == render(canonical) and runtime-cleanliness. Zero markers today ⇒ byte-identical, no regression.
3. **cnr2-10 (tag hive/swarming/executing + D10 + census, deps cnr2-9+12):** who-must-act attribution; paired per-runtime restructuring permitted for the 3-column table and interwoven bullets under the frozen-baseline proof; D10 transport split is the only semantic delta; census flip in `test_lib.mjs`.
4. **cnr2-11 (tag validating/reviewing + FINAL render + suite, deps cnr2-10):** attribution-only; sole final-render owner of all rendered trees (managed roots + plugin trees in its file scope); render-model section in 06-runtime-integration; full recorded verify chain recorded green.

**Slice 3 (S5): COMPLETE** — cnr2-9/12/10/11 capped, goal-checked; external release 1.5.1 landed on top and healed the transient drift-pin red (stale provenance sidecar from the mid-flight version bump; user-confirmed release, waited out per multi-session etiquette).

**Current slice (slice 4 = S6+S7, final):**
1. **cnr2-13 (D11 doctor):** `bee doctor --runtime codex|claude` — fail-closed status report; never "ready" from file presence; codex trust/custom-agent rows honestly `unknown`/`unsupported` per the capability matrix (doctor --json exposes no trust surface on 0.144.4).
2. **cnr2-14 (D12 conformance, deps cnr2-13):** scripted automatable subset of the 12 black-box scenarios + manual checklist with named metrics; wired into the verify chain.
3. **cnr2-15 (D13 AGENTS.md dedupe):** 20 KiB budget guard test + conservative dedupe at the template source (every removed sentence provably present in a skill).

## Current slice — work items

1. **cnr2-1 (S1/D3) docs truth cleanup:** remove the three stale "Codex has no (lifecycle) hooks" claims; INSTALL.md gains the Codex verify procedure (project trust → `/hooks` review state → observed check via `.bee/logs/hooks.jsonl`; three-state model `hooks_file_present / hooks_discovered / hooks_trusted_and_observed`).
2. **cnr2-2 (S1/D4) matcher superset:** `.codex/hooks.json` state-sync matcher → `update_plan|TaskCreate|TaskUpdate|TodoWrite`, fixed at the template source that onboarding renders from (never only the rendered copy), plus contract-test coverage.
3. ~~cnr2-3 (S1/D5)~~ — dropped at validation: premise disproved (manifests are intentional catalog projections; drift-check already pins them — see CONTEXT.md D5 correction).
4. **cnr2-4 (S2/D2) capability spike:** read-only probes of the installed Codex CLI for each claimed capability; output `.bee/spikes/codex-native-runtime-v2/capability-matrix.md` with per-capability `observed | not-observed | unknown` + evidence (command output, doc citation), and a copy summarized to `docs/history/codex-native-runtime-v2/reports/capability-matrix.md`. Each `not-observed/unknown` capability produces a logged asymmetry decision gating S3/S4/S6 scope.

## Test matrix sketch (edge dimensions at high-risk depth)

- **Idempotence:** matcher/manifest edits re-runnable through onboarding without diff churn (existing `test_onboard_bee` re-run).
- **Version skew:** superset matcher must be valid on both old and new Codex tool names (that is why superset, never swap — D4).
- **Split-brain:** the new parity test is itself the regression net for D5; `test_split_brain_regression.mjs` pattern is precedent.
- **Fail-open logging:** hook edits must keep `logs/hooks.jsonl` fail-open behavior (covered by `test_hook_contracts.mjs`).
- **Distribution:** template-vs-rendered drift is the standing failure mode (generator drift check from 1.5.0) — every rendered-file edit lands at its template source.
- **Spike honesty:** capability matrix rows require verbatim command evidence; "docs say so" alone marks `unknown`, never `observed`.

## Verification

- Whole-suite: the recorded `commands.verify` chain (baseline green at session start, 2026-07-18).
- Per-cell verify commands named in each cell.
