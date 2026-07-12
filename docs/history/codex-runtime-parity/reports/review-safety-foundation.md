# Review Report — codex-runtime-parity / Safety foundation slice

**Date:** 2026-07-12 · **Lane:** high-risk (full wave, 5 reviewers) · **Verdict: P1 = 0 (after fix cell 4b) — ready for Gate 4**

## Wave

4 core (code-quality, architecture, security, test-coverage) + 1 conditional (api-contract, trigger: public plugin-contract change). All dispatched isolated (diff 088fcd8..HEAD + CONTEXT.md + plan.md only, zero session history), on the native review slot (opus) after the configured cli reviewer (codex gpt-5.6-sol) timed out systematically 5/5 at 25 min — filed as P2 friction; the unsafe recorded cli flags themselves are E3 scope. Full per-reviewer reports: `.bee/workers/review-{security,code-quality,architecture,test-coverage,api-contract}.md`.

## Findings and Disposition

| Sev | Finding | Disposition |
|---|---|---|
| P1 | Partial-unprovable apply_patch branch (`bee-write-guard.mjs:176`) had zero test rows (test-coverage F1) | **FIXED in-slice** — cell codex-parity-4b (`6705baf`): rows 27–29 (mixed provable+unprovable, both orderings, Move-destination combo) + rows 19–22 strengthened to assert corrective stderr (F5). Goal-checked fresh: 67+71 rows ALL PASS, judge intact. Guard code itself untouched and verified correct by two independent reviewers. |
| P2 ×4 | `set --feature` leaves gates intact (security); no vendored-wrapper import smoke test (architecture); stale committed `.codex/hooks.json` contradicts the new route until E2 removes it (api-contract); plain-context assertions + bytewise refusal asserts missing (test-coverage F2/F3) | **Backlog** (review-finding rows, feature-tagged) — natural homes in E2/E3 slices. |
| P3 ×17 | Grouped: stale docs (07-contracts/06-runtime/INSTALL), guard robustness batch (prototype-key lookup, huge-stdin edge, weak reservation identity, regex parser-differential), catalog/arch advisories (ALLOWED_DIFFERENCES granularity, third catalog copy, enum duplication), test-coverage niceties, manifest version drift (E2 by design), repo self re-onboard | **Backlog** (4 grouped rows). |

Corroboration notes: no cross-reviewer finding collisions requiring promotion; security and code-quality independently verified the guard and adapter clean on direct probes (traversal, absolute, prototype pollution, deny-flip attempts).

## Verification-Evidence Gate (§3)

4/4 `behavior_change` cells carry substantive evidence with red-failure/exception characterization (1.9k–3k chars each, in traces). Cell 2b is test-only. No helper bypass. Frozen judges intact on all 7 cells.

## Artifact Verification (§4)

catalog.mjs / claude-hooks.json / adapter.mjs / startFeature / suites: **EXISTS + SUBSTANTIVE + WIRED** (manifest points at claude projection; 7/7 wrappers import adapter; start-feature live in vendored CLI; 9 catalog refs in the drift test).

## UAT (§5) — live demos, fresh outputs 2026-07-12

1. **Hostile stdin** (`null` → write-guard): exit 0, no crash — fail-open honored.
2. **apply_patch targeting `.bee/state.json`** (canonical envelope): **denied exit 2** with the corrective FIX message. Incidental live proof: the guard also denied the orchestrator's own `cp` command touching state.json during UAT prep — the guard guards its guardians.
3. **start-feature mid-feature**: refused exit 1 with plain-language FIX; `.bee/state.json` sha256-identical before/after — zero-mutation held.

## Final gates (fresh, this session)

test_write_guard 67 rows ALL PASS · test_hook_contracts 71 rows ALL PASS · test_model_guard ALL PASS · test_lib 169/0 · test_onboard PASS failures:0.
