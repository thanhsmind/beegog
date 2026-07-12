# cells-batch-add — plan

```yaml
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: small
```

## Why

Observed friction (user report, 2026-07-12): planning sessions create cells by
writing one scratchpad JSON file per cell, then running `add --file` per cell —
~2 tool calls per cell (10 calls for a 5-cell slice), each with path/wrapper/echo
overhead. `add --stdin` already exists but accepts exactly one cell per invocation.

## What

One direct task:

1. **lib**: add batch support to cell creation in `skills/bee-hive/templates/lib/cells.mjs`
   — accept a JSON **array** of cells with all-or-nothing semantics: validate every
   cell first (including duplicate ids *within* the batch), write only if all pass.
   Reuse `addCell`'s validation by splitting it into validate + write phases; the
   single-object path stays byte-compatible in behavior.
2. **CLI**: `bee_cells.mjs add --stdin|--file` accepts either a single JSON object
   (unchanged) or a JSON array (new). Summary line reports every added id.
3. **Vendored parity**: copy templates → `.bee/bin/` (test suite enforces byte-identical).
4. **Docs**: update `skills/bee-planning/SKILL.md` §6, `skills/bee-planning/references/planning-reference.md:146`,
   and `skills/bee-hive/references/routing-and-contracts.md:229` to instruct ONE
   batched `add --stdin` heredoc for the slice instead of Write-file-then-`add --file` per cell.
5. **Tests**: extend `templates/tests/test_lib.mjs` — batch happy path, mid-batch
   validation failure writes nothing, duplicate id within batch refuses, single-object
   path unchanged.

## Files

- skills/bee-hive/templates/lib/cells.mjs (+ .bee/bin/lib/cells.mjs sibling)
- skills/bee-hive/templates/bee_cells.mjs (+ .bee/bin/bee_cells.mjs sibling)
- skills/bee-hive/templates/tests/test_lib.mjs
- skills/bee-planning/SKILL.md, skills/bee-planning/references/planning-reference.md,
  skills/bee-hive/references/routing-and-contracts.md (prose only)

## Verify

`node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/scripts/test_onboard_bee.mjs`

## Reality check (inline, small lane)

- **MODE FIT**: one direct task, 0 risk flags (internal CLI, additive change) → small. PASS
- **REPO FIT**: `add` already supports `--stdin` (templates/bee_cells.mjs:8); addCell
  validation is one function (lib/cells.mjs:74) — clean split point. PASS
- **ASSUMPTIONS**: array input currently *rejected* (`addCell: cell must be a JSON
  object` guard at lib/cells.mjs:75) — no silent behavior change for existing callers. PASS
- **SMALLER PATH**: prose-only ("use --stdin per cell") halves calls but keeps N calls
  per slice; batch collapses to 1. Chosen scope is the honest minimum. PASS
- **PROOF SURFACE**: existing suite covers addCell edge cases; batch tests slot beside
  them; vendored-parity test guards the copy step. PASS
