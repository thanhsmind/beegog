# Backlog auto-commit scoping (P79) — Context

**Feature slug:** backlog-auto-commit
**Date:** 2026-07-23
**Exploring session:** complete
**Scope:** Quick
**Domain types:** CALL

## Feature Boundary

`bee backlog add`'s auto-commit (shipped in P78) currently fires unconditionally for every row, including an agent self-logging friction/debt/findings about its own session; this feature scopes the auto-commit to only human-queue-submitted rows, and makes a merge-in-progress skip visible instead of a silent no-op. Ends at `commitBacklogRow`/`handleBacklogAdd` and their direct callers — no other backlog CLI verb is in scope.

## Locked Decisions

| ID | Decision | Rationale (only if it changes implementation) |
|----|----------|-----------------------------------------------|
| D1 | `bee backlog add` gains an explicit `--queue-submit` boolean flag, default `false`. `commitBacklogRow` only attempts a commit when it is `true`. | type/severity/layer cannot distinguish human-queue-submission from agent-self-observation — P79's own row proves it: the 2026-07-23T09:11:59.377Z `harness-issue` entry used the same `type` an agent's routine self-audit finding would use. Named `--queue-submit`, not `--source human\|agent`: the caller is always the agent process: what varies is intent (new item for the processing queue vs. the agent logging its own friction/debt/finding), and `--source` would misstate that. Default `false` is the safer default given P79 is itself a P1 self-audit finding about accidental main pollution — a caller that forgets the flag now fails safe (no commit), not loud (commit). |
| D2 | `commitBacklogRow` detects a merge in progress (resolve the real git-dir via `git rev-parse --git-dir`, check for `MERGE_HEAD` there — never a hardcoded `.git/MERGE_HEAD`, since linked worktrees point `.git` elsewhere) *before* attempting the scoped commit, and surfaces exactly that cause: `commit_skipped_reason: "merge_in_progress"` in the JSON result, plus a visible warning suffix in the CLI text output. | Scoped to merge-in-progress only (YAGNI) — every other existing failure path (no `.git`, spawn error, generic commit failure) stays silent `{committed:false, sha:null}` exactly as today; P79 only asked for this one cause to stop degrading silently. Detecting `MERGE_HEAD` up front is deterministic and avoids parsing git's stderr text, which is fragile across git versions. |

### Agent's Discretion

Which existing call sites across `skills/**` pass `--queue-submit` vs. leave it unset is an implementation/inventory task, delegated to planning — not a product decision (the product decision is the flag's existence, name, and default, locked above).

## Existing Code Context

From the quick scout only. Downstream agents read these before planning.

### Reusable Assets

- `skills/bee-hive/templates/bee.mjs:2502` (`commitBacklogRow`) — scoped git add+commit against `.bee/backlog.jsonl` only, already degrades to `{committed:false, sha:null}` on any failure without throwing. D1/D2 extend this function; `appendJsonl` (line 2563, in `handleBacklogAdd`) always runs regardless of the new flag — only the commit step becomes conditional.
- `skills/bee-hive/templates/bee.mjs:2533` (`handleBacklogAdd`) — flag parsing (`requireFlag`, optional-flag pattern for `detail`/`feature`) to follow for the new `--queue-submit` flag; builds the `line` object and the `text` summary that D2's warning suffix extends.
- `skills/bee-hive/templates/lib/feedback.mjs:67` (`KIND_ALIASES`/`NORMALIZED_KINDS`) — confirms `type` is a finding-kind taxonomy (friction/finding/proposal/outcome/debt/harness-issue/...), orthogonal to who/why a row was added — ruled out as the D1 signal.

### Established Patterns

- `.bee/bin/bee.mjs` mirrors `skills/bee-hive/templates/bee.mjs` byte-for-byte (rendered via `onboard_bee.mjs --apply`) — both need updating, or the template edited and re-synced; confirmed identical function bodies at the same line numbers during this scout.
- The scoped-commit pattern in `commitBacklogRow` (pathspec-limited `git add`/`git commit`, never `-A`/plain `commit`) is the established convention for any future auto-commit — D2 must reuse `runBacklogGit`, not introduce a new git-invocation helper.

## Canonical References

- `docs/backlog.md` row P79 — the accepted acceptance criteria this feature implements.
- `.bee/backlog.jsonl:2026-07-23T09:11:59.377Z` (harness-issue) — the self-audit finding that is this feature's direct trigger and D1's evidence.
- `docs/history/backlog-auto-commit/` (this feature's own prior slice, P78) — commit `1a164fc`, merged `5900af8`: the auto-commit behavior this feature narrows.

## Outstanding Questions

### Deferred To Planning

- [ ] Full inventory of `bee backlog add` call sites across `skills/**` (17 references across 9 files, confirmed by fresh-eyes review) and which should pass `--queue-submit` — needs a planning-stage scout, not an exploring-stage one. Planning must confirm at least one real caller passes the flag, else P78's auto-commit value fully reverts to never-firing (fresh-eyes review note).
- [ ] Whether `--queue-submit` needs its own validation error (e.g. rejecting an unrecognized value) or a bare boolean presence check is sufficient, given `handleBacklogAdd`'s existing flag-parsing conventions.
- [ ] Whether the JSON result should carry a `commit_skipped_reason` value (e.g. `"not_queue_submit"`) when the commit is skipped because `--queue-submit` is false/absent, or leave that path with no reason field at all (D2 only defined a reason for the merge-in-progress case; fresh-eyes review flagged this as an open, non-blocking gap).

## Deferred Ideas

- Generalizing `commit_skipped_reason` to cover every failure path (no-`.git`, spawn error, generic commit failure), not just merge-in-progress — deferred by D2 (YAGNI); revisit only if a future incident needs visibility into one of those other causes.

## Handoff Note

CONTEXT.md is the source of truth. Decision IDs are stable. Planning reads locked decisions, code context, canonical references, and the deferred-to-planning questions above.
