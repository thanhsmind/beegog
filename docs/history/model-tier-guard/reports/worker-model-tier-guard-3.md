# model-tier-guard-3 — skill docs: explicit-tier transport wording + generation default

[DONE] Per D1/D3: reworded `bee-swarming` SKILL.md step 4's `inherit`/`budget` transport clauses to require the `[bee-tier: ceiling]` / `[bee-tier: <tier>]` marker alongside the model-param transport (decision 0023), and added the matching marker+budget coupling sentence to `swarming-reference.md`'s `resolveTier` paragraph. Added one in-place sentence each to the 5 aux skills (`bee-planning`, `bee-grooming`, `bee-scribing`, `bee-xia`, `bee-exploring`) stating both canonical fragments verbatim: "default to the generation slot" and "[bee-tier: ceiling] marker plus a one-line justification". No new sections/headings; each sentence matches its skill's existing voice and sits next to the nearest dispatch-relevant guidance (planning: L2+ bee-xia discovery paragraph; grooming: Execute section; scribing: intro; xia/exploring: Hard Gates list). Protected sentences untouched — swarming's "Judge each cell" tier-judgment rubric and exploring's fresh-eyes "slot: `review`" line are unchanged.

Files touched: `skills/bee-swarming/SKILL.md`, `skills/bee-swarming/references/swarming-reference.md`, `skills/bee-planning/SKILL.md`, `skills/bee-grooming/SKILL.md`, `skills/bee-scribing/SKILL.md`, `skills/bee-xia/SKILL.md`, `skills/bee-exploring/SKILL.md`.

Verify: the cell's grep/content-protection command + `node skills/bee-hive/templates/tests/test_lib.mjs` — red before editing (10 MISSING-clause lines + MISSING-swarming-marker + MISSING-coupled-budget-clause), green after (`LIB-OK` / `PASS`, exit 0).

Full trace and evidence: `.bee/cells/model-tier-guard-3.json`.

Deviations: none — implementation matched the cell's action exactly.

Friction: a concurrent worker (hookbee, cell-1) committed while this cell's staged changes were still in the index, briefly sweeping my 7 files + this cell's trace into its commit. hookbee self-corrected (reset + amend) before I committed, restoring my changes to the working tree; this cell's own commit below is clean and cell-scoped.

No open questions.
