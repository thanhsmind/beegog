# Learnings — codex-plugin-first-hybrid (2026-07-18)

Feature: GH #22 P0-1 — codex plugin-first becomes hybrid (skills from plugin,
hooks always repo-local), fail-closed, never skills-only.

## 1. The advisor consult caught the fix un-fixing itself — read the CLEANUP path of any installer change
The plan's naive shape (write hooks in onboarding) would have shipped the exact
bug it fixed: plugin-first's cleanup pass (`plugin_distribution.mjs`
`cleanHookConfig`) strips any entry matching `/.bee/bin/hooks/` — precisely
what `mergeCodexHooks` writes — and it runs AFTER onboarding in install.sh.
Every install-flow change needs its cleanup/uninstall mirror-path read in the
same breath as its install path.

## 2. An intended interim-red is a scope smell, not a sequencing fact
cph-1 (core) landed with cph-2 (wiring) pending and the existing E2E went red
because the half-wired state IS the self-erasure bug. The right resolution was
the worker's option 2 — pull the single load-bearing wire into the same cell —
not relaxing the assertion "until the next cell lands". If a serialized split
makes a real test red between cells, the split boundary is wrong.

## 3. Typed-blocked must be designed, not assumed
The apply path had exactly one typed refusal (`skillSync.blocked`); everything
else threw untyped `{error}`. "Fail-closed with a typed message" is a feature
you build (new blocked shape + tests), not a property you inherit. Same lesson
at the fixture level: the `.codex`-as-file obstacle trips a DIFFERENT probe
(cleanup's lstat, raw ENOTDIR) before the polished blocker — the test asserts
the real shape; a curated message there is filed as follow-up.

## 4. Harness worktrees are cut at spawn-time base — workers on serialized cells must rebase
cph-2's worktree was cut at the pre-merge base even though main had already
advanced with cph-1. The worker's first step on any serialized cell should be
`git rebase main` (or checkout of the named integration sha), verified via
`git log`, before reading any code.

## Follow-ups (backlog)
- Curated FIX-message for the cleanup-probe ENOTDIR path.
- install.ps1 has no plugin rollback machinery (pre-existing; Windows E2E
  slice owns it).
- GH #22 items 3 (dispatch prepare CLI), 6 (economics attribution), 7 (tiny
  A/B) remain open as separate features.
