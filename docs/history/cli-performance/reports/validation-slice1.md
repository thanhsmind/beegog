# Validation — cli-performance slice 1 (cp-1..cp-3)

Date: 2026-07-21 · Lane: standard · Verdict: **READY** · Gate 3: auto-approved (bypass total, audit logged)

## Reality gate
- MODE FIT PASS (2 flags: covered-behavior refactor, multi-domain). REPO FIT PASS (all profiling anchors re-verified by checker; test_recovery 37/37 and test_reviews 35/35 exist and are green as baselines). ASSUMPTIONS PASS (injected-runner refactor feasible through existing opts param). SMALLER PATH PASS (no daemon, no cache stores, pass-local only). PROOF SURFACE PASS (structural call/spawn-count assertions on fixtures; wall-clock advisory only).

## Combined plan-check + cold-pickup (opus) — 1 BLOCKER, 1 WARNING, 2 MINOR → all resolved
- BLOCKER cp-2: memo born inside deriveCandidateStatus would be per-candidate (~zero reuse); must be born in bee.mjs's candidate loops (buildReviewBlock ~:252, buildReviewsStatusSummary ~:2458) and threaded via opts. → cp-2 files now include both bee.mjs mirrors; action rewritten with the threading architecture.
- WARNING plan.md:32 serialization rationale ("share bee.mjs mirrors") was wrong for cp-1 (recovery.mjs-contained). Plan is frozen (D1) — correction recorded HERE: cp-1 and cp-2 share no source file; serialization is kept for the shared render/manifest pipeline only.
- MINOR: cell verify fields carried the pre-D4 full-chain pattern → all three now targeted-only (cp-1 test_recovery, cp-2 test_reviews, cp-3 manifest --check); the orchestrator runs ONE full chain at wave close per D4 — this wave dogfoods its own policy.
- MINOR: D5 close-out ops (cells/decisions archive) are un-celled data mutations → accepted; close report must record the commands + before/after counts (already required by plan).
- D4 honesty verdict (checker, argued both ways): independent verification PRESERVED — per-cell targeted re-runs + judges + one orchestrator-run wave-close full chain + untouched session/merge/release full-chain sites; only per-cell full-chain granularity is traded for the ~5x cost cut.

## Schedule
cp-1 → cp-2 → cp-3 serial (render pipeline contention; deps recorded).
