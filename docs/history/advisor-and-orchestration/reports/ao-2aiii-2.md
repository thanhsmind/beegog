# ao-2aiii-2 — Routing prose: 4-arg purpose-scoped resolveTier

Worker: Stuart (generation tier) · Capped: 2026-07-17T13:38:50Z · Status: DONE

## What changed

Closed the B4(1) prose half deferred from 2A-ii (plan.md 2A-iii): the three
routing-prose sites still teaching the bare 3-arg `resolveTier` call for a
cli-shaped path now cite the purpose-scoped 4-arg form:

- `bee-swarming/SKILL.md:96` — the cli branch of the tier-resolution rule now
  states cell-purpose cli resolution returns
  `{type:'refused', reason:'cli_tier_gather_only'}` and the orchestrator
  re-routes the cell to a model tier — cli cell execution stays gated
  behind W9's absolute-path dogfood, never dispatched to a cli-shaped tier.
- `bee-validating/SKILL.md:61` — the plan-checker (review slot) documents
  `resolveTier(root, 'review', runtime, {for:'gather'})` for a cli-shaped
  slot; model-shaped review is unchanged.
- `bee-reviewing/SKILL.md:106` — the external adversarial reviewer
  documents the same `{for:'gather'}` form, and points at the Delegation
  contract's cli gather branch instead of the External Executors protocol.
- `skills/bee-swarming/references/swarming-reference.md:168,187` — the
  typed-dispatch enumeration gained the optional 4th `purpose` param, its
  `'cell'`-default fail-safe, and the `{type:'refused'}` shape; a new Status
  note before the External Executors dispatch protocol clarifies that
  section (reserve/verify/cap/release) describes the not-yet-enabled
  cell-execution contract gated behind W9, reachable in code today only via
  an explicit gather-purpose resolve — the actually-enabled path for a
  cli-shaped tier is the Delegation contract's cli gather branch.

## Files

`skills/bee-swarming/SKILL.md`, `skills/bee-validating/SKILL.md`,
`skills/bee-reviewing/SKILL.md`,
`skills/bee-swarming/references/swarming-reference.md`, their
`.claude/skills/` + `.agents/skills/` onboarding-synced mirrors
(byte-identical, `cmp`-verified), `docs/history/codex-harness-hardening/release-manifest.json`
(regenerated via `--write`).

## Verification (fresh run this claim)

`node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/scripts/test_onboard_bee.mjs && node scripts/release_manifest.mjs --check`
→ **test_lib.mjs 342 passed/0 failed · test_onboard_bee.mjs PASS failures:0 skipped:1 · release_manifest --check 142 files match · combined exit 0.**
Full trace and evidence: `.bee/cells/ao-2aiii-2.json`.

## Notes

No new test rows — prose-only cell, verified by RED/GREEN anchor grep
(`cli_tier_gather_only`, `for:'gather'`) against git HEAD before vs. the
working tree after (see cell trace evidence). `plan.md`, `.bee/decisions.jsonl`,
and `validation-slice-2a-iii.md` were already modified/untracked in the
working tree before this claim (orchestrator's own Gate 2/3 records) and
were left untouched — not part of this cell's bounded scope.
