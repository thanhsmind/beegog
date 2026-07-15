---
artifact_contract: bee-plan/v1
artifact_readiness: requirements-only
mode: high-risk
---

# worktree-isolation — Plan

**Feature:** worktree-isolation · **Date:** 2026-07-15 · **CONTEXT:** ./CONTEXT.md (D1–D4, spike-settled)

## Mode Gate

Flags: **existing covered behavior** (root resolution feeds every CLI verb and every
hook on every host), **weak proof** (no worktree precedent in-repo; decision 0018
rejected the last attempt), **multi-domain** (git plumbing + lib + hooks + dispatch
prose), **cross-platform** (win32 `.git`-file parsing, path separators). **4 flags →
high-risk.** Also touches the write-guard — safety machinery — which is
audit/security-adjacent: hard-gate treatment confirmed.

## Discovery (L1 — spike + scout, in-repo)

- Spike (live probe): native worktree = `<main>/.claude/worktrees/agent-<id>`,
  branch `worktree-agent-<id>`, shared `.git`; commit reachable from main by branch
  name; un-pinned worker reads a forked empty store → phase idle → fail-closed.
- Two `findRepoRoot` copies: `lib/state.mjs:239` (CLI) and `hooks/adapter.mjs:89`
  (all hooks) — both must gain the resolution; a contracts test pins them.
- Linked-worktree detection key: root's `.git` is a FILE whose `gitdir:` line points
  into `<main>/.git/worktrees/<id>`; main root = the directory containing that
  `.git` DIRECTORY, accepted only when `<main>/.bee/onboarding.json` exists.
- Guard fires inside worktrees (spike): `payload.cwd` = worktree path;
  `CLAUDE_PROJECT_DIR` empty in worker env — env delivery impossible for Edit; the
  `.git` file on disk is the channel.

## Approach

**wt-1 — resolution in the lib.** `lib/state.mjs`: `findRepoRoot` gains (a)
`BEE_ROOT` env check first (valid = contains `.bee/onboarding.json`, else fall
through), (b) linked-worktree hop — when the walk lands on a root whose `.git` is a
file, parse `gitdir:`, derive the main root, return it when it carries
`.bee/onboarding.json`, else keep the worktree root (fail-open to today's
behavior). New export `resolveRoots(startDir) → {storeRoot, workRoot}` for callers
needing both (the guard). RED-first rows in `test_lib.mjs` build a real temp git
repo + `git worktree add`.

**wt-2 — the guard splits store from work.** `hooks/adapter.mjs` (its own
`findRepoRoot`) gains the same hop; `bee-write-guard.mjs` computes rel paths
against **workRoot** (worktree top) while `guards.checkWrite` reads state and
reservations from **storeRoot** — one reservation namespace of logical paths (D4).
Unresolvable/ambiguous detection ⇒ refuse the write (fail-closed, D4). RED-first in
`hooks/test_write_guard.mjs` + `test_hook_contracts.mjs`; a contracts row pins the
two `findRepoRoot` copies' worktree behavior against divergence.

**wt-3 — the dispatch protocol.** `bee-swarming` SKILL.md + swarming-reference:
multi-worker waves (≥2) on Claude Code dispatch each worker with
`isolation: worktree` (D1); prompt template gains the worktree contract (report
your branch in `[DONE]`; coordination store is the main checkout — automatic);
tend/goal-check gains the **integration step** (merge reported branch, conflict =
halt+block+friction per D3, verify post-merge in MAIN, cleanup per D3 disposition
table); `bee-executing` worker-details notes the branch-report field. Feature-close
prune covers `.claude/worktrees/` leftovers (merged-or-logged only).

**Rejected alternatives.** (a) bee-managed `git worktree add` lifecycle — native
harness isolation exists and was spike-proven; manual lifecycle is the Codex path,
deferred (D1). (b) Env-var delivery of the main root to hooks — spike-disproven
(empty env in worker; Edit has no command string). (c) Unifying the two
`findRepoRoot` copies into one import — the adapter is deliberately import-light
(fail-open hook), so both copies get the hop + a pinning test instead.

**Risk map.**

| Component | Risk | Proof needed |
|---|---|---|
| findRepoRoot hop (both copies) | HIGH — every host, every verb/hook | RED-first temp-repo worktree tests; behavior unchanged outside worktrees (regression rows); win32 `.git`-file parsing (gitdir line, `\` separators) |
| guard store/work split | HIGH — safety machinery | test_write_guard rows: reservation match from worktree edit; fail-closed on ambiguity; non-worktree behavior byte-stable |
| BEE_ROOT escape hatch | LOW | validated-or-ignored rows |
| dispatch/merge-back prose | MED | grep-anchored verify + this feature's own execution runs wt-2 ∥ wt-3 under worktree dispatch (live dogfood) |
| harness auto-clean semantics | MED | spike showed "locked" worktree while running; post-completion behavior probed during dogfood — disposition table (D3) covers both outcomes |

## Test Matrix (edge dimensions, high-risk depth)

- **Boundary:** cwd = worktree root exactly; cwd deep inside worktree; nested path where main root also matches walk; worktree of a worktree (git forbids — detection must not loop).
- **Format:** `.git` file with `gitdir:` + trailing newline; absolute vs relative gitdir; win32 backslash gitdir.
- **Absent/corrupt:** `.git` file unparseable → fail-open to worktree root (CLI) / fail-closed deny (guard write); main root missing `.bee/onboarding.json` → no hop.
- **Compat:** every existing test green with zero behavior change outside worktrees; BEE_ROOT unset everywhere today.
- **Security:** BEE_ROOT pointing at a non-bee dir is ignored; hop never escapes above the gitdir-named main root.

## Slice 1 (current — the whole feature)

| Cell | What | Deps | Files |
|---|---|---|---|
| worktree-isolation-1 | findRepoRoot hop + BEE_ROOT + `resolveRoots` (lib, both mirrors) + RED-first temp-worktree tests | — | templates/lib/state.mjs, .bee/bin/lib/state.mjs, templates/tests/test_lib.mjs |
| worktree-isolation-2 | adapter hop + guard store/work split, fail-closed ambiguity + RED-first guard/contract tests | wt-1 | hooks/adapter.mjs, hooks/bee-write-guard.mjs, .bee/bin/hooks/adapter.mjs, .bee/bin/hooks/bee-write-guard.mjs, hooks/test_write_guard.mjs, hooks/test_hook_contracts.mjs |
| worktree-isolation-3 | swarming worktree dispatch protocol + integration step + executing branch-report + prune note | wt-1 | skills/bee-swarming/SKILL.md, skills/bee-swarming/references/swarming-reference.md, skills/bee-executing/references/worker-details.md |

Computed dispatch: `[wt-1] → [wt-2 ∥ wt-3]` — wave 2 runs under **worktree
dispatch itself** (the dogfood proof). Post-slice: manifest regen owned by wt-2
(largest lib touch) per critical-pattern 20260715.

No future-slice cells. Deferred: Codex/manual worktree lifecycle (backlog at scribing).
