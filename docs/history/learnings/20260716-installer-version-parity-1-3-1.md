# Learnings — installer-version-parity-1-3-1 (Linux slice, bee 1.3.1)

Date: 2026-07-16 · Cells: -4 (was -1, orphan-claim re-add), -2, -3 · Release: v1.3.1 tagged and pushed; 9 hosts onboarded.

## What held

- **"Diff current behavior against must_haves before writing" saves whole cells.** Cell -4's engine work (D1/D3) already existed at HEAD from an earlier session's uncommitted work swept into the consolidation commit; the worker's mandate to check first turned a re-implementation into a coverage-only cell (12 plugin-first checks). The stale-claim → drop-and-re-add pattern (precedent: codex-harness-hardening-3→5) handled the orphan claim cleanly.
- **Name-prefix matching is not ownership.** Cleanup matched `bee-*` by prefix and would have deleted a user's `bee-custom`. The managed set must derive from the validated release inventory's exact names, and a malformed inventory must refuse before mutation (D7). Any future "clean up our files" logic should start from an owned-inventory lookup, never a naming convention.
- **Exit codes lie; statuses don't.** install.sh gated refusals on exit code, so a `blocked_no_source` plan (exit 0) slipped through to a plugin transition. Gating on the plan's status field closed it. Machine contracts between installer layers should exchange typed statuses, not process exit codes.
- **Pre-confirmation purity is testable.** A PATH-isolated fake-CLI sandbox with deny sentinels (assert nothing outside the temp sandbox is written before confirm) is cheap (15 cases) and caught the pre-confirm plugin mutation. The E2E is now mandatory verify suite #17, so the transaction contract cannot silently regress.

## What to carry forward

- Windows/PowerShell E2E (install.ps1) is the open half of D2/D8 — P43 stays in-flight until a real PS run proves it; do not let the green Bash suite stand in for it.
- Host fleet lag was the real field-pain multiplier (all anphabe hosts were on 1.0.0 while source was 1.3.0). Release-and-onboard should be one motion, not two separated by days.
