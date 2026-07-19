---
artifact_contract: bee-implement-plan/v1
feature: multi-session-hardening
lane: high-risk
status: Ready for Review
updated: 2026-07-19
sources: [CONTEXT.md, plan.md, .bee/cells/msh-1.json, .bee/cells/msh-2.json, .bee/cells/msh-3.json, .bee/cells/msh-4.json, .bee/cells/msh-5.json, .bee/cells/msh-6.json]
decisions: [D1, D2, D3, D4, D5, D6, D7]
---

# Implementation Plan: multi-session-hardening

> Human-layer projection of the truth artifacts. Truth lives in CONTEXT.md
> (decisions), plan.md + cells (work), and the validating report (evidence).
> Feedback on this document flows back to those artifacts, then this re-renders.

Hardens bee's same-checkout multi-session coordination so that concurrent
sessions can no longer silently double-claim a cell, silently drop a
reservation, mutate a cell another session owns, or go undetected as stale
while mid-turn. The gap was found by a line-by-line audit against the 1.6.2
source (decision 12f54e88) and confirmed by three live near-misses on
2026-07-19 (decisions 0101ec31, ec2912ba; learning
`20260719-codex-native-transport.md`). Six dependency-ordered cells
(`msh-1`..`msh-6`) close it: a shared lockfile primitive, a race-safe claim
path, lock-guarded reservations, ownership-checked cell mutators, a throttled
heartbeat/lease renewal, and a doctrine sync so the skill text matches the new
contract.

## D1-D7 Decision Summary

| ID | One-line | Key refusal / compatibility guarantee |
|----|----------|----------------------------------------|
| D1 | `cells claim --id` is re-backed by the same O_EXCL claim file (`claimCellFile`, `wx`) that `claim-next` already uses; claim file acquired before the cell JSON flips. | Loser gets a typed `CLAIMED` refusal naming owner + expiry (was: silent double-claim). No behavior change for the winner. |
| D2 | New `withStoreLock(root, name, fn)` lib primitive: O_EXCL lockfile under `.bee/locks/`, bounded retry/backoff (~50ms x up to 100 tries), 30s stale-lock takeover, holder metadata, always released in `finally`. Reservation and state logical-RMW verbs run inside it. | Timeout is a typed `LOCK_BUSY` refusal naming the holder pid/session — never a fall-through unlocked write. Lock guards bee's own CLI verbs only; hooks never take it (stay read-only + fail-open). |
| D3 | Session id is resolved at mutation time: explicit flag -> `CLAUDE_CODE_SESSION_ID` env -> hook-payload-derived id -> absent. Never handed down in a worker prompt. | A truly absent id still writes a session-less row, same as today (fixes the cnt-6 mismatch class). |
| D4 | `verify`/`cap`/`block`/`unclaim`/`reopen` (+ `update` on claimed cells) compare the caller's derived session against the live claim file's session. | Live-claim mismatch refuses by name (owner + expiry); expired claim, no claim, or matching session proceeds unchanged — fully backward compatible for single-session use. `--force-ownership` bypasses with an audit line appended to the cell trace. |
| D5 | `heartbeatTouch(root, sessionId)` rides the existing `bee-prompt-context.mjs` (UserPromptSubmit) and `bee-state-sync.mjs` (PostToolUse/Stop) hooks, no-oping unless the stored heartbeat is older than 60s. | Hooks stay fail-open: a throw inside touch never blocks the hook's primary job. Stale threshold stays 900s, now backed by an actually-running refresh. |
| D6 | Logical state RMW verbs move inside `withStoreLock('state', ...)`; a full revision counter / compare-and-swap stays deferred (cnr2-5). | `writeState()` itself is unchanged (still whole-object atomic rename); the lock is the fix for the RMW race described in `test_state_write_concurrency.mjs:24-33`. |
| D7 | Compatibility floor: no store format changes to `reservations.json`, `cells/*.json`, or `sessions/*.json`; new artifacts (`.bee/locks/`) are gitignored runtime tier. | Single-session behavior is byte-compatible except paths that would previously have silently corrupted under a race — those now refuse loudly, and every new refusal is typed and names its holder. |

## Cross-Cutting Patterns

Every cell that touches `templates/lib/` obeys two standing patterns from
`docs/history/learnings/critical-patterns.md`, applied per-cell rather than
as a separate step:

1. **Freeze-first (20260716).** Before editing `claims.mjs`, `reservations.mjs`,
   `cells.mjs`, or `state.mjs`, the touching cell first runs the relevant
   existing suites green and records the output, so any regression the cell
   introduces is visible against a known-green baseline.
2. **Manifest write+check inside the cell (20260715 + 20260719 recurrence).**
   Each lib-touching cell runs `release_manifest.mjs --write` then `--check`
   itself as part of its own verify, so the tree it commits is always
   manifest-green — regen is never deferred to a later cell except the final
   close pass in `msh-6`.

## Cell Sections

### msh-1 — `withStoreLock` O_EXCL lockfile primitive + racer selftest (D2)

- **Goal:** land the shared locking primitive every later cell depends on, with no callers wired yet.
- **Files:** `skills/bee-hive/templates/lib/lock.mjs` (create) + `.bee/bin/lib/lock.mjs` mirror, `scripts/test_store_lock.mjs` (create), `.gitignore`, `docs/history/codex-harness-hardening/release-manifest.json`.
- **Approach:** export `withStoreLock(root, name, fn)`: `mkdir .bee/locks`, acquire `.bee/locks/<name>.lock` via `writeFileSync` with `wx` containing `{pid, session, ts}`; on `EEXIST` retry ~50ms up to 100 tries; before each retry, take over a lock whose mtime is older than 30s (unlink + reacquire, still race-safe via the `wx` loop); on timeout return/throw a typed `{type: refused, reason: LOCK_BUSY, holder}` parsed from the lock body; always release in `finally`, and release only unlinks a lock this process itself acquired (compared by pid+token). `scripts/test_store_lock.mjs` is a forked-racer, single-`spawnSync`-row child-orchestrator (critical-patterns 20260714 async rule) covering: no lost update under N racers, the stale-takeover case, and the `LOCK_BUSY` case. `.bee/locks/` is gitignored. Does not wire any caller — msh-2/3/5 own that.
- **Verify:** `node scripts/test_store_lock.mjs && node scripts/test_lib_mirror.mjs && node scripts/release_manifest.mjs --check`
- **Deps:** none.
- **Must-have truths:** lock body names holder pid+session+ts; release only removes a lock this process acquired; no caller changes in this cell.
- **Prohibitions:** no fail-open unlocked write path; no dependency additions.

### msh-2 — `cells claim` re-backed by O_EXCL claim file + session-id self-derivation (D1+D3)

- **Goal:** make cell claiming race-safe end to end and give every verb a shared way to resolve "who is calling."
- **Files:** `skills/bee-hive/templates/lib/cells.mjs`, `skills/bee-hive/templates/lib/claims.mjs`, `.bee/bin/lib/cells.mjs`, `.bee/bin/lib/claims.mjs`, `skills/bee-hive/templates/bee.mjs`, `.bee/bin/bee.mjs`, `skills/bee-hive/templates/tests/test_lib.mjs`, `scripts/test_claim_race.mjs` (create), release manifest.
- **Approach:** freeze-first — run `test_lib.mjs` + `test_bee_cli.mjs` green and record output before editing. Export `resolveSessionId({flag})` from `claims.mjs` with precedence explicit flag -> `CLAUDE_CODE_SESSION_ID` env -> null; use it in `claim-next` (existing `--session-id` keeps working) and the new claim path. `claimCell` acquires the claim file via `claimCellFile` first (typed `CLAIMED` refusal on loss, naming owner session + expiry), only then mutates the cell JSON; the claim file's session is the resolved session id (a null session still creates the claim file, session field absent). `cells claim` CLI passes the flags through. Unclaim/cap extend to release the claim file. `scripts/test_claim_race.mjs` is a forked-racer child-orchestrator: N concurrent `cells claim --id X` -> exactly one winner, N-1 typed `CLAIMED` refusals. Existing test rows stay byte-unchanged.
- **Verify:** `node scripts/test_claim_race.mjs && node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/templates/tests/test_bee_cli.mjs && node scripts/test_lib_mirror.mjs && node scripts/release_manifest.mjs --check`
- **Deps:** msh-1.
- **Must-have truths:** single-session flow (no env id) still claims successfully; loser refusal names owner and expiry; claim-next path unchanged for winners.
- **Prohibitions:** no store format change; no scheduler changes.

### msh-3 — reservations RMW under store lock + session auto-derive (D2+D3)

- **Goal:** stop concurrent reserves from silently dropping each other's holds, and make session-less reserves visible by default.
- **Files:** `skills/bee-hive/templates/lib/reservations.mjs`, `.bee/bin/lib/reservations.mjs`, `skills/bee-hive/templates/bee.mjs`, `.bee/bin/bee.mjs`, `scripts/test_reservation_race.mjs` (create), release manifest.
- **Approach:** freeze-first — existing reservation rows in `test_lib`/`test_bee_cli` green, recorded. Wrap `reserve`/`release`/`sweep` read-check-write bodies in `withStoreLock(root, 'reservations', fn)`, with the conflict check running inside the lock. When `--session` is absent, `reserve` resolves it via the msh-2 `resolveSessionId` helper, so top-level-session reserves become cross-session-visible by default; a genuinely absent id still writes a session-less row (today-compatible). Typed `LOCK_BUSY` surfaces the holder. `scripts/test_reservation_race.mjs` is a forked-racer: N concurrent reserves of distinct paths -> N rows survive; same path -> one winner + typed conflicts for the rest.
- **Verify:** `node scripts/test_reservation_race.mjs && node skills/bee-hive/templates/tests/test_lib.mjs && node scripts/test_lib_mirror.mjs && node scripts/release_manifest.mjs --check`
- **Deps:** msh-1, msh-2 (shares the session helper).
- **Must-have truths:** no reservation silently lost under concurrency; write-guard consumers see auto-derived sessions; hooks still never take the lock.
- **Prohibitions:** no `reservations.json` format change; no hook edits in this cell.

### msh-4 — claim-ownership check on cell mutators + audited force door (D4)

- **Goal:** stop one session from mutating a cell another session is actively holding, with a loud rescue path.
- **Files:** `skills/bee-hive/templates/lib/cells.mjs`, `.bee/bin/lib/cells.mjs`, `skills/bee-hive/templates/bee.mjs`, `.bee/bin/bee.mjs`, `skills/bee-hive/templates/tests/test_lib.mjs`, release manifest.
- **Approach:** freeze-first — `test_lib` + `test_bee_cli` green, recorded. `recordVerify`/`capCell`/`blockCell`/`unclaimCell`/`reopenCell` (+ `updateCell` when the cell is claimed) read the live claim file: if a claim exists, is unexpired, carries a session, and the caller's resolved session (D3) differs, the verb returns a typed refusal naming owner + expiry; an expired claim, absent claim, session-less claim, or a matching session proceeds unchanged. CLI flag `--force-ownership` on these verbs bypasses the check and appends an audit entry (who forced, when, owner bypassed) to the cell trace's `deviations`. Test rows cover all three branches plus the force-audit row; existing rows stay byte-unchanged.
- **Verify:** `node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/templates/tests/test_bee_cli.mjs && node scripts/test_lib_mirror.mjs && node scripts/release_manifest.mjs --check`
- **Deps:** msh-2.
- **Must-have truths:** single-session use never hits a refusal; refusal names owner and expiry; force always leaves an audit line in the trace.
- **Prohibitions:** no throw inside guard-consumed paths (typed returns only); no change to cap verify-evidence requirements.

### msh-5 — throttled heartbeat + lease renewal in hooks; state RMW under lock (D5+D6)

- **Goal:** keep a live session's heartbeat and claim/hold TTLs actually fresh, and close the state-store RMW race the same way reservations was closed.
- **Files:** `skills/bee-hive/templates/lib/claims.mjs`, `.bee/bin/lib/claims.mjs`, `skills/bee-hive/templates/lib/state.mjs`, `.bee/bin/lib/state.mjs`, `hooks/bee-prompt-context.mjs`, `hooks/bee-state-sync.mjs`, `.bee/bin/hooks/bee-prompt-context.mjs`, `.bee/bin/hooks/bee-state-sync.mjs`, `scripts/test_heartbeat_touch.mjs` (create), release manifest.
- **Approach:** freeze-first — `test_hook_contracts` + `test_state_write_concurrency` green, recorded. `claims.mjs` exports `heartbeatTouch(root, sessionId)`: no-ops unless the stored heartbeat is older than 60s, otherwise refreshes the heartbeat and extends the TTL of this session's claim files and holds. Wired into `bee-prompt-context.mjs` and `bee-state-sync.mjs` inside their own `try/catch` so the hook stays fail-open and green even when touch throws; session id comes from the hook payload/env per D3. State logical-RMW verbs (worker add/remove, scribing-run, start-feature, gate, generic set) move inside `withStoreLock(root, 'state', fn)`; `writeState()` itself is unchanged. `scripts/test_heartbeat_touch.mjs` covers: throttle no-op is byte-identical, over-60s does refresh+renew, and a throw inside touch still leaves the hook exit green. Existing hook-contract and concurrency suites stay byte-unchanged and green. Note: `hooks/*.mjs` are catalog-rendered onto projections — check `hooks/catalog.mjs` wiring and re-render projections if the catalog hashes handler bytes.
- **Verify:** `node scripts/test_heartbeat_touch.mjs && node hooks/test_hook_contracts.mjs && node scripts/test_state_write_concurrency.mjs && node scripts/test_lib_mirror.mjs && node scripts/release_manifest.mjs --check`
- **Deps:** msh-1, msh-2, msh-3.
- **Must-have truths:** hooks remain fail-open (a touch throw never blocks); at most one heartbeat write per 60s per session; state verbs serialized under the lock.
- **Prohibitions:** no stale-threshold change (900s stays); no new hook events registered.

### msh-6 — doctrine sync: orchestrator-claims-before-spawn in skill text + final render/manifest (D1+D3 close)

- **Goal:** bring the worker/orchestrator contract in the skill text into line with D1/D3 so the mechanized behavior and the documented behavior agree, and close the feature manifest-green.
- **Files:** `skills/bee-executing/SKILL.md`, `skills/bee-executing/references/worker-details.md`, `skills/bee-swarming/SKILL.md`, `skills/bee-swarming/references/swarming-reference.md`, release manifest. Docs/skill-text only — no lib edits.
- **Approach:** update worker and orchestrator skill text so the orchestrator claims the cell (`claim-next` or `cells claim --id`, session id self-derived or explicit) before spawning; the worker's startup step validates ownership via `cells show` (claimed + expected worker/session) and never runs `cells claim` itself; reservation instructions drop every handed-down session id (workers rely on auto-derive / their own env). The AO14 single-execution-worker contract wording is preserved unchanged. Re-render skill projections if the render suite requires it, then run the final `release_manifest.mjs --write` for the feature close.
- **Verify:** `node scripts/test_skill_render.mjs && node scripts/test_conformance.mjs && node scripts/census_stale_spawn_syntax.mjs && node scripts/release_manifest.mjs --check`
- **Deps:** msh-2, msh-3, msh-4, msh-5.
- **Must-have truths:** no skill text instructs a worker to run `cells claim`; no literal handed-down session id remains in worker templates; AO14 contract wording preserved.
- **Prohibitions:** no lib/source edits; no contract weakening for reservations.

## Validation Plan

**Automated** — each cell's own `verify` command (listed above) plus, at
close, the full configured verify chain (plan.md success criterion 5:
write-guard and model-guard rows byte-unchanged).
**Manual** — none called out beyond the forked-racer selftests each cell
records.
**Evidence** — pending; links to `docs/history/multi-session-hardening/reports/…`
once `bee-validating` runs.

## Risks

| Risk | Mitigation |
|------|------------|
| A lock bug can wedge every CLI verb. | Stale takeover + `LOCK_BUSY` naming the holder; the lock guards CLI verbs only (hooks never take it). |
| A false ownership refusal can strand a cell. | Expired-claim pass-through + the `--force-ownership` door. |
| Hook edits are fail-open-critical. | `heartbeatTouch` wrapped in its own try/catch; hook-contract tests (`test_hook_contracts`) must stay green. |

## Open Questions

No blocking open questions. Ready for review.
