# harness-integration-4 — Vendor `bee.mjs` via onboarding and document the new CLI surface

**Status:** [DONE]
**Worker:** worker-w4

**Outcome:** Confirmed the corrected premise from validating iteration 1 (Blocker 5) with a manual scratch-repo check, zero code changes: `onboard_bee.mjs`'s `listTemplateHelpers()`/`listTemplateLibModules()` already auto-discover every `.mjs` file under `skills/bee-hive/templates/` and `templates/lib/` via a generic `readdirSync` scan, so `bee.mjs`, `command-registry.mjs`, and `validate-args.mjs` (built by cells harness-integration-1/-2) are already vendored and hash-tracked with no `onboard_bee.mjs` edit. Updated `skills/bee-hive/templates/AGENTS.block.md`'s bootstrap block to reference `node .bee/bin/bee.mjs --help --json` as an optional discovery aid (framed per D6: an MCP wrapper and a mandatory every-session discovery call were considered and explicitly deferred, not "replaced," since no such mandatory mechanism existed before). Documented the unified CLI dispatcher, the D3 manifest shape, and the manifest content-hash drift-tracking behavior in `docs/02-architecture.md` (new subsection under Vendored helpers) and `docs/07-contracts.md` (lib API entries for `command-registry.mjs`/`validate-args.mjs`, a `bee.mjs` block in the Helper CLI surface, the write-guard hook contract row, and `.bee/manifest-hash.json` in Runtime files).

**Files touched:**
- `skills/bee-hive/templates/AGENTS.block.md`
- `docs/02-architecture.md`
- `docs/07-contracts.md`

**Verify:** `node skills/bee-hive/scripts/test_onboard_bee.mjs` — PASS, 0 failures, 1 pre-existing environment-gated skip.

**Deviations:** none — no `onboard_bee.mjs` code change was made or needed, per the cell's own prohibition.

Full trace/evidence: `.bee/cells/harness-integration-4.json`.
