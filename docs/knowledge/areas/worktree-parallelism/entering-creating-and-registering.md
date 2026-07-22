---
type: bee.area
title: "Worktree Parallelism — entering: creating a feature worktree and registering it"
description: "The paved road that creates and grants a feature worktree in one move, the adoption command that registers a hand-made one, the fresh lifecycle state a bootstrap writes, and the typed zero-mutation refusals and best-effort rollback that guard both."
timestamp: 2026-07-22
bee:
  id: worktree-parallelism-entering-creating-and-registering
  lifecycle: active
  areas: [worktree-parallelism]
  required_context: [areas/worktree-parallelism/the-trust-model.md]
  decisions: ["worktree-session-routing D7 (worktree new is the paved road for STARTING a feature worktree, GH #21)", worktree-feature-parallelism (register/list/unregister and the bootstrap contract)]
  sources: [docs/history/worktree-session-routing/, "docs/specs/worktree-parallelism.md#S-registering-a-worktree-the-cli", "docs/specs/worktree-parallelism.md#S-entering-worktree-new-feature-slug-d7-gh-21"]
  authoritative_for: "worktree-parallelism: creating, granting and bootstrapping a feature worktree"
---

# Worktree Parallelism — Entering: Creating and Registering

Two ways in, and they differ only in who made the worktree. `register` adopts a worktree
that already exists; `new` creates one and adopts it in the same move. Both end in the same
place: a grant in the main store's registry, keyed by the git-verified id, and a freshly
bootstrapped store inside the worktree.

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
  `--base-ref`, resolved as a commit-ish via `git rev-parse --verify --end-of-options
  "<ref>^{commit}"` — accepts HEAD, HEAD~1, short shas, tag^{commit}; the RESOLVED sha is
  what the worktree is created from, and anything unresolvable is one typed
  `WORKTREE_BASE_NOT_FOUND` refusal, the old separate invalid-syntax code retired), then
  grants + bootstraps exactly as `register` does. The grant id is read back from the worktree's git metadata after creation,
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
