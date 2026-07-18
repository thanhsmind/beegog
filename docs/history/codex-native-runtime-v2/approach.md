# approach — codex-native-runtime-v2

## Chosen path

Capability-gated, slice-ordered parity build (CONTEXT.md D1–D13): land the always-safe truth/guard fixes first (S1), observe the installed Codex CLI's real capabilities second (S2), and only then build the distribution, orchestration, adapter, doctor, and conformance layers on what was actually observed. Root `skills/` stays the single human-edited source; per-runtime rendering happens inside the existing onboarding sync, not in a parallel dist tree.

## Rejected alternatives

- **Full skill fork (two 15-skill sets):** rejected — guaranteed drift; the review doc itself rejects it (D1).
- **Trusting the review doc's Codex capability claims without observation:** rejected — the doc's own strongest insight is `hooks_file_present ≠ hooks_trusted_and_observed`; building custom agents on unverified docs would repeat the exact "file exists so it works" failure it diagnoses (D2).
- **Parallel `skill-src/ + build/ + dist/` tree (doc's literal proposal):** rejected in favor of adapters under `skills/<name>/adapters/` rendered by the existing onboarding sync — one less tree, reuses the machinery that already versions, mirrors, and tests skill distribution (D9).
- **Swapping hook matchers to `update_plan` only:** rejected — superset keeps old/new Codex tool names both matched; zero-risk on version skew (D4).
- **Patching symptoms individually** (per-symptom fixes like "Codex reviews too much"): rejected — the review doc's closing argument; this feature is the single initiative it recommends.

## Risk map

| Component | Risk | Proof needed |
|---|---|---|
| Docs cleanup (D3) | LOW | grep-zero on stale claims; markdown intact |
| Matcher superset (D4) | LOW | template-source edit + contract test; onboarding re-render idempotent |
| Hook-manifest convergence (D5) | MEDIUM | new parity regression test; both plugin and repo-local install paths keep guard+audit |
| Capability spike (D2) | MEDIUM | verbatim CLI evidence per capability; `unknown` is an honest verdict |
| Plugin hooks XOR (D6) | MEDIUM | gated on S2; installer test for the XOR rule |
| Custom agents + developer_instructions (D8) | HIGH | gated on S2; inert-config prohibition from P25 ("profiles are not shipped as inert configuration") — agents must be observed selectable |
| Adapter split (D9) | HIGH | regression net FIRST (critical-pattern 20260716): freeze current rendered-skill bytes green, then change the renderer; semantic-hash test for shared cores |
| Advisor transport (D10) | MEDIUM | Codex-adapter prose only; this repo's advisor is cli-shaped already |
| Doctor (D11) | MEDIUM | fail-closed unit tests; never "ready" from file presence |
| Conformance (D12) | MEDIUM | automatable subset as scripts; manual scenarios documented, not faked |
| AGENTS.md dedupe (D13) | MEDIUM | byte budget check; every removed sentence provably present in a skill |

## Order and blast radius

S1 → S2 → (S3, S4, S6 parallelizable) → S5 → S7. S5 touches `onboard_bee.mjs` skill-sync — the second-highest blast-radius surface after `resolveRoots`; it gets the frozen-green regression net before any renderer change. Every rendered artifact (`.codex/hooks.json`, `.claude/skills/*`, `.agents/skills/*`, agent files) is edited at its template/generator source; the generator drift check (1.5.0) is the enforcement backstop.

## Open questions for validating

1. Does `codex` CLI on this machine expose agents/hook-trust surfaces inspectable read-only (S2 feasibility itself)?
2. Where exactly does onboarding render `.codex/hooks.json` from (template path), and does a contract test already pin its matcher set?
3. Are `hooks/hooks.json` vs `hooks/claude-hooks.json` both actually consumed (plugin route vs repo route), or is one dead — convergence (D5) vs deletion?
