# workers-prune — correctness review findings (small lane: 1 reviewer)

Reviewer: codex `gpt-5.6-sol` (configured review slot), external-executor protocol;
result artifact `.bee/workers/review-workers-prune.result.json` (transient — pruned at feature close).
Verdict on the first pass: **4 P1, 1 P2 — merge blocked.** All fixed same-session in `workers-prune-fix-1`.

## P1-1 — suffix regex mis-stems dotted cell ids → FIXED
`alpha.out10.log` stemmed to `alpha` (the `out\d*\.log` alternative wins), bypassing the keep rule for an
active cell literally named `alpha.out10`; empty-stem names (`.log`, `.out10.log`) were accepted as candidates.
**Fix:** keep decisions moved to prefix matching (`<id>` / `<id>.…`) against a keep set built from active worker
cells + every non-capped cell; the suffix regex now only classifies candidates. Empty stems are never candidates.
Pinned by the dotted-id and empty-stem fixtures.

## P1-2 — flag parsing could turn dry-run intent into real deletion → FIXED
`worker prune --dryrun --json` swallowed `--json` as the typo's value and deleted for real;
`worker clear --dry-run` was accepted and really cleared.
**Fix:** prune rejects unknown flags; `--dry-run` is a hard error on every verb except `worker prune`.
Pinned by the strict-flags check.

## P1-3 — malformed `state.workers` failed open → FIXED
A valid-JSON state whose `workers` is an object (not array) was treated as "no active workers" and
deleted a live worker's transient. **Fix:** non-array `workers` throws before any deletion
(destructive verb fails closed). Pinned by the semantic-corruption check.

## P1-4 — one-time keep-set snapshot races a concurrent dispatch → MITIGATED (accepted residual)
**Fix:** the keep set is re-read immediately before the destructive loop (C1, the repo's standard
minimal-window pattern) and the swarming doc no longer claims run-anytime safety — prune is the
orchestrator's feature-close verb. A filesystem lock was rejected as over-machinery for a
single-orchestrator harness; declared in the fix cell's `deliberate_exceptions`.

## P2 — tests didn't pin the promised behaviors → FIXED
Fixtures gained the dotted active id, empty-stem names, and a subdirectory; the dry-run check asserts
exact candidate-set equality (was: count only); semantic corruption and unknown-flag rejection each
have a dedicated check. Suite: **155 passed, 0 failed** (was 153 pre-review).

## Reviewer environment note
The reviewer's sandbox could not spawn child processes (`spawnSync EPERM`), so its own suite run
reported 15 spawn-based failures — environment, not findings; the suite is green in the repo. Its
live repros were reproduced and confirmed here before fixing.
