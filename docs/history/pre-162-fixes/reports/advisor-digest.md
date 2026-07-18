# Advisor digest — pre-162-fixes (high-risk lane)

Advisor: fable (ceiling tier, AO3/AO13). Consulted 2026-07-19. Verdict:
GO-WITH-CONDITIONS. Ground truth confirmed at HEAD v1.6.1 (one-shot merge at
worktree-store.mjs:795/826-828; hard-coded 'hooks' at bee.mjs:2757;
check-ref-format at worktree-store.mjs:332-333).

Risks + mitigations (full text as delivered):

1. `repoOwnsHookCatalog` does not exist in bee.mjs (only onboard_bee.mjs:2062)
   — D1's fallback would ReferenceError. Port the one-line helper + re-sync
   mirrors.
2. Parsing "real handler paths" fights the `$r` design (shell strings, no
   static prefix provable — bee.mjs:2455-2458). Either strip the `$r`/ prefix
   (quoted+unquoted) and treat the rest as repo-relative with fallback on any
   unparseable command, or mirror the Claude resolver's cheaper dual-location
   existence check (bee.mjs:2664-2665). Advisor prefers the dual-check as the
   lower-risk read of D1.
3. The new host-topology fixture must change the hooks.json COMMAND strings
   (`"$r"/.bee/bin/hooks/<f>`), not just move files; keep scenario 12 as the
   bee-repo case.
4. Green path can leave main dirty when verify mutates a tracked file
   (commit uses the index; verify edits stay unstaged). Post-commit assert
   `git status --porcelain --untracked-files=no` empty; typed warning if not.
5. "HEAD unchanged" proof must be three-part: `rev-parse HEAD` unchanged +
   `.git/MERGE_HEAD` absent + tracked-clean (`--untracked-files=no`) — raw
   porcelain-empty is dishonest (abort never removes untracked files verify
   created).
6. The red-verify e2e is a fixture CHAIN: test_worktree_cli.mjs:802-805
   depends on the alarm test leaving `mainA/flag.txt` flipped. Under abort
   semantics that premise collapses — rework the downstream fixture to flip
   its own flag; audit every mainA reuse.
7. Verify now runs on a mid-merge tree (MERGE_HEAD live, changes staged) —
   document it; run the abort in a `finally` so a verify crash can't strand a
   staged merge; handle "Already up to date" (no MERGE_HEAD → commit would
   error/empty).
8. `--end-of-options` needs git ≥ 2.24 (note the floor); the existing test
   asserts WORKTREE_INVALID_BASE_REF where D3 emits WORKTREE_BASE_NOT_FOUND —
   update the expected code.

Drift audit (old-contract prose that must change in this feature):
- docs/specs/worktree-parallelism.md:83 "merge commit is never rolled back".
- skills/bee-hive/SKILL.md:69 Session Scout "not a signal to roll back".
- AGENTS.md:56 rule 14 rider "post-merge configured verify" → staged-then-
  verified; red aborts. (+ AGENTS.block.md template, rendered trees.)
- worktree-store.mjs:826-828 message; test_worktree_cli.mjs:544-550 assertion.

Ambiguity resolutions: D1 → dual-location check acceptable (either
implementation is GO; parsing must degrade to the ported fallback). D2 step 7
equivalence holds only when verify leaves tracked files untouched — back it
with the post-commit tracked-clean assertion. D2 HEAD-proof = the three-part
check, encoded in e2e.
