# msh-5 — throttled heartbeat+lease renewal in hooks; state RMW under lock (D5+D6)

**Status:** [DONE] — capped, verified green, completed by a successor session
after a predecessor died mid-cell (session limit); predecessor's work was
hand-committed without a cell id (0871734 "multi session hardenining") — see
Deviations.

**Outcome:** `heartbeatTouch(root, sessionId)` (claims.mjs) rides
`bee-prompt-context.mjs` (UserPromptSubmit) and `bee-state-sync.mjs`
(PostToolUse/Stop), throttled to at most one refresh per session per
`HEARTBEAT_TOUCH_THROTTLE_SECONDS` (60s, far below the unchanged 900s stale
threshold). When it refreshes: the session's own heartbeat record (via
`withStoreLock('sessions', ..., { maxAttempts: 1 })` — try-once, LOCK_BUSY
skips silently, never thrown) and every live claim file the session owns
(`renewClaimTTL`, same-session-only, gated by the existing per-claim
`.adopting` exclusive gate — a claim gated by an in-flight adopt/sweep is
skipped, never rewritten, and ownership is re-verified under the gate so a
renewal can never revert an adoption). Hold renewal
(`renewHoldsBySession`, reservations.mjs) is composed at the HOOK call site
alongside `heartbeatTouch`, not imported by claims.mjs itself (keeps
claims.mjs/reservations.mjs cycle-free, mirroring how state.mjs composes
both leaf modules without either importing the other). Both hooks wrap the
touch in its own try/catch, separate from their primary job, so a throw
inside `heartbeatTouch` is logged (`.bee/logs/hooks.jsonl`) and never blocks
the reminder (`bee-prompt-context.mjs`) or the cell-counts/`last_activity`
refresh (`bee-state-sync.mjs`). `bee-state-sync.mjs`'s own state
read-modify-write is itself now inside `withStoreLock('state', ...,
{ maxAttempts: 1 })` (D3-amended) — LOCK_BUSY skips the sync silently,
never escalated to a crash log. D6: every CLI-side state logical-RMW verb
(`state.mjs`'s `startFeature`; `bee.mjs`'s `handleStateSet`,
`handleStateGate`, `stateWorkerMutate` (shared by worker add/update/
remove/clear), `handleStateScribingRun`) now runs its read-check-write body
inside `withStoreLock('state', ...)` with the CLI's normal ~5s retry budget
(no `maxAttempts` override — only the hook-driven touch path opts into
try-once). `lock.mjs`'s `withStoreLock` gained the `options.maxAttempts`/
`retryDelayMs` parameters powering the try-once mode, byte-compatible for
every caller that omits them.

**Files touched (this cell's own additions on top of the predecessor's
0871734):** `scripts/test_heartbeat_touch.mjs` (new — 23-row suite),
`docs/history/codex-harness-hardening/release-manifest.json` (regenerated),
`docs/history/multi-session-hardening/reports/msh-5.md` (this file). No
further source edits were needed: reading `hooks/bee-prompt-context.mjs`,
`hooks/bee-state-sync.mjs`, `skills/bee-hive/templates/lib/claims.mjs`,
`skills/bee-hive/templates/lib/reservations.mjs`,
`skills/bee-hive/templates/lib/lock.mjs`,
`skills/bee-hive/templates/lib/state.mjs`, and
`skills/bee-hive/templates/bee.mjs` (plus their `.bee/bin` mirrors, verified
byte-identical) against the action's guardrail list confirmed every item
already present in 0871734: try-once/skip-on-busy hooks (never wait),
same-session-only renewal respecting the `.adopting` gate, fail-open hooks,
CLI verbs waiting normally under the D6 lock. Nothing was missing.

**Verification:** direct lib-level cases (throttle no-op byte-identical,
LOCK_BUSY silent skip at both the session-heartbeat and state-RMW layers,
renewal-vs-`.adopting`-gate skip/never-rewrite) run against synthetic
clocks for determinism; the over-throttle refresh and touch-throw cases run
through the REAL `bee-prompt-context.mjs`/`bee-state-sync.mjs` hooks via the
shared isolated worker runner (`scripts/lib/run-module-worker.mjs`, the same
harness `hooks/test_hook_contracts.mjs` uses), proving the hook-site
composition of `claims.mjs` + `reservations.mjs`, not just the lib functions
in isolation. `behavior_change` evidence: freeze suites were confirmed green
by the orchestrator before this cell's own work began (`test_lib` 365/0,
`test_hook_contracts` ALL PASS, `test_state_write_concurrency` PASS,
`test_lib_mirror` PASS) and re-confirmed green by this session before
capping. A deliberate-red run (disabling `renewClaimTTL`'s per-claim gate
check — `if (!acquireGate(...))` → `if (false)` — in both
`skills/bee-hive/templates/lib/claims.mjs` and its `.bee/bin/lib` mirror)
turned exactly the two gate rows red
(`gate:cell-gated-skipped`, `gate:cell-gated-never-rewritten`, 23 rows/2
failing) while every other row stayed green, then both files were restored
via `git checkout --` (confirmed byte-identical, `git status --short`
empty) and the suite re-ran clean. Final full cell verify chain, fresh
output: `test_heartbeat_touch.mjs` 23/23, `test_hook_contracts.mjs` 178/178
(ALL PASS), `test_state_write_concurrency.mjs` PASS (18 real OS processes,
zero corruption), `test_lib_mirror.mjs` PASS (22 lib files + 10 hook files
byte-identical), `release_manifest.mjs --write` then `--check` clean (364
files).

**Deviations:**
1. The cell's implementation work was done by a predecessor session that
   died mid-cell (session limit) and hand-committed its changes as `0871734`
   "multi session hardenining" — a commit carrying no cell id, outside the
   normal one-commit-per-cell convention (critical rule 8). This session
   verified the predecessor's implementation against the action's full
   guardrail list (see Outcome/Files touched above), found nothing missing,
   and completed the cell's remaining unmet requirements (the missing
   `scripts/test_heartbeat_touch.mjs`, the deliberate-red proof, the
   manifest regen, and this report) rather than re-implementing existing,
   correct work.
2. `0871734` also carried two side artifacts outside a normal cell diff:
   `.bee/cells/msh-5.json` and `.bee/cells/msh-6.json` (the predecessor's own
   cell record and a follow-on cell it had begun scoping). Both are
   pre-existing repo state at the time this session started and were left
   untouched — msh-6 is out of this cell's scope.

**Reservations:** released.
