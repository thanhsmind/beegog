# CONTEXT — cli-performance

**Feature slug:** `cli-performance` · **Date:** 2026-07-21 · **Source:** user report (CLI lệnh cả phút dưới load; run_verify chạy quá nhiều lần kể cả subagent; "không thể để CLI chậm hơn LLM suy nghĩ")

## Boundary

In scope: the measured hot paths of `bee status --json` (recovery block, review-candidates derivation), the verify-frequency policy in skill prose, and operational store hygiene (archiving) that shrinks every command's read set. Out of scope: rewriting storage tech (jsonl stays — GH #40 closed on this), node startup cost (~20-30ms floor per process), run_verify's internal suite speed (v1.7.7 already parallelized; GH #42 closed with the frequency-not-content answer).

## Measured evidence (profiling digest, 2026-07-21)

- `status --json` 613-619ms vs ~50ms module-load floor; other reads 56-68ms.
- Block 1: `detectCrashCandidates` ≈ **365ms** — `lastDurableSettlement` called once PER stale session (33×), each call re-reading+parsing `.bee/decisions.jsonl` (495KB/1240 lines) via `activeDecisions`, re-reading the capture queue, re-running `listCells` (recovery.mjs:171-190, call site :352). Transcript tail reads are bounded and fine (49ms total).
- Block 2: `deriveCandidateStatus` ≈ **212ms** — up to 2 `git` spawns per candidate×covering-session pair (reviews.mjs:400,410,423), 38 candidates × 6 sessions, zero caching of repeated `(head, ref)` pairs.
- Write-guard hook: 48-53ms/tool call, dominated by node cold-start, not its own I/O — floor accepted, out of scope.
- Verify frequency: full chain ~60s; mandated at baseline (1/session), per-cell worker green, **orchestrator re-run per behavior-change cell (swarming:125 — the multiplier)**, session finish, worktree merge. Observed ~30 full runs in one working day ≈ 30 min wall.
- Store growth: decisions.jsonl doubled in one day (tag events ×812 from backfill, including one accidental double-apply); active cells 49 with two closed features unarchived.

## Locked decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | **Read-once per call, never per item.** `detectCrashCandidates` computes its shared inputs (`activeDecisions`, capture queue, `listCells`) exactly once per invocation and threads them through; per-session work touches only per-session files. Behavior (candidates returned) byte-identical. | 33 re-reads of a 495KB file per status call is the whole bug; the fix is altitude, not micro-optimization. |
| D2 | **Cache repeated git answers within one derivation pass.** `buildReviewBlock`'s pass memoizes `headCoveredBy`/`commitsSince` by `(head, ref)`/`(ref)` for its duration — no cross-call cache, no TTL, derived state stays derived (same idiom as read-time derivation everywhere else). | Dozens of identical `git merge-base`/`rev-list` spawns per status call; a pass-local Map kills them without inventing a staleness story. |
| D3 | **Status hits a budget, enforced by a test.** After D1/D2, `status --json` on this repo's real store shape must come in under **250ms wall** (idle box); the suite asserts the structural fixes (call-count/spawn-count on fixtures), not wall-clock flakiness — plus one advisory wall-time print for humans. | The user's bar is "CLI never slower than the LLM"; sub-250ms idle keeps even loaded-box latency in low seconds instead of a minute. |
| D4 | **The verify ladder: targeted proof per cell, full chain per milestone.** A cell's `verify` command is its TARGETED suite (seconds). Full `run_verify` is mandated at exactly: session baseline (1×), wave close (1× by the orchestrator — replacing per-cell orchestrator re-runs for standard/high-risk), session finish (1×), release/merge gates (unchanged). Workers run their cell's targeted verify red-first and green; the worker's full-chain run is DROPPED (the orchestrator's wave-close run is the independent full proof). Judges never run the full chain. | The multiplier was policy, not code: worker full + orchestrator full per cell tripled a 60s cost ~5× per wave. One independent full chain per wave keeps the honesty (fresh, orchestrator-run, never the worker's word) at a fifth of the cost. |
| D5 | **Store hygiene is part of performance.** At feature close: archive terminal-feature cells (`cells archive`) and aged/superseded decisions (`decisions archive --before`), so every command's baseline read set stays small. The accidental duplicate tag events (406×2) are accepted (append-only, overlay-idempotent) but noted; tag-event compaction is a deferred idea, not built now. | decisions.jsonl doubled in a day; reads are O(store). The verbs exist (dp-3, v1.7.8) — using them routinely is the cheap half of performance. |

## Pinned terms

- **Targeted verify** — the cell's own suite command (seconds), as opposed to the full `run_verify` chain (~60s).
- **Wave-close run** — the orchestrator's single independent full `run_verify` after the last cell of a wave caps.
- **Pass-local cache** — a memo alive only for one derivation pass; never persisted, never TTL'd.

## Open questions (for planning)

- Whether `status` additionally skips the recovery block when the current session has a live heartbeat and no HANDOFF (candidate for a later tiny; not needed to hit D3's budget).
- Tag-event growth policy long-term (compaction/snapshot) — deferred idea.

## Deferred ideas

- `status --fast` / recovery-skip-when-live (only if D3's budget is ever missed again).
- Tag-event compaction (overlay snapshot) once tag events dominate the store.
- Write-guard hook startup tax (~50ms/tool-call floor) — would need a daemon/socket model, explicitly out of scope (D5 of decision-propagation: no daemon).

## Canonical references

- Profiling digest: docs/history/cli-performance/reports/profiling.md (to be committed from the gather output)
- GH #40/#42 closures (storage tech + verify content stay as-is; this feature is frequency + hot paths)
