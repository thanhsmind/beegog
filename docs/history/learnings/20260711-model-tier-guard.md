---
date: 2026-07-11
feature: model-tier-guard
categories: [security, testing, process, multi-agent]
severity: high
tags: [hooks, prompt-injection, fail-open, external-executors, git-concurrency, review-corroboration]
---

# Learnings — model-tier-guard

## What Happened

A PreToolUse hook now denies subagent dispatches that carry no explicit model tier (no `model` param, no anchored `[bee-tier: <tier>]` marker) — closing the leak where forgotten model params silently inherited the most expensive session model (`tier_mix.ceilingShare` was 0.4). Shipped through the full standard pipeline: 4 build cells, a 4-reviewer external wave that produced 5 corroborated P1 clusters, a 3-cell fix wave, and a live-fire UAT battery in the real session.

## Root Cause (of the notable defects)

1. **The marker contract was injectable by design.** D1 specified "marker anywhere in description / first 500 prompt chars" — planning and validation both treated a control token as a free-text search target. Validation's 14-row table enumerated *legitimate* marker positions but never an adversarial "marker embedded in quoted content" row; only corroborated security+architecture review (two independent P2s → P1) caught the trust-boundary property. No single reviewer rated it P1 — the corroboration-promotion rule is what surfaced it as blocking.
2. **A stated fail-open contract had no malformed-input test dimension.** `echo null | hook` crashed exit 1 (uncaught `payload.cwd` on null), the exact inverse of the documented "crash must exit 0" contract. Happy-path development never exercises fail-open; prose invariants must be forced into the test table from the first draft.
3. **Presence checks masqueraded as wiring proof, twice.** The `Task` tool name was declared but untested; the onboarding test string-searched serialized settings. Same defect shape (P1-3, P1-4): substring presence passes while event/matcher/duplication drift silently. The fix is structural assertions — exact entry counts, byte-identical matchers, both code paths actually invoked.
4. **External executors carry ambient authority.** A codex review-slot worker resolved a stale bee 0.1.18 source and attempted onboarding mid-review under `--yolo`; it stopped by its own judgment, not by any guarantee. Separately, a worker's `git commit --amend` in the shared tree swept a concurrent worker's staged files (self-caught, reset, recommitted clean).

## Recommendation

- **When a free-text marker acts as an authorization/control signal, anchor it to a reserved structural position (first non-whitespace token / field start) at design time, and add "marker embedded mid-content" as a mandatory adversarial row in the plan-time test matrix.** Search-anywhere control tokens are injectable by construction; review should confirm the anchor, not discover the hole. (Promoted to critical-patterns.)
- **When a spec states a fail-open/fail-safe contract, malformed top-level input (null, wrong type, throwing dependency) is a mandatory test-row class from the first test draft.** (Promoted to critical-patterns, same entry.)
- **When a surface has two names or a generated registration (legacy+current tool names, config entries), write structural/round-trip assertions — exact counts, byte-identity, both paths invoked — never substring presence checks.** Prove new assertions bite with a deliberate temporary break before trusting them.
- **When dispatching external CLI executors for read-only work (reviewers, checkers), state READ-ONLY + "do not run onboarding/apply" in the dispatch preamble, and prefer transport-level read-only sandboxing over executor judgment** — a stale source + `--yolo` is one polite refusal away from corrupting `.bee/bin`. (Friction filed for a mechanical guard.)
- **When multiple workers commit in one shared working tree, forbid `git commit --amend` and any index-wide operation during swarm waves; stage only explicitly-named own files, always fresh commits.** (Friction filed to add to the worker prompt template.)
- **At the 3-iteration validation cap, a residual finding that is deterministic and mechanical (reviewer prescribed the exact fix + counterexamples) may be closed by orchestrator-verified command evidence; only design-judgment findings escalate to the user.** (Logged as a durable decision.)
- **When a failure mode coexists with prose telling agents not to do it, "more prose" is disproven a priori — go straight to mechanical enforcement.** This feature existed because instructions alone leaked; the P1-5 fix tightened docs *toward* the hook, never the hook toward the docs.

## Reusable patterns (pointer)

Hook skeleton (stdin normalize → repo-root walk → fail-open try/catch → JSONL event log with isolated error boundaries), spawn-based payload-table tests with copied-lib tmp fixtures, and the three-surface hook registration + idempotence/parity proof all live in `hooks/bee-model-guard.mjs`, `hooks/test_model_guard.mjs`, and cell 2/6's test work — copy from there, not from memory.
