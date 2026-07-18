# Learnings — worktree-session-routing (2026-07-18)

Feature: GH #21 fix — `bee worktree new` (enter), `bee worktree merge` (return,
verify = semantic-conflict alarm), D9 routing prose. Built while a sibling
session was live in the same checkout — the feature dogfooded its own problem.

## 1. A registered worktree serves a session that RUNS there; an orchestrator in main fans out through P40 harness worktrees
The write guard resolves store + containment from the tool call's cwd. A session
seated in the main checkout therefore cannot Edit files in a registered sibling
worktree (absolute paths fail containment; relative paths alias to main's own
tree). The working pattern for "build in isolation while main is occupied" from
a MAIN-seated orchestrator: dispatch execution workers with harness worktree
isolation (P40 resolves them to the main store, whose lane gates authorize the
writes), then git-merge each worker branch into a registered integration
worktree via `git -C` (git plumbing carries no file-path targets, so it is not
a guarded write). The registered-worktree door (`worktree new` → open a session
in the printed path) is for humans starting a NEW session — exactly what D9's
prose says; nothing was missing from the design, but the two roads must not be
confused.

## 2. Baseline red in a shared checkout may be another session's mid-flight work, not drift
The mirror/manifest suites cannot distinguish a live sibling's uncommitted
half-cell from one-sided drift. This session reverted a live worker's edits
twice before checking file mtimes (seconds-fresh = someone is writing NOW).
Check `git status` + mtimes + session heartbeats BEFORE "fixing" any
mirror-drift red in a checkout that other sessions share. Filed as friction
(backlog) with a suggested baseline-gate hint.

## 3. Advisor-ref staleness is event-based: record the consult LAST, right before the gate
Logging the Gate-3 audit decision AFTER `state advisor-ref record` made the ref
stale (newest-decision-id anchor moved) and the gate refused. Order that works:
fold conditions into cells → log all decisions → record advisor-ref → approve
the gate. Re-recording the same digest is legitimate when the only new decision
is the audit line itself.

## 4. Serialized workers on one feature: base each on the integration commit, not on main HEAD
`git checkout -b work <integration-sha>` in the harness worktree gives worker
N+1 the exact state left by worker N (same-feature deps) without dragging in
the sibling session's parallel commits, and keeps the merge back into the
integration branch conflict-free by construction.

## Follow-ups
- Merge-back to main deferred until the sibling's slice is committed; the plan
  is to dogfood `bee worktree merge --id <id>` for it (GH #21 closes then).
- Friction filed: baseline-gate hint when another session's worker is
  dispatched (see .bee/backlog.jsonl).
