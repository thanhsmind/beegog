# Spec — Worktree feature parallelism

**Area:** how one session fans independent work into git worktrees, each running its
own bee lifecycle, reconciled to the main checkout on `git merge`.
**Status:** shipped 2026-07-16 (unreviewed); enter/return commands + routing rule added
2026-07-18 (worktree-session-routing, GH #21, unreviewed). History:
`docs/history/worktree-feature-parallelism/`, `docs/history/worktree-session-routing/`.

## What problem this solves

Two different kinds of parallelism exist in bee:
- **Swarm-worker worktrees (P40, pre-existing):** an orchestrator dispatches many workers
  into worktrees that all share ONE coordination store at the main checkout and work under
  ONE feature's single gate. Worktrees only remove git-index contention.
- **Independent-feature worktrees (this area):** a worktree runs its OWN full bee lifecycle
  — its own phase, gates, and store — so a session can advance several independent features
  at once and merge each back. This is what P40 deliberately did NOT provide.

## The trust model (the load-bearing rule)

A worktree gets its own store ONLY when it is **granted**, and a grant is trusted only when
it comes from a source the worktree cannot forge:

- The grant lives in the **main checkout's** store, at `runtime/worktree-grants.json`, keyed
  by the worktree's **git-verified id** (the id in `<main>/.git/worktrees/<id>`, validated by
  git's bidirectional back-link — the same `<worktree>/.git` ⇄ `<main>/.git/worktrees/<id>/gitdir`
  agreement P40 already checks).
- Resolution (per write, stateless) walks up to the checkout root, classifies it
  (`ordinary` / `linked-valid` / `linked-invalid`), and for a `linked-valid` worktree reads
  the grant registry **from the main store only** — never from anything inside the worktree.
  - registered id → the worktree resolves to its **own** store.
  - not registered / revoked / self-claimed → **main store** (the P40 default, byte-for-byte).
  - invalid link metadata → a **typed deny**, never a thrown exception (a throw inside the
    fail-open write-guard would silently become an allow).

**Why a worktree cannot grant itself:** the resolver never reads a registry located under the
worktree. A worktree may write any self-claiming marker inside its own store and it changes
nothing. This is the exact "onboarding-marker-as-trust" pattern P40 rejected, kept rejected.

## Registering a worktree (the CLI)

- `worktree register --feature <slug>` — run from inside a linked-valid worktree. Writes the
  grant into the main store's registry (keyed by the git-verified id) and **bootstraps** the
  worktree's own store: copies the main store's onboarding + config, writes a FRESH lifecycle
  state (the named feature, phase idle, all gates unapproved). An independent-feature worktree
  runs its OWN feature, so it inherits none of main's state/gates/log.
- `worktree list` / `worktree unregister [--id <id>]` — read/remove grants in the main store.

## Entering: `worktree new --feature <slug>` (D7, GH #21)

The paved road for STARTING a feature worktree — create and register in one move, run from
the ordinary main checkout:

- Creates the sibling `../<repo-basename>--wt--<slug>` on branch `wt/<slug>` (optional
  `--base-ref`, validated via `git check-ref-format`), then grants + bootstraps exactly as
  `register` does. The grant id is read back from the worktree's git metadata after creation,
  never assumed from the directory name. Output names the created path and tells the human to
  open their next session there — a running session is never auto-teleported.
- Slug allowlist `^[a-z0-9][a-z0-9-]*$`; every git call is an argv array (no shell), `--`
  before user-derived values.
- Every refusal is **typed and zero-mutation**: invalid slug/base-ref, caller not an ordinary
  checkout, target path / branch / grant already exists, and git's own `worktree add` failure
  (the pre-checks are advisory; git's atomic failure is authoritative). A failure AFTER the
  worktree was created rolls back best-effort (worktree, branch, grant) and reports typed; if
  even rollback fails, the error names `worktree register` as the adoption path.
- `register` remains for adopting a hand-made worktree; `new` is the paved road.

## Returning: `worktree merge --id <id>` (D8)

Run from the ordinary MAIN checkout (never from inside a worktree — that includes merging
"yourself"):

- Typed zero-mutation refusals first: unknown/ungranted id, dirty MAIN tree, dirty WORKTREE
  tree, detached HEAD or branch mismatch in the worktree. **Dirty** (D8a) =
  `git status --porcelain` without `--ignored`: the worktree's gitignored `.bee` store never
  counts as dirt.
- Then `git merge --no-ff <branch>` on main. A textual conflict returns typed
  `MERGE_CONFLICT` — git's conflict state is left for the human (the log tier already
  union-merges). A clean merge runs the configured `commands.verify` (none recorded →
  `verify: skipped`).
- **A red verify after a textually clean merge is the semantic-conflict alarm** the command
  exists to raise: typed `MERGE_VERIFY_RED` with the output tail — fix-first before release.
  The merge commit is never rolled back by bee.
- `--cleanup` (D8b/D8c): on green (or skipped) verify it runs unconditionally — worktree
  remove, then `git branch -d` (never `-D`), then grant removal, in that order. It refuses
  (typed; the merge result stays ok) when the worktree still holds tracked-modified or
  untracked files. Skipped-verify cleanup always carries a warning that nothing was checked.
  Cleanup never runs after `MERGE_CONFLICT` or `MERGE_VERIFY_RED`.

## Routing rule (D9 — prose, not a hook)

When a session is about to start NEW feature work in a checkout that already has another live
session's active work — a live cross-session heartbeat plus a non-idle phase in the shared
store (D9a), or active holds / live-owner lanes — the paved road is `worktree new` and opening
the next session in the printed path. Docs-lane work, tiny fixes, and release machinery stay
in the MAIN checkout (release always runs in main). The rule lives in bee-hive's Session Scout
and AGENTS.md critical rule 14; the existing guards (holds, live-owner lanes, gates) keep
enforcing the hard parts.

## The three tiers (what merges, what does not)

The store is classified into three lifecycle tiers, realized by git config (no directory move):
- **log tier** — append-only event logs (decisions, backlog, review-candidates). **Tracked**,
  with a `merge=union` git attribute so parallel worktree branches union-merge their provenance
  on `git merge` instead of conflicting. Readers/`replayLog` dedup by event id, so interleaved
  duplicates fold. This is how a worktree's decisions/provenance travel back to main.
- **cache tier** — derived, disposable state (phase/gate state, lanes). Gitignored; rebuilt by
  replaying the log. Never merged.
- **runtime tier** — live coordination (sessions, claims, reservations, the worktree grant
  registry). Gitignored; TTL/heartbeat lifetimes. Never merged — a merged stale hold is a bug.

## Boundary (out of scope)

- Same-feature / same-file concurrent read-write across worktrees — delegated to the existing
  claims/holds primitives, not solved here.
- Rollout to onboarded host repos — deferred; proven in bee's own repo first.
- P40 swarm-worker behavior — unchanged; this area coexists beside it.

## Where it lives (reading map)

- Decision + replay logic: `worktree-store.mjs` (`decideWorktreeStore`, `replayLog`,
  `readGrants`, `writeGrant`, `bootstrapWorktreeStore`, `createFeatureWorktree`,
  `mergeFeatureWorktree` — the last two dependency-free; the CLI handler resolves
  config/roots and passes them in).
- Resolution: `resolveRoots` in the state library (throwing) and the hook adapter
  (non-throwing, import-light — grant read inlined). Both expose `{id, mainRoot, worktreeRoot}`
  for a linked-valid worktree.
- CLI: the `worktree` command group.
- Merge safety: `.gitattributes` (log tier) + the onboarding gitignore block (runtime/cache tiers).
- Tests: resolver P40 regression, grant-resolve, worktree-store unit, worktree CLI e2e (all in
  the mandatory verify chain).
