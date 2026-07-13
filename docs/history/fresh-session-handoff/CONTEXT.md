# Fresh Session Handoff — Context

**Feature slug:** fresh-session-handoff
**Date:** 2026-07-13
**Exploring session:** complete
**Scope:** Deep
**Domain types:** ORGANIZE (state model), RUN (hooks), CALL (CLI verbs)

## Feature Boundary

Multiple interactive terminals work one project (same checkout) without stomping
each other — per-feature lane state replaces the single global pipeline, cell
claims become cross-session-safe (atomic + TTL), cross-session file holds are
hook-enforced — and a session that finishes its task hands the next one to a
fresh session: cap → claim next → write a planned-next handoff → user types
`/clear` → the SessionStart hook rehydrates and the new session starts the next
task by itself. The feature ends at the interactive flow; the headless outer
loop is out of scope (deferred, see backlog).

## Locked Decisions

These are fixed. Planning must implement them exactly — cited, never reinterpreted.
Changing one requires the user, a new D-ID or an explicit supersession note, never
a silent edit.

| ID | Decision | Rationale (only if it changes implementation) |
|----|----------|-----------------------------------------------|
| D1 | Two handoff kinds with different resume behavior: a **planned-next handoff** (previous task capped, verify green, next cell chosen deliberately) auto-resumes — after `/clear` the fresh session starts the next task without asking; a **pause handoff** (mid-work interruption, e.g. context budget) keeps today's rule — surface and WAIT, never auto-resume. | The whole point of the flow is that `/clear` is the only keystroke; but auto-resuming interrupted work is still unsafe. The handoff record must therefore carry its kind, and only the planned-next kind may auto-resume. |
| D2 | When the session's current lane has no open cells left, it automatically claims an open cell from another lane **that already passed execution approval (Gate 3)** (selection ordering is a Deferred-To-Planning question), skipping cells whose paths intersect another session's active holds. Nothing execution-approved left → report "no approved work left" and stop. A lane that has not passed its gates is never auto-started. | Auto-pull is bounded by existing approvals — the human's gate decisions, not the puller, authorize the work. |
| D3 | Cross-session file holds are **hook-enforced (hard block)**: a write into a path held by another live session (hold within TTL) is denied by the write guard, with a message naming the holder and the expiry. Advisory-only checking is rejected. | Scout evidence: today's reservation check is voluntary — nothing stops a session that skips it. The owner wants the DB-lock guarantee, not a convention. |
| D4 | The primary supported topology is **multiple sessions in one checkout** — no setup required, exactly how the owner works today. Git worktrees are a documented option for when two lanes must touch the same code area, not a requirement and not built-for in this feature (no shared-store-across-worktrees work). | Keeps scope honest: same-checkout safety is the deliverable; worktree plumbing would roughly double the state-model work for a topology the owner doesn't use yet. |

### Agent's Discretion

Lane file schema, claim/lock primitive choice (O_EXCL lockfile, per-cell claim
file, or equivalent — anything that closes the read-check-write race the scout
found), what remains in the global `state.json` (index/back-compat mirror),
session identity mechanism, TTL/heartbeat values, and the migration path for
current readers/writers and their tests — all delegated to planning, within the
locked decisions above.

## Terms

| Term | Meaning in this feature |
|------|-------------------------|
| lane | One feature's own pipeline record: its phase, mode, and gate approvals, living apart from other features' records so several can be active at once. |
| planned-next handoff | A handoff written deliberately at task completion: previous cell capped with green verify, next cell already claimed. The only handoff kind that a fresh session may act on without confirmation (D1). |
| pause handoff | Today's HANDOFF.json meaning: work interrupted mid-flight. Surface and wait, never auto-resume — unchanged. |
| hold | A cross-session file reservation with a TTL: while live, other sessions are hard-blocked from writing the held paths (D3). |
| claim (cross-session) | Taking ownership of an open cell in a way that is atomic against concurrent sessions and expires by TTL if the claiming session dies. |

## Existing Code Context

From the background scout (state.json consumer inventory, 2026-07-13). Downstream
agents read these before planning.

### Reusable Assets

- `skills/bee-hive/templates/lib/state.mjs` — `readState`/`readStateStrict`/`writeState` primitives; `startFeature` (:483-563) already does a guarded atomic feature-start (preconditions: terminal phase, no HANDOFF, no workers, no active reservations, no claimed cells) — the natural seam for "start a lane".
- `skills/bee-hive/templates/lib/reservations.mjs` — TTL semantics to reuse for holds and claims: `isExpired` (:29-35), `isActive` (:37-39), `findConflicts` (:79-87) with path-overlap matching, `sweepExpired` (:135-148). Default TTL 3600s.
- `skills/bee-hive/templates/lib/fsutil.mjs:37-42` — `writeJsonAtomic` (tmp + rename). Atomic per-write but **no lock/CAS**: reserve/claim do read-check-write in three steps, so two concurrent CLI calls can both pass the check (race confirmed by scout). The new claim primitive must close this.
- `hooks/bee-session-init.mjs` + `skills/bee-hive/templates/lib/inject.mjs:100-207` — `buildSessionPreamble` already assembles the post-`/clear` injection (state, HANDOFF block, gates, debts); rehydrate extends this, it does not need a new hook.
- `lib/guards.mjs` + `hooks/bee-write-guard.mjs` — the PreToolUse write guard that already denies direct state edits; D3's cross-session hard block extends this exact mechanism.

### Established Patterns

- CLI-owned state mutation (hive law 12): every new lane/claim/handoff mutation needs a CLI verb in `bee.mjs` / `lib/command-registry.mjs`; direct JSON edits are denied.
- Templates are the source of truth (`skills/bee-hive/templates/` vendored byte-identical to `.bee/bin/`); a standing test enforces parity.
- Fail-open reads / fail-closed mutations (`readState` vs `readStateStrict`).

### Integration Points

- `.bee/state.json` readers that must survive the split (scout, with anchors): `hooks/bee-chain-nudge.mjs:64-69` (phase, workers), `hooks/bee-session-close.mjs:172-208` (phase), `lib/inject.mjs` (phase/mode/next_action/gates), `lib/cells.mjs:290-317` (`claimCell` reads `approved_gates.execution` — becomes lane-scoped), `:477-496` (`scribingDebt`), `bee.mjs:190-272` (`buildStatus`).
- `.bee/HANDOFF.json` today: no CLI writer (agent Write, prose-instructed), no schema validation (`readHandoff` :296-298), no kind field; "never auto-resume" exists only as prose in `inject.mjs:127`, `bee.mjs:246`, SKILL/AGENTS prose. D1 turns this into a schema'd, CLI-written record with a `kind`.
- `startFeature` preconditions (`state.mjs:504-509` refuses on HANDOFF existence, claimed cells anywhere, active reservations) — all currently global; must become lane-aware without weakening the guarantee.
- Tests pinning the single-file shape (will need migration, scout list): `templates/tests/test_lib.mjs` :174-233 (read/readStrict), :3073-3131 (`state set` byte-survival), :3313-3394 (worker prune), :3614-3750 (start-feature preconditions), :746-887 (preamble text); `templates/tests/test_bee_cli.mjs:452-509`, :839-846; `hooks/test_hook_contracts.mjs:1668-1703`, :1760-1774, :1235-1243.

## Canonical References

- `docs/specs/workflow-state.md` — the durable workflow record spec (phase vocabulary, gates, guarded feature-start); this feature amends it at scribing time.
- `docs/specs/hook-runtime.md` — lifecycle guardrail spec; D3's hard block and the rehydrate live here.
- `docs/specs/doctrine-layer.md` B3a + critical rule 13 — any new standing rule this feature adds must carry its own transport.
- `.bee/logs/dispatch.jsonl` pattern (P22) — precedent for append-only session-scoped logs.

## Outstanding Questions

### Resolve Before Planning

(none — all four gray areas locked)

### Deferred To Planning

- [ ] Claim/lock primitive that actually closes the race (O_EXCL claim file per cell vs lockfile around the store) — decided by a small feasibility probe on the target platforms (WSL2 + Windows Git Bash; note critical pattern 20260708: node cannot resolve MSYS `/tmp` paths). **Gating probe, not a late detail**: D3's hard block and cross-session claims both collapse if no primitive works on both platforms — run it first (fresh-eyes review, 2026-07-13).
- [ ] Claim ownership across the handoff/`/clear` boundary — the claiming session dies at `/clear` and the rehydrated session is a new identity: does the planned-next handoff carry the claim (handoff-owned until adopted) or does the fresh session re-claim, and what closes the window in which a third session could grab the just-claimed cell? (fresh-eyes finding, 2026-07-13)
- [ ] Session identity: what names a session in claims/holds (pid + start time? generated id persisted per terminal?) and how heartbeat/TTL renewal works while a session works a long cell.
- [ ] Lane file layout and what `state.json` keeps (index? active-lane mirror for back-compat readers?) — constrained by the reader inventory above.
- [ ] How `bee_status`/preamble present multiple active lanes without breaking the single-lane display contract tests.
- [ ] Priority order for D2's cross-lane pull (backlog rank? lane age? explicit priority field?).

## Deferred Ideas

Out-of-scope ideas captured during exploring. Not lost, not planned.

- Headless outer loop (`while claim-next; do claude -p ...; done`) — approach 2 from the owner conversation; deliberately deferred until the interactive flow is proven. → backlog row (proposed).
- Shared coordination store across git worktrees — only needed if the owner adopts the worktree topology later (D4).
- `merge=union` gitattributes for the tracked append-only `.jsonl` files — small, standalone quality-of-life item for multi-branch work.

## Handoff Note

CONTEXT.md is the source of truth. Decision IDs are stable. Planning reads locked
decisions, code context, canonical references, and deferred-to-planning questions.
Validating and reviewing use locked decisions for coverage and UAT.
