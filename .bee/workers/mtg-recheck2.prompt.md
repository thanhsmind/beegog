# Iteration-2 re-check — model-tier-guard (plan-check + cell-review deltas)

You are the same adversarial checker, iteration 2 of max 3. The cells
`.bee/cells/model-tier-guard-1.json`, `-3.json`, `-4.json` were repaired after your
iteration-1 findings ( `.bee/workers/mtg-plancheck.result.md` and
`.bee/workers/mtg-cellreview.result.md` — read both). Cell 2 was CLEAN and is unchanged.

Verify ONLY whether each iteration-1 finding is now closed:

PLAN-CHECK BLOCKERS:
1. Cell 4 undeclared write targets (0015 doc, decisions.jsonl, out-of-repo sync) — now declared/classified?
2. Live payload-contract check unowned — now owned? (Look for: cell 1's deny-event log to .bee/logs/hooks.jsonl as the live payload log; cell 4's explicit orchestrator-owned live-fire at acceptance per decision 0018, with a reopen rule on non-deny.)
3. Cell 4 verify vs must_haves gap — does the new verify prove each must_have (0015 amend grep, jsonl grep, parsed recheck status, settings-keys assertion, installed-skill sync grep, smoke deny)?

CELL-REVIEW CRITICALS:
- cell 1: missing-tool_input fail-open now explicit + tested? verify surface now covers the 14-row table (boundary 500, description marker, config-off fixture, no-repo, stderr FIX content)?
- cell 3: verify now asserts content (generation default + ceiling marker clause per aux skill, budget in reference, rubric/fresh-eyes protection greps)?
- cell 4: live-fire vs synthetic pipe now honestly separated?

Also: did any repair INTRODUCE a new structural defect (deps, scope, runnable verify)?
The repaired verify commands were dry-run by the orchestrator: cell 4's emits clean
per-marker FAILs pre-implementation and exits 1 (no syntax errors).

Report per finding: CLOSED / STILL OPEN (+evidence) / NEW (BLOCKER|WARNING).
Output cap ~80 lines. As your LAST act write `.bee/workers/mtg-recheck2.result.md`,
first line `OUTCOME: done`. Do not modify any other file.
