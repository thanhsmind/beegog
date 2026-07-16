---
artifact_contract: bee-plan/v1
artifact_readiness: requirements-only
mode: spike
---

# plan — worktree-feature-parallelism (slice 1: the seam spike)

## Mode gate

Feature overall = **high-risk**. Flags counted: `data model` (three-tier `.bee/` +
event log), `audit/security` (opt-in is an authorization signal governing where writes
are permitted), `cross-platform` (git worktree + `.git` file resolution on linux/win32),
`existing covered behavior` (P40's `resolveRoots` is under test and must not regress),
`weak proof` (no repo precedent for worktree-local stores). = 5 flags.

But **one yes/no proof decides whether the whole architecture is real** → slice 1 is a
**spike** (mode gate: spike overrides flag count). If the seam can't be solved without
reintroducing a rejected mechanism, the feature is not real and returns to planning.
Only after a GREEN spike do the high-risk build slices exist.

## Discovery (L1 — cited, no separate discovery.md)

Precedent already in-repo, no research needed:
- `adapter.mjs:135-188` / `state.mjs:270-321` — P40's typed `resolveRoots`, bidirectional
  git back-link already validated (the trust anchor to reuse).
- critical-pattern **model-tier-guard** (20260711): an authz/control marker must be
  anchored to a trusted structural position, never a self-asserted in-content marker.
- critical-pattern **fresh-session-handoff** (20260714): a fail-closed branch inside the
  fail-open hook must RETURN a typed deny, never throw.
- Existing `.jsonl` append-only logs (`decisions.mjs`, `reviews.mjs`, `capture.mjs`) — the
  shape the `log/` tier generalizes; backlog P30 is the `merge=union` piece.

## Spike question (the one yes/no)

> Can a **stateless, per-write** `resolveRoots` distinguish a genuine independent-feature
> opt-in worktree from a P40 swarm worktree — **without** trusting any marker the worktree
> writes about itself — while leaving the P40 `linked-valid → main` path byte-for-byte
> unchanged; and can the three tiers + idempotent replay reconstruct a feature's state
> across a real `git merge`?

## Candidate mechanism to prove (per D2; falsifiable)

**Trust the main store + git identity, never the worktree's self-claim.** P40 already
validates a worktree's identity by bidirectional back-link (`<main>/.git/worktrees/<id>`
⇄ worktree `.git`). Reuse that verified `<id>` as the key. The opt-in command
(`bee worktree new --feature X`) writes a grant record into the **MAIN store's runtime
tier** (trusted: it's the main checkout, not the worktree), keyed on the git-verified
`<id>`. `resolveRoots`, on detecting `linked-valid`, additionally consults that main-store
registry: `<id>` registered → resolve to the **worktree-local** store; not registered →
resolve to **main** (exactly P40 today). The worktree asserts nothing about itself; the
trusted main store records the grant against a git-verified identity. This is the
model-tier-guard anchoring rule applied to a filesystem resolver — and it is exactly why
it does not reintroduce onboarding-marker-as-trust (58c56bb6).

## Acceptance (spike is GREEN iff all hold, with printed evidence)

1. A registered worktree's write resolves to its **worktree-local** store; its phase/gates
   are independent of `main`'s `state.json`.
2. An **un**registered `linked-valid` worktree resolves to **main**, fail-closed exactly
   as P40 (proves the P40 regression path survives — the model-tier-guard "marker
   mid-content → rejected" analogue: a self-written worktree marker grants nothing).
3. A forged/mismatched `<id>` (back-link fails) → typed `WORKTREE_LINK_INVALID`, RETURNED
   not thrown (fresh-session-handoff rule), no fallback to a local store.
4. Minimal three tiers exist in the spike: append events to a worktree's `log/`,
   `git merge` (union) into main, `bee replay` on main → materialized state deterministically
   includes both branches' events; re-running replay is idempotent (byte-identical output).

## Spike shape (throwaway, under `.bee/spikes/worktree-feature-parallelism/`)

A self-contained proof harness (temp git repo + real `git worktree add`, deterministic
fault injection for the forged-id case — the pattern P40's wt-4 already used) that
exercises acceptance 1–4 and prints a sentinel per case + a distinct exit code (spike
sentinel discipline, 20260715). No production `.bee/bin` file is edited in the spike; a
resolver *variant* is proven in the spike dir, then promoted only in the build slices if
GREEN. Spike code never ships (spike-code rule).

## If GREEN → build slices (named only, NOT created — future-slice prohibition)

S2 extend `resolveRoots` (both copies) additively + typed deny; S3 tier split
(`log/`+`.gitattributes merge=union`, `cache/`, `runtime/`) + gitignore; S4 `bee replay`
+ `bee worktree new/merge`; S5 P40 byte-for-byte regression suite + release-manifest regen.
Each its own gate under the feature. **None created until this spike is GREEN.**

## Test matrix (spike depth, against the 12 edge dimensions)

- **Identity/authz:** registered ✓ · unregistered→main ✓ · forged-id→typed-deny ✓ ·
  self-written worktree marker grants nothing ✓ (the injection row).
- **Concurrency (deferred, asserted out):** same-file two worktrees → NOT covered; assert
  the spike does not claim it (D4 boundary).
- **Idempotency:** replay×2 byte-identical ✓ · union-merge duplicate event → deduped ✓.
- **Cross-platform:** `.git` file vs dir resolution (the win32/linux split P40 handles).
- **Fail-open host:** deny path RETURNS typed verdict, proven via a real hook-shaped call,
  never only in-process (fresh-session-handoff).
