# lcv3-4 — AGENTS.block.md template + root AGENTS.md re-render + README lane/flag tables (D6/D7/D10)

**Status:** [DONE]

**Outcome:** `skills/bee-hive/templates/AGENTS.block.md` and `README.md` now restate the same narrowed lane doctrine as the already-rewritten `skills/bee-hive/SKILL.md` (lcv3-2) — D7 narrowed flags, D6 product-files-only caps, D3/D4 tiny/small lane shapes, and the real D9 briefing fan-out (standard: on-demand; high-risk: always). The AGENTS.block.md docs/history tree note now states plan.md's D1 Gate-2 freeze and its D3/D4 per-lane conditionality instead of listing it as unconditionally present. Root `AGENTS.md` was re-rendered byte-identical via `onboard --apply`, which also refreshed the managed `.claude/skills` and `.agents/skills` roots to lcv3-1..3's already-committed source. Plugin skill trees and the release manifest were regenerated in the same commit.

**Files touched:** `skills/bee-hive/templates/AGENTS.block.md`, `AGENTS.md`, `README.md`, `scripts/test_gate_bypass_doctrine.mjs`, `.claude-plugin/skills/**`, `.codex-plugin/skills/**`, `.claude/skills/**`, `.agents/skills/**`, `.bee/onboarding.json`, `docs/history/codex-harness-hardening/release-manifest.json`, `docs/history/lane-ceremony-v3/reports/lcv3-4-red.txt`.

**RED evidence:** `docs/history/lane-ceremony-v3/reports/lcv3-4-red.txt` (16 failures recorded before the doctrine edit).

**Full trace/evidence:** `.bee/cells/lcv3-4.json`

**Verify:** `node scripts/test_agents_budget.mjs && node scripts/test_gate_bypass_doctrine.mjs && node scripts/release_manifest.mjs --check` — passed.

**Commit:** `bfec381` — `docs(lcv3-4): AGENTS.block.md + README doctrine rewrite for D6/D7/D9/D10 [lcv3-4]`
