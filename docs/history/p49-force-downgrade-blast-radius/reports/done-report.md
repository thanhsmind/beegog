# Done-report — p49-force-downgrade-blast-radius (orchestrator-authored)

Cell: p49-force-downgrade-blast-radius-1 · lane small · PBI P49 · worker: worker-p49 (sonnet, generation tier) · [DONE]

## What shipped

Refused `--apply` payload (and only it — dry-run already carried `plan`) now enumerates the force blast radius beyond skills: top-level `host_items` = `plan.filter(copy_lib|copy_helper)`, verbatim, order-preserving, threaded through both `applyPlan()`'s blocked-branch return and `main()`'s apply-refusal emission. Present+populated (forceable, drift), present+empty (forceable, no drift), absent (non-forceable). No scope/target tags on host items. Guard logic untouched.

## Orchestrator's independent evidence (never the worker's word)

- Diff reviewed verbatim: `onboard_bee.mjs` +49/-16 (two additive blocks, both guarded by `forceable`), `test_onboard_bee.mjs` +197 (10d negatives, 10z1 exact-equality three-step, 10z2 forceable-empty).
- Own verify re-run: `node skills/bee-hive/scripts/test_onboard_bee.mjs` → `PASS - failures: 0, skipped: 1` (pre-existing case-insensitive-fs skip).
- Full repo verify after self-onboard projection sync + release-manifest regen: exit 0 (first run red on the known manifest-hash trip — critical-patterns 20260715 "shipping a lib file means shipping the manifest"; `release_manifest.mjs --write` inside the feature, re-run green).

## Advisor trail

- Bundle: reports/advisor-bundle.md · raw: reports/advisor-digest.md · verdict: reports/advisor-verdict.md (PROCEED-WITH-CHANGES, 8 findings).
- Findings 1–5, 7 folded into the cell BEFORE dispatch (exact-equality assertion replacing 10v's permissive subset check; copy_helper fixture coverage via readdirSync seeding; unknown-version negatives; forceable-empty pin; both-emission-site threading; no scope/target tags).
- Finding 8 (legacy-global refresh items not enumerated) filed as separate friction — out of scope, not repo-relative.

## Deviations

Worker: none from cell contract. Two test-authoring bugs self-caught pre-cap (missing fake plugin.json in a repro; `--global-skills` in 10z1 dragging aggregate forceable to false — dropped, host_items is `.bee/bin`-scoped).

## Spec sync

docs/specs/onboarding.md R26 added (behavior_change obligation); docs/backlog.md P49 → done.
