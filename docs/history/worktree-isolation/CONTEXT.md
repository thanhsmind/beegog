# Worktree Isolation — Context

**Feature slug:** worktree-isolation
**Date:** 2026-07-15
**Exploring session:** complete (gate_bypass=total — recommended options locked, audit-logged)
**Scope:** High-risk
**Domain types:** RUN | ORGANIZE

## Feature Boundary

Multi-worker swarm waves can dispatch each worker into its own git worktree —
removing shared-index/commit-order contention — while cells, claims, reservations,
and state keep living in the main checkout's single store, the write guard keeps
enforcing, and the orchestrator integrates each worker's commits back before the
cell counts. It ends before any Codex/manual worktree lifecycle (deferred) and
before any change to what reservations mean.

## Origin

Backlog P40, deferred from parallel-scheduler D4 (2026-07-15): concurrent workers
share one checkout/index; one commit per cell means `index.lock` contention and
commit-order coupling the docs never address. Prior art: decision 0018 REJECTED
worktree-per-worker as "a foundation swap without demonstrated need" — this feature
is the demonstrated need arriving, scoped so it is NOT a foundation swap (see D1).
Design sketch precedent: `docs/08-harness-adoption.md:60-64` (optional worktree
isolation mode), `swarming-reference.md:71` (aspirational contract note).

## Locked Decisions

These are fixed. Planning must implement them exactly — cited, never reinterpreted.

| ID | Decision | Rationale (only if it changes implementation) |
|----|----------|-----------------------------------------------|
| D1 | Worktree dispatch is an **opt-in swarming mode for multi-worker waves (≥2)** on Claude Code, via the Agent tool's native `isolation: worktree`. Shared-checkout stays the default elsewhere (solo lanes, single-worker waves). The one deliberate exception is this feature's post-enablement `wt-4` acceptance: a single isolated worker proves the mechanism but does not change normal dispatch eligibility. Codex/manual lifecycle OUT — own backlog row. Refines 0018: reservations remain the file-ownership primitive; worktrees remove only git-level contention. | Decision 42a01cfd plus validation acceptance sequencing 58c56bb6. |
| D2 | **One coordination store with typed resolution**: the main checkout's `.bee/` is the only live store during worktree dispatch. Library `resolveRoots` returns a typed `worktreeResolution` (`ordinary`, `linked-valid`, or `linked-invalid`). Starting at the nearest `.git`-FILE ancestor (the physical `workRoot`, independent of onboarding), parse its `gitdir`, require it to name `<main>/.git/worktrees/<id>`, and validate the reverse `<gitdir>/gitdir` pointer back to that worktree before accepting `<main>` as `storeRoot`. Anything shaped like a linked worktree but failing those checks is `linked-invalid`: library `findRepoRoot` and every coordination-CLI store operation fail loudly with typed `WORKTREE_LINK_INVALID` and never fall back to a worktree-local `.bee/`. The hook adapter remains non-throwing and transports the typed result so policy can deny safely. An ordinary `.git` directory, submodule, and separate-git-dir repository remain `ordinary` and require explicit control tests. `.bee/onboarding.json` is never consent or proof. Both resolver copies implement this contract; a worktree's checked-out `.bee/` is never a live store. | A worktree contains tracked onboarding material, so marker presence cannot establish trust. Typed rejection prevents malformed linked metadata from silently forking the coordination store while preserving the hook host's non-throwing adapter boundary. Decisions 5aa8946d + amendment 5de1fd36; validation repair 58c56bb6 and plan re-review. |
| D3 | **Integration is a transactional orchestrator goal-check, not a security boundary**: a same-UID worker is cooperative but fallible; Git metadata is consistency evidence, not authority against that worker. Before dispatch, the orchestrator must independently capture a control-plane attestation containing canonical common Git dir, worktree path/id, initial symbolic ref, base commit, and declared/reserved paths; a runtime unable to capture it is ineligible for worktree mode. After `[DONE]`, the orchestrator rechecks that attestation, derives identity from the recorded worktree id and Git metadata rather than worker text, requires the worker commit to descend from the base, and requires its changed paths to be a subset of reserved files. Integration captures pre-main SHA, runs `merge --no-ff --no-commit`, and performs targeted precommit checks; conflict or red aborts without a merge commit. Only green targeted checks permit the merge commit. The committed main checkout then runs the exact full repository verify; wt-4 owns evidence with `pwd`, pre/post main HEAD, merged ancestry, command, and output. An unexpected red full verify is followed immediately by a non-destructive revert commit and preservation of the worker worktree/branch. Automatic cleanup is allowed only after the worktree is clean, committed-main full verify is green, and the worker commit is reachable; it uses non-force worktree removal and `branch -d`, preserving on any failure. `[BLOCKED]`, `[HANDOFF]`, abandonment, identity mismatch, conflict, red verification, and drop are never automatically cleaned. A destructive drop requires explicit operator approval plus recorded status, dirty/untracked diff, HEAD, reachability, and a recovery ref or patch. | The attestation and subset/ancestry checks make integration robust against fallible worker reports without pretending same-UID metadata is a security principal. Transactional merge, revert, and conservative cleanup keep recoverable work intact and make full-main verification attributable. Decisions 649d91b3 + 5f05b038; validation repair 58c56bb6 (W9) plus plan re-review. |
| D4 | **The write guard keeps enforcing under worktree dispatch**: reservation paths stay logical repo-relative (one namespace). Before logical normalization, every target is canonically contained in `workRoot`: existing targets use their real path; new targets resolve through their nearest existing ancestor. Reject outside-root targets, `..` traversal, and symlink escapes before authorization. Then normalize `<worktree>/src/x` → `src/x`. The adapter carries typed `ctx.worktreeResolution` beside `ctx.root`/`ctx.storeRoot`; the write guard denies every write-capable tool on `linked-invalid` before mutation, while other hooks ignore the field. Every write tool gets POSIX plus Windows separator/case test rows. Where containment or resolution cannot be made safe, worktree mode is **refused**, never run unguarded. | A worktree prefix, lexical-only check, or symlink escape can silently miss reservations. Canonical containment makes the logical namespace meaningful before holder checks, while the explicit resolution status preserves fail-closed policy inside a non-throwing adapter. Decision 23d67e0b; validation repair and plan re-review. |

### Agent's Discretion

Helper naming and placement for the small duplicated root-resolution hop and
exact wording of swarming's worktree contract. The resolution channel, typed
outcomes, attestation fields, transactional merge strategy, canonical containment,
root identities, checks, evidence, and disposition rules above are not discretionary.

## Terms

| Term | Meaning in this feature |
|------|-------------------------|
| worktree dispatch | Spawning a swarm worker whose working tree is its own git worktree while every bee coordination verb still hits the main checkout's store. |
| integration (merge-back) | The orchestrator transactionally bringing a worktree worker's commit(s) into the main checkout after `[DONE]`, then verifying committed main; part of the goal-check before the cell counts. |
| control-plane attestation | Orchestrator-captured pre-dispatch record of canonical common dir, worktree identity/path, initial ref, base commit, and declared/reserved paths; worker text cannot supply or amend it. |
| logical path | The repo-relative path a reservation names, independent of which working tree the physical edit lands in. |
| workRoot | The physical checkout containing the path being read or written; in worktree dispatch this is the linked worktree top found from the nearest `.git`-FILE ancestor. |
| storeRoot | The main checkout whose `.bee/` is the single coordination store, accepted only after bidirectional Git back-link validation. |

## Specific Ideas And References

- Claude Code Agent tool `isolation: "worktree"` — native worktree per subagent.
  The spike confirmed its location, branch naming, shared Git metadata, and commit
  visibility; cleanup and incomplete-work disposition remain explicit orchestrator
  responsibilities under D3.
- `docs/08-harness-adoption.md:60-64` — the original `--isolation worktree` sketch.
- Decision 0018 (`docs/decisions/0018-...md:26`) — the rejection this feature refines.

## Existing Code Context

### Reusable Assets

- `.bee/bin/lib/state.mjs:239-259` — `findRepoRoot(startDir)`: current cwd walk-up; D2 hook point ONE. `resolveRoots` retains the physical worktree top and typed relationship; `findRepoRoot` returns the validated store or raises typed `WORKTREE_LINK_INVALID`, never a linked-worktree-local fallback.
- `hooks/adapter.mjs:89-101` — the adapter's separate `findRepoRoot` copy; D2 hook point TWO. `ctx.root` remains the physical `workRoot` for compatibility, while new `ctx.storeRoot` is consumed only by the write guard. A contract test pins both resolution copies against re-divergence.
- `hooks/bee-write-guard.mjs:46-56` — `toRelPath(root, cwd, rawPath)`: the D4 hook point; canonical containment must precede logical normalization and reservation lookup for every write-capable tool.
- `skills/bee-executing/references/worker-details.md:94-101` — worker commit protocol (`git add <files>` + one commit per cell) — unchanged, but runs inside the worktree under D1.
- `bee cells schedule` (parallel-scheduler) — wave computation that decides when a wave has ≥2 workers.

### Established Patterns

- Mirror discipline: `templates/lib/` ↔ `.bee/bin/lib/` byte-identical; hook parity is derived from the runtime production inventory with explicit source-only exclusions, then checks every shipped counterpart rather than a hand-maintained filename pair.
- Guard changes are RED-first tested in `hooks/test_write_guard.mjs` + contracts in `hooks/test_hook_contracts.mjs`.
- Claims/reservations O_EXCL semantics: local filesystems only (`claims.mjs:1-13`) — worktrees on the same volume satisfy this.

### Integration Points

- `skills/bee-swarming/SKILL.md` + `references/swarming-reference.md` — dispatch protocol gains the opt-in worktree mode, orchestrator-derived branch identity, merge-back, main-checkout verification, and disposition/cleanup steps.
- `docs/specs/workflow-state.md` — spec sync target (scribing).

## Canonical References

- `docs/backlog.md` P40 (this feature), P28 (claims), P39 (computed waves).
- `docs/decisions/0018-orchestrator-goal-check-and-frozen-judge.md` — refined, not reversed.

## Outstanding Questions

### Resolve Before Planning

- (none — D1–D4 locked under gate_bypass=total)

### Spike Results (2026-07-15, probe agent — answers the validating unknowns)

- **Native worktree mechanics (ANSWERED YES — merge-back feasible):** the harness
  creates a real linked worktree at `<main>/.claude/worktrees/agent-<id>` on branch
  `worktree-agent-<id>`, sharing the main repo's `.git` (`git-dir` =
  `<main>/.git/worktrees/agent-<id>`). A worker commit lands on that branch and is
  reachable from the main checkout by branch name alone — the branch outlives the
  worktree directory. The orchestrator derives that branch from the native
  worktree id before integration; cleanup of the directory is independent.
- **Root/store fork (CONFIRMED, fail-closed):** inside the worktree, `bee status`
  resolves `source.root` to the worktree, finds no `state.json`, reads phase
  `idle`, and the intake gate blocks writes — an un-pinned worktree worker cannot
  work at all. Fail-closed, but proves D2's store-pinning is load-bearing, and
  gives planning the detection key: a linked worktree has a `.git` FILE whose
  `gitdir` points into `<main>/.git/worktrees/<id>` — the main root is derivable
  mechanically.
- **Guard fires inside the worktree (CONFIRMED):** the write-guard hook ran on the
  worker's shell command (`CLAUDE_PROJECT_DIR` is empty in the worker env; the
  hook still executed and resolved root from `payload.cwd`). D4's mechanism
  therefore splits: **rel paths** compute against the worktree top (already
  logical), while **state/reservations** must be read from the MAIN store — the
  linked-worktree resolution above serves both `findRepoRoot` (CLI) and the
  hook adapter.
- **Validation constraints locked (2026-07-15):** the Git pointer validates in
  both directions; linked-shaped invalid metadata is typed and never falls back;
  ordinary directories, submodules, and separate-git-dir repositories remain
  control cases. Onboarding is not consent. Canonical containment precedes
  normalization for every write tool, including Windows separator/case rows.
  Enabling work is strictly serialized in the shared checkout: wt-1 → wt-2 →
  wt-3. A fourth acceptance cell runs only after all three land and proves
  pre-dispatch attestation, reserved-path subset and ancestry checks,
  transactional integration, full committed-main verification with provenance,
  and conservative cleanup/preservation through deterministic fault injection.
- **Side finding (friction, filed):** the intake-gate deny fired on a compound
  `mkdir/printf/git` command targeting `.bee/spikes/` while its own message says
  `.bee/` is writable without routing — target-path extraction fails on compound
  commands and fails closed on the verb.

## Deferred Ideas

- Codex/manual `git worktree` lifecycle for external CLI executors — backlog row (append at scribing).
- Worktree-aware `bee cells schedule` hints (annotate waves with "worktree recommended") — not needed for v1.

## Handoff Note

CONTEXT.md is the source of truth. Decision IDs are stable. Planning reads locked
decisions, code context, canonical references, and deferred-to-validating questions.
