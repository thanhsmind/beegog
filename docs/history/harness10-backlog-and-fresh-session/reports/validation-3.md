# harness10 — Validation Report, Slice 3 (A3: outside-markers audit + A4: preamble project map)

**Date:** 2026-07-08 · **Mode:** standard, lane small ×2 · **Cells:** harness10-4, harness10-5 · **Verdict:** READY WITH CONSTRAINTS

## Reality Gate

| Check | Result | Evidence |
|---|---|---|
| MODE FIT | PASS | two small cells, 4 files total, disjoint |
| REPO FIT | PASS | merge path helpers are `agentsBlockPresent`/`extractAgentsBlock`/`mergeAgentsContent` (onboard_bee.mjs:178–208 — checker-verified); `buildSessionPreamble` linear builder with a deterministic slot after commands, before critical-patterns (inject.mjs:84–102) |
| ASSUMPTIONS | PASS | tamper test pre-seeds user prose so propose never fires there — byte-identical third apply survives; existing preamble tests are substring-based, additive section can't break them |
| SMALLER PATH | PASS | pointers-only preamble is the minimal Q1/Q2 surface; header is provable-parts-only |
| PROOF SURFACE | PASS | both suites with new assertions |

## Checker (combined, 1 iteration — no BLOCKERs)

WARNINGs repaired into the cells:

- harness10-4: key_link named a nonexistent helper (`splitAgents`) → corrected to the real merge path, header composed before the merge call; D4 any-prose narrowing acknowledged as deliberate operationalization; fresh-repo plan shape pinned (create + propose, ordered, both asserted); multi-line-comment clause; top-of-file placement; up_to_date→changes_needed flip on legacy onboarded repos asserted as intended.
- harness10-5: layout pinned (heading always present, count on its own line, separator excluded from cap, specs-without-maps still warns).

## Constraints (recorded for execution)

1. **Sequential dispatch, not parallel:** both cells' verify runs both suites in one working tree — a red intermediate state in either blocks the other. forager-4 completes before forager-5 starts.
2. harness10-5 landing makes vendored `.bee/bin/lib/inject.mjs` drift in onboarded repos → next onboarding plan re-triggers `copy_lib`. Expected; noted so reviewing doesn't flag it.
3. Project-map preamble tests that create `docs/specs/` fixtures must clean up (shared root fixture, order-safety).

## Approval Block

- Verdict: **READY WITH CONSTRAINTS** (the three above). Approval covers slice 3 only. Slice 4 returns to prep + validating when current.
