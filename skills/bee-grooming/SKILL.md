---
name: bee-grooming
description: >-
  Hunt and kill tech debt IN THE CURRENT PROJECT — dead code, stale docs, TODO/stubs, duplication, drifted specs — reported in plain project language. bee's own housekeeping (the entropy score) is a short side-note, and `.bee/`, `.claude/`, `.codex/` are never treated as project debt. Use when the user asks to clean up, find debt, or audit the repo.
metadata:
  version: '0.1'
  ecosystem: bee
  dependencies:
    nodejs-runtime:
      kind: command
      command: node
      missing_effect: degraded
      reason: Computes the entropy score from bee records via the vendored .bee/bin helpers.
---

# Grooming (undertaker bees)

Grooming is the on-demand hygiene pass, run when the hive is idle. It carries dead weight out in a fixed cycle: **hunt the project → propose → execute → close the loop**, with a quick hive-housekeeping check on the side. Grooming decides nothing alone and deletes nothing alone.

## Scope — the project, not the harness

Grooming cleans the **current project**: its source code, its docs, its tests. Report what you find in **plain language a non-bee user understands** ("three unused functions in the export module" — not "orphaned cells at trace level"). Keep bee's own vocabulary out of the findings.

Hard boundary — these are OUT of scope as project debt and are NEVER kill/move candidates here:

- `.bee/`, `.claude/`, `.codex/`, the `AGENTS.md` bee block, and bee's vendored helpers (`.bee/bin/`) — this is the harness, not the project.
- `node_modules/`, build output, lockfiles, and generated directories.

If the hunt turns up a genuine **bee/harness bug** (a vendored helper misbehaving, a guard that never fires, a stray `.claude`/`.codex` file), do NOT file it as a project kill. Note it in **one line** as a *harness issue to report upstream to bee* and move on. The audit is about the user's code, not bee's plumbing.

## 1. Hive housekeeping — entropy score (bee's own tidiness; keep it to a few lines)

This score measures **bee's bookkeeping** (loose cells, stale reservations, un-synced specs), not your project's code health — report it in two or three lines and spend the real effort on the hunt below. `broken_tools` and any bee-lib bug are **harness**, so they route upstream, not into project proposals.

Compute the score from `.bee/` records (`node .bee/bin/bee_status.mjs --json` plus `node .bee/bin/bee_cells.mjs list` and the jsonl logs; counting rules in `references/grooming-reference.md`):

```
ENTROPY SCORE = orphaned cells ×10 + unverified cells ×5 + stale decisions ×5
              + stale specs ×5 + backlog-without-outcome ×2 + stale work ×3
              + broken tools ×8, cap 100
```

- **0** = perfect · **1–25** = healthy · **26–50** = attention · **51–100** = action required

Report the score AND the trend versus the last run (previous audits are `entropy-audit` entries in `.bee/backlog.jsonl`). A rising trend at a "healthy" score still deserves a sentence.

## 2. Hunt the project's debt (the main event)

Scope every check to the **project's own files** — exclude `.bee/`, `.claude/`, `.codex/`, `node_modules/`, and build output (see Scope). Work every source; per-source checklists in the reference:

- friction clusters across cell traces and `.bee/backlog.jsonl`
- dead code and unused exports
- stale docs that contradict the code
- stale, missing, or duplicated area specs (behavior changed after the spec's `updated` date; `behavior_change` cells capped with no spec at all; or two specs covering one surface — decisions 0001/0002; proposed sync/harvest/merge work routes through `bee-scribing`)
- TODO/stub debris
- verify-commands that no longer run
- superseded-but-still-cited decisions
- slop patterns in recent diffs (empty catches, redundant `return await`, dead flags, copy-paste drift)

Prove non-use before calling anything dead: dynamic imports, reflection, config-driven loading, and external callers all count as use. "Obviously dead" without evidence is a red flag, not a finding.

## 3. Propose

Each kill candidate becomes a backlog item with three fields: **pain** (what it costs today) / **predicted impact** (what removal buys) / **risk lane** (tiny or small). Rank by pain × impact and present the top few — never dump 30 raw candidates.

**MANDATORY user approval before any deletion. Grooming never deletes on its own initiative.** No approval, no kill — regardless of how obvious the candidate looks.

## 4. Execute

Approved kills run as normal tiny/small cells through the `bee-executing` worker loop — reserve, verify, cap. Grooming never edits files directly. Ad-hoc subagent dispatches grooming makes while investigating a kill candidate default to the generation slot model; ceiling requires the [bee-tier: ceiling] marker plus a one-line justification.

One approved kill per cell. Approval of one kill is not approval of its "related" neighbors — never batch unapproved kills into an approved cell.

## 5. Close the Loop

After execution, record the actual outcome against the prediction: `node .bee/bin/bee_backlog.mjs add --type kill-outcome --severity <P1|P2|P3> --layer <layer> --title "<outcome>" --detail "<predicted vs actual>" --feature <feature>` (field guidance in the reference). Prediction wrong? That is signal, not embarrassment. Feed durable lessons to `bee-compounding` — grooming that never learns just mows the same grass.

## Headless

`mode:headless` = audit + propose only: compute the score and trend, run the hunt, emit ranked proposals in a structured terminal report with approvals deferred to an `Outstanding Questions` section. Headless NEVER executes kills and never deletes anything.

## Red Flags

- treating `.bee/`, `.claude/`, or `.codex/` (or bee's vendored helpers) as project debt — the harness is out of scope
- presenting a bee/harness bug as a project kill instead of a one-line "report upstream to bee" note
- findings written in bee-jargon (cells, traces, capCell) instead of plain project language
- letting the entropy score / hive housekeeping dominate the report — the project hunt is the main event
- deleting anything without recorded user approval
- "obviously dead" claimed without proof of non-use
- batching multiple kills into one approved cell
- grooming editing files directly instead of dispatching cells
- dumping every candidate instead of ranking by pain × impact
- skipping the actual-outcome record after execution
- reporting the score without the trend

Violating the letter of these rules is violating the spirit of these rules.

## Handoff

Grooming pass complete: entropy score reported, approved kills executed, outcomes recorded. Invoke bee-compounding skill.

| Reference | When to Load |
|---|---|
| `references/grooming-reference.md` | entropy counting rules, hunt checklists, proposal/outcome templates, slop-pattern list |
