---
date: 2026-07-12
feature: cells-update-verb
categories: [process, tooling]
severity: low
tags: [cli-mutations, cells, ui-noise, validator-map]
---

# Learnings — cells-update-verb

## What Happened

User-reported regression of the cli-mutations win: bee activity (full JSON diffs of `.bee/cells/*.json`
hand-edits) still flooded the working view during validation repair loops, because `bee_cells.mjs` had
no `update` verb — rule 11's documented fallback (friction + hand-edit) was firing exactly as written.
Two friction items already shared this root cause. Shipped `updateCell` + CLI `update` (small lane,
1 cell, solo): validator-map field allowlist, status door (open|blocked only), strict-read fail-closed,
frozen-key refusals with owning-verb hints, post-merge truths invariant. Suite 208→215, onboard PASS.

## Root Cause

The CLI-owned-state contract (`bb4bb18e`) covered state.json/backlog.jsonl but left cell revision —
a recurring, legitimate flow (every validation ITERATE round) — on the hand-edit fallback.

## Recommendation

When a rule-11 hand-edit fallback fires more than once for the same record type, that is the signal the
record type needs its own CLI verb — the fallback is a debt marker, not a steady state. The two friction
items were the queue; act on the second occurrence, not the fifth.
