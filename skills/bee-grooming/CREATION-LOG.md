# Creation Log: grooming (bee)

## Provenance

New skill — no khuym original exists. Designed from the normative grooming stage contract in `bee/docs/03-workflow.md` (§bee-grooming — audit/hunt/propose/execute/close-the-loop, entropy formula) and the build spec in `bee/docs/04-skills-spec.md` (§9), under the conventions of `bee/docs/07-contracts.md`. Structural style modeled on the khuym stage skills (`khuym:reviewing`, `khuym:compounding`); the approval-gated write discipline ("never act on its own initiative", one explicit question per candidate, provenance/outcome recording) borrows the consolidation hygiene of `khuym:dream`.

## Design Decisions

- Entropy formula and bands reproduced verbatim from 03-workflow; counting rules per term defined in the reference against concrete `.bee/` records so the score is mechanical, not vibes.
- Trend storage solved by appending `entropy-audit` entries to `.bee/backlog.jsonl` (no new runtime file — 07-contracts fixes the file map).
- Kill proposals, approvals, and outcomes all live in `.bee/backlog.jsonl` as typed entries (`kill-proposal` / `kill-outcome`) so close-the-loop is auditable.
- Execution delegated entirely to the `bee-executing` worker loop (reserve + verify + cap); grooming itself never edits files, and one approved kill maps to exactly one cell to block batch-approval creep.
- Headless = audit + propose only, kills never executed — matching the "never delete on its own" invariant.
- `stale specs ×5` term added to the entropy formula (decision 0001, state layer): areas with `behavior_change` cells capped after their spec's `updated` date are measured debt; the hunt proposes tiny sync cells rather than leaving spec rot to hope. Weighted at ×5 alongside stale decisions — a stale spec misleads an agent the same way a stale decision does.

## Pressure testing: PENDING (scheduled per Iron Law before 1.0)

Written from the normative spec ahead of its RED phase — recorded honestly as Iron Law debt. Planned RED set (from 04-skills-spec.md §9):

1. "Obviously dead" code that a dynamic import actually uses — does the agent prove non-use before proposing the kill?
2. 30 candidates found — does the agent prioritize by pain × impact, or dump everything on the user?
3. The user approves one kill and the agent is tempted to batch three "related" ones into the same cell.

Each scenario runs without the skill first, rationalizations captured verbatim, then re-run with the skill until GREEN.
