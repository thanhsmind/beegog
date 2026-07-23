# cz-5 — The compact capsule, its golden, and the verb that renders it

**Status: [DONE]**

The compact capsule ships end to end: three renderers extracted from
`buildSessionPreamble` (proven byte-identical against the committed golden),
`buildCompactCapsule(root, {sessionId, handoffOutcome})` rendering D6 items 2-12
with the anchor check muted so no capsule byte varies with anchor presence, and
the `state compact-capsule` verb wired through registry, handler, dispatch map,
`Use:` list and two dispatcher-level test rows. `hooks/test_hook_contracts.mjs`
is green with **zero** edits.

Two earlier attempts at this cell were destroyed by a concurrent session's
force-unclaim and merge (P1 friction already filed, `coordination` layer). This
run applied the artifacts preserved at `.bee/tmp/cz-5/` after re-deriving the
anchors against the live tree.

## Files touched

Source: `skills/bee-hive/templates/lib/inject.mjs`,
`skills/bee-hive/templates/lib/compaction.mjs`,
`skills/bee-hive/templates/lib/command-registry.mjs`,
`skills/bee-hive/templates/bee.mjs`,
`skills/bee-hive/templates/tests/test_bee_cli.mjs`,
`scripts/test_compact_capsule.mjs` (new).

Mechanical (D24 regen chain, in order — `render_plugin_skill_trees.mjs` →
`onboard_bee.mjs --apply` → `release_manifest.mjs --write`): the `.bee/bin/`
mirror, `.bee/onboarding.json`, the four rendered plugin trees, and
`docs/history/codex-harness-hardening/release-manifest.json`. The four rendered
`test_bee_cli.mjs` projections were confirmed byte-identical to the source with
`cmp`; none was hand-edited.

`scripts/fixtures/preamble-golden.txt` was **not** regenerated — it is the
pre-extraction baseline and is what makes the byte-identity row a real proof.

## Deviations

None. No architectural change, no package install, no locked decision
reinterpreted.

Full trace, verification evidence and verify output: `.bee/cells/cz-5.json`.
