# pah-2 — H2 cells add/update advisory manifest lint

**Status:** [DONE]

**Outcome:** `handleCellsAdd`/`handleCellsUpdate` in `bee.mjs` now call a new `manifestLintWarning(cell)` after every successful write, printing a stderr `WARNING:` line (uniform across `--json` and text output, decoupled from stdout's result shape) when the written/merged cell's `verify` mentions `release_manifest` but `files` omits `docs/history/codex-harness-hardening/release-manifest.json`. Never refuses, never changes the exit code. `cells update` lints the MERGED cell (post-`updateCell`), so a patch that only touches an unrelated field still catches a pre-existing trap shape. Malformed shapes (missing/non-string verify, missing/non-array files) return `null` silently — never throw.

**Files touched:**
- `skills/bee-hive/templates/bee.mjs`
- `.bee/bin/bee.mjs` (mirror)
- `skills/bee-hive/templates/tests/test_bee_cli.mjs`
- `.claude/skills/bee-hive/templates/tests/test_bee_cli.mjs` (mirror)
- `.agents/skills/bee-hive/templates/tests/test_bee_cli.mjs` (mirror)
- `docs/history/codex-harness-hardening/release-manifest.json` (via `--write`)

**Test coverage added:** 4 pure-logic unit rows for `manifestLintWarning()` (trap fires, manifest-listed silent, unrelated-verify silent, malformed shapes never throw) + 5 through-the-dispatcher rows exercising `bee cells add`/`bee cells update` on a fixture separate from the existing `demo-2` lifecycle chain (WARNING fires on both add and update's merged-cell path, stays silent when the manifest is listed or verify is unrelated, write always exits 0).

Full trace/evidence (including the `verification_evidence` object and pre-change absence check): `.bee/cells/pah-2.json`.

**Commit:** `c757692` — "feat(pah-2): advisory release-manifest lint on cells add/update"
