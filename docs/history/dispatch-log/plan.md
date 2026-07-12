---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: tiny
---

# Plan — dispatch-log (P22)

**Feature slug:** dispatch-log
**Date:** 2026-07-11
**Backlog row:** P22 — every subagent dispatch audit-logged with its resolved model/tier.
**Source:** owner request 2026-07-11 ("cách 2" — the UI shows dispatch descriptions but never the model param; bee needs a durable record independent of description conventions).

## Discovery

L0 — the extension point is proven local code: `hooks/bee-model-guard.mjs` already parses every Agent/Task PreToolUse payload, resolves the repo root, checks `hookEnabled`, and classifies the transport (model param at :157, anchored marker at :160, deny at :172). It already appends JSONL to `.bee/logs/hooks.jsonl` via the `logDeny`/`logCrash` pattern — the same pattern carries the new dispatch log. Test harness `hooks/test_model_guard.mjs` has fixture repos + `readLastJsonl` ready to assert log lines.

## Mode Gate

Flags: 1 (existing covered behavior — the guard has a 357-line payload-table suite). 2 files, one direct task → **tiny**. The change is additive logging on paths the suite already pins; deny/allow semantics untouched.

## Approach

Add `logDispatch(root, entry)` (same fail-open try/catch shape as `logDeny`) writing to `.bee/logs/dispatch.jsonl`:
`{ts, tool, transport: "model-param"|"marker"|"bare-denied", model, tier, subagent_type, description}` (description truncated to 120 chars). Refactor `hasTierMarker` → `markerTier(toolInput)` returning the captured tier or null (regex already captures it). Call sites: the model-param return, the marker return, the deny branch. Hard rule preserved: a dispatch-log failure never changes the exit code — deny-only contract of decision 0023 untouched; this hook still never rewrites input.

RED-first: new test rows (model-param dispatch logs model; marker dispatch logs tier; bare deny logs bare-denied; disabled fixture logs nothing) added and run before the hook change — must fail; then implement; then green. Re-vendor `.bee/bin/hooks/bee-model-guard.mjs` (copy) after green.

## Verification

`node hooks/test_model_guard.mjs` (extended suite green) && `diff -q hooks/bee-model-guard.mjs .bee/bin/hooks/bee-model-guard.mjs` && `node skills/bee-hive/templates/tests/test_lib.mjs`.

## Reality check (tiny fast path)

- MODE FIT: 2 files, additive logging → tiny. PASS.
- REPO FIT: logDeny/logCrash pattern + readLastJsonl helper exist (`bee-model-guard.mjs:78`, `test_model_guard.mjs:116`). PASS.
- ASSUMPTIONS: vendored hook copy currently in sync (diff -q clean, verified). PASS.
- SMALLER PATH: none smaller — one cell, two files. PASS.
- PROOF SURFACE: extended payload-table suite is a real behavioral proof, not marker greps. PASS.

## Gate record

Merged Gate 2+3 (tiny) auto-approved under gate-bypass: "add fail-open dispatch logging to bee-model-guard + RED-first test rows, verified by the extended guard suite + vendor diff + test_lib."
