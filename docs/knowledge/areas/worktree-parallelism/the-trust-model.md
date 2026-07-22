---
type: bee.area
title: Worktree Parallelism — the trust model that decides which store a worktree gets
description: "Why a worktree only ever gets its own store when it is granted from a source it cannot forge, how per-write resolution classifies a checkout and reads the grant registry from the main store only, and why a self-claiming marker inside a worktree changes nothing."
timestamp: 2026-07-22
bee:
  id: worktree-parallelism-the-trust-model
  lifecycle: active
  areas: [worktree-parallelism]
  required_context: [areas/worktree-parallelism/overview.md]
  decisions: ["worktree-feature-parallelism (the grant registry lives in the main store, keyed by the git-verified id)", "P40 (the onboarding-marker-as-trust pattern, rejected and kept rejected)"]
  sources: [docs/history/worktree-feature-parallelism/, "docs/specs/worktree-parallelism.md#S-the-trust-model-the-load-bearing-rule"]
  authoritative_for: "worktree-parallelism: the grant trust model and per-write store resolution"
---

# Worktree Parallelism — The Trust Model

This is the load-bearing rule of the whole area. Everything else — the commands that
create and return a worktree, the shared holds ledger, the store's lifecycle tiers —
assumes that "does this checkout get its own store?" already has an unforgeable answer.

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
