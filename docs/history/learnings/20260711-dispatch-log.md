---
date: 2026-07-11
feature: dispatch-log
categories: [pattern, failure]
severity: standard
tags: [hooks, audit-log, test-isolation, fail-open, process-cwd]
---

# Learning: Observability rides the guard that already sees everything — and cwd-fallback tests leak into the real repo

**Category:** pattern + failure
**Severity:** standard
**Tags:** [hooks, audit-log, test-isolation, fail-open]
**Applicable-when:** adding observability to a hook; writing tests that exercise a `process.cwd()` fallback; building anything downstream of `.bee/logs/dispatch.jsonl`.

## What Happened

P22 added a dispatch audit log to `bee-model-guard`: one fail-open JSONL line per evaluated Agent/Task dispatch (`transport` model-param/marker/bare-denied, model, tier, subagent_type, description ≤120). RED-first (4 failing rows), green in one pass, live-fired the same session — the three compounding analyst dispatches appeared in the log with their models. Two incidents:

1. The write-guard denied the feature's first source edit because the orchestrator claimed the cell while `.bee/state.json` was still `phase: idle` — plan and cell are data-layer writes, nothing forces the phase flip before the first source edit.
2. Self-inspection of the live log found pollution: test row17 exercises the hook's cwd fallback (`cwd` non-string → `process.cwd()`), and `runHookRaw` spawned without a `cwd` option — so the fallback resolved to the real repo and each suite run appended a real `dispatch.jsonl` line, violating the suite's own isolation promise. Fixed same session (cell 2): spawn cwd pinned to a fixture, with a fixture-side log assertion.

## Root Cause

1. "Cell claimed ⇒ phase ≠ idle" is an invariant no step enforces atomically; the guard caught it, cheaply, as designed.
2. A test that *deliberately* triggers a cwd fallback inherits the runner's cwd unless the spawn pins one — the leak only became observable once the hook started writing per-dispatch (the deny-only era never logged on row17's allow path).

## Recommendation

- **Put new observability in the choke point that already sees the traffic** — the guard hook already parsed every dispatch and owned the fail-open JSONL pattern; the whole feature was one function and three call sites. Check for an existing choke point before adding a new hook/wrapper.
- **Any test that exercises a cwd/env fallback pins the child's cwd to a fixture** (`spawnSync(..., {cwd: fixtureRoot})`) and asserts the side effect landed fixture-side. A fallback test without a pinned cwd is sampling whatever directory CI runs from.
- **When starting a feature, flip `.bee/state.json` out of `idle` in the same step that claims the first cell** — before the first source edit, or the write-guard (correctly) blocks it.
- The dispatch log is **fail-open best-effort** — a failed write drops the line silently rather than blocking the dispatch. Nothing downstream may assume 100% capture.

## Known gap (filed as friction)

The fail-open guarantee itself is asserted by comment, not test — no row forces the log write to throw (e.g., `.bee/logs` as a file) and asserts the exit code is unchanged. Pre-existing gap shared with `logDeny`/`logCrash`.
