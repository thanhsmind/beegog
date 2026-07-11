You are an adversarial plan-checker PANEL for the bee repo (current dir). Assume the plan is flawed until proven otherwise. Verify, do not redesign. NO session history.

Inputs (read all): docs/history/skill-sync/CONTEXT.md, approach.md, plan.md, implement-plan.md, the three cell files .bee/cells/skill-sync-1.json, skill-sync-2.json, skill-sync-3.json, and skills/bee-hive/scripts/onboard_bee.mjs + test_onboard_bee.mjs for ground truth.

Run FOUR personas over the same inputs, each reporting findings as BLOCKER (structurally unsound) or WARNING (survivable):
1. COHERENCE — do the five documents agree with each other and with the cells? Any contradiction, any D-ID (D1-D5) not landing in a cell, any cell claiming something the plan does not?
2. FEASIBILITY — can each cell be executed against the real code as it exists? Verify the code claims (HIVE_DIR anchoring, applyPlan write order incl. the unconditional onboarding.json write after the item loop, readBeeVersion fallback, runOnboard's lack of target override). Runnable verify commands?
3. SECURITY — the delete surface under ~/.claude/skills: is the structural bee-* fence specified tightly enough that an implementer cannot accidentally widen it? Symlinks inside skill dirs? A bee-* symlink pointing outside the target? Tests forced hermetic?
4. SCOPE-GUARDIAN — is any cell doing hidden architecture work, exceeding its lane, or is ceremony exceeding the work?

Then DEDUPE overlapping findings and synthesize into two buckets: AUTO-FIX (mechanical, apply-and-record) and PRESENT-FOR-DECISION (user judgment).

Output: `PANEL: <n> findings` then per finding `### [BLOCKER|WARNING] <persona(s)> — <title>` with evidence (file/line or cell field) and smallest fix, then the two buckets. Do not modify files.
