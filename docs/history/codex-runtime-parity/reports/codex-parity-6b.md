# codex-parity-6b — Prove every configured Codex repo hook through the installed command route

**Status:** [DONE] · **Lane:** high-risk · **Worker:** routewright · **Date:** 2026-07-12

## Outcome

`hooks/test_hook_contracts.mjs` gained `--repo-route-only`: a real process-level harness that parses all
nine commands out of the **active** `.codex/hooks.json` and executes each command string **verbatim**
through `/bin/bash -lc` — the transport Codex actually uses — instead of calling the wrappers directly.
Every configured event/handler is exercised on four arms (fixture root cwd, nested cwd, non-git cwd, and
`git` **shimmed off the PATH** — the branch that reproduces the original `MODULE_NOT_FOUND`), inside a
throwaway git fixture whose root path carries spaces and Unicode, with `CLAUDE_PROJECT_DIR` /
`CLAUDE_PLUGIN_ROOT` unset and `HOME`/`CODEX_HOME` caged in the fixture.

RED was **observed**, not asserted: the same rows fed the pre-fix config at ref `ba31819` fail 39 of 47
(`MODULE_NOT_FOUND`, both Stop handlers dead, the write guard not guarding); they pass 46/46 against the
active config.

## Files touched

- `hooks/test_hook_contracts.mjs` (test-only; no runtime, config, wrapper, or manifest file was edited)

## Full trace, verification evidence, deviations

`.bee/cells/codex-parity-6b.json`

## Gate 4 still owed (not automatable)

Rewriting `.codex/hooks.json` invalidated the nine `trusted_hash` entries. A human must re-trust the hooks
in a fresh Codex thread (`/hooks` shows trusted rows + a clean Stop). The `bash -lc` pin means a non-POSIX
`$SHELL` (fish/nu) and native Windows remain declared coverage gaps, not proved.
