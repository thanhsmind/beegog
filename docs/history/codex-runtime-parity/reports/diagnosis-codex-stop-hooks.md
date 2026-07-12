# Diagnosis: Codex project hooks exit 1 at Stop

**Date:** 2026-07-12
**Runtime:** Codex CLI 0.144.1
**Status:** Root cause confirmed; no hook-source fix applied yet

## Symptom

The trusted project hook source reports exactly two `Stop hook (failed)` rows,
each with `hook exited with code 1`.

## Causal chain

1. Codex loads the trusted project source `.codex/hooks.json`. It contains nine
   bee command hooks, including two commands under `Stop`.
2. Both Stop commands build their script path from `"$CLAUDE_PROJECT_DIR"`.
3. Codex project hooks do not provide that Claude-only project variable. Codex
   documents the session `cwd` as hook input and recommends resolving a
   project-local command from the git root. Compatibility variables are
   documented for plugin roots, not for a project root.
4. With the variable unset, the shell resolves each command to
   `/.bee/bin/hooks/<script>`.
5. Node cannot find either module and exits `1` before bee's fail-open wrapper
   logic can run. Since Codex launches matching command hooks concurrently, the
   two Stop handlers produce the two failures seen by the user.

## Reproduction and counterfactual

- Unset-root reproduction:
  `env -u CLAUDE_PROJECT_DIR bash -c 'node "$CLAUDE_PROJECT_DIR"/.bee/bin/hooks/bee-state-sync.mjs'`
  exits `1` with `Cannot find module '/.bee/bin/hooks/bee-state-sync.mjs'`.
- Setting `CLAUDE_PROJECT_DIR` to the repository makes both installed Stop
  commands exit `0`. This isolates path construction as the direct cause of
  the screenshot rather than handler business logic.
- Running the current source wrappers under `hooks/` exits `0`, proving the
  shared adapter path itself is viable.

## Latent second failure

The active config points at stale copies under `.bee/bin/hooks/`. The vendored
`bee-session-close.mjs` predates the shared adapter and can print plain text for
`Stop`; Codex requires JSON whenever a successful Stop hook writes stdout.
Changing only the environment variable would therefore expose an output-shape
failure next. The incident fix must route the active project source to the
current shared wrappers (or refresh a complete self-contained vendor set) and
exercise the installed command, not only the source module.

## Why tests were green

`hooks/test_hook_contracts.mjs` spawns `hooks/*.mjs` directly. It does not run
the commands Codex loads from `.codex/hooks.json`. The onboarding suite covers
Claude's `.claude/settings.json` fallback and even asserts
`$CLAUDE_PROJECT_DIR` there; it does not exercise the active Codex project
source. The test boundary therefore stopped one layer before the live defect.

## Runtime source check

- Project trust is enabled and all nine project-hook definitions have trusted
  hashes.
- No bee Codex plugin is installed or enabled. Removing `.codex/hooks.json`
  now would remove every bee hook, rather than switch safely to a plugin.
- A separate user-level SessionStart hook exists, but it is unrelated to bee
  and does not account for the two Stop failures.

## Fix boundary

This slice repairs the source-repository project fallback only: deterministically
render `.codex/hooks.json` from the shared Codex catalog, resolve commands from
the git root without Claude environment variables, and run the real installed
commands from root and nested working directories. It does not install or
migrate a global plugin, synchronize global skills, or implement the remaining
E2/E3/E4 work.

Official contract: [Codex hooks](https://learn.chatgpt.com/docs/hooks).
