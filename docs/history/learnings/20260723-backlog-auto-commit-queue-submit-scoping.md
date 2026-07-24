---
date: 2026-07-23
feature: backlog-auto-commit
categories: [pattern, decision, failure]
severity: standard
tags: [backlog, cli-design, worktree, mechanical-pass, self-audit]
---

# Learnings — backlog-auto-commit-2 (P79: scoping the auto-commit)

**Category:** pattern
**Severity:** standard
**Tags:** [worktree, git-detection, cli-design]
**Applicable-when:** implementing any auto-commit/auto-stash/git-state-dependent feature in a repo that uses linked git worktrees.

## What Happened

D2 needed to detect a merge in progress before `commitBacklogRow` attempted its scoped `git add`/`git commit`. It resolves the real git-dir via `git rev-parse --git-dir` and checks for `MERGE_HEAD` there, rather than assuming `.git/MERGE_HEAD` — because in a linked worktree (this repo's own `--wt--` convention), `.git` is a file pointing elsewhere, not a directory.

## Root Cause

A hardcoded `.git/MERGE_HEAD` path silently fails (file never found) inside any linked worktree, so a merge-in-progress there would go undetected — exactly the silent-degrade failure mode this decision exists to avoid. Resolving the git-dir first, then checking within it, works identically in an ordinary checkout and in a linked worktree.

## Recommendation

When any repo feature needs to detect git state (`MERGE_HEAD`, `HEAD`, `refs/`, index locks, etc.) by touching `.git` directly, always resolve `git rev-parse --git-dir` first and read relative to that — never assume `.git` is a directory. This repo dogfoods its own worktree tooling constantly; a hardcoded `.git/<file>` path is a latent bug the moment anyone runs the feature from `bee worktree new`.

---

**Category:** decision
**Severity:** standard
**Tags:** [cli-design, scope-narrowing, backlog]
**Applicable-when:** planning work that touches `bee backlog add` or any caller of `commitBacklogRow`/`handleBacklogAdd`.

## What Happened

D1 gated the existing auto-commit (P78) behind a new `--queue-submit` flag, default `false`. The small-lane scoping-synthesis pass inventoried all 17 existing `bee backlog add` call sites across 9 skills files and found every one of them is an agent self-observation (friction/debt/finding) — correctly, none were changed to pass `--queue-submit`. Net effect: **P78's auto-commit capability is currently dormant** — no live code path in the repo triggers a commit today, until some future caller is wired to pass the flag.

## Root Cause

The default was chosen fail-safe (no commit) over fail-loud (commit), because P79 itself is a P1 self-audit finding about an agent's own routine self-observation getting auto-committed to shared history without review. Fail-safe was the right call given that trigger — but it has the side effect of silently neutralizing P78's shipped value until a genuine human-queue-submission call site exists, and none currently does.

## Recommendation

When narrowing a shipped default from "always on" to "on by explicit opt-in" as a safety fix, always inventory existing callers in the SAME pass (as this one did) and, if zero callers will opt in, file the "wire a real caller" gap as its own backlog item immediately — don't let a safety fix silently retire a feature's value without a visible trail. (Done here: `.bee/backlog.jsonl` proposal filed 2026-07-23T10:24:19.445Z, "Wire a real human-queue-submit caller for bee backlog add --queue-submit".)

---

**Category:** failure
**Severity:** standard
**Tags:** [backlog-parser, mechanical-pass, silent-drop, pre-existing]
**Applicable-when:** writing or reviewing a mechanical pass (parser, lint, gate) that classifies markdown table rows by exact-string match against an enum.

## What Happened

While flipping P79's row to `done`, the established convention was followed — `done ([docs/history/<feature>/](history/<feature>/))` — matching P77's identical prior pattern. `bee backlog counts` afterward reported implausible numbers. Root cause, confirmed by reading `lib/backlog.mjs`: `readBacklogCounts`/`normalizeStatus` requires an **exact** match to `'done'`/`'proposed'`/`'in-flight'` after stripping only `*`/`` ` ``/`_` markup — a status cell reading `done ([...])` normalizes to that whole string, fails the exact match, and is silently dropped from every count, not flagged as malformed. Direct audit of the live `docs/backlog.md` found **5 of 47 actually-done rows (~11%)** invisible to counts/rank/README-badges this way: 3 using the link-parenthesis convention (`P32`, `P77`, `P79`) and 2 using a sibling `done: <text>` convention (`P8`, `P13`). Git history confirms this is an **11-day-old latent defect** (first triggered 2026-07-12, `587ab80`) — this feature's own P79 row is simply the occasion it was finally noticed, not something backlog-auto-commit caused.

## Root Cause

`skills/bee-hive/templates/tests/test_backlog_capture.mjs`'s existing coverage for this parser only feeds it synthetic unknown-status fixtures (e.g. `blocked`) and asserts the silent-drop behavior as *correct* — it never tests the parser against the project's own real, documented `done`-with-link convention, so the mismatch between "what the parser accepts" and "what this project's table actually writes" was never exercised.

## Recommendation

A mechanical pass that classifies rows by exact-enum match against a live, evolving document must be tested against that document's own real conventions, not only synthetic edge cases — add a golden/integration assertion (`counts.total` equals the number of table rows whose status cell starts with a recognized status word, e.g. `/^done\b/`, not only an exact match) so a documented annotation convention can never silently vanish from counts/rank/badges again. Filed as `.bee/backlog.jsonl` friction, P2, 2026-07-23T10:20:34.557Z — out of this feature's own locked scope (CONTEXT.md bounds this feature to `commitBacklogRow`/`handleBacklogAdd`), left for grooming/a future cell to fix.
