# Spec — Worktree feature parallelism

**Area:** how one session fans independent work into git worktrees, each running its
own bee lifecycle, reconciled to the main checkout on `git merge`.
**Status:** shipped 2026-07-16 (unreviewed); enter/return commands + routing rule added
2026-07-18 (worktree-session-routing, GH #21, unreviewed); cross-worktree hold acquisition
made atomic (single-lock conflict-check + reserve + ledger-insert) and holds gained
heartbeat-renewal on top of their TTL ceiling, 2026-07-21 (hardening-1-7-10, unreviewed).
History: `docs/history/worktree-feature-parallelism/`, `docs/history/worktree-session-routing/`.

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

## Returning: `worktree merge --id <id>` (D8)

Run from the ordinary MAIN checkout (never from inside a worktree — that includes merging
"yourself"):

- Typed zero-mutation refusals first: unknown/ungranted id, dirty MAIN tree, dirty WORKTREE
  tree, detached HEAD or branch mismatch in the worktree. **Dirty** (D8a) =
  `git status --porcelain` without `--ignored`: the worktree's gitignored `.bee` store never
  counts as dirt.
- The merge itself is a **staged transaction** (D2-REVISED, user review P1-2): `git merge
  --no-ff --no-commit <branch>` stages the merge WITHOUT committing it. Already up to date
  (nothing staged) returns a typed no-op result and never touches `git commit`. A textual
  conflict runs `git merge --abort`, then PROVES main is untouched (HEAD unchanged, no
  `.git/MERGE_HEAD`, clean tracked status) before returning typed `MERGE_CONFLICT` — bee
  still does not auto-resolve a textual conflict, it just no longer leaves conflict state
  sitting on main. A clean stage runs the configured `commands.verify` (none recorded →
  `verify: skipped`) against the merged-but-**uncommitted** tree.
- **A red verify after a textually clean merge is the semantic-conflict alarm** the command
  exists to raise: `git merge --abort` runs, main-untouched is proven the same way, and the
  result is typed `MERGE_VERIFY_RED` with the output tail — fix-first before release. Because
  the merge was never committed until verify passed, **no merge commit ever existed to roll
  back**; this supersedes the old "merge commit is never rolled back" contract. Only once
  verify is green does bee run `git commit` (message names the id). A post-commit guard checks
  `git status --porcelain --untracked-files=no` is clean; if the verify command itself left
  tracked files modified, the result carries a typed `warning.code:
  'verify_mutated_tracked_files'` instead of silently treating the tree as equivalent to the
  commit. Recovery for a merge commit that only fails a LATER independent verify: `git revert
  -m 1 <merge-commit>` (documented, not automated).
- `--cleanup` (D8b/D8c): strictly post-commit — on green (or skipped) verify it runs
  unconditionally — worktree remove, then `git branch -d` (never `-D`), then grant removal, in
  that order. It refuses (typed; the merge result stays ok) when the worktree still holds
  tracked-modified or untracked files. Skipped-verify cleanup always carries a warning that
  nothing was checked. Cleanup never runs after `MERGE_CONFLICT`, `MERGE_VERIFY_RED`, or the
  already-up-to-date no-op.

## Routing rule (D9 — prose, not a hook)

When a session is about to start NEW feature work in a checkout that already has another live
session's active work — a live cross-session heartbeat plus a non-idle phase in the shared
store (D9a), or active holds / live-owner lanes — the paved road is `worktree new` and opening
the next session in the printed path. Docs-lane work, tiny fixes, and release machinery stay
in the MAIN checkout (release always runs in main). The rule lives in bee-hive's Session Scout
and AGENTS.md critical rule 14; the existing guards (holds, live-owner lanes, gates) keep
enforcing the hard parts.

**Visibility (worktree-ux, 2026-07-21, GH #30/#31):** `bee status` inside an UNGRANTED
linked worktree prints a loud notice (text + `worktree_notice` in JSON) that the tree
SHARES the main checkout's store — same feature/phase/claims, no isolation — naming both
remedies (`worktree new` from main, or `worktree register` for the existing tree); granted
worktrees and ordinary checkouts are byte-unchanged. `worktree new` success output carries
an explicit `next_step`: open a session with cwd at the created path; merge back later via
`worktree merge`. A write denied by containment that targets a granted sibling worktree
names that worktree and both remedies instead of the generic containment text (message
only — the deny itself is unchanged; any grants-read error falls back to the generic
message, never an allow).

**Lane-first refinement (cross-worktree-holds D7, 2026-07-20):** exploring, planning, and
validating do not touch source — a new feature in an occupied checkout starts as a per-feature
LANE on the shared store (full live coordination: claims, reservations, holds all visible),
and a worktree grant is taken only at Gate 3, and only when the feature's execution genuinely
overlaps files with other in-flight work. Most parallel work never needs the worktree at all;
per-module test suites + suite auto-discovery (see `verify-pipeline.md`) removed the
artificial overlaps that used to force the choice early.

## Cross-worktree holds (the shared ledger — cross-worktree-holds D1-D6, 2026-07-20)

A granted worktree's store is an island by design — which used to mean its reservations were
invisible to main and to sibling worktrees, and overlapping edits surfaced only at merge. The
shared holds ledger closes that gap at WRITE time:

- **One ledger, main store only:** `<mainRoot>/.bee/runtime/cross-worktree-holds.json`,
  beside the grant registry (same trust model: the main store is the authority; a worktree
  reaches it via `resolveRoots().mainRoot`). Path-keyed rows
  `{holder, feature, session, cell, acquired_at, expires_at}`; holder is the git-verified
  worktree id or `"main"`. TTL-expired rows are pruned on every read; all mutations run under
  the main store's `cross-worktree-holds` lock with atomic tmp+rename writes.
- **Mirror on reserve:** a reservation in any checkout mirrors into the ledger (an ungranted
  linked worktree never double-mirrors — its reservations already live in the shared store).
  Before reserving, the seam consults the ledger and refuses with a typed `FOREIGN_HOLD`
  result naming the holding checkout, feature, and expiry.
- **Acquisition is one atomic step, not three sequential ones (hardening-1-7-10).** Checking
  the ledger for a conflicting foreign hold, reserving the path in the local (worktree or
  main) store, and inserting the mirrored row into the shared ledger all run under the SAME
  single lock acquisition at the main root — never as separate lock-check, lock-reserve,
  lock-insert steps that could interleave with another checkout's attempt on the identical
  path. Two checkouts racing the same path can therefore never both come away believing they
  hold it; exactly one wins, and the loser gets the typed `FOREIGN_HOLD` refusal instead of a
  hold it does not actually have.
- **Holds renew, not just expire (hardening-1-7-10).** A hold's TTL ceiling (1 hour) is the
  same failure-recovery backstop as before, but a live session's own heartbeat now refreshes
  the timestamp on every cross-worktree hold it owns — a try-once refresh that never blocks
  the session's primary work. A long-running live worker therefore keeps its holds protected
  for as long as it stays genuinely active; TTL expiry now fires only for a session that has
  actually gone silent (a dead or abandoned worker), not for one still working past the old
  fixed ceiling.
- **Three read taps, one voice:** (1) `reservations reserve` — typed refusal before any local
  row is written; (2) `claim-next` — silently skips a cell whose declared files overlap a
  foreign hold, so a session always picks conflict-free work instead of waiting; (3) the
  write-guard — denies a write to a foreign-held path, naming holder + feature + expiry,
  phase-independent, added net-first (frozen 26-row green before the edit, 31/31 after).
- **Release is scoped by cell, never by holder alone.** All agents in the main checkout share
  `holder:"main"`; an early cut that released by holder wiped a concurrent worker's mirrored
  holds (live incident, same day, decision a0ab91b6). Release derives the acting agent's own
  active cell ids and clears exactly those rows. Worktree merge `--cleanup` releases every
  row for the removed worktree id, best-effort after the grant is removed.
- **Failure discipline:** missing ledger = empty (byte-identical to pre-ledger behavior);
  unparseable ledger = typed deny (`worktree-holds-unreadable`, mirroring the reservation
  corrupt-store rule); unresolvable topology = fail-open with crash-log. Both runtime files
  (`cross-worktree-holds.json`, `worktree-grants.json`) are direct-edit-denied in every
  phase — CLI-only writes.
- **Waiting model:** fail-fast, never blocking — a refusal names who and until when; the
  session takes other open work (`claim-next` already routed it away) and the hold lapses by
  TTL if its owner dies. The merge verify-gate stays as the final semantic net.

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

- Same-feature / same-file concurrent WRITE-INTENT across worktrees is now covered by the
  shared holds ledger (above); concurrent read visibility across worktrees stays out of
  scope by design — digests and the merge gate remain the interface.
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
- Shared ledger: `templates/lib/worktree-holds.mjs` (mirror/release/foreign-lookup/sweep,
  corrupt-check); seam wiring in `templates/bee.mjs` reservations handlers +
  `performCleanup`; claim-next tap in `templates/lib/cells.mjs`; guard tap in
  `templates/lib/guards.mjs` (`resolveHoldTopology` in all three, same shape).
- Tests: resolver P40 regression, grant-resolve, worktree-store unit, worktree CLI e2e,
  `scripts/test_worktree_holds.mjs` (seam), `scripts/test_worktree_holds_race.mjs`
  (concurrency), claim-next foreign-skip rows in `test_cli_cells.mjs`, guard net + foreign
  rows in `templates/tests/test_guards.mjs` (all discovered by the verify pipeline).
