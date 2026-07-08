# harness10 — Review Report (Gate 4)

**Date:** 2026-07-08 · **Feature:** harness10-backlog-and-fresh-session · **Verdict:** P1 = 0, P2 = 0, P3 = 3 (1 fixed, 2 filed)

## Reviewers (isolated context: diff + CONTEXT + plan only)

- **code-quality + correctness** (generation): both suites pass; parser tolerance claims verified against adversarial live inputs; onboarding double-header hazard confirmed guarded by plan ordering + test. No P1/P2.
- **architecture + test-coverage** (generation): read-only backlog boundary (D7 honored — no mechanical PBI-transition enforcement), single-owner schema + enum, no D9 coupling, clean two-backlog disambiguation. No P1/P2.
- **security**: not spawned — diff has no auth/secrets/injection surface; detector reads named manifests only and excludes secret-shaped files by the existing scout rule.

## Verification-Evidence Gate

All 7 `behavior_change` cells (harness10-1..7) carry recorded `verification_evidence` (tests inspected + red-then-green proof), not vague assertions. harness10-8 is `behavior_change: false` (dogfood sync). PASS.

## Artifact Verification (EXISTS / SUBSTANTIVE / WIRED)

| Promise | Result |
|---|---|
| commands_detect.mjs detects + CLI entry | WIRED — imported by onboard_bee.mjs, vendored, prints `[]` live |
| backlog.mjs parser | WIRED — imported by both inject.mjs and bee_status.mjs |
| Project map preamble section | WIRED — live output shows section + warning + PBI line |
| PBI counts in bee_status | WIRED — live `pbi: {proposed:3,in_flight:0,done:0}` |
| docs/backlog.md seeded | EXISTS + SUBSTANTIVE — 3 proposed rows, correct schema |
| AGENTS.md D4 header | WIRED — applied on the bee repo with `[unknown]` fill-me line |
| scribing bootstrap / capture / flip prose | SUBSTANTIVE — single-owner, D7-tagged |

## UAT (dogfood — live on the bee repo itself)

The feature was exercised end-to-end on its own repo (harness10-8): `bee_status --json` reports real PBI counts; the session preamble renders the Project map section including the bootstrap warning (bee uses `docs/` as its spec layer, so Q1/Q2 correctly flag missing `docs/specs/` maps — an honest gap the feature surfaced, filed as a candidate, not a blocker); onboarding proposed the AGENTS header. All observable outputs match CONTEXT decisions.

## Findings

- **P3 (fixed inline):** `projection|todo list` verify-gaming token in routing-and-contracts.md:111 — deleted the code span; D12 prose now reads naturally, heading is the stable landmark.
- **P3 (filed, backlog):** backlog.mjs latches the first Status-columned table (out-of-contract input per D6; silent under-report if two Status tables coexist).
- **P3 (filed, backlog):** BACKLOG_STATUSES "drift guard" is a value-lock, not a cross-file guard (single-source; redundant source-regex half).

## Finishing

- Fresh test output: `test_lib.mjs` 59 passed / 0 failed; `test_onboard_bee.mjs` PASS, 0 failures, 0 skipped.
- P3s: 1 fixed, 2 filed to `.bee/backlog.jsonl` with feature traceability (non-blocking).
- No P1 → Gate 4 is "approve merge".
