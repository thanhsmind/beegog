---
type: bee.pattern
title: A shared-suite red is not yours while a sibling cell is in flight
description: A shared-suite red is not yours while a sibling cell is in flight
tags: [failure, swarming, verify, parallel-waves]
timestamp: 2026-07-13
bee:
  id: pattern-20260713-a-shared-suite-red-is-not-yours-while
  lifecycle: active
  sources: ["docs/history/learnings/critical-patterns.md#PAT29", "original feature: advisor"]
  polarity: pitfall
  critical: true
---

# A shared-suite red is not yours while a sibling cell is in flight

When a cell's verify runs the full shared suite, a red observed while another
cell is claimed-but-uncapped may be the sibling's mid-flight state, not your
defect. Check `.bee/cells/*.json` for in-flight siblings before diagnosing;
re-run after they cap. Never "fix" files outside your cell's scope to green it.
