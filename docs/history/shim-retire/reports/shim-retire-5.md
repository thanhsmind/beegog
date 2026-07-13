# shim-retire-5 — Skills prose sweep

[DONE] — every `bee_*.mjs` invocation across `skills/*/SKILL.md` and
`skills/*/references/*.md` now reads as `node .bee/bin/bee.mjs <group> <verb>`.

Files touched (22, all under `skills/`, none under `templates/` or
`CREATION-LOG.md`):

skills/bee-briefing/SKILL.md, skills/bee-bypass-gate/SKILL.md,
skills/bee-compounding/SKILL.md, skills/bee-compounding/references/compounding-reference.md,
skills/bee-evolving/SKILL.md, skills/bee-executing/SKILL.md,
skills/bee-executing/references/worker-details.md, skills/bee-exploring/SKILL.md,
skills/bee-grooming/SKILL.md, skills/bee-grooming/references/grooming-reference.md,
skills/bee-hive/SKILL.md, skills/bee-hive/references/go-mode.md,
skills/bee-hive/references/routing-and-contracts.md, skills/bee-planning/SKILL.md,
skills/bee-planning/references/planning-reference.md, skills/bee-reviewing/SKILL.md,
skills/bee-reviewing/references/reviewing-reference.md, skills/bee-scribing/SKILL.md,
skills/bee-scribing/references/scribing-reference.md, skills/bee-swarming/SKILL.md,
skills/bee-swarming/references/swarming-reference.md, skills/bee-validating/SKILL.md,
skills/bee-validating/references/validation-reference.md

Two spots needed hand rewrites beyond the mechanical group-preserving
substitution, since they referenced the shims as things-in-themselves rather
than as `<shim> <args>` invocations:

- `bee-compounding/SKILL.md` — the warn-never-block paragraph said "`bee_feedback.mjs`
  is missing"; changed to "`bee.mjs` is missing" (there is no longer a
  per-command file that could go missing).
- `bee-hive/references/routing-and-contracts.md` — the Helper CLI Quick
  Reference used to claim the 9 shims "remain valid ... produce byte-identical
  output"; rewritten to state they are retired per decision bbc6bcea (D1), with
  `LEGACY_HELPER_RE` noted as a transition guard only (D3).

Verify passed: full trace and verify output at `.bee/cells/shim-retire-5.json`.

No deviations, no friction, no advisor consults. `templates/` and every
`CREATION-LOG.md` left untouched per must_haves prohibitions.
