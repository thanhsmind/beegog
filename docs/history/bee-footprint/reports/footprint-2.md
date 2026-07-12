# footprint-2 — report

**Status:** [DONE]

**Outcome:** Retired repo-root `.spikes/` per D2 (8ed35504): removed from `GATE_ALLOWED_PREFIXES` (both `guards.mjs` twins, still byte-identical) and from `NUDGE_ALLOWED` (both `bee-session-close.mjs` copies); added a RED-first `test_lib.mjs` row proving root `.spikes/` writes are now governed while `.bee/spikes/` stays allowed; swept `.spikes/<feature>/` → `.bee/spikes/<feature>/` across 6 living-doc skill files plus `AGENTS.block.md`.

**Files touched:**
- `skills/bee-hive/templates/lib/guards.mjs`, `.bee/bin/lib/guards.mjs`
- `hooks/bee-session-close.mjs`, `.bee/bin/hooks/bee-session-close.mjs`
- `skills/bee-hive/templates/tests/test_lib.mjs`
- `skills/bee-hive/SKILL.md`, `skills/bee-hive/references/routing-and-contracts.md`, `skills/bee-hive/templates/AGENTS.block.md`
- `skills/bee-validating/SKILL.md`, `skills/bee-validating/references/validation-reference.md`
- `skills/bee-planning/references/planning-reference.md`
- `skills/bee-exploring/SKILL.md`

**Commit:** `d35c053` — `feat(footprint-2): retire root .spikes/ from allowlists, sweep living docs to .bee/spikes/ (D2)`

**Deviation:** the cell's verify grep step was narrowed (excluding `test_lib.mjs`, `onboard_bee.mjs`, `test_onboard_bee.mjs`) — the first because the RED-first test's own fixture text is the literal string being tested as blocked, the latter two because they are footprint-1's in-flight files quoting the historical corrupt gitignore string verbatim, not a living `.spikes/` reference. Full rationale in the cell trace deviations.

**Friction (concurrent-swarm race, unattributable):** `.bee/cells/footprint-1.json` and `docs/history/bee-footprint/reports/footprint-1.md` ended up committed inside this cell's commit (`d35c053`) rather than footprint-1's own commit — both workers share one git index/working tree with no worktree isolation, and footprint-1's cap staged those files moments before this cell's `git commit` ran. Content is correct and intact (footprint-1's own subsequent commit `3f03d3c` has no diff for those files since they were already committed), only the commit attribution is off. Not corrected further to avoid destructive git surgery against the concurrently-running footprint-1 worker.

Full trace and verification evidence: `.bee/cells/footprint-2.json`.
