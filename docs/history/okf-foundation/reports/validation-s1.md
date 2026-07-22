# Validation report — okf-foundation S1 (high-risk)

Date: 2026-07-22 · Verdict: **READY WITH CONSTRAINTS** (after narrow return applied)

## Reality gate

| Check | Result | Evidence |
|---|---|---|
| MODE FIT | PASS | 4 flags counted mechanically (plan.md §Mode gate); no smaller honest lane — S1 alone spans both managed lib roots + ledger + render trees |
| REPO FIT | PASS | Store-module precedent (`capture.mjs`/`reviews.mjs`); projection precedent (`decisions.mjs:895-902`); templates-as-source confirmed (`onboard_bee.mjs:2837-2841`) |
| ASSUMPTIONS | PASS (after repair) | Panel falsified the original propagation assumption; repaired — see matrix rows 4-5 |
| SMALLER PATH | PASS | Split-cell alternative evaluated and rejected: intermediate commit red on `test_plugin_distribution` drift-pin = v1.9.0 incident class. One atomic cell is the smallest *honest* unit |
| PROOF SURFACE | PASS | `verify = node scripts/run_verify.mjs` (full chain); RED-first suite required by must_haves |

## Feasibility matrix

| # | Assumption | Risk | Proof required | Evidence | Result |
|---|---|---|---|---|---|
| 1 | Ledger refresh reachable mid-feature | MED | Named mechanism | `ledger_parity.mjs` FIX_HINT = `onboard_bee.mjs --repo-root . --apply`; `listTemplateLibModules()` auto-discovers new `*.mjs` (panel, `onboard_bee.mjs:1707`) | ✅ |
| 2 | Anchor inventory mechanical (D35 denominator) | LOW | Extractable ids | `advisor-protocol.md` uses uniform `**B1 —` / `- R1 —` forms (grep evidence in session log) | ✅ |
| 3 | `test_knowledge.mjs` auto-discovered | LOW | Discovery root | `run_verify.mjs` `DISCOVERY_ROOTS` includes `skills/bee-hive/templates/tests` | ✅ |
| 4 | Templates edit keeps chain green after ledger+manifest refresh alone | — | Panel probe | **FALSIFIED**: `test_plugin_distribution.mjs:317-329` byte-pins committed `.claude-plugin`/`.codex-plugin` trees; render step mandatory | ❌ → repaired |
| 5 | Repaired sequence is complete | MED | Ordered command list | Panel-verified: author both roots → `onboard_bee --apply` → `render_plugin_skill_trees` → `release_manifest --write` → `run_verify`; manifest path `docs/history/codex-harness-hardening/release-manifest.json` | ✅ |
| 6 | Schedule | — | zero cycles | `cells schedule`: waves [[okf-1],[okf-2]], no cycles/unsatisfiable deps | ✅ |

## Panel findings (bee-review, opus) and disposition

- [L2][BLOCKER] render step + ~40 generated files missing → **fixed**: okf-1 action is now the
  numbered 5-step sequence; `files` includes all four trees, ledger, manifest; `read_first` gained
  the three scripts. Plan.md S1 file order corrected (post-validation planning return; Gate 2
  re-approved under bypass).
- [L2][BLOCKER] plan.md shared the gap → **fixed** (same revision).
- [L3][BLOCKER] 4-in-1 cell / cold pickup → **resolved by explicitness, not splitting**: the split
  alternative produces a red intermediate commit (drift-pins), which the panel's own L1 warning
  acknowledges the plan avoided deliberately. Cold pickup is now a numbered checklist with every
  script in `read_first`. Recorded as a constraint below.
- [L1][WARNING] plan deviates from integration-review S1/S2 boundary → accepted deviation, reason
  recorded in plan.md ("a split cell would leave an intermediate commit red").
- [L3][WARNING] reservation scope → okf-1 `files` now names the four trees; solo execution this
  slice (serial waves), no competing reservations.
- [L3][WARNING] help-manifest conformance untested → added to okf-1 test fixtures (new verb appears
  in `--help --json`; `test_bee_cli` in gating suites).
- [L1][WARNING] empty `decisions` arrays → both cells tagged.

## Advisor consult (AO2b)

Digest: `reports/advisor-digest-s1.md`. Round-trip guard + fixtures folded into okf-1; ledger
ordering hazard folded (onboarding.json in files, refresh-last rule); D21/D35 F2 flags recorded in
P66 (advice never overrides locked decisions). Re-recorded post-plan-revision: same digest, fresh
anchors — the revision *implements* the digest's own findings, so the consult substance is current.

## Constraints on READY

1. okf-1 is intentionally wide (atomic propagation); the worker must follow the numbered sequence
   exactly — steps 2-4 are order-sensitive, refresh/render/manifest are the last mutations.
2. If the worker's chain run reds on anything outside the six named gating suites, that is new
   information: return `[BLOCKED]` with the output, do not improvise.
3. okf-2 depends on okf-1's capped state (needs the `knowledge check` verb live).

## Approval block

Gate 3 auto-approved (gate_bypass=total) after non-stale advisor_ref recorded. Approval covers
S1 (okf-1, okf-2) only; S2+ return through planning/validating when current.
