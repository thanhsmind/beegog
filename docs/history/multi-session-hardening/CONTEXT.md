# CONTEXT — multi-session-hardening

Locked decisions for hardening bee's same-checkout multi-session coordination.
Source: the 2026-07-19 audit (decision 12f54e88), verified line-by-line against
1.6.2 source by a gather pass; three live near-misses the same day (decisions
0101ec31, ec2912ba; learnings 20260719-codex-native-transport.md); backlog rows
feature=multi-session-hardening (2×P1, 3×P2 + session-id P3).

Mode: high-risk (hard-gate flags: claim/write-guard machinery, data-loss class
races, every session's safety depends on these paths).

## Problem (evidence-anchored)

1. **P1** `claimCell` (`templates/lib/cells.mjs:388-424`) is read-check-write
   with no O_EXCL claim file; only `claim-next` → `claimCellFile`
   (`claims.mjs:237-265`, flag `wx`) is race-safe. The swarm worker flow
   (`bee-executing/SKILL.md:39`, `worker-details.md:14`) instructs the unsafe
   verb; there is no lease around schedule→assign→spawn. Two sessions can both
   believe they own a cell (happened: cnt-1/cnt-2, ~2 worker runs discarded).
2. **P1** `reservations.mjs reserve()` (110-140) is whole-store RMW: two
   concurrent reserves both pass the conflict check against one snapshot and
   the later write silently drops the earlier hold. `--session` is optional
   (bee.mjs:823-834); session-less rows are invisible to
   `findSessionConflicts` (97-108); worker templates never pass it.
3. **P2** `recordVerify`/`capCell`/`blockCell`/`unclaimCell`/`reopenCell`
   (`cells.mjs:426-620`) prove no claim ownership — any session can mutate
   another session's cell.
4. **P2** Session heartbeat refreshes only in `bee-session-init.mjs`
   (SessionStart); stale threshold 900s vs hour-long working turns — a live
   session reads dead, opening its lane to `claim-next` pooling (GH#20 guard
   consumes exactly this signal).
5. **P2** `writeState()` (`state.mjs:878-881`) is whole-object
   atomic-rename; logical RMW is last-writer-wins (named HONEST LIMIT in
   `test_state_write_concurrency.mjs:24-33`, deferred as cnr2-5).
6. **P3** An orchestrator-handed session id in a worker prompt mismatched the
   worker's real `CLAUDE_CODE_SESSION_ID` → write-guard denied the worker's
   own write as a cross-session conflict (cnt-6, backlog row 2026-07-19).

## Locked decisions

**D1 — One claim primitive: the O_EXCL claim file becomes the only way a cell
is claimed.** `cells claim --id` is re-backed by `claimCellFile` (same `wx`
claim-file path `claim-next` uses): acquire the claim file first (typed
`CLAIMED` refusal on loss), only then flip the cell JSON. No behavior change
for the winner; the loser now loses loudly instead of silently double-owning.
`--session-id` accepted like claim-next; absent, it self-derives (D3). The
worker execution contract changes: the ORCHESTRATOR claims (claim-next or
claim --id, with session id) BEFORE spawning; the worker receives the cell id
+ owning session and only VALIDATES ownership (`cells show`), never claims.
**Δ2-amended (advisor + plan-check):** the claim file is released on EVERY
claim-clearing transition — cap, unclaim, block, drop, reopen — not only the
claim-next unwind (today releaseClaim has exactly one caller, cells.mjs:831;
"cap already sweeps" is false). claimCellFile's session requirement is
deliberately relaxed to allow sessionless single-user claims, with a release
path whose owner check handles an absent session.
`bee-executing`/`bee-swarming` skill text updated accordingly. (Interim
doctrine already in critical-patterns 20260719; this mechanizes it.)

**D2 — Serialize multi-writer stores with one tiny lockfile primitive, keep
the store formats.** New lib helper `withStoreLock(root, name, fn)`: acquire
`.bee/locks/<name>.lock` via O_EXCL create (`wx`) with bounded retry/backoff
(~50ms × up to 100 tries ≈ 5s) and stale-lock takeover (mtime older than 30s
— a CLI RMW lasts milliseconds; any lock older than that is a crashed
process), write pid+session+ts inside for diagnosis, always release in
`finally`. Reservation mutations (`reserve`, `release`, `sweep`) and state
logical-RMW verbs run their read-check-write inside the lock. Rejected
alternatives: per-hold O_EXCL files (store-format break, bigger blast radius,
migration cost) and SQLite (new dependency; bee is node-stdlib-only by
doctrine). Timeout ⇒ typed refusal (`LOCK_BUSY` naming holder pid/session),
never a fall-through unlocked write; fail-open is NOT acceptable here because
the entire purpose is mutual exclusion. **Δ1-amended (advisor + spike):**
stale takeover is by ATOMIC RENAME (rename lock → lock.stale-<pid>-<ts>; the
one rename winner unlinks the corpse; ENOENT losers back off) — the naive
unlink+reacquire has a double-unlink race where a waiter deletes the NEW
holder's fresh lock (spike's negative control reproduced 7-8 winners).
Staleness is re-verified at the moment of each retry, never cached.
**Δ3-amended:** hooks never WAIT on the lock — writer hooks take it
try-once/skip-on-busy (LOCK_BUSY ⇒ skip this touch/sync silently, fail-open
preserved); an unlocked hook write racing a locked CLI write would reintroduce
the exact lost-update this decision exists to kill (bee-state-sync's own
state RMW included).

**D3 — Session id is self-derived at mutation time, never handed down.**
Reservation/claim/heartbeat verbs resolve the session id as: explicit flag
(highest, for tests) → `CLAUDE_CODE_SESSION_ID` env → hook-payload-derived id
where available → absent (row written session-less exactly as today).
Worker-facing skill text drops every literal session id; workers read their
own env. (Fixes problem 6; makes cross-session holds actually visible by
default instead of opt-in.)

**D4 — Cell mutators check claim ownership when a claim exists.**
`verify/cap/block/unclaim/reopen` (and `cells update` on claimed cells)
compare the caller's derived session id (D3) against the live claim file's
session. Match, expired claim, or NO claim file present ⇒ proceed (fully
backward compatible: single-session use has no claim files on `cells claim`
today — after D1 it will, and expiry keeps rescue possible). Mismatch with a
LIVE claim ⇒ typed refusal naming owner + expiry. `--force-ownership` flag
overrides with an audit line appended to the cell trace (rescue ladder needs
a door; it is loud, never silent). **Δ5-amended:** the audit lives in a
distinct append-only trace key `trace.ownership_overrides` — capCell REPLACES
`trace.deviations` wholesale from the cap argument (cells.mjs:531), so a
deviations-append would be silently wiped at cap; the `...trace` spread
(cells.mjs:528) preserves unknown keys. A forced unclaim also clears-or-adopts
the claim file, else the forced-open cell stays self-refusing.

**D5 — Heartbeat and lease renewal ride the existing hooks, throttled.
Δ3/Δ4-amended:** every store the touch writes goes through the D2 lock in
try-once/skip mode; claim-TTL renewal additionally respects the per-claim
`.adopting` gate (acquireGate/skip-if-held, claims.mjs:214-230) so a renewal
racing an adoption can never revert ownership. Renewal primitives are new
same-session-only verbs (`renewClaimTTL`, hold renewal by session) — never
adoptClaim. Accepted residual (Δ6, documented non-goal in the tests): a
session idling in unrelated chat blanket-renews its claims; D4's audited
force door + release-on-terminal transitions are the rescue.
`bee-prompt-context.mjs` (UserPromptSubmit) and `bee-state-sync.mjs`
(PostToolUse/Stop) call a new `heartbeatTouch(root, sessionId)` that no-ops
unless the stored heartbeat is older than 60s (one cheap stat/read; at most
one write per minute per session). The same touch renews the session's live
claim files' TTL and its holds. Hooks remain fail-open: a throw in touch
never blocks the hook's primary job. Stale threshold stays 900s — with
refresh actually running, 15 min of true silence now genuinely means gone.

**D6 — Full state revision/CAS stays deferred (cnr2-5), D2's lock is the
fix here.** Logical state RMW verbs go through `withStoreLock('state', ...)`;
a revision counter + compare-and-swap remains a future concern once
cross-process contention outgrows the lock. Logged so planning cannot
re-scope it in by accident.

**D7 — Compatibility floor.** No store format changes (reservations.json,
cells/*.json, sessions/*.json unchanged); new artifacts live under
`.bee/locks/` (gitignored, runtime tier). Single-session behavior is
byte-compatible except where a race would previously have silently corrupted
(those paths now refuse loudly). Every new refusal is typed and names its
holder — no bare "denied".

## Success criteria

1. A forked-racer test proves: N concurrent `cells claim --id X` → exactly one
   winner, N-1 typed `CLAIMED` refusals (extend `test_state_write_concurrency`
   child-orchestrator pattern per critical-patterns 20260714 async rule).
2. Forked-racer reserve test: N concurrent reserves of distinct paths → N
   surviving rows (no lost update); overlapping path → exactly one winner.
3. Mutator ownership test rows: live-claim mismatch refuses; expired/no-claim
   proceeds; `--force-ownership` proceeds and appends the audit line.
4. Hook-driven heartbeat test: touch under 60s no-ops (byte-identical store),
   over 60s refreshes heartbeat + renews claim/hold TTLs; hook stays green
   when touch throws.
5. Existing suites stay green: full configured verify chain, including
   write-guard and model-guard rows byte-unchanged (freeze-first per
   critical-patterns 20260716 for `claims.mjs`/`reservations.mjs` edits).
6. Skill text (`bee-executing`, `bee-swarming`, worker-details) reflects
   D1/D3: orchestrator claims first; workers validate; no handed-down ids.

## Non-goals

- Git working-tree/index isolation (worktree feature owns it; rule 14 stands).
- SQLite or any new dependency; store format migrations.
- Scheduler-level global lease across sessions (claim-before-spawn subsumes
  the practical need).
- Codex-runtime hook parity for D5 (Codex hooks have no per-prompt event
  today; prose rule remains — filed as follow-up if needed).
