# Cell fanout-2 Report

**Status:** [DONE]

**Outcome:** Replaced the advisor-mode section in `routing-and-contracts.md` with the Delegation contract (D2/D3); added a one-line delegation pointer to all 11 SKILL.md files (hive + 10 phase skills); amended the tiny/small lane-table "0 subagents" cells to "0 ceremony subagents (I/O-offload workers exempt)"; reworded the swarming rescue-ladder rung 2 and removed the "called-only advisor" clause from swarming-reference.md.

**Files touched:**
- skills/bee-hive/references/routing-and-contracts.md (advisor section → Delegation contract section)
- skills/bee-hive/SKILL.md (lane-table "0 ceremony subagents" ×2 + new hive delegation line)
- skills/bee-exploring/SKILL.md
- skills/bee-planning/SKILL.md
- skills/bee-validating/SKILL.md (net-new line)
- skills/bee-swarming/SKILL.md (net-new line + rescue-ladder rung 2 reword)
- skills/bee-swarming/references/swarming-reference.md ("called-only advisor" clause removed)
- skills/bee-reviewing/SKILL.md (net-new line)
- skills/bee-scribing/SKILL.md
- skills/bee-compounding/SKILL.md (net-new line)
- skills/bee-grooming/SKILL.md
- skills/bee-briefing/SKILL.md (net-new line)
- skills/bee-xia/SKILL.md

**Verify:** cell's `verify` command (grep assertions: Delegation contract present, no "advisor mode" in the three swarming/routing files, all 11 SKILL.md files match `/delegat/i`, no "called-only advisor" clause) — PASSED, exit 0.

**Full trace and evidence:** [.bee/cells/fanout-2.json](../../../../.bee/cells/fanout-2.json)
