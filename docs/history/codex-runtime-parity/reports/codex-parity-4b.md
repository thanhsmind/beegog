# Cell report: codex-parity-4b

**Status:** [DONE]
**Worker:** phil (generation tier)

**Outcome:** Closed review findings F1 (P1) and F5 (P3) from `.bee/workers/review-test-coverage.md`. Added rows 27–29 to `hooks/test_write_guard.mjs`: a partial-unprovable apply_patch matrix mixing one PROVABLE target with one UNPROVABLE target in both orderings (provable-first, unprovable-first) plus the outside-repo Move-destination combo named in the finding — each asserting the WHOLE request denies exit 2, pinning `bee-write-guard.mjs`'s `relPaths.length < targets.length` branch (line 176) for the mixed case specifically. Strengthened existing unprovable-deny rows 19–22 to also assert the corrective FIX-bearing stderr, not just exit code, matching row18's existing check. No real guard bug was exposed by the new rows. Verify: `node hooks/test_write_guard.mjs && node hooks/test_hook_contracts.mjs` — 67 + 71 rows, ALL PASS, exit 0.

**Files touched:** `hooks/test_write_guard.mjs` (test-only cell; `hooks/bee-write-guard.mjs` untouched, no rows deleted or weakened — diff is +67 insertions only).

Full trace and verification evidence: [.bee/cells/codex-parity-4b.json](../../../../.bee/cells/codex-parity-4b.json) (decision 0009 — the trace is the single source).
