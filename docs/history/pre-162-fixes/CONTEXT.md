# pre-162-fixes — CONTEXT (locked decisions)

Source: the user's 1.6.1 review (2026-07-19, chat — full text mirrored in
GH #22 thread context). Verdict 8/10; two mechanical P1 bugs + one P3 must
land before 1.6.2. The review text IS the product direction; decisions below
restate it.

## In scope (the "trước 1.6.2" list)

1. **P1 — doctor codex checks the wrong hook dir on host repos.**
   `handleDoctor()` calls `doctorHookHandlersResolvable(root, "hooks")` →
   checks `<repo>/hooks/<file>.mjs`. Onboarding renders host hook commands as
   `"$r"/.bee/bin/hooks/<file>.mjs`. Works when dogfooding bee's own repo
   (which has root `hooks/`), breaks on every normal host (only
   `.bee/bin/hooks/`). Conformance fixture stubs root `hooks/` too — mimics
   bee's topology, so the bug was invisible.
2. **P1 — worktree merge is not a safe transaction.** Conflict leaves main in
   conflict state (no abort); red verify leaves a known-red merge commit on
   main. Redesign per the review's 8 steps (D2 below).
3. Regression tests for both.
4. **P3 — --base-ref validated with the wrong primitive.**
   `git check-ref-format --allow-onelevel` checks ref-NAME syntax, not
   commit-ish existence; rejects/ignores `HEAD~1`, `abc1234`, `v1^{commit}`.

## Out of scope (filed to backlog / GH #22, not this feature)

dispatch prepare CLI; logical/requested/effective model split; doctor
ready/degraded/blocked + attestation; doctor deep skill-inventory check;
live-Codex canary; GitHub Actions CI matrix; Windows installer rollback.

## Locked decisions

- **D1 — doctor resolves the hook dir from reality, not a hard-coded name.**
  Parse the actual command paths out of `.codex/hooks.json` entries, resolve
  each to a repo-contained canonical path, and check THAT file exists.
  Fallback ordering when no hooks.json entry yields a path:
  `repoOwnsHookCatalog(root) ? "hooks" : ".bee/bin/hooks"`. New regression
  fixture = a NORMAL host topology: `.codex/hooks.json` → `.bee/bin/hooks/*`
  present, root `hooks/` absent, `hook_handlers_resolvable` must be ok; plus
  the inverse (missing handler file → not ok).
- **D2 — merge-back becomes a transaction that never leaves main wounded.**
  (1) capture pre-merge HEAD; (2) `git merge --no-ff --no-commit`; (3)
  conflict → `git merge --abort`, confirm HEAD unchanged, typed
  MERGE_CONFLICT; (4) run the configured verify on the merged-but-uncommitted
  working tree; (5) red → `git merge --abort`, confirm HEAD unchanged, typed
  MERGE_VERIFY_RED (the semantic alarm now reports WITHOUT wounding main);
  (6) green → `git commit`; (7) post-commit full verification is satisfied by
  the pre-commit run (committing changes no tracked bytes — document this
  equivalence in code; if a future test class ever needs committed state, a
  temporary integration branch is the named escape hatch, not main); (8) if a
  post-commit verify is ever run and unexpectedly red, `git revert -m 1` is
  the documented recovery. **Supersedes D8's "merge commit is never rolled
  back"**: the new invariant is stronger — no merge commit EXISTS until
  verify is green; abort paths must prove HEAD byte-unchanged in tests.
- **D3 — base-ref uses `git rev-parse --verify --end-of-options
  "<ref>^{commit}"`**; failure → typed `WORKTREE_BASE_NOT_FOUND`, zero
  mutation. Accepts HEAD, HEAD~1, short shas, tag^{commit} forms.
- **D4 — cleanup semantics under the new transaction:** `--cleanup` still
  runs only after green (now: after the commit lands); conflict/red-verify
  abort paths never clean up, and the worktree/branch are untouched.

## Acceptance

- Doctor: normal-host fixture green; bee-repo dogfood still green; missing
  handler detected. Conformance fixtures updated to host topology.
- Merge: e2e proves conflict → abort, HEAD unchanged, no MERGE_MSG residue;
  red verify → abort, HEAD unchanged; green → exactly one merge commit;
  cleanup only post-commit. Existing 19 installer/worktree scenarios stay
  green (assertions updated only where D2 intentionally changed behavior —
  the red-verify scenario now asserts abort instead of surviving commit).
- base-ref: HEAD~1/short-sha/tag accepted; garbage → WORKTREE_BASE_NOT_FOUND.
- Full configured verify green; spec `worktree-parallelism.md` +
  `onboarding.md`/doctor prose synced at scribing.
