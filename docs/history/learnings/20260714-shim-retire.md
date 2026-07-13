---
date: 2026-07-14
feature: shim-retire
categories: [failure, process, testing]
severity: medium
tags: [test-fixtures, fail-open, compat-surface, docs-drift, planning-anchors]
---

# Learnings — shim-retire (bee.mjs becomes the only shipped CLI)

## What Happened

Owner directive: dispatcher-unify had merged all 9 helper scripts into `bee.mjs`
but kept the shims as a "compatibility net" — and AGENTS.md/skills prose kept
teaching the shim names as canonical, so agents kept using them. This feature
deleted the 9 shims, added an onboarding `remove_helper` retirement pass
(onboarding only ever *copied*; nothing ever deleted a vendored file the
templates dropped), swept every living doc/skill/test/installer surface, and
kept the write-guard's legacy-shape regex as an explicitly expiring transition
guard. 6 cells, all green (test_lib 292/0, test_bee_cli 116/0, both hook suites,
onboard suite), self-onboard of this repo proved the removal end-to-end.

## Root Cause (of the debt this feature paid down)

A compat net with no removal trigger, plus docs that still taught the old
surface, made the old surface the *default* path — the net cost nothing
technically (no runtime spawned a shim) but cost a full second feature
behaviorally.

## Findings

1. **Two hardcoded fixture module lists rotted independently and fail-opened the
   write guard in tests.** `test_bee_write_guard_hook.mjs` `VENDORED_LIB_MODULES`
   (missing `claims.mjs`/`backlog.mjs`) and `test_write_guard.mjs` `copyLib`
   (4-file list, missing `claims.mjs`) both crashed the hook at import inside
   fixtures; the hook's fail-open turned that into "every row passes". Fixed by
   deriving the list via `readdirSync` of the real lib dir (as
   `test_hook_contracts.mjs` already did). Promoted to critical-patterns.
2. **A compat surface without an expiry becomes doc-drift debt.** dispatcher-unify
   kept shims "in case" with no removal trigger; only owner friction forced the
   cleanup. Contrast: this feature's own transition guard (`LEGACY_HELPER_RE`)
   shipped WITH a filed P3 removal debt item — same tradeoff, explicit exit ramp.
3. **Line-number anchors for repeatable patterns mislead sweeps.** The plan's
   "~1052-1101 parity section" was actually scattered checks through ~1225, and
   test_lib's shim spawns were whole sections (~3325-4080, 5658-5852, 6226-6830).
   Validation (opus plan-checker) caught it; the fix was callsite-keyed
   instructions (`runScript(BEE_*)` = delete, `runBee`-only = keep) instead of
   ranges. When a plan cites line anchors for a pattern that repeats, grep-verify
   completeness before dispatch.
4. **Area-sliced cells under-represent coupling through shared fixtures.** Two
   validation blockers (B3: a test assertion pinning AGENTS-block text owned by a
   sibling cell; B4: hook tests reading the stale vendored lib until the closing
   self-onboard) were couplings none of the "logical area" boundaries showed.
   B4 then flipped mid-flight when cell 1's self-hosting byte-parity guard forced
   an early vendor sync — the orchestrator had to re-route the assertion flip
   from cell 6 to cell 3 between waves. When a cell syncs a shared
   source-of-truth artifact, name every downstream cell that opens at RED
   because of it.
5. **Deleted parity checks got a one-for-one replacement accounting for only 2
   of 7.** The other 5 (status --json/text, reservations list, decisions active)
   are exercised by surviving `runBee` functional checks, but no explicit
   per-check audit was recorded — filed as a P3 follow-up audit rather than
   assumed covered.

## Recommendations

- When a test fixture must mirror a runtime file set, derive it programmatically
  (readdir the real directory); never hand-enumerate. (Critical-promoted.)
- When shipping any compat/transition surface, file its removal as backlog debt
  in the same feature — an "in case" net with no expiry is planned drift.
- When deleting a check because its comparison target is retired, record a
  one-for-one accounting: cite the surviving assertion of the same behavior, or
  flag a real coverage loss.
- When a plan anchors a sweep to line ranges, grep-verify the anchor list is
  exhaustive before dispatching a worker on it.
