# harness10 — Validation Report, Slice 4 (B: PBI layer + A5 + dogfood sync)

**Date:** 2026-07-08 · **Mode:** standard; lanes small, small, tiny · **Cells:** harness10-6 → 7 → 8 (sequential deps) · **Verdict:** READY WITH CONSTRAINTS

## Reality Gate

| Check | Result | Evidence |
|---|---|---|
| MODE FIT | PASS | mechanical/prose/sync split; 5 + 8 + 4 files |
| REPO FIT | PASS | checker-verified: `addCell` already preserves unknown fields (pbi lands via spread); `buildStatus` flat object slots `pbi` naturally; Project map section accommodates the extra line; AGENTS block 90→≤100 headroom; grooming FST table lines 45–55 is the exact A5 target |
| ASSUMPTIONS | PASS | test conflicts identified precisely (test_lib ~540 length===4, ~544 !/PBI/) and named in the cell for repurposing |
| SMALLER PATH | PASS | parser reads Status column only; no writer helper (D7 honored — prose-ruled transitions) |
| PROOF SURFACE | PASS | both suites + self-checking greps + line budgets; 10-8 verify covers all truths (pbi grep, detector CLI run, up_to_date) |

## Checker (combined, 1 iteration)

- **BLOCKER (10-8):** this repo's AGENTS.md is block-only → apply fires the D4 `propose_agents_header` by design, violating the cell's original prohibition. **Repaired:** prohibition amended to expect the header; the applied `[unknown]` fill-me header is now an asserted dogfood truth.
- WARNINGs repaired: PBI status enum gets the COMMAND_KEYS-style drift guard (10-6); both existing test assertions named for repurposing (10-6); PBI line appends in both Project-map branches, warning case included (10-6); 07-contracts gets the additive-field note (moved to 10-7, D10 added to its citations); two-backlogs disambiguation in the AGENTS block pointer + grooming wording (10-7); Red Flags file named (scribing SKILL); routing-and-contracts grep added to 10-7 verify; 10-8 verify extended to cover all truths; **docs/backlog.md seeded by 10-8** from CONTEXT Deferred Ideas (3 proposed rows) so the dogfood exercises real counts, not just the null path.

## Constraints (recorded for execution)

1. Sequential dispatch 6 → 7 → 8 (deps enforce it; shared verify suites anyway).
2. 10-6 must repurpose, not delete, the slice-4-boundary assertion (absent-backlog case keeps the negative test).
3. 10-8's summarize step lists the propose_agents_header item explicitly before apply — the user-facing summary names everything apply will write.

## Approval Block

- Verdict: **READY WITH CONSTRAINTS**. Approval covers slice 4 (final slice). After execution → bee-reviewing (Gate 4).
