# cph-1 — done report (hybrid codex plugin-first onboarding core)

Worker: cph1-worker (sonnet, isolated harness worktree). Worker commit
`82b7684`, merged into main as `720448f`. 2026-07-18.

## What shipped
- `onboard_bee.mjs`: `--runtime claude|codex|both` flag (default both); hoisted
  codex-hybrid write path (fires on `--plugin-source` + runtime covering
  codex, from the PASSED flag only — never recorded state): vendors
  `.bee/bin/hooks/` + merges `.codex/hooks.json`; typed
  `{status:'blocked', reason, forceable:false}` preflight for filesystem
  collisions (fail-closed — skills never reported applied without hooks);
  `codex_hooks` managed-set key gated on `runtime∈{codex,both} &&
  pluginSource` (claude-only installs report no codex drift);
  `repoHooksTransitionNotices` surfaces a superseded sticky repo-hooks record
  instead of silently dropping it.
- `plugin_distribution.mjs`: `codexHybrid` param (default false = byte-
  identical legacy) exempting `.codex/hooks.json` from the plugin-first
  cleanup — closes the advisor-R1 self-erasure loop. Never inferred from the
  `runtimes` param (different axis); always caller-supplied; CLI flag
  `--codex-hybrid`.
- `install.sh` + `install.ps1`: thread `--codex-hybrid` into the distribution
  helper cleanup call under plugin-first + codex coverage (mid-task scope
  extension, orchestrator-approved: the one missing wire that closed the
  self-erasure loop the existing E2E scenario actually exercises; Windows
  patched for parity to avoid shipping the same bug there).
- 4 mirrors byte-identical, rendered trees regenerated, manifest regenerated.

## Verification (fresh command output)
Independent orchestrator re-run on main after merge 720448f:

```
node skills/bee-hive/scripts/test_onboard_bee.mjs        -> PASS, failures: 0
node skills/bee-hive/scripts/test_plugin_distribution.mjs -> 38 passed, 0 failed
node scripts/test_lib_mirror.mjs                          -> 4/4 PASS
node scripts/release_manifest.mjs --check                 -> 354 file(s) match
node scripts/test_installers_e2e.mjs --installer bash     -> 16 passed, 0 failed
```

## Deviations (accepted)
- Mid-task E2E regression surfaced the unwired cleanup flag; resolved by the
  approved one-line (per installer) wire instead of relaxing the test.
- install.ps1 parity added unrequested (symmetric; prevents the same
  self-erasure on Windows).
- Worker unbound its stale session-lane binding to unblock its local write
  guard — worktree-infra quirk, filed as an observation, no state damage.
