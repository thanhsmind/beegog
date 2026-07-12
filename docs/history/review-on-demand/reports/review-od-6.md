# review-od-6 — report

**Status:** [DONE]

**Outcome:** Re-encoded `bee-hive`'s routing table, Modes-and-Lanes ceremony table, Gate 4 wording,
go-mode pipeline diagram, the `AGENTS.block.md` template + repo `AGENTS.md` managed block, and
`docs/03-workflow.md` so independent review is a user-invoked side entry (SPEC R1/R3/R7/R8, 7.4,
decision `565e68d0`) and never a default chain stage. Execution now closes through scribing →
compounding as `unreviewed`; Gate 4 lives only inside a `bee-reviewing` session the user explicitly
requested. The repo `AGENTS.md` BEE block was hand-mirrored byte-identically against
`skills/bee-hive/templates/AGENTS.block.md` inside the markers (onboarding does not regenerate this
repo's own `AGENTS.md`).

**Deviation:** `docs/03-workflow.md`'s Modes-and-lanes table `small` row still chained
"→ one correctness reviewer → Gate 4 →" into its default workflow description — left untouched it
would have contradicted the cell's own must-have ("no routing/chain artifact routes execution
completion into bee-reviewing"). Auto-fixed per deviation rule 2 (missing critical functionality)
to read "→ self-checks (no auto reviewer — the correctness reviewer moves inside an on-demand review
session) →".

**Files touched:** `skills/bee-hive/SKILL.md`, `skills/bee-hive/references/routing-and-contracts.md`,
`skills/bee-hive/references/go-mode.md`, `skills/bee-hive/templates/AGENTS.block.md`, `AGENTS.md`,
`docs/03-workflow.md`.

**Verify:** `node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/scripts/test_onboard_bee.mjs && ! grep -F -e "-> bee-reviewing" skills/bee-hive/templates/AGENTS.block.md && ! grep -F -e "-> bee-reviewing" AGENTS.md` — exit 0 (test_lib.mjs 206/0, test_onboard_bee.mjs PASS 0 failures/1 platform skip, both negative greps clean).

**Commit:** `c8886f8`

Full trace: `.bee/cells/review-od-6.json`
