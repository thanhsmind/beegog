# hardening-1-7-10 — plan

Mode: high-risk (flags: data-loss [archive], cross-platform [Windows], covered contracts change
[commandWindows contract test, NEEDS_REVISION test], proof replacement [test_claim_race negative
control]). Source of truth for lib edits: `skills/bee-hive/templates/` — `.bee/bin/` and rendered
trees sync at close-out (D9).

## Cells and waves

Wave A (parallel, disjoint files):
- **1710-1 ci-green** (D1) — `.github/workflows/windows.yml`, `scripts/run_verify.mjs`,
  `templates/tests/test_state.mjs`, `templates/tests/test_claims.mjs`, `scripts/test_claim_race.mjs`,
  chmod-skip in the affected suite. behavior_change: false (tests/CI only).
- **1710-2 lock-liveness** (D2) — `templates/lib/lock.mjs`, `scripts/test_store_lock.mjs`
  (+ live-holder-long-hold regression). behavior_change: true.
- **1710-4 archive-txn** (D4) — `templates/lib/cells.mjs`, `templates/tests/test_cells.mjs`.
  behavior_change: true.
- **1710-6 win-hook-root** (D6) — `hooks/catalog.mjs`, `skills/bee-hive/scripts/onboard_bee.mjs`,
  `hooks/test_hook_contracts.mjs`, regenerated `.codex/hooks.json`. behavior_change: true.

Wave B (parallel, after A):
- **1710-3 atomic-holds** (D3) — `templates/bee.mjs`, `templates/lib/worktree-holds.mjs`,
  heartbeat hook source, `scripts/test_worktree_holds_race.mjs`. behavior_change: true.
- **1710-5 session-bridge** (D5) — `templates/lib/claims.mjs`, session-init hook source,
  `templates/lib/recovery.mjs`, `templates/lib/perf.mjs`, `templates/tests/test_claims.mjs`,
  `templates/tests/test_recovery.mjs`. behavior_change: true. (After A: test_claims env-scrub
  from 1710-1 lands first.)
- **1710-8 origin-rewrite** (D8) — culprit suite + new regression test. behavior_change: false.

Wave C (serial, after B):
- **1710-7 judge-lifecycle** (D7) — `templates/lib/cells.mjs`, `templates/lib/dispatch-prepare.mjs`,
  `templates/tests/test_misc.mjs`. deps: 1710-4 (cells.mjs), 1710-5 (claims surface).
  behavior_change: true.

Close-out:
- **1710-9 close-out** (D9) — mirrors sync, render, manifest, full verify green + hermetic re-check.
  deps: all. behavior_change: false.

## Verification

Each cell verifies with its targeted suite(s) (recorded per cell); full-chain proof is 1710-9's
`node scripts/run_verify.mjs` green (plus `env -u CLAUDE_CODE_SESSION_ID -u BEE_SESSION_ID` re-run).
Goal-check semantic judge runs per capped behavior_change cell (builder sonnet, judge opus —
model independence).

## Feasibility notes (validated)

- D2: timer heartbeat rejected — spawnSync blocks the event loop, timers can't fire during the
  exact long hold we're protecting; pid-liveness probe works synchronously and locks are
  same-host by construction. HARD_STALE_MS ceiling guards pid reuse.
- D6: `node -e` with outer double / inner single quotes and no `$`/backtick/`%` is parseable
  identically under cmd.exe and PowerShell; the bootstrap is executable on POSIX so the contract
  test can actually run it from a nested cwd on Linux CI.
- D5: single-live-session adoption reuses the existing freshness predicate; the two-session case
  still refuses — matches the review's own release-gate scenario.
- D4: lock order `cells:<id>` → `cells-archive` with archive never taking `cells:<id>` is
  deadlock-free; `writeCell` is the single write funnel so the boundary check covers every mutator.
