---
date: 2026-07-15
feature: codex-harness-hardening
categories: [failure, integration]
severity: high
tags: [safety-guards, guard-placement, self-onboard, downgrade, fail-open, distribution]
---

# The guard that self-skipped before it ran, while an ungated sibling path did the damage

## What Happened

A stale (older) launcher running `onboard_bee.mjs` in **self-onboard** mode silently
downgraded the host's vendored runtime (`.bee/bin/lib/*.mjs`, and `bee.mjs` itself via
`copy_helper`) from a newer version back to the launcher's own older one. `bee status`
then read `drift:false` over the wreckage. The exact real-world defect a frozen
regression fixture (`test_split_brain_regression.mjs`) reproduced: exit 3, `before=1.0.0
after=0.1.43`.

The striking part: a correct three-version downgrade **preflight already existed**
(`computeSkillSyncTarget` — source vs `host_helpers` vs `installed_skills`, with
`blocked_downgrade` / unknown-fail-closed / force-only-when-all-numeric / zero-mutation).
It had protected ordinary hosts for months. It simply **never ran** on the vector that
mattered.

## Root Cause

The preflight lived **inside the per-skill-target loop**. On the self-onboard path, every
skill target is `self_skip`ped with `continue` *before* `computeSkillSyncTarget` is called
— so the version check was skipped along with the targets. Meanwhile the `copy_lib` /
`copy_helper` loops in `computePlan` step 3 vendor the launcher's own lib/helpers into
`.bee/bin` **unconditionally, with no version gate**, regardless of `self_skip`. So the
data the guard needed (`hostVersion` = the installed `.bee/bin/lib` version) was
*target-independent*, but the guard's **placement** was target-scoped. A guard scoped to a
branch is absent on exactly the branch that skips that branch.

Fail-open amplified it: nothing downstream re-checked, and the status drift signal compared
the ledger against the runtime lib — both of which the downgrade rewrites in lockstep, so
the corruption read as "no drift."

## Recommendation

- **When a safety check depends only on run-global data, place it at run-global scope — not
  inside a per-item loop that can be skipped wholesale.** Before trusting an existing guard,
  ask "on which code path is this guard's *placement* skipped?", not just "does the guard
  read the right values?". The two are different questions; this bug lived in the gap between
  them.
- **When you add an ungated mutation path (a copy/write loop) beside a gated one, the new
  path inherits none of the old path's guards.** `copy_lib` and `copy_helper` ran with no
  version gate while a sibling path was fully protected. Audit every mutation vector against
  the guard, not the guard against one vector.
- **The fix that generalizes:** hoist the target-independent check to where it fires
  unconditionally (here: `hostLibDowngradeBlock` in `computeSkillSync`, filling
  `result.blocked` after aggregation *only when aggregation found nothing* — so it fills the
  self-skip gap without double-blocking ordinary hosts), then let the existing whole-apply
  abort do the refusing. Reuse the refusal machinery; do not build a parallel path.
- **A validation persona panel caught the BLOCKER that the plan's own author missed** — the
  fix must abort the *whole* apply pre-loop, not guard inside `case "copy_lib"` (which leaves
  the onboarding-ledger rewrite and `copy_helper` still mutating). For a fix whose whole
  point is *zero mutation*, "which writes are still reachable after the block?" is the
  question to answer explicitly, per apply action.
