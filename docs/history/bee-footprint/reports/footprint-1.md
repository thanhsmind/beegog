# footprint-1 — Onboard-managed .gitignore block for machine-local .bee runtime files (D1)

**Status:** [DONE]

**Outcome:** Added a `.gitignore` managed-block stage (`create_gitignore_block` /
`append_gitignore_block` / `update_gitignore_block`) to `onboard_bee.mjs`'s
`computePlan`/`applyPlan`, mirroring the existing AGENTS.md marker-splice idiom
but with `# BEE:START` / `# BEE:END` gitignore-comment markers and the D1
machine-local pattern list. `onboarding.json` now tracks a `gitignore_block`
sha256 alongside `agents_block` for drift detection.

**Files touched:**
- `skills/bee-hive/scripts/onboard_bee.mjs`
- `skills/bee-hive/scripts/test_onboard_bee.mjs`

**Verification:** RED-first — new tests run against the pre-change script
failed (missing plan action, ENOENT on the never-created `.gitignore`).
GREEN after implementation: `node skills/bee-hive/scripts/test_onboard_bee.mjs
&& node skills/bee-hive/templates/tests/test_lib.mjs` exits 0. Full trace and
evidence: `.bee/cells/footprint-1.json`.
