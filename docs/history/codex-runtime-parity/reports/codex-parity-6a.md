# codex-parity-6a — Render the active Codex source-repo fallback from the shared catalog

**Status:** `[DONE]` · **Worker:** hookwright · **Lane:** high-risk · **Date:** 2026-07-12

## Outcome

The live Codex project fallback `.codex/hooks.json` is now **generated** from the shared
catalog at target `repo` — it resolves the git root from Codex's session cwd instead of the
Claude-only `$CLAUDE_PROJECT_DIR` that Codex never sets (the variable whose absence collapsed
every hook command to `node /.bee/bin/hooks/…` and killed it with `MODULE_NOT_FOUND`).

The contract runner was hardened **first**, before the fix landed, so the fix could not pass
without doing the work:

- **Strict argv** — an unknown flag now exits 2 naming the known modes. It previously exited 0
  printing `ALL PASS`, which would have let any verify naming an unimplemented mode pass green.
- **Required-row manifest** — row id `codex-repo-target-drift` is REQUIRED: **absent or skipped
  ⇒ non-zero exit**. Skip rows are built with `pass: true`, so a skipped row used to print
  `ALL PASS`. Both escape hatches were probed and proved to bite.

`--catalog-only` was **extended**, not rebuilt (it already existed from cell codex-parity-2).
The bare default suite went 71 → 73 rows, 0 skipped, 0 failing — the path everything else
depends on is intact.

The plugin target remains the renderer **default**: `hooks/hooks.json` and
`hooks/claude-hooks.json` are byte-identical to their pre-cell forms (hashes recorded, and the
verify pins the diff to ref `ba31819`, not HEAD).

## Files touched

- `hooks/catalog.mjs` — `renderProjection(runtime, { target })` / `renderProjectionText(runtime, { target })`,
  `TARGETS`, the pinned `REPO_TRANSPORT_UNAVAILABLE_DIAGNOSTIC`, and the repo transport renderer.
- `.codex/hooks.json` — regenerated; 9 commands, no Claude root variable, `--source=repo`.
- `hooks/test_hook_contracts.mjs` — strict argv, required-row manifest, and the two new
  repo-target rows (`codex-repo-target-drift`, `codex-repo-target-transport`).

## Verification

Cell verify (verbatim) is **GREEN (exit 0)**; the same command was **exit 1** before the cell.
Transport live-fired out of the generated file: the fix works with `CLAUDE_PROJECT_DIR` unset,
fail-open emits the pinned literal on **stderr** with **empty stdout** (non-git cwd *and* git
absent from PATH), and a deliberate deny still exits 2.

Full trace, `red_failure_evidence`, and `verification_evidence`: `.bee/cells/codex-parity-6a.json`.

## Gate 4 note

The 9 rewritten hook definitions change their `trusted_hash`. Per decision `d91a8398` they stay
dormant until the **human** re-trusts them in a fresh Codex thread. That is by design, not a
defect — trust state was never touched by this cell.
