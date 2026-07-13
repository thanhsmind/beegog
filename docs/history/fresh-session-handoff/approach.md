# Approach: Fresh Session Handoff

## Recommended path

Build bottom-up from the one primitive everything rests on: an **O_EXCL claim
file** (probe-proven, `.bee/spikes/fresh-session-handoff/`) plus a **session
identity** that survives into hooks and CLI calls. On that foundation, make the
lane model **additive, not a rewrite**: `state.json` remains the *default lane*
and gains an index, extra lanes live in `.bee/lanes/<feature>.json`, and a
session resolves its lane through its own session record — so a repo with zero
extra lanes behaves byte-identically to today and the pinned test suite stays
green until each consumer is deliberately migrated. Then land D3's hard block
(holds carry session identity; the existing write guard denies cross-session
overlap), and finally D1/D2's flow: a schema'd handoff with a `kind` field,
cap → claim-next → planned-next handoff → `/clear` → rehydrate, where **the
handoff carries the claim** and the fresh session *adopts* it (ownership
transfer closes the fresh-eyes race window; the claim's TTL covers a session
that never comes back).

## Rejected alternatives

- **One lockfile serializing the whole store** — coarse contention, and stale-lock recovery is harder than per-cell claim files; O_EXCL-per-cell is the probe-proven primitive.
- **Pure per-lane split (delete global state.json)** — breaks every reader and ~20 pinned test sites at once (scout inventory); the default-lane fallback migrates incrementally with a green suite at every step.
- **SQLite/real DB for coordination** — closes the race, but adds a native dependency to a zero-dependency vendored harness; against the "vừa đủ" philosophy.
- **Advisory-only holds** — rejected by the owner outright (D3).

## Risk map

| Component | Risk | Reason | Proof needed |
|---|---|---|---|
| O_EXCL claim atomicity | LOW (linux) / MEDIUM (win32) | probe PASS 20×8 on WSL2; win32 `wx` → CREATE_NEW documented upstream but unproven here | validating: re-run probe on a Windows Git Bash host, or accept documented-upstream with a runtime self-check cell |
| Session identity reaching every consumer | MEDIUM | hooks receive `session_id` in their payload; CLI verbs run in Bash where no session var is guaranteed | validating: inspect hook payload fixtures + prove a pass-through mechanism (env var set by SessionStart? session file keyed by cwd+pid ancestry?) before any cell writes to it |
| Reader/test migration (lane fallback) | HIGH | ~20 pinned test sites assume one state.json (CONTEXT integration points) | suite must stay green after the foundation slice with zero lanes created — that IS the slice's verify |
| D3 hard block false positives | MEDIUM | the write guard must never block a session's *own* holds; mis-resolved identity = every write denied | hook-contract test: same-session write allowed, cross-session denied, expired hold allowed |
| Claim adoption across /clear | MEDIUM | new session identity must adopt the handoff-carried claim atomically | fixture test simulating two sessions racing for a handoff-carried cell |
| Preamble/display contract | LOW | preamble text is pinned by tests :746-887 | migrate assertions alongside the inject change, same cell |

## Files and order

1. `skills/bee-hive/templates/lib/` — new claim/session module (or extension of `reservations.mjs`); `state.mjs` lane resolution; tests RED-first in `templates/tests/test_lib.mjs`.
2. `skills/bee-hive/templates/lib/command-registry.mjs` + `bee.mjs` — new verbs (lane, claim-next, handoff write/adopt, session).
3. `lib/guards.mjs` + `hooks/bee-write-guard.mjs` + `hooks/test_hook_contracts.mjs` — D3 hard block.
4. `lib/inject.mjs` + `hooks/bee-session-init.mjs` — rehydrate branch (D1).
5. `skills/bee-hive/SKILL.md`, `references/routing-and-contracts.md`, `templates/AGENTS.block.md` — prose: two handoff kinds, claim-next flow; any new standing rule carries its transport (doctrine-layer B3a / critical rule 13).
6. Version bump + onboarding vendor sync; specs (`workflow-state.md`, `hook-runtime.md`) at scribing.

## Relevant learnings

- `docs/history/learnings/critical-patterns.md` [20260710] **never release another agent's reservations on a stall signal** — TTL reclaim must check disk progress (heartbeat freshness) before stealing a claim; a reclaim is the orchestrator opening the door with the key, so the rule becomes: expired TTL + no heartbeat progress = reclaimable, anything else = untouchable.
- [20260708] Windows Git Bash `/tmp` invisible to node — the claim/session paths must always be repo-relative (`.bee/…`), never system temp.
- [20260708] verify strings are authored, not read — every cell's verify dry-runs before it ships.
- [20260710] evidence checkpointed to disk per step — the probe result is already on disk under `.bee/spikes/fresh-session-handoff/`.

## Questions for validating

- Does the hook payload carry `session_id` on every event we need (SessionStart, PreToolUse, Stop), and what is the honest pass-through to CLI verbs the agent runs in Bash?
- Windows host probe: run `probe_atomic_claim.mjs` on a real Windows Git Bash host, or accept the documented-upstream claim with a self-check?
- D2 selection ordering: backlog rank → lane age is the proposed key; confirm `bee_backlog.mjs rank` exposes what claim-next needs.
- Does `startFeature`'s precondition set (no claimed cells ANYWHERE, no reservations) stay global or become lane-scoped without weakening its guarantee? (It guards against burying unfinished work — lane-scoping it must not allow two lanes over the same paths.)
