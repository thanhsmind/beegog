---
date: 2026-07-23
feature: backlog-auto-commit
categories: [swarming, worktree-coordination, cli-design]
severity: P2
tags: [bee-gather, agent-dispatch, cross-worktree-hold, scoped-commit, backlog]
---

# Learnings — backlog-auto-commit (P78)

## What Happened

`bee backlog add` (`skills/bee-hive/templates/bee.mjs` `handleBacklogAdd`) was extended with a
`commitBacklogRow` helper that stages and commits `.bee/backlog.jsonl` alone, via an explicit git
pathspec on both `add` and `commit`, right after a successful append — degrading silently to
`committed:false` outside a git work tree. The cell (`backlog-auto-commit-1`, tiny lane) capped
clean: verify green except one pre-existing, unrelated baseline red confirmed on `main` before
this cell was dispatched. Two friction points surfaced during swarming and close, one already
known, one newly characterized here.

## Root Cause

**1. bee-swarming dispatches a read-only pinned type for cell execution (recurrence).**
`skills/bee-swarming/SKILL.md`'s Operating Contract step 3 and its "Single execution worker"
section both offer `subagent_type: "bee-gather"` as a valid spawn choice for a *generation*-tier
cell — including the tiny/small single execution worker, which must edit files, run git, and run
verify. `.claude/agents/bee-gather.md`'s actual system contract is unconditionally read-only
("never writes, never edits, never runs a mutating command"). The dispatch was refused
(`[BLOCKED]`) and had to be re-dispatched as `subagent_type: "claude"` instead. This is the same
class of gap already filed 2026-07-20 (`dispatch prepare --kind cell`), now reproduced through a
different code path (bee-swarming's own single-execution-worker spawn instructions) — confirming
it is a real, recurring documentation contradiction, not a one-off misreading. No pinned agent
type for cell *execution* (as opposed to I/O-offload gather/extract/review) currently exists in
this repo's rendered agent set.

**2. A cross-worktree hold IS a hard block on `git add`/`git commit`, not just on
`reservations reserve`.** Mid-close, another live worktree session placed a hold on the exact file
this feature needed to commit (visible via `reservations list --json`'s `cross_worktree` array,
mirrored at `.bee/runtime/cross-worktree-holds.json`). The block is enforced directly in the
Bash `PreToolUse` guard — `.bee/bin/lib/guards.mjs:682` ("bee cross-worktree hold: ... is held by
checkout ... a hard block") — independent of and in addition to the `reservations reserve`
enforcement path. `git add` on the held path was refused with that exact message; waiting for the
hold to clear (verified via a read-only poll of `reservations list`, never routing around the
guard) and retrying then succeeded immediately. Treat a `cross_worktree` entry as a live gate on
any git mutation of that path from another checkout, not as passive/informational status.

## Recommendation

- When dispatching a cell-execution worker (tiny/small single execution worker, or a
  standard/high-risk swarm worker), never pass `subagent_type: bee-gather` / `bee-extract` /
  `bee-review` — those pinned types are valid ONLY for read-only I/O-offload gather dispatches.
  Cell execution always carries a `model` param (or the ceiling ratio: no param, tier marker only)
  and the runtime's default/general subagent type — never a pinned bee-* type.
- Before assuming a `cross_worktree` hold entry is informational, check whether the guard that
  enforces it (`.bee/bin/lib/guards.mjs`, the cross-worktree hold block) also gates the operation
  you are about to run — for git mutations in this repo, it does. Poll `reservations list` (read
  only) until the entry's `released_at` is set, then retry the real command; never force through
  or edit around the block.
- When investigating a guard's enforcement surface, grep the actual hook/guard implementation
  (`.bee/bin/hooks/`, `.bee/bin/lib/guards.mjs`) before concluding a mechanism is unenforced from
  reading only the CLI command handlers (`bee.mjs`, `reservations.mjs`) — the two layers can
  enforce the same rule at different call sites, and missing one gives a false "not enforced"
  read.
