# Grooming Reference

Load after `bee-grooming` is selected. The cycle lives in SKILL.md; counting rules, checklists, and templates live here.

## Entropy Computation

```
ENTROPY SCORE = orphaned cells ×10 + unverified cells ×5 + stale decisions ×5
              + stale specs ×5 + backlog-without-outcome ×2 + stale work ×3
              + broken tools ×8, cap 100
```

Counting rules per term (all from `.bee/` records — never guess):

| Term | Count | Source |
|---|---|---|
| orphaned cells | open/claimed cells whose feature is no longer the active feature and has no HANDOFF pointing at them | `node .bee/bin/bee.mjs cells list` vs `.bee/state.json` + `.bee/HANDOFF.json` |
| unverified cells | claimed cells with no recorded verify result (`trace.verify_passed` absent) | cell files |
| stale decisions | active decisions citing files/paths that no longer exist, or contradicted by current code | `node .bee/bin/bee.mjs decisions active` + spot-check citations |
| stale specs | areas with a `behavior_change: true` cell capped after the area spec's `updated` frontmatter date, or with such a cell and no spec at all (map cells to areas by files touched); ALSO areas whose Pointers / reading-map locations have git commits or uncommitted changes after `updated` even with no cell — vibe edits outside the chain count too (decision 0003); count each area once | capped cell files + `git log --since=<updated> -- <paths>` + `git status --porcelain` vs `docs/specs/<area>.md` frontmatter |
| backlog-without-outcome | **machine-backlog** (`.bee/backlog.jsonl`) entries older than 30 days with no matching outcome entry — NOT `docs/backlog.md` PBI rows, which are product intent and never score entropy | `.bee/backlog.jsonl` |
| stale work | reservations past TTL and never released; HANDOFF.json older than 7 days | `.bee/reservations.json`, `.bee/HANDOFF.json` |
| broken tools | `.bee/bin/` helpers that error on invocation; hook crash entries in `.bee/logs/hooks.jsonl` since the last audit | run helpers with `--json`, read the log |

Bands: 0 = perfect · 1–25 healthy · 26–50 attention · 51–100 action required.

**This score is bee's own housekeeping, not project debt.** Report it in the short hive-housekeeping note (a few lines), never as the headline. `broken_tools` and any bee-lib / vendored-helper bug are **harness health** — surface them in one plain line and route upstream to bee; they NEVER become project kill proposals. `stale_specs` is the one term about the user's own docs — carry it into the project hunt.

**Coverage read-out** (decision 0003 — informational, never scored): alongside the score, report `specs: <N areas specced> / <M behavior-bearing reading-map locations>` (a location is behavior-bearing when its one-liner describes observable behavior, not assets/config). Low coverage is a backfill program for harvest cells, not week-to-week debt.

Trend: after each audit, append an entry to `.bee/backlog.jsonl` so the next run can compare:

```json
{"ts":"<ISO>","type":"entropy-audit","score":18,"breakdown":{"orphaned_cells":0,"unverified_cells":1,"stale_decisions":1,"stale_specs":0,"backlog_without_outcome":4,"stale_work":0,"broken_tools":0},"trend":"down from 27","source":"grooming"}
```

## Hunt Checklists

**Scope first (every check below):** hunt the **project's own files** only — its source, docs, tests, config. Exclude the harness and generated trees: `.bee/`, `.claude/`, `.codex/`, the `AGENTS.md` bee block, `node_modules/`, build output, lockfiles. A finding inside those is not project debt; a real bee bug there is a one-line "report upstream to bee" note, not a kill proposal. Write every finding in plain project language (name the module/file and what it costs), not bee vocabulary.

**Friction clusters** — group `trace.friction` strings from capped cells and `type:"friction"` backlog entries by module/topic; 2+ hits on the same thing = a cluster worth a proposal. Also tally entries by `layer` (spec | context | environment | verification | state) and report one line in the audit: friction count per layer, largest = the bottleneck layer this cycle — fix proposals aim at that layer first. Entries without `layer` count as unattributed.

**Dead code / unused exports** — for each suspect symbol: grep every reference (imports, dynamic `import()`, `require`, string-built paths, config/registry files, reflection); check public-API surface (package entry points, exported types); check test-only usage (test-only = candidate to move, not to keep). No reference anywhere = candidate. Any doubt = not a candidate.

**Stale docs vs code** — compare README/docs claims (commands, file paths, flags, versions) against reality by running or resolving them; each mismatch is a candidate (fix the doc, not the code, unless the code is the bug).

**Stale, missing, or duplicated area specs** — for each stale-specs hit from the audit, propose a `bee-scribing` sync cell (tiny lane) that merges the missed `behavior_change` deltas into `docs/specs/<area>.md`; a git-drift hit (files changed, no cell — decision 0003) gets the same sync cell, and "no behavioral delta — spec confirmed current" is a valid cheap outcome; for an area with shipped behavior and no spec at all, propose a `bee-scribing` harvest cell (small lane — it may need user interview time). Scan for **duplicates**: two spec files whose Pointers or reading-map lines overlap on the same surface (including `-v2`/`-new`/date-suffixed names) — propose a `bee-scribing` merge cell that consolidates into the older stable name and deletes the fork; two documents describing one area is worse than a stale one, because readers cannot tell which is true. Also spot-check `docs/specs/reading-map.md` lines against reality (paths exist, one-liners still true, exactly one spec per surface). **Misfiled artifacts** (decision 0004): `docs/specs/` holds ONLY area specs, `system-overview.md`, `reading-map.md`, and `visuals/` — scripts, exports, CSVs, or survey folders living there pollute coverage counting and spec scans; propose a tiny move-cell relocating them (e.g. to `docs/history/` or a data directory) and fixing any references. A spec staler than the behavior it describes is worse than no spec — an agent trusts it and acts on the old behavior. Sync/harvest/merge always runs through bee-scribing, never as a raw doc edit — the BA template and never-invent rules live there.

**Fresh Session Test** (docs/09 item 4) — answer five questions from repo artifacts alone, each mapped to its owner; an unanswerable probe does **not** file an open-ended task — it names its **one-command fix** (D10/A5), so the finding is immediately actionable:

| Question | Answered by | One-command fix when unanswerable |
|---|---|---|
| What is this system? | `docs/specs/system-overview.md` | run `bee-scribing` **bootstrap** (offers a provable-facts skeleton for the missing map, D2) |
| How is it organized? | `docs/specs/reading-map.md` | run `bee-scribing` **bootstrap** (writes the missing reading-map skeleton, D2) |
| How do I run it? | `.bee/config.json` `commands` (setup/start) | run `node .bee/bin/lib/commands_detect.mjs`, confirm the candidates into `.bee/config.json` (D3) |
| How do I verify it? | `.bee/config.json` `commands` (test/verify) — run it, don't just read it | run `node .bee/bin/lib/commands_detect.mjs`, confirm test/verify into `.bee/config.json` (D3) |
| Where are we now? | `node .bee/bin/bee.mjs status --json` | (self-answering — the command is the artifact) |

Five minutes per audit; this catches system-of-record decay the entropy formula cannot see (a spec can be fresh and the repo still unanswerable to a cold start). A probe finding is filed with its fix named, never as "document the project" — the fix is one bounded command (bootstrap for Q1/Q2, detect-and-confirm for Q3/Q4).

**Product-backlog (PBI) drift** — audit `docs/backlog.md` (the product backlog of PBI rows — distinct from `.bee/backlog.jsonl`, the machine friction/grooming layer) for three drift patterns, each a tiny fix cell (prose-ruled correction, never a hook — D7):

| Drift | Meaning | Fix cell |
|---|---|---|
| `in-flight` row, no active feature | a row claims work is underway but no `docs/history/<feature>/` matches the slug | tiny: flip to `done`+link if the feature shipped, or back to `proposed` if it was dropped |
| `done` feature, no row | a shipped feature under `docs/history/` has no backlog row (bypassed the backlog) | tiny: append the `done` row retroactively, linked |
| duplicate rows for one story | two rows describe the same PBI (parser counts both honestly — dedup is this prose audit, not the counter's job) | tiny: merge into the higher-priority row, delete the fork |

Status counts come from `node .bee/bin/bee.mjs status --json` (`pbi`) — the audit reconciles those counts against active features and `docs/history/`, it does not recount by hand.

**TODO/stub debris** — grep `TODO|FIXME|HACK|XXX|not implemented|placeholder`; each hit is either a real backlog item (file it with predicted impact) or debris (kill candidate). Never leave it as a comment-shaped promise.

**Unverified verify-commands** — run each distinct `verify` command from open cells in a dry form; a command that cannot run (missing script, renamed target) makes its cell unexecutable — propose a fix cell.

**Superseded-but-still-cited decisions** — for each superseded decision, grep code comments, docs, plan.md and CONTEXT.md for its D-id or wording; stale citations are candidates.

**Slop patterns in recent diffs** — scan the last ~20 commits for the slop list below.

## Slop-Pattern List

- empty or log-only `catch` blocks that swallow errors
- redundant `return await` inside async functions
- dead flags: config/env switches with only one live branch
- copy-paste drift: near-duplicate blocks that diverged in one detail
- commented-out code kept "just in case"
- defensive re-checks of conditions already guaranteed by the caller
- stub handlers that return fixed values in non-test code

## Proposal Template

One per kill candidate, appended to `.bee/backlog.jsonl` and presented for approval:

```json
{"ts":"<ISO>","type":"kill-proposal","title":"<what dies>","pain":"<what it costs today>","predicted_impact":"<what removal buys>","risk_lane":"tiny|small","evidence":"<proof of non-use / staleness, file:line>","status":"proposed","source":"grooming"}
```

Presentation format (gstack question shape):

```text
CONTEXT: <the candidate and its evidence, 1-2 lines>
QUESTION: Approve this kill?
RECOMMENDATION: <kill / keep / defer, with one reason>
A) Approve — dispatch as a <risk_lane> cell
B) Keep — record why, close the proposal
C) Defer — leave in backlog with a revisit note
```

One question per candidate. Approval covers exactly that candidate.

Promote-to-check proposals (a repeated finding becoming a grep/lint/guard — docs/09 item 3) ride the same template with `risk_lane` tiny or small; changing what a gate or gate-adjacent guard *blocks* is never tiny.

## Outcome Template

After the kill cell caps (or fails), append:

```json
{"ts":"<ISO>","type":"kill-outcome","proposal_ts":"<ts of the proposal>","title":"<what died>","predicted_impact":"<as proposed>","actual_outcome":"<what actually happened, incl. surprises>","cell":"<cell id>","source":"grooming"}
```

Prediction vs actual mismatches worth remembering → hand to `bee-compounding` as a learning candidate.

## Red Flags

- score computed from memory instead of `.bee/` records
- a kill executed without a `kill-proposal` entry and recorded approval
- proposals with pain or impact fields left generic ("cleanup", "tidiness")
- outcome entries never written ("the kill obviously worked")
- headless run that executed anything
