# Phase 6 — Worktree isolation for swarming

## Context

- `docs/08-harness-adoption.md` item 7 (already scoped, never built)
- `docs/decisions/0018-orchestrator-goal-check-and-frozen-judge.md` — worktree-per-worker was rejected as the *default* isolation primitive ("bee's isolation primitive is reservations; switching to worktrees is a foundation swap without demonstrated need"). This phase is an **opt-in mode**, not a reversal of that decision.
- harness source: Symphony's worktree + `RUN_CONTRACT.json` model (`docs/SYMPHONY_QUICKSTART.md`, `docs/SYMPHONY_SCOPE.md`)

## Requirements

- `--isolation worktree` flag on `bee-swarming`, opt-in per wave (never default), for `high-risk` lanes or wide-blast-radius waves.
- Reuse bee's existing cell as the RUN_CONTRACT — no new artifact (per docs/08's own note: bee's cell already carries scope, files, must_haves, verify).
- Skip harness's copied-DB + semantic-changeset + sync machinery — bee's state is per-file JSON; git merge already does the replay job (per docs/08's own reasoning).
- Claude Code: use the Agent tool's native worktree support. Codex: document the manual `git worktree` path.

## Files

- Modify: `skills/bee-swarming/SKILL.md` + `references/swarming-reference.md` (isolation contract addendum)
- Modify: `skills/bee-hive` Codex parity reference (manual worktree path note)

## Implementation steps

1. Add `--isolation worktree` to swarming's wave-analysis step: when set, each worker's assigned cell also gets a fresh worktree instead of a plain-checkout reservation.
2. Reservations still apply *within* the worktree — worktree adds a second safety layer, it does not replace the reservation mechanism.
3. Document the Codex manual path: create the worktree, point its `AGENTS.md` shim at the cell contract, same status-token protocol.
4. On worker completion, the orchestrator's existing goal-check + frozen-judge run against the worktree's diff before merge — unchanged logic, just a different filesystem root.

## Tests / validation

- Integration: run a `high-risk` lane wave with `--isolation worktree`, confirm workers cannot see or affect the root checkout mid-run, confirm merge-back is a normal git merge.

## Risks / rollback

- Risk: worktree setup/teardown cost per wave — mitigate by keeping it strictly opt-in (matches decision 0018's original reasoning for staying with reservations by default).
- Rollback: flag-gated. Omitting `--isolation worktree` reverts to exactly today's behavior.
