# Worktree Isolation — Context

**Feature slug:** worktree-isolation
**Date:** 2026-07-15
**Exploring session:** complete (gate_bypass=total — recommended options locked, audit-logged)
**Scope:** Standard
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
| D1 | Worktree dispatch is an **opt-in swarming mode for multi-worker waves (≥2)** on Claude Code, via the Agent tool's native `isolation: worktree`. Shared-checkout stays the default elsewhere (solo lanes, single-worker waves). Codex/manual lifecycle OUT — own backlog row. Refines 0018: reservations remain the file-ownership primitive; worktrees remove only git-level contention. | Decision 42a01cfd. |
| D2 | **One coordination store**: the main checkout's `.bee/` is the only live store during worktree dispatch. Primary channel (spike-settled, decision 5aa8946d): **linked-worktree resolution** — a resolved root whose `.git` is a FILE (gitdir → `<main>/.git/worktrees/<id>`) resolves the store to `<main>`; this reaches BOTH the CLI (cwd walk) and the Edit-triggered guard (via `payload.cwd`), needing no env. `BEE_ROOT` env override (validated — must contain `.bee/onboarding.json`) is the explicit escape hatch checked first, for CLI invocations only. **Both `findRepoRoot` copies get the resolution — `lib/state.mjs:239` AND the hook adapter's own copy (`hooks/adapter.mjs:89`)** (fresh-eyes finding 1/2). A worktree's checked-out `.bee/` is never a live store. | Scout: a worktree contains tracked `.bee/onboarding.json`, so an un-pinned worker silently forks runtime state (spike-confirmed: phase idle, fail-closed blocked). An env var cannot reach an Edit-triggered hook — the `.git` file on disk can. Decisions 9ba51eb0 + 5aa8946d. |
| D3 | **Merge-back is an orchestrator goal-check step**: after `[DONE]`, integrate the worker's commit(s) into the main checkout (merge of the worker-reported branch), then re-run the cell verify in the MAIN checkout — the cell counts only on post-merge green. **A merge conflict is NOT worker-rescue material** (fresh-eyes finding 4): two by-contract-disjoint workers conflicting means the schedule/reservations lied — halt that cell's integration (typed failure), mark the cell blocked with the conflict recorded, file friction, and investigate before any re-dispatch; never force-resolve. **`[BLOCKED]`/`[HANDOFF]` disposition (finding 3): preserve, never discard** — the dirty worktree + branch are kept, their path/branch recorded in the cell trace for resume; removal happens only after the cell is re-completed elsewhere or explicitly dropped, and is logged. Clean-`[DONE]` cleanup (worktree remove + branch delete) after green post-merge verify; feature close prunes only merged-or-logged leftovers. | Computed waves guarantee disjoint files, so merges are expected clean; verify-after-merge preserves 0018's evidence contract; uncommitted work is never silently destroyed. Decisions 649d91b3 + amendment below. |
| D4 | **The write guard keeps enforcing under worktree dispatch**: reservation paths stay logical repo-relative (one namespace); guard-side normalization maps `<worktree>/src/x` → `src/x`. Where normalization cannot be made safe, worktree mode is **refused**, never run unguarded. | Scout: un-normalized rel paths silently miss reservations. Fail-closed. Decision 23d67e0b. |

### Agent's Discretion

Where the BEE_ROOT check lives in `findRepoRoot`; how the guard recognizes a
worktree prefix (marker file, `git worktree list` output, env, or path pattern);
merge strategy (merge vs cherry-pick) as long as worker commit identity survives
and conflicts fail typed; how swarming's prompt template carries the worktree
contract lines; helper naming/location (`lib/` module vs swarming-reference prose).

## Terms

| Term | Meaning in this feature |
|------|-------------------------|
| worktree dispatch | Spawning a swarm worker whose working tree is its own git worktree while every bee coordination verb still hits the main checkout's store. |
| integration (merge-back) | The orchestrator bringing a worktree worker's commit(s) into the main checkout after `[DONE]`; part of the goal-check, before the cell counts. |
| BEE_ROOT | Env override pinning bee's repo-root resolution to the main checkout; validated (must contain `.bee/onboarding.json`), else ignored/failed loudly. |
| logical path | The repo-relative path a reservation names, independent of which working tree the physical edit lands in. |

## Specific Ideas And References

- Claude Code Agent tool `isolation: "worktree"` — native worktree per subagent,
  "auto-cleaned if unchanged". Exact mechanics (location, branch naming, dirty
  cleanup, visibility of commits to the main checkout) are UNVERIFIED — spike.
- `docs/08-harness-adoption.md:60-64` — the original `--isolation worktree` sketch.
- Decision 0018 (`docs/decisions/0018-...md:26`) — the rejection this feature refines.

## Existing Code Context

### Reusable Assets

- `.bee/bin/lib/state.mjs:239-259` — `findRepoRoot(startDir)`: cwd walk-up (onboarding.json, then .git); D2 hook point ONE.
- `hooks/adapter.mjs:89-101` — the adapter's own separate `findRepoRoot` copy feeding `ctx.root` for every hook (fresh-eyes finding 1); D2 hook point TWO — both copies get the linked-worktree resolution, and a test pins them against re-divergence.
- `hooks/bee-write-guard.mjs:46-56` — `toRelPath(root, cwd, rawPath)`: the D4 normalization hook point; `adapter.mjs:207-215` resolves root via `findRepoRoot(payload.cwd)`.
- `skills/bee-executing/references/worker-details.md:94-101` — worker commit protocol (`git add <files>` + one commit per cell) — unchanged, but runs inside the worktree under D1.
- `bee cells schedule` (parallel-scheduler) — wave computation that decides when a wave has ≥2 workers.

### Established Patterns

- Mirror discipline: `templates/lib/` ↔ `.bee/bin/lib/` byte-identical; state.mjs edits ship to both.
- Guard changes are RED-first tested in `hooks/test_write_guard.mjs` + contracts in `hooks/test_hook_contracts.mjs`.
- Claims/reservations O_EXCL semantics: local filesystems only (`claims.mjs:1-13`) — worktrees on the same volume satisfy this.

### Integration Points

- `skills/bee-swarming/SKILL.md` + `references/swarming-reference.md` — dispatch protocol gains the worktree mode (prompt lines, BEE_ROOT prefix, merge-back + cleanup steps).
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
  worktree directory, so integration = merge the reported branch; cleanup of the
  directory is independent.
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
