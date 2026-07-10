# 0018 — Orchestrator goal-check + frozen judge (backlog P12)

- **Status:** active — owner-approved 2026-07-10 ("thực hiện toàn bộ các backlog"); built in 0.1.17.
- **Date:** 2026-07-10
- **Source:** LOOP survey (2026-07-10): every mature orchestrator converges on "evidence, not assertion" *at the orchestrator* — smart-orchestrate has Claude re-run typecheck/test itself instead of trusting Codex's word; delegator verifies inside a worktree the worker cannot self-green and freezes the "judge" files (tests, CI, lockfiles) so a worker cannot redefine "passing". The shannholmberg diagram's loop: fable measures the result against the /goal; miss reruns, hit ships. bee trusted `cap` (worker self-verifies) and caught tampering only at Gate 4 — one stage too late, and a prerequisite gap for external workers (decision 0019).
- **Confidence:** 0.75 (the judge helper is mechanical and tested; the re-run discipline is prose and needs dogfooding).

## Decision

Two additions to `bee-swarming`'s tend loop — a `[DONE]` is accepted only after both:

1. **Goal-check (re-run the verify).** The orchestrator runs the cell's verify command itself, in its own shell, before the cell counts toward a clean wave. Lane-scaled: `tiny`/`small` may spot-check one representative cell per wave; `standard`/`high-risk` re-run every `behavior_change` cell. A failure means the cell is not done — re-dispatch **to the same tier** with the failing output. Task misses rerun; only provider-class failures climb the rescue ladder's tier rung (delegator's fallover discipline).

2. **Frozen judge.** `frozenJudgeHits(files_changed, cell.files)` in `lib/cells.mjs` + `bee_cells.mjs judge --id <id>`: files matching the judge patterns — test sources/files, snapshots, CI config, lockfiles, package manifests, test-runner config, `.bee/config.json` — that were changed **without being declared in the cell's `files` scope** are tamper signals. A hit never auto-counts toward a clean wave: the orchestrator records the hits, flags the cell for `bee-reviewing`, and either gets each file justified or re-dispatches with corrected scope. Declared judge files are legitimate (test-writing cells exist); *undeclared* judge changes are the signal.

## Rationale

- The reviewer at Gate 4 already checks verification evidence, but a tampered verify config poisons every downstream check — the earliest honest checkpoint is dispatch acceptance.
- Declared-scope subtraction keeps false positives near zero: planning already writes each cell's `files`, so the diff between "what you were asked to touch" and "what you touched" is mechanical.
- This is the safety prerequisite for external, non-Claude workers (decision 0019): opening the swarm to third-party CLIs without orchestrator-side measurement invites the exact failure delegator's frozen-judge was built for.

## Alternatives considered

- **Trust cap + Gate 4 only (status quo).** Rejected — a worker that weakens an assertion or pins `"test": "exit 0"` sails through cap and contaminates the wave.
- **Hard-block judge hits mechanically (refuse cap).** Rejected for now — test-writing and dependency-bump cells legitimately touch judge files; the declared-scope subtraction plus flag-for-review routes judgment to review instead of blocking honest work. Revisit if dogfood shows hits being waved through.
- **Worktree-per-worker isolation (delegator's model).** Rejected — bee's isolation primitive is reservations; switching to worktrees is a foundation swap without demonstrated need.

## Scope (built)

- `lib/cells.mjs`: `FROZEN_JUDGE_PATTERNS`, `frozenJudgeHits`, `judgeCell`; `bee_cells.mjs judge` subcommand; version 0.1.17.
- `bee-swarming/SKILL.md`: operating contract step 7 (goal-check + judge), wave-clean definition tightened.
- `bee-reviewing` consumes the flags (judge hits arrive as review items with the cell trace).
- Tests: `test_lib.mjs` frozen-judge fixtures (undeclared hits per rule, declared coverage exact/prefix/glob, Windows path normalization).
