# Phase 5 — Input-type classification

## Context

- [docs/decisions/0024-harness-cross-pollination-analysis.md](../../docs/decisions/0024-harness-cross-pollination-analysis.md) §3 (proposed combined intake sequence, steps ①–②)
- harness source: `docs/FEATURE_INTAKE.md` input-type table
- Depends on Phase 1 (dispatcher) for the `bee intake` verb surface. Benefits from Phase 4 (index) existing, but does not require it — can write to its own `.bee/intake.jsonl` first, mirroring `decisions.jsonl`.

## Requirements

- A classification step in `bee-hive` routing, run **before** `bee-exploring`, choosing one of: new spec / spec slice / change request / initiative / maintenance / harness improvement.
- Write a durable intake row immediately, even for `tiny` work: `{ts, input_type, summary, feature, status: draft}`.
- `bee-exploring` becomes conditional: skip the Socratic dialogue when the input type + summary leave no real gray area; run it exactly as today otherwise.
- Merge bee's existing risk-flag checklist with harness's (near-identical sets already); update the same intake row with lane + flags + reason once the mode gate runs.

## Files

- Modify: `skills/bee-hive/SKILL.md` (routing: add classification step before invoking `bee-exploring`)
- Modify: `skills/bee-exploring/SKILL.md` (add the skip-condition based on input type + summary)
- Create: `bin/lib/intake.mjs` (append/read `.bee/intake.jsonl`), `bee intake` verb group on the Phase 1 dispatcher
- Modify: `skills/bee-hive/templates/bee_status.mjs` (surface open intake rows: `status: draft`/`in-flight`)

## Implementation steps

1. Write the input-type classifier logic into `bee-hive`'s routing reference.
2. Add the intake-row write (append-only) at classification time, before `bee-exploring` runs.
3. Add the conditional skip in `bee-exploring`: if input type + summary parse as unambiguous, skip straight to the mode gate; otherwise run the existing Socratic dialogue unchanged.
4. Update the intake row with lane/flags once the mode gate (already in `bee-planning`) completes.
5. Update `bee_status.mjs` to surface open intake rows.

## Tests / validation

- Unit: intake row written correctly for each input type; skip-condition triggers correctly on unambiguous vs. ambiguous fixtures.
- Dogfood: run one real `tiny` request through the new path, confirm token cost didn't regress vs. today's unconditional `bee-exploring` invocation (plan.md open question 2 depends on this measurement).

## Risks / rollback

- Risk: misclassifying "unambiguous" skips a dialogue that was actually needed — mitigate by defaulting to "run exploring" whenever classification confidence is low; never silently skip on a guess.
- Rollback: additive. Removing the classifier step reverts to today's unconditional `bee-exploring` invocation.
