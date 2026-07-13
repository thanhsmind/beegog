# fsh-12 — Doctrine + skill prose: two-kind handoff rule (with transport), multi-session etiquette, census anchors

**Status:** [DONE]

**Outcome:** Replaced the blanket "never auto-resume" HANDOFF rule in `skills/bee-hive/templates/AGENTS.block.md` (and hand-mirrored into root `AGENTS.md`, kept byte-identical) with the two-kind rule and its transport verbs (`bee state handoff write --kind planned-next`, `bee cells claim-next`, `bee state handoff adopt`), added a new multi-session etiquette critical rule (rule 14), made `skills/bee-hive/SKILL.md`'s HANDOFF bullet and `skills/bee-hive/references/routing-and-contracts.md`'s HANDOFF/Resume Logic sections kind-aware, and added a short offer-only "Fresh-Session Handoff" section to both `skills/bee-executing/SKILL.md` and `skills/bee-swarming/SKILL.md`. Added a RED-first census check to `skills/bee-hive/templates/tests/test_lib.mjs` pinning the new anchors on both doctrine surfaces — confirmed it failed against the pre-edit text (via `git stash`) before confirming green with the edits applied. Prose/test only; no lib or behavior change.

**Files touched:**
- `AGENTS.md`
- `skills/bee-hive/templates/AGENTS.block.md`
- `skills/bee-hive/SKILL.md`
- `skills/bee-hive/references/routing-and-contracts.md`
- `skills/bee-executing/SKILL.md`
- `skills/bee-swarming/SKILL.md`
- `skills/bee-hive/templates/tests/test_lib.mjs`

Full trace/evidence: `.bee/cells/fsh-12.json`
