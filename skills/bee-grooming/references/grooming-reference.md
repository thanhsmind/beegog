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
| orphaned cells | open/claimed cells whose feature is no longer the active feature and has no HANDOFF pointing at them | `node .bee/bin/bee_cells.mjs list` vs `.bee/state.json` + `.bee/HANDOFF.json` |
| unverified cells | claimed cells with no recorded verify result (`trace.verify_passed` absent) | cell files |
| stale decisions | active decisions citing files/paths that no longer exist, or contradicted by current code | `node .bee/bin/bee_decisions.mjs active` + spot-check citations |
| stale specs | areas with a `behavior_change: true` cell capped after the area spec's `updated` frontmatter date, or with such a cell and no spec at all (map cells to areas by files touched); count each area once | capped cell files vs `docs/specs/<area>.md` frontmatter |
| backlog-without-outcome | backlog entries older than 30 days with no matching outcome entry | `.bee/backlog.jsonl` |
| stale work | reservations past TTL and never released; HANDOFF.json older than 7 days | `.bee/reservations.json`, `.bee/HANDOFF.json` |
| broken tools | `.bee/bin/` helpers that error on invocation; hook crash entries in `.bee/logs/hooks.jsonl` since the last audit | run helpers with `--json`, read the log |

Bands: 0 = perfect · 1–25 healthy · 26–50 attention · 51–100 action required.

Trend: after each audit, append an entry to `.bee/backlog.jsonl` so the next run can compare:

```json
{"ts":"<ISO>","type":"entropy-audit","score":18,"breakdown":{"orphaned_cells":0,"unverified_cells":1,"stale_decisions":1,"stale_specs":0,"backlog_without_outcome":4,"stale_work":0,"broken_tools":0},"trend":"down from 27","source":"grooming"}
```

## Hunt Checklists

**Friction clusters** — group `trace.friction` strings from capped cells and `type:"friction"` backlog entries by module/topic; 2+ hits on the same thing = a cluster worth a proposal.

**Dead code / unused exports** — for each suspect symbol: grep every reference (imports, dynamic `import()`, `require`, string-built paths, config/registry files, reflection); check public-API surface (package entry points, exported types); check test-only usage (test-only = candidate to move, not to keep). No reference anywhere = candidate. Any doubt = not a candidate.

**Stale docs vs code** — compare README/docs claims (commands, file paths, flags, versions) against reality by running or resolving them; each mismatch is a candidate (fix the doc, not the code, unless the code is the bug).

**Stale area specs** — for each stale-specs hit from the audit, propose a sync cell (tiny lane) that merges the missed `behavior_change` deltas into `docs/specs/<area>.md`; also spot-check `docs/specs/reading-map.md` lines against reality (paths exist, one-liners still true). A spec staler than the behavior it describes is worse than no spec — an agent trusts it and acts on the old behavior.

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
