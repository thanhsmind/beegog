# hardening-1-7-10 — CONTEXT

Scope: fix ALL blockers from the external v1.7.9 No-Go review, independently verified 2026-07-21
(6 review workers, every finding anchored file:line; 8 friction rows filed in .bee/backlog.jsonl).
User directive: "thực hiện fix toàn bộ" (total autopilot, gate_bypass=total).

## Locked decisions

- **D1 — CI green gate (tests/workflows).**
  `.github/workflows/windows.yml` drops the deleted `test_lib.mjs` step and runs the split
  template suites via the auto-discovery runner subset instead. Test hermeticity law: suites must
  not inherit harness session env — `scripts/run_verify.mjs` scrubs `CLAUDE_CODE_SESSION_ID` and
  `BEE_SESSION_ID` from every child suite env, AND `test_state.mjs`/`test_claims.mjs` scrub them
  at bootstrap (defense in depth). `test_claim_race`'s negative control replaces its 50 ms sleep
  ordering with a deterministic barrier (must pass 10/10). chmod-based write-failure simulations
  skip with a loud marker when `process.geteuid?.() === 0`.

- **D2 — lock stale-takeover requires dead owner (lib/lock.mjs).**
  A timer-based heartbeat is REJECTED: `withStoreLock` sections run synchronous `spawnSync`
  (worktree merge verify), so the event loop is blocked and timers cannot fire — validated
  against the exact failure scenario. Instead `tryStaleTakeover` becomes: mtime > STALE_MS (30 s)
  **AND** owner pid not alive (`process.kill(pid, 0)`; `EPERM` counts as alive; missing/unparsable
  pid counts as dead) → takeover. Absolute ceiling `HARD_STALE_MS` (15 min) guards pid-reuse:
  past the ceiling, takeover proceeds regardless of liveness. Locks are same-host by construction
  (per-checkout `.bee/locks/`), so pid probing is valid. `lock.mjs` contract prose updated:
  long holds are safe for a live holder; the 30 s window is for crashed holders only.

- **D3 — atomic cross-worktree holds (bee.mjs + lib/worktree-holds.mjs).**
  Conflict-check → local reserve → mirror-insert all run under ONE main-root
  `cross-worktree-holds` lock (lock order: shared lock outermost, then the local store's own
  lock inside). New `renewHolds(mainRoot, sessionId)` refreshes `mirrored_at` for the session's
  live holds; wired into the existing heartbeat hook path so a live worker never silently loses
  its hold at the 1 h TTL. The stale "UNWIRED" module header is corrected.

- **D4 — archive/mutator serialization + archive transaction (lib/cells.mjs).**
  `writeCell` (the single write funnel) briefly takes the `cells-archive` lock around a final
  active-path existence check + write; archive/unarchive keep it exclusively for their whole
  transaction → archive vs mutator serialized at the write boundary, no per-cell lock churn.
  Lock order is always `cells:<id>` → `cells-archive`; archive never takes `cells:<id>` → no
  deadlock. `assertNotArchived` added to the four unguarded mutators (`reopenCell`, `setTier`,
  `resetCellBudget`, `recordJudgeVerdict`). Archive transaction: preflight destination-collision
  check (refuse, don't overwrite), journal file written before any rename, summary write moved
  inside the guarded section, crash-recovery sweep at archive/unarchive entry rolls an
  interrupted journal back; unarchive refuses to overwrite an existing active file.

- **D5 — Codex session bridge (lib/claims.mjs + session-init hook + lib/recovery.mjs).**
  `resolveSessionId` gains a durable fallback: when flag/env yield null, scan live session
  records with the existing freshness predicate — exactly ONE fresh live session → adopt its id
  (result carries an `adopted: true` audit marker); two or more → `SESSION_REQUIRED` stands
  (real multi-session ambiguity is still refused). The session-init hook persists
  `transcript_path` from the hook payload into the session record; recovery prefers a stored
  `transcript_path` over layout math, making Codex transcript resolution real instead of a
  relabeled Claude layout.

- **D6 — Windows hook transport resolves git root (hooks/catalog.mjs + onboard_bee.mjs).**
  `commandWindows` becomes a shell-agnostic `node -e` bootstrap: outer double quotes, inner
  single quotes only, NO `$`, backtick, or `%` characters (cmd + PowerShell safe); it resolves
  the repo root via `git rev-parse --show-toplevel`, exits 0 silently when no git root (POSIX
  parity), else spawns the real hook with `stdio: 'inherit'` and exits with the child's status.
  The contract test is updated to require THIS form and to actually execute the commandWindows
  string from a nested cwd (executable on POSIX too — `node -e` is cross-platform).

- **D7 — judge NEEDS_REVISION returns the cell to `open` with a clean slate (lib/cells.mjs +
  lib/dispatch-prepare.mjs).** On NEEDS_REVISION over a capped cell: status → `open` (not
  `claimed`) + `releaseTrace` (verify evidence cleared) + the existing `reopened_for_rework`
  logging kept. A fresh claim and a fresh verify are then structurally required by the existing
  claim/cap gates — the stale-evidence re-cap hole closes. The v1.7.9 test that locked in the
  old flip is updated. `dispatch-prepare` uses the validated real worker name as the reservation
  identity (drops the `prepare-<id>` nickname). `--force-ownership` performs a real audited
  claim transfer when the claims API allows it simply; otherwise its advisory nature is stated
  in output and friction filed.

- **D8 — nested-clone origin-rewrite hunt (tests).** Find the suite that rewrote the PARENT
  repo's `remote.origin.url` during a nested-clone verify (candidates: installer E2E,
  worktree CLI/store tests), pin its cwd/root, and add a regression test that a nested-clone
  verify leaves the parent's remotes byte-identical.

- **D9 — close-out.** Mirrors sync via self-onboard `--apply`, `render_plugin_skill_trees.mjs`
  then `release_manifest.mjs --write` (render-then-manifest order), full verify green foreground,
  plus hermetic re-check with session env scrubbed.

## Out of scope

Beads integration (review's own recommendation: don't), tiny-direct execution mode (decision:
deliberately not built), projection-tree noise reduction, LICENSE/SECURITY.md hygiene (separate
docs lane later).
