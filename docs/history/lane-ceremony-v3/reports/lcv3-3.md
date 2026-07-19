# lcv3-3 — Chain skills: validating gate-in per D1/D2, briefing drift per D9, swarming worker-prompt cites cell for tiny

**Status:** [DONE]

**Outcome:** Rewrote `bee-validating/SKILL.md`'s Required Inputs to gate in on the plan approved+frozen at Gate 2 (D1) plus current-slice cells existing (D2), replacing the retired `artifact_readiness` field, while preserving the refusal to bee-planning when the plan is unapproved or cells are missing. Rewrote `bee-briefing/SKILL.md`'s drift rule to fire on cell changes only (D9, since D1 freezes plan.md after approval) and aligned the small-lane brief row to D4. Rewrote `bee-swarming/SKILL.md`'s worker-prompt line to cite the cell for tiny/small (no plan.md, D3/D4) and its completion wording to name the next batch of cells (D2). RED-first: 6 new assertions added to `scripts/test_gate_bypass_doctrine.mjs`, recorded RED before the rewrite, GREEN after. Plugin trees + release manifest regenerated in the same cell.

**Files touched:** `skills/bee-validating/SKILL.md`, `skills/bee-briefing/SKILL.md`, `skills/bee-swarming/SKILL.md`, `scripts/test_gate_bypass_doctrine.mjs`, `.claude-plugin/skills/**` (rendered), `.codex-plugin/skills/**` (rendered), `docs/history/codex-harness-hardening/release-manifest.json`, `docs/history/lane-ceremony-v3/reports/lcv3-3-red.txt`

**Full trace and evidence:** `.bee/cells/lcv3-3.json`
