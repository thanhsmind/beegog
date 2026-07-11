# Cell Report: codex-parity-1

**Status:** [DONE]

**Outcome:** Built `hooks/test_hook_contracts.mjs`, a process-spawn fixture
harness that runs all seven production wrappers (bee-session-init,
bee-prompt-context, bee-state-sync, bee-chain-nudge, bee-session-close,
bee-model-guard, bee-write-guard) as real child processes against malformed
stdin rows (empty/junk/null/array/object-cwd/missing-cwd/~2MB payload) plus
Codex event-output rows (PreCompact/SubagentStop/Stop advisory shape,
PreToolUse apply_patch deny shape), wired to the actual event→wrapper
matchers in `hooks/hooks.json`. `--baseline` mode ran against the CURRENT
unmodified wrappers and recorded 16 RED findings verbatim into
`reports/red-baseline.md` (decision D2, CONTEXT.md): 6 of 7 wrappers crash
with an uncaught TypeError on a top-level JSON `null` payload or a
non-string `cwd`; `bee-write-guard.mjs` silently allows an `apply_patch`
write targeting the unconditionally direct-edit-denied `.bee/state.json`;
`bee-chain-nudge.mjs`/`bee-session-close.mjs` emit plain-text prose instead
of a parseable JSON `systemMessage` for Codex advisories. This cell fixed
nothing — no production `hooks/*.mjs` wrapper was edited (verified via
`git diff --stat`).

**Files touched:** `hooks/test_hook_contracts.mjs`,
`docs/history/codex-runtime-parity/reports/red-baseline.md`

**Full trace/evidence:** `.bee/cells/codex-parity-1.json`
