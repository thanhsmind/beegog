# worktree-session-routing — CONTEXT (locked decisions)

GitHub issue #21: "Tôi cảm giác worktree chưa chạy. Tôi chạy 2 session khác
nhau nhưng khi release bị bắt đợi." Evidence in the issue: (a) this repo's own
1.5.1 release had to block-and-wait for another session's last cell; (b) the
other session saw the release bump mid-flight and had to ask its human
whether to wait/revert/continue. The user's locked product direction (chat
screenshot in the issue): *mỗi phiên tự ra worktree riêng rồi merge lại — chỉ
đụng khúc merge, không đợi; sợ conflict ngữ nghĩa, không sợ conflict file.*

Parent feature: `worktree-feature-parallelism` (D1-D6 locked in
`docs/history/worktree-feature-parallelism/CONTEXT.md`). Its shipped portion:
grant registry, store bootstrap, `resolveRoots` grant-consult, write-guard
deny on invalid link, CLI `worktree register/list/unregister`
(spec `docs/specs/worktree-parallelism.md`, shipped 2026-07-16 unreviewed).
Its named-but-never-built remainder: `bee worktree new`, merge-back/replay,
routing prose. This feature builds exactly that remainder, honoring D1-D6.

## In scope

1. `bee worktree new --feature <slug>` — the missing "enter" step (D2 of the
   parent feature named this exact command as the only opt-in door).
2. `bee worktree merge --id <id>` — the missing "return" step.
3. Routing prose (bee-hive + AGENTS.md multi-session rule) so a session knows
   *when* to enter a worktree instead of camping the shared checkout.

## Out of scope (inherited + new)

- Same-file concurrency across worktrees (parent D4 — stays with claims/holds).
- P40 swarm-worker worktree dispatch (parent D1 — untouched, coexists).
- Three-tier `.bee/` directory split (parent D3) — NOT built here; the flat
  layout + existing `merge=union` on the 3 jsonl logs is enough for this MVP.
- Host rollout (parent D6) — beegog first, hosts pull via release as usual.
- Auto-teleporting a running session into a worktree — impossible; the human
  opens the new session in the printed path. The command prepares everything.

## Locked decisions

- **D7 — `bee worktree new` creates AND registers in one move.** From the main
  checkout: `git worktree add <sibling> -b <branch>` + grant + store bootstrap
  (reusing `bootstrapWorktreeStore`), then prints the path with a one-line
  "open your session there" instruction. Sibling path convention:
  `../<repo-basename>--wt--<slug>` (outside the main worktree so the write
  guard's containment stays honest). Branch convention: `wt/<slug>`.
  `register` stays for adopting a hand-made worktree; `new` is the paved road.
- **D8 — merge-back = git merge + post-merge full verify, run from the MAIN
  checkout.** `bee worktree merge --id <id>`: refuse on dirty main tree or
  dirty worktree tree (typed), `git merge --no-ff <branch>`; file conflicts
  surface as normal git conflicts (jsonl logs already `merge=union`); then the
  configured `commands.verify` runs and its result is REPORTED — a red verify
  after a clean textual merge is the semantic-conflict alarm the user asked
  for, and the command says exactly that. Merge succeeds + verify green →
  offer cleanup (`--cleanup` flag: `git worktree remove` + unregister +
  branch delete). Verify red → merge commit stays, typed
  `MERGE_VERIFY_RED` result tells the session to fix-first before release.
- **D9 — routing rule, not a hard gate.** bee-hive orientation + AGENTS.md
  rule 14 gain: when starting NEW feature work in a checkout that already has
  another live session's active work (live-owner lanes, active holds, or a
  mid-swarm default pipeline), the paved road is `bee worktree new` and a
  fresh session in the printed path; camping the shared checkout stays legal
  for docs-lane work, tiny fixes, and release machinery (release always runs
  in the MAIN checkout). Prose only — no new hook; the existing guards keep
  enforcing the hard parts (holds, live-owner lanes, gates).
- **D10 — the worktree session is a normal bee session.** Its store was
  bootstrapped idle; it runs bee-hive → its own gates → its own cells in its
  own store (parent's independent-feature mode). No new session/lane schema
  fields in this MVP: the worktree's own store IS the binding; the main
  store's grant registry (git-verified id) remains the only cross-tree index.

## Acceptance

- From main checkout: `worktree new --feature demo` → sibling worktree exists
  on branch `wt/demo`, granted, bootstrapped idle store; `worktree list`
  shows it; command output names the path.
- In the worktree: commits on `wt/demo`; main checkout untouched.
- From main: `worktree merge --id <id>` on a clean pair → merge commit on
  main, verify runs, green path reports green; `--cleanup` removes worktree +
  grant + branch. Dirty main / dirty worktree / unknown id → typed refusals,
  zero mutation.
- Semantic-conflict path proven in tests: textual-clean merge that breaks a
  test → `MERGE_VERIFY_RED` reported, merge commit intact.
- bee-hive + AGENTS.md name the routing rule; rendered plugin trees + manifest
  stay drift-green.
