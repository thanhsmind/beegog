---
artifact_contract: bee-implement-plan/v1
status: validated-pending
mode: high-risk
---

# worktree-isolation — Implement Plan

## What & Why

Multi-worker swarm waves share one git checkout today, so a wave of 2+ workers
hits `index.lock` contention and commit-order coupling — flagged when
parallel-scheduler shipped computed waves and left git-contention unresolved
(backlog P40). This feature lets 2+-worker waves on Claude Code each get their own
git worktree (Agent tool's native `isolation: worktree`), while cells, claims,
reservations, and state keep living in and being read from the one main checkout's
`.bee/` — no forked runtime state, no unguarded writes. A prior worktree-per-worker
attempt was rejected as "a foundation swap without demonstrated need" (decision
0018); this feature is scoped narrowly enough not to repeat that.

## Locked Decisions

- **D1** — Opt-in only for multi-worker waves (≥2) on Claude Code, via the Agent
  tool's native `isolation: worktree`; shared checkout stays default elsewhere;
  Codex/manual lifecycle out of scope; reservations remain the file-ownership
  primitive. (Decision `42a01cfd`.)
- **D2** — One coordination store: the main checkout's `.bee/`. Linked-worktree
  resolution (root's `.git` is a FILE pointing into
  `<main>/.git/worktrees/<id>`) resolves the store to `<main>`; `BEE_ROOT` env is
  an explicit escape hatch for CLI only, validated against
  `.bee/onboarding.json`. Both `findRepoRoot` copies
  (`lib/state.mjs:239`, `hooks/adapter.mjs:89`) get the resolution. (Decisions
  `9ba51eb0`, `5aa8946d`.)
- **D3** — Merge-back is an orchestrator goal-check step: after `[DONE]`, merge
  the worker's reported branch, re-run cell verify in the MAIN checkout; a
  conflict halts that cell's integration (typed failure, blocked, friction
  filed — never force-resolved); `[BLOCKED]`/`[HANDOFF]` worktrees are preserved
  (path + branch in cell trace) until re-completed or explicitly dropped.
  (Decision `649d91b3` + amendment.)
- **D4** — The write guard keeps enforcing under worktree dispatch: reservation
  paths stay logical/repo-relative; the guard normalizes `<worktree>/src/x` →
  `src/x`. Where normalization can't be made safe, worktree mode is refused, never
  run unguarded. (Decision `23d67e0b`.)

## Affected Files

- **Cell 1** (lib): `skills/bee-hive/templates/lib/state.mjs`,
  `.bee/bin/lib/state.mjs`, `skills/bee-hive/templates/tests/test_lib.mjs`
- **Cell 2** (adapter+guard, deps: -1): `hooks/adapter.mjs`,
  `hooks/bee-write-guard.mjs`, `.bee/bin/hooks/adapter.mjs`,
  `.bee/bin/hooks/bee-write-guard.mjs`, `hooks/test_write_guard.mjs`,
  `hooks/test_hook_contracts.mjs`,
  `docs/history/codex-harness-hardening/release-manifest.json`
- **Cell 3** (dispatch protocol, deps: -1): `skills/bee-swarming/SKILL.md`,
  `skills/bee-swarming/references/swarming-reference.md`,
  `skills/bee-executing/references/worker-details.md`

## Implementation Steps

### Cell 1 — findRepoRoot hop + BEE_ROOT + resolveRoots (lib, both mirrors)

- RED first in `test_lib.mjs`: build a real temp git repo (`git init`, one
  commit, `git worktree add`); assert `findRepoRoot` from inside the worktree
  returns MAIN root, from main root is unchanged, `BEE_ROOT` valid/invalid,
  corrupt `.git` falls back to worktree root, `resolveRoots` pair correct in/out
  of a worktree, gitdir with trailing newline, relative gitdir.
- Add `BEE_ROOT` as the FIRST check — valid only when
  `<BEE_ROOT>/.bee/onboarding.json` exists, else fall through silently.
- After the walk resolves a root, add the linked-worktree hop: if `<root>/.git`
  is a FILE, parse its `gitdir:` line (absolute/relative, trailing whitespace,
  win32 backslashes); if it points into `<main>/.git/worktrees/<id>`, derive
  `<main>` and return it only when `<main>/.bee/onboarding.json` exists;
  otherwise keep today's walk result. One hop max, never loop.
- Export `resolveRoots(startDir) -> {storeRoot, workRoot}` — `workRoot` is the
  raw walk root, `storeRoot` is after resolution; equal outside worktrees.
- Apply byte-identically to both mirror copies. Make RED rows pass; confirm zero
  behavior change outside worktrees.

### Cell 2 — adapter hop + write-guard store/work split (deps: cell 1)

- RED first: `test_write_guard.mjs` rows for a worktree edit matching a
  main-store reservation (allow when owner, deny naming the holder otherwise), a
  worktree edit with no reservation behaving like the main-checkout equivalent,
  and ambiguous-worktree detection denying the write. `test_hook_contracts.mjs`
  row pinning `lib/state.mjs` and `adapter.mjs` to identical resolution on a
  shared fixture.
- Duplicate the same hop into the adapter's own `findRepoRoot` copy (~line 89) —
  keep the adapter import-light, no new import of `lib/state.mjs`.
- `buildContext` exposes both roots: `ctx.root` = `storeRoot` (state/config/
  reservations reads), `ctx.workRoot` = worktree top (path normalization).
- `toRelPath` in `bee-write-guard.mjs` computes against `workRoot`; state/
  reservations reads use `storeRoot` — one logical namespace (D4).
- Ambiguous detection (unparseable `.git`, gitdir outside
  `<main>/.git/worktrees/`) DENIES write tools fail-closed; CLI/read paths keep
  fail-open. Sync `.bee/bin/hooks` copies byte-identical.
- Run `node scripts/release_manifest.mjs --write` (lib/hook files changed), then
  confirm `--check` green.

### Cell 3 — swarming dispatch protocol (deps: cell 1)

- `SKILL.md` wave-dispatch step: on Claude Code, a ≥2-worker wave dispatches
  each worker with `isolation: worktree`; solo/single-worker waves keep shared
  checkout (D1).
- `swarming-reference.md`: replace the aspirational worktree line (~71) with a
  worktree-only prompt contract block — worker reports its branch
  (`git branch --show-current`) in `[DONE]`; coordination store resolves to main
  automatically.
- Add the INTEGRATION step to tend/goal-check: merge the reported branch into
  main; conflict = typed failure, blocked, friction filed, never
  force-resolved/never worker-rescued; re-run cell verify in MAIN (cell counts
  only post-merge green); cleanup (`git worktree remove` + `git branch -d`).
- Add the D3 disposition table: `[BLOCKED]`/`[HANDOFF]` worktrees preserved
  (path+branch in cell trace) until re-completion or explicit drop (logged);
  feature close prunes only merged-or-logged `.claude/worktrees/` leftovers.
- `worker-details.md` Atomic Commit section: note the branch-report field.
- Do not touch installed copies under `.claude/skills`/`.agents/skills`; never
  make worktree dispatch mandatory for any lane.

## Validation Plan

- **Cell 1:** `node skills/bee-hive/templates/tests/test_lib.mjs && node
  scripts/test_lib_mirror.mjs`
- **Cell 2:** `node hooks/test_write_guard.mjs && node
  hooks/test_hook_contracts.mjs && node scripts/test_lib_mirror.mjs && node
  scripts/release_manifest.mjs --check`
- **Cell 3:** `rg -q "isolation: worktree" skills/bee-swarming/SKILL.md && rg -q
  "worktree" skills/bee-swarming/references/swarming-reference.md && rg -q
  "branch" skills/bee-executing/references/worker-details.md && node
  skills/bee-hive/templates/tests/test_bee_cli.mjs`
- **Spike evidence collected (2026-07-15):** native worktree =
  `<main>/.claude/worktrees/agent-<id>` on branch `worktree-agent-<id>`, sharing
  main `.git`; commit reachable from main by branch name alone. An un-pinned
  worktree worker resolves root to itself, finds no `state.json`, reads phase
  `idle`, intake gate blocks writes — confirms D2's store-pinning is load-bearing.
  The write-guard hook fires inside the worktree via `payload.cwd`
  (`CLAUDE_PROJECT_DIR` is empty/unusable) — confirms the `.git`-file channel is
  the only viable detection path for both CLI and hook adapter.

## Risks & Mitigations

| Component | Risk | Mitigation |
|---|---|---|
| findRepoRoot hop (both copies) | HIGH — every host, every verb/hook | RED-first temp-repo tests; explicit non-worktree regression rows; win32 gitdir parsing covered |
| Guard store/work split | HIGH — safety machinery, hard-gate | Reservation-match rows from worktree edits; fail-closed on ambiguity; non-worktree behavior byte-stable |
| BEE_ROOT escape hatch | LOW | Validated-or-ignored rows; never trusted on non-bee dir |
| Dispatch/merge-back prose | MED | Grep-anchored verify + dogfood: this feature's own wave 2 (cells 2 ∥ 3) runs under worktree dispatch itself |
| Harness auto-clean semantics | MED | Spike showed worktree "locked" while running; post-completion behavior probed during dogfood; D3 disposition table covers both outcomes |

## Out of Scope

- Codex/manual `git worktree` lifecycle for external CLI executors (own backlog
  row, filed at scribing).
- Worktree-aware `bee cells schedule` hints ("worktree recommended" annotation)
  — not needed for v1.
- Any change to what a reservation means (D1: reservations remain the
  file-ownership primitive; worktrees remove only git-level contention).
