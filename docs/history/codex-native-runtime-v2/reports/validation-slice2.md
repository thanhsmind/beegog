# Validation report — codex-native-runtime-v2, slice 2 (cnr2-6/7/8)

Date: 2026-07-18. Lane: high-risk.

## Reality gate

- **MODE FIT: PASS** — same 5-flag count as slice 1; guard/manifest surface unchanged in kind.
- **REPO FIT: PASS** — reviewer verified live: catalog repo-target render produces the missing entries; renderProjection/renderProjectionText exist (catalog.mjs:224,250); no existing pin compares the on-disk file (test_hook_contracts.mjs:2688 renders fresh only) — cnr2-7's pin is genuinely new; guard gates on DISPATCH_TOOLS + anchored regex (bee-model-guard.mjs:45,49); per-runtime matcher groups renderable.
- **ASSUMPTIONS: PASS** — spawn ABI grounded in spike evidence (envelope quoted verbatim; provenance citation gap noted and folded into cnr2-8 as hygiene fix).
- **SMALLER PATH: PASS** — D6/D8 halves already deferred per matrix; slice is the PROCEED subset only.
- **PROOF SURFACE: PASS** — baselines green today: contracts 164 rows, model-guard, onboard, release manifest 146 files (reviewer re-ran all).

## Panel + cold-pickup (combined, review tier)

Verdict **STRUCTURALLY CLEAN**, 0 blockers, 6 warnings — all folded: stale claude-only rationale in catalog + onboarding comments (→ cnr2-8), regen path named explicitly (piped renderProjectionText), spike provenance citation fix, renderer scope disambiguated (Codex renderer only), cnr2-6 verify strengthened.

## Advisor consult (cli, codex/gpt-5.6-sol)

Bundle `reports/advisor-bundle-s2.md`, digest `reports/advisor-digest-s2.md`. Verdict **PROCEED-WITH-CHANGES**, 8 findings, all folded pre-dispatch: authoritative field is `tool_input.message` (not `prompt`); full allow/deny/fail-open fixture boundary (only `worker` envelope captured — `default`/`explorer` fail open); isolated Codex branch in the guard (never merged into the Claude dispatch set); cnr2-7 sequencing safety (audits silent, one-time /hooks retrust noted); event-count truth correction 7→8 folded into cnr2-6 (now deps cnr2-7); Codex command count 12→13 + source↔mirror byte-parity assertion; spec sync obligation (hook-runtime.md, reading-map.md pre-spawn claude-only wording) carried to slice close; cnr2-8 traceability corrected D8→D4+0023.

## Schedule

Waves: [cnr2-7] → [cnr2-6, cnr2-8] (cnr2-6 deps cnr2-7 for the event-count rider; cnr2-8 deps cnr2-7 for the manifest file; cnr2-6 and cnr2-8 share no files).

## Verdict

**READY.** Gate 3 auto-approved under bypass=total (audit decision logged at approval).
