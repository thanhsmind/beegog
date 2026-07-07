---
name: bee-grooming
description: >-
  Hunt and kill tech debt, and audit hive health with the entropy score. Use when the user asks to clean up, find debt, or audit the repo, or when reviewing/compounding has filed backlog items worth killing.
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

Grooming is the on-demand hygiene pass, run when the hive is idle. It carries dead weight out of the hive in a fixed cycle: **audit → hunt → propose → execute → close the loop**. Grooming decides nothing alone and deletes nothing alone.

## 1. Audit — Entropy Score

Compute the score from `.bee/` records (`node .bee/bin/bee_status.mjs --json` plus `node .bee/bin/bee_cells.mjs list` and the jsonl logs; counting rules in `references/grooming-reference.md`):

```
ENTROPY SCORE = orphaned cells ×10 + unverified cells ×5 + stale decisions ×5
              + stale specs ×5 + backlog-without-outcome ×2 + stale work ×3
              + broken tools ×8, cap 100
```

- **0** = perfect · **1–25** = healthy · **26–50** = attention · **51–100** = action required

Report the score AND the trend versus the last run (previous audits are `entropy-audit` entries in `.bee/backlog.jsonl`). A rising trend at a "healthy" score still deserves a sentence.

## 2. Hunt

Work every source; per-source checklists in the reference:

- friction clusters across cell traces and `.bee/backlog.jsonl`
- dead code and unused exports
- stale docs that contradict the code
- stale area specs (behavior changed after the spec's `updated` date — decision 0001)
- TODO/stub debris
- verify-commands that no longer run
- superseded-but-still-cited decisions
- slop patterns in recent diffs (empty catches, redundant `return await`, dead flags, copy-paste drift)

Prove non-use before calling anything dead: dynamic imports, reflection, config-driven loading, and external callers all count as use. "Obviously dead" without evidence is a red flag, not a finding.

## 3. Propose

Each kill candidate becomes a backlog item with three fields: **pain** (what it costs today) / **predicted impact** (what removal buys) / **risk lane** (tiny or small). Rank by pain × impact and present the top few — never dump 30 raw candidates.

**MANDATORY user approval before any deletion. Grooming never deletes on its own initiative.** No approval, no kill — regardless of how obvious the candidate looks.

## 4. Execute

Approved kills run as normal tiny/small cells through the `bee-executing` worker loop — reserve, verify, cap. Grooming never edits files directly.

One approved kill per cell. Approval of one kill is not approval of its "related" neighbors — never batch unapproved kills into an approved cell.

## 5. Close the Loop

After execution, record the actual outcome against the prediction in `.bee/backlog.jsonl` (template in the reference). Prediction wrong? That is signal, not embarrassment. Feed durable lessons to `bee-compounding` — grooming that never learns just mows the same grass.

## Headless

`mode:headless` = audit + propose only: compute the score and trend, run the hunt, emit ranked proposals in a structured terminal report with approvals deferred to an `Outstanding Questions` section. Headless NEVER executes kills and never deletes anything.

## Red Flags

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
