# CONTEXT — worktree-feature-parallelism

## Boundary

**In scope.** A new, opt-in bee mode in which a single orchestrator session fans work
out into several *independent features*, each running its **own full bee lifecycle
(own phase + own gates + own event log)** inside its **own git worktree**, then
reconciles both code and provenance back to `main` on `git merge`. The mechanism is
event-sourced: the durable `.bee/` log becomes the tracked, union-mergeable source of
truth; the live phase/gate cache is a derived projection rebuilt by replay. Proven
end-to-end in **beegog's own repo first** (real worktree, real merge, real replay).

**Out of scope.**
- Host rollout / migration of the 9 onboarded hosts (a separate later decision — D6).
- Same-feature / same-file concurrent read-write across worktrees — delegated to the
  existing claims/holds primitives ("gastown"); this feature covers **file-disjoint,
  independent features** across worktrees (D4).
- Any change to the P40 `worktree-isolation` swarm-worker behavior or its locked D2
  (shared main store for swarm workers) — this mode coexists beside it, does not
  replace it (D1).
- Codex / manual `git worktree` lifecycle — inherits P40's deferral.

## Origin

- User report (mdview host session, 2026-07-16): an agent hand-rolled a git worktree
  for an *independent* piece of work and every source write was blocked by the main
  checkout's `state.json` (a different feature, execution not approved). Diagnosis:
  P40 supports worktree parallelism **only** through orchestrated swarm-cell dispatch
  under one already-approved feature; there is **no supported path for a worktree to
  run its own independent bee lifecycle with its own gates**.
- Subsumes backlog **P30** (tracked `.jsonl` `merge=union`), extends it from
  "logs stop conflicting" to "a whole feature's state merges back."
- Deferred sibling: P40 (`worktree-isolation`) swarm-worker mode; P41 (write-guard
  wait/queue); P29 (headless outer loop).

## Domain types

- `ORGANIZE` — the `.bee/` on-disk layout (three tiers) and its git-tracking policy.
- `RUN` — the `bee replay` projection step and the worktree spawn/merge flow.
- `CALL` — the opt-in CLI verb that declares an independent-feature worktree.

## Locked decisions

| ID | Decision |
|----|----------|
| D1 | **New mode, coexists with P40 — extends the shared resolver without altering P40's swarm-worker resolution path.** P40 swarm-worker worktrees keep resolving to the shared main store, byte-for-byte unchanged (the existing `linked-valid → main` branch is preserved). This feature adds a *separate* outcome to the same `resolveRoots`: an independent-feature worktree with its own live store. The two are distinguished by an explicit opt-in signal (D2), never inferred from worktree shape; the default (no opt-in) stays fail-closed exactly as P40 leaves it. |
| D2 | **Opt-in via an explicit orchestrator command** (e.g. `bee worktree new --feature <slug>`). Never an environment-variable root override, never an onboarding-marker-as-trust — both were rejected by P40 (`5de1fd36`, `58c56bb6`) and must not be reintroduced. The command is the only channel that marks a worktree as an independent-feature store. **Load-bearing seam (spike's primary must-answer):** `resolveRoots` runs stateless and per-write, so a one-time command cannot inform later writes on its own — *something* must persist inside the worktree to say "I am an independent store," yet a naive persisted marker is structurally the rejected onboarding-marker-as-trust pattern. How the resolver distinguishes a genuine opt-in without leaning on an untrusted in-worktree marker (e.g. a signed/back-linked token the command writes into the *main* store's runtime tier and the worktree references, or resolution keyed on the main store rather than the worktree) is the **first question the D6 spike must answer** before anything else is built. |
| D3 | **`.bee/` splits into three tiers by lifecycle.** `log/` = durable append-only event log (decisions, cell/cap events, review-candidates): **git-tracked** with `merge=union` — travels with the branch, merges back. `cache/` = phase/gate/lane state (today's `state.json`, `lanes/`): **derived**, gitignored, rebuilt by `bee replay` from `log/`. `runtime/` = live coordination (`sessions/`, `claims/`, `reservations.json`): live TTL/heartbeat, gitignored, **never merged** (a merged stale hold from a deleted branch is a bug). |
| D4 | **Full per-worktree isolation of phase/gates/state.** Isolation boundary is the worktree (filesystem/git — OS-authenticated). Same-feature / same-file concurrent read-write across worktrees is **explicitly out of scope**, handed to claims/holds. This mode targets independent, file-disjoint features. |
| D5 | **Idempotent merge + replay.** Every `log/` event carries a stable id; `bee replay` is a pure, deterministic projection that sorts by `(timestamp, id)` and dedups by id. `git merge` union-merges `log/`; replay on `main` reconstructs the full picture including every branch's events. Cross-feature merges reconcile automatically; same-file conflicts are the claims/holds boundary (D4). |
| D6 | **Prove in beegog first (spike-first).** Build and demonstrate the whole mechanism — real worktree, real independent gates, real `git merge`, real replay — inside bee's own repo before any host onboarding or on-disk-layout change ships. Rollout to the 9 hosts (back-compat vs clean-break) is a distinct decision made **after** the mechanism is proven. |

## Terms

- **independent-feature worktree** — a git worktree running its own full bee lifecycle
  (own phase, own gates, own `log/`), reconciled to `main` by `git merge` + replay.
  Distinct from P40's **swarm-worker worktree** (shares the main store, one gate).
- **log tier / cache tier / runtime tier** — the three lifecycle classes of `.bee/`
  data (D3): tracked-mergeable, derived-disposable, live-local respectively.
- **replay** — the pure deterministic projection of the merged event log into the
  cache tier's materialized state (D5).

## Scout paths (existing patterns to build on)

- `.bee/bin/hooks/adapter.mjs:135-188` — `resolveRoots()`: typed worktree resolution
  (`ordinary` / `linked-valid` / `linked-invalid`), currently forces `storeRoot = main`.
- `.bee/bin/lib/state.mjs:270-321` — throwing twin `resolveRoots` + `WorktreeLinkInvalidError`;
  `state.mjs:328-343` `defaultState()` + `statePath()`.
- `.bee/bin/lib/guards.mjs:160-197` — session→lane resolution + cross-session hold check.
- `.bee/bin/lib/claims.mjs`, `reservations.mjs` — the live coordination primitives (runtime tier).
- `.bee/bin/lib/decisions.mjs`, `reviews.mjs`, `capture.mjs`, `perf.mjs` — existing
  append-only `.jsonl` logs (the pattern the log tier generalizes).
- `docs/history/worktree-isolation/CONTEXT.md:34-37` — P40's locked D1–D4, especially
  D2 (shared main store) which this mode must coexist with, not violate.

## Planning / validating constraints (from fresh-eyes review)

- **The opt-in-persistence seam is the spike's first must-answer** (D2) — resolve it
  before any tier restructuring is built.
- **Pin a P40 regression/control test** in validating: the `linked-valid → main`
  swarm-worker branch of `resolveRoots` (both the adapter copy and the `state.mjs` copy)
  must stay byte-for-byte behaviour-identical; the new opt-in outcome is additive only.
- "gastown" throughout this doc = the existing claims/holds coordination primitives
  (`claims.mjs`, `reservations.mjs`), used as shorthand for the heavier same-file
  coordinator, not a new component.

## Open questions / deferred ideas

- **Host rollout strategy** (back-compat additive vs clean-break major bump) — deferred
  to after the beegog spike proves the mechanism (D6). → backlog.
- **Same-feature / same-file cross-worktree concurrency** ("gastown") — deferred; the
  claims/holds primitives are the intended answer (D4). → backlog.
- **P40 live-acceptance gap** (`71789be2`) — the live native-worktree commit/merge/cleanup
  proof for P40 is still open and independent of this feature; a writable checkout can
  close it separately.
