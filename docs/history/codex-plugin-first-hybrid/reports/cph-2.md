# cph-2 — done report (installer passthrough + E2E hooks-or-refusal)

Worker: cph2-worker (sonnet, isolated harness worktree, rebased onto main
720448f). Worker commit `991a03d`, merged into main as `8196e03`. 2026-07-18.

## What shipped
- `install.sh` + `install.ps1`: `--runtime "$RUNTIME"` threaded into
  ONBOARD_FLAGS unconditionally (all onboard_bee.mjs call sites — preview,
  apply, recheck); repo-copy branch verified a no-op today (runtime only gates
  `codexHybrid = pluginSource && runtimeCoversCodex`) and threaded for
  symmetry; stale "not threaded yet" comments corrected. Typed-blocked apply
  confirmed to abort via `handle_transition_failure → rollback_plugin`;
  failure messages on BOTH the onboarding-apply and DIST_HELPER-preflight
  paths now name the fixes (repo-copy, or clear the obstacle and retry
  hybrid). install.ps1 parity, with an in-code note that it has no plugin
  rollback machinery (pre-existing asymmetry, out of scope).
- E2E (`test_installers_e2e.mjs`, 3 new scenarios, suite now 19):
  (a) codex plugin-first → `.codex/hooks.json` carries all 8 lifecycle events
  incl. the spawn_agent PreToolUse matcher, vendored `.bee/bin/hooks/` has
  all 10 canonical handlers, no repo-local skill copies, and doctor reports
  `hooks_file_present: ok` with trust rows `unknown + blocking` (the expected
  codex-cli 0.144.4 shape).
  (b) `.codex` pre-created as a file → typed blocked refusal, plugin rolled
  back, never skills-only. Finding: the refusal fires from
  plugin_distribution's cleanup probe (raw ENOTDIR string) BEFORE
  onboarding's polished codexHookWriteBlocker message — still typed, still
  rolled back; curated-message follow-up filed to backlog.
  (c) claude plugin-first regression guard: stale claude hook entries still
  stripped; no codex files appear.

## Verification (fresh command output)
Independent orchestrator re-run on main after merge 8196e03: see
`.bee/workers/cph2-verify.log` — `test_installers_e2e (bash): 19 passed, 0
failed`; onboard_bee PASS failures 0; plugin_distribution 38/0; lib_mirror
4/4; manifest 354 match. (Tail recorded in the cell verify entry.)

## Deviations (accepted)
- Worker rebased its worktree onto main first (harness worktree was cut at
  the pre-cph-1 merge-base; clean fast-forward).
- Fix-options guidance extended to the DIST_HELPER preflight failure path
  (the path scenario (b) actually exercises).
- install.ps1 message parity without inventing rollback machinery it never had.
