# hardening-8

**[DONE]** — Hermetic verify + release hygiene: config overlay, E2E env seal, loud canary skip.

## 1. Machine-local config overlay

- `.bee/config.json` (tracked) carried this machine's `dogfood_repos` absolute path (`/home/thanhsmind/projects/anphabe/anphabe-gogl`) — scrubbed from the tracked file.
- `readConfig` (`state.mjs`) now deep-merges a gitignored `.bee/config.local.json` sibling OVER the tracked config: overlay wins per key, absent overlay is byte-identical to today (D4 zero-overlay parity, proven by test), and arrays REPLACE wholesale (never concatenated/interleaved) — verified with a dedicated `dogfood_repos` array-replace row. New export `mergeConfigOverlay` (pure, base never mutated) and `localConfigPath`.
- This machine's `.bee/config.local.json` (untracked, gitignored) now carries the same `dogfood_repos` entry, so local behavior is unchanged.
- `bee config set|get|unset --key ... --local` redirects to `.bee/config.local.json` instead of the tracked file; omitting `--local` is exactly today's behavior. The models-config cli-safety guard (`refuseIfNewConfigProblem`) only applies to the tracked file — an overlay write skips it (the overlay is for machine-local values like `dogfood_repos`, not model/cli wiring).
- **Bug caught while wiring `--local`:** the CLI's bare-boolean-flag allowlist (`FLAG_ALONE_BOOLEANS`) did not include `local`, so `--local` silently consumed the NEXT token (`--json`) as its own value instead of becoming `true` — the write landed in the tracked file with no error. Fixed by adding `'local'` to `FLAG_ALONE_BOOLEANS`. Proven RED (removing it from the set reproduces the silent-wrong-file bug — the test then fails on a JSON-parse error because `--json` never took effect either) then GREEN.
- `.bee/config.local.json` added to the onboarding gitignore block (`GITIGNORE_BLOCK_PATTERNS`, `onboard_bee.mjs`) and to this repo's own `.gitignore`; the hand-kept duplicate list in `test_onboard_bee.mjs` (`GITIGNORE_PATTERNS_FOR_HASH`) updated to match.

## 2. Installers E2E env seal

- `test_installers_e2e.mjs`'s `assertVersionParity` (status + onboard up_to_date recheck) and the codex-plugin-first `doctor` check ran their `execFileSync`/`spawnSync` calls with NO explicit `env` — node child_process semantics mean that inherits the REAL outer process environment (real `HOME`/`CODEX_HOME`/`PATH`), silently reopening the isolation this suite's own header promises for every call the actual `install.sh` run already seals.
- Extracted the sandbox env construction into one `sandboxEnv(sb, opts)` helper (used by `run()` too, unchanged behavior there) and now pass `env: sandboxEnv(sb)` explicitly on all three post-install verification call sites.
- Regression guard added: a static source-level check (mirrors the existing `install.ps1` sparse-checkout guard already in this file) asserts each of the three call sites carries `env: sandboxEnv(`. Proven RED (call sites had no `env:` — assertion failed) then GREEN.
- Full suite: 23/23 passed (was 22 before the new guard).

## 3. Loud canary skip

- `scripts/canary_codex.mjs`'s two no-codex-binary skip paths (default mode and `--probe`) now print a machine-greppable marker line before the existing human-readable message — `CANARY_SKIP reason=no-codex-binary mode=default` / `mode=probe`. Exit code unchanged (0) in both cases; `--probe-selftest` (never touches codex) is untouched and prints no marker.
- `scripts/run_verify.mjs` gained a general, reusable convention: `SKIP_MARKER_RE` / `skipNote(stdout)` — any discovered suite may opt in by printing a `CANARY_SKIP <reason>` line; the summary loop now annotates that suite's `PASS` line with `[SKIPPED: <reason>]` instead of silently folding a self-skip into an ordinary green result. Exit codes are never touched by this — only the printed line changes.
- **Deliberately did NOT** add `scripts/canary_codex.mjs` itself to `run_verify.mjs`'s mandatory suite list: this dev machine has a real `codex` binary on `PATH` (`/home/thanhsmind/.local/bin/codex`), so canary's default mode would attempt LIVE `codex exec` calls (network, auth, real cost) inside the mandatory baseline-gate command — exactly the risk `canary.yml` was deliberately split out to avoid (`Deliberately NOT a push/PR gate`, per that workflow's own header). Wiring it in unconditionally (or even conditionally-on-absent-codex) would change `commands.verify`'s cost/determinism profile on any codex-equipped machine, which is outside this cell's authorized scope.
- Instead, added `scripts/test_run_verify_skip_marker.mjs` (auto-discovered by `run_verify.mjs`'s own `test_*.mjs` glob under `scripts/`) proving: (a) `skipNote`/`SKIP_MARKER_RE` unit behavior including the line-start anchor (no bare-substring false positive); (b) a synthetic self-skipping suite run through `run_verify.mjs`'s own exported `runOne()` is captured with an intact exit code 0 and a recoverable reason; (c) the CONCRETE instance — `canary_codex.mjs` default mode and `--probe`, invoked with a `codex`-free `PATH`, both print the marker and exit 0; `--probe-selftest` prints no marker. 7/7 passed.

## 4. No-repro closures (recorded per the cell action, no code change)

- **Node-24 timeout-worker instability:** no repo tie to Node 24 found. `run-module-worker.mjs`-based suites (`test_split_brain_regression.mjs`, others importing `runModuleWorker`) ran green across repeated invocations in this session on Node v24.14.1 (this repo's live runtime — `node --version` = v24.14.1). No flaky timeout observed for any run-module-worker suite during this cell's work; treated as no-repro on this machine/runtime combination.
- **Windows installer E2E:** deferred, needs a real Windows runner — `test_installers_e2e.mjs` only proves the Bash installer in this slice (its own header: "Only the Bash installer is proven by this cell; PowerShell is a later release slice"); unchanged by this cell.

## Evidence

- `node scripts/test_installers_e2e.mjs --installer bash`: 23 passed, 0 failed (RED→GREEN proven for the new env-seal guard by temporarily removing the `env:` option and re-running).
- `node skills/bee-hive/templates/tests/test_state.mjs`: 31 passed, 0 failed, including 5 new `readConfig`/`mergeConfigOverlay` overlay rows (RED proven via `git stash` of `state.mjs` — `SyntaxError: … does not provide an export named 'localConfigPath'` — then restored/GREEN).
- `node skills/bee-hive/scripts/test_onboard_bee.mjs`: 0 failures, 1 skipped (pre-existing, unrelated to this cell).
- `node scripts/test_run_verify_skip_marker.mjs`: 7 passed, 0 failed.
- `node skills/bee-hive/templates/tests/test_bee_cli.mjs`: 221 passed, 0 failed, including the new `--local` round-trip row (RED→GREEN proven by temporarily removing `'local'` from `FLAG_ALONE_BOOLEANS`).
- `node scripts/release_manifest.mjs --write` then `--check`: 411 files match.
- `node scripts/render_plugin_skill_trees.mjs`: `.claude-plugin/skills` and `.codex-plugin/skills` re-rendered (120 files each) to pick up the canonical `skills/bee-hive/**` edits (`state.mjs`, `bee.mjs`, `test_state.mjs`, `onboard_bee.mjs`, `test_onboard_bee.mjs`).
- Full `node scripts/run_verify.mjs`: see cell trace for the final foreground run's exit code and any WSL2-flake reruns.

Files touched: `skills/bee-hive/templates/lib/state.mjs`, `.bee/bin/lib/state.mjs`, `skills/bee-hive/templates/bee.mjs`, `.bee/bin/bee.mjs`, `skills/bee-hive/templates/tests/test_state.mjs`, `skills/bee-hive/templates/tests/test_bee_cli.mjs`, `skills/bee-hive/scripts/onboard_bee.mjs`, `skills/bee-hive/scripts/test_onboard_bee.mjs`, `scripts/test_installers_e2e.mjs`, `scripts/canary_codex.mjs`, `scripts/run_verify.mjs`, `scripts/test_run_verify_skip_marker.mjs` (new), `.bee/config.json`, `.bee/config.local.json` (new, untracked/gitignored), `.gitignore`. Plugin skill trees re-rendered (`.claude-plugin/skills/bee-hive/**`, `.codex-plugin/skills/bee-hive/**` + both `.bee-render.json` sidecars) and the release manifest regenerated to pick up every canonical change.

Full trace/evidence: `.bee/cells/hardening-8.json`.
