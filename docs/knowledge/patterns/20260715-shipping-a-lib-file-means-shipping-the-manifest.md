---
type: bee.pattern
title: "Shipping a lib file means shipping the manifest: regen release-manifest inside the feature"
description: "Shipping a lib file means shipping the manifest: regen release-manifest inside the feature"
tags: [process, release-manifest, verify-chain, lib-files]
timestamp: 2026-07-15
bee:
  id: pattern-20260715-shipping-a-lib-file-means-shipping-the-manifest
  lifecycle: active
  sources: ["docs/history/learnings/critical-patterns.md#PAT37", "original feature: parallel-scheduler"]
  polarity: pitfall
  critical: true
---

# Shipping a lib file means shipping the manifest: regen release-manifest inside the feature

Any cell that adds/renames/changes a file under `templates/lib/` or `.bee/bin/lib/` makes
`release_manifest.mjs --check` (part of `commands.verify`) red until `--write` regenerates the
stored manifest — so the regen is part of the FEATURE, owned by its last cell or its close step,
never discovered at the close verify. Same rule generalized: before capping a slice, ask which
standing repo-wide guards (manifest, mirror, census) hash the files you touched, and run their
regen/check inside the slice. (Filed friction to mechanize the hint.)

**Recurred 2026-07-19 (cnt-3):** the cell regenerated rendered plugin trees, deferred the
manifest regen to "the slice-closing cell", and its own cell verify ran neither check — it
capped green while the shared baseline sat red for every concurrent session until a fix-first
cell (cnt-6) repaired it. Prose alone did not hold under a multi-session checkout;
mechanization (manifest check derived into the verify of any cell whose files hit rendered
trees or `lib/`) is now the recorded fix direction, not a nice-to-have.

**Recurred 2026-07-20 (msh-1) — THIRD instance, new layer:** the cell added a lib file and
regenerated the manifest, but the committed plugin skill trees were never re-rendered
(`render_plugin_skill_trees.mjs`); red surfaced only at the feature-close full chain and cost a
fix-first cell (msh-8). The derived-artifact set for a `templates/lib/` touch is now known to be
THREE-deep: `.bee/bin` mirror + rendered plugin trees + release manifest. Until the mechanization
lands (backlog), any lib-touching cell's verify carries all three regen/checks explicitly.
