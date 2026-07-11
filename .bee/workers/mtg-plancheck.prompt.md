# Adversarial plan check — feature model-tier-guard

You are an adversarial plan checker. Assume the plan is flawed until proven otherwise.
Work from the repository root. Read ONLY these inputs (read budget: these files + the
specific source lines they cite; output cap ~120 lines):

- docs/history/model-tier-guard/plan.md (CONTEXT is folded into its "Scoping synthesis" section — there is no separate CONTEXT.md for this feature; treat the Locked decisions D1–D4 there as the locked decision set)
- .bee/cells/model-tier-guard-1.json … model-tier-guard-4.json
- For citations the cells make: hooks/hooks.json, skills/bee-hive/scripts/onboard_bee.mjs (lines 40–60 and 945–1005), skills/bee-hive/scripts/test_onboard_bee.mjs (lines 380–420), hooks/bee-chain-nudge.mjs, hooks/bee-write-guard.mjs

Verify exactly 5 dimensions:
1. Requirement/decision coverage — every locked decision D1–D4 lands in at least one cell.
2. Cell completeness — each cell has files, read_first, directive action, must_haves, and a runnable verify.
3. Dependency correctness — deps form a DAG; no cell depends on a future slice.
4. Key links — integration points named in plan.md are owned by a specific cell.
5. Scope sanity — no cell is doing hidden architecture work or exceeds its lane.

Report every finding as BLOCKER (structurally unsound) or WARNING (survivable, note it).
Do not propose redesigns. Do not soften findings. Quote file/cell evidence per finding.

As your LAST act, write your full report to `.bee/workers/mtg-plancheck.result.md` with a
first line `OUTCOME: done` (or `OUTCOME: blocked` + reason if you could not complete),
then sections BLOCKERS / WARNINGS / EVIDENCE. Do not modify any other file.
