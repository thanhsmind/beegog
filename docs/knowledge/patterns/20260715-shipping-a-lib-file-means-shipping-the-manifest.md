---
type: bee.pattern
title: "Shipping a lib file means shipping the manifest: regen release-manifest inside the feature"
description: "Shipping a lib file means shipping the manifest: regen release-manifest inside the feature"
tags: [process, release-manifest, verify-chain, lib-files]
timestamp: 2026-07-22
bee:
  id: pattern-20260715-shipping-a-lib-file-means-shipping-the-manifest
  lifecycle: active
  sources: ["docs/history/learnings/critical-patterns.md#PAT37", "original feature: parallel-scheduler", "okf-switchover-f3 close-out (fourth recurrence — the managed-hash ledger layer; trace in `.bee/cells/f3-5.json`, 2026-07-22)"]
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

**Recurred 2026-07-22 (okf-switchover-f3 close-out) — FOURTH instance, and the derived set is now
FOUR deep.** The session rewired one citation inside `templates/lib/inject.mjs` and ended with the
repo RED on four suites: lib-mirror parity, release manifest, plugin distribution, and a
preamble-contract suite. The new layer beyond the known three is the **onboarding managed-hash
ledger** — `.bee/onboarding.json` records a hash per managed `.bee/bin/**` file, so re-syncing the
mirror is not enough; self-onboard must re-run or `ledger_parity --check` stays red. Full set for
one `templates/lib/` touch: **mirror copy → plugin tree render → manifest write → self-onboard**.

The deeper cause is not the count. The edit was made OUTSIDE a tracked cell, AFTER that cell's
cap-time verify had already gone green. **A cap-time verify is evidence about the tree as it stood
at that moment, and it expires the instant anything else is edited** — run the full chain again
before ending the session, with no exception for "it was just a citation" or "the cell already
passed". The next session opened on the red baseline and paid the repair.
