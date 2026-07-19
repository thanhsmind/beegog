# lcv3-1 — bee-planning core rewrite

**Status:** [DONE]

**Outcome:** bee-planning doctrine rewritten to the v3 lane ceremony — intake-classification-first mode gate then lane-scaled bootstrap (D8), product-files-only caps (D6) + two narrowed risk flags (D7), lane-scaled shape (tiny = request + one cell / no plan.md — D3; small = logged scoping synthesis + 1–3 cells, plan.md opt-in — D4; standard/high-risk plan.md frozen at Gate 2, approval stamp only, `artifact_readiness` mutation removed — D1), and preview-before-persist merged-gate ordering (D5). RED-first: 7 new doctrine assertions failed against the old text, green after the rewrite.

**Files touched:**
- `skills/bee-planning/SKILL.md` — §1 Intake & Mode Gate (D6/D7/D8), §2 Lane-scaled bootstrap (D8), §5 lane-scaled shape + plan freeze (D1/D3/D4), §5 merged gate preview-before-persist (D5), §6 Prep (no enrichment), Headless + Red Flags aligned. `gate_bypass_level`/`full` tokens, banned-phrase bans, phase-enum sentence, AO14 single-execution-worker handoff, and Scope-Reduction Prohibition preserved.
- `skills/bee-planning/references/planning-reference.md` — fan-out table (tiny none / small opt-in), plan.md template frontmatter (freeze, no `artifact_readiness`), removed implementation-ready markers + current-slice sections (D2), shape-bodies-by-mode, trace-of-shapes = `mode -> shape (plan.md, frozen at Gate 2) -> cells`.
- `scripts/test_gate_bypass_doctrine.mjs` — added the lane-ceremony-v3 assertion block (RED-first).
- `.claude-plugin/skills/**`, `.codex-plugin/skills/**` — re-rendered (105 files each) in-cell.
- `docs/history/codex-harness-hardening/release-manifest.json` — regenerated (362 files) in-cell.

**RED evidence:** `docs/history/lane-ceremony-v3/reports/lcv3-1-red.txt` (7 FAILs before the rewrite).

**Verify:** `node scripts/test_gate_bypass_doctrine.mjs && node scripts/release_manifest.mjs --check` — PASS, 0 failures, manifest 362/362 match.

Full trace and behavior-change evidence: `.bee/cells/lcv3-1.json`.
