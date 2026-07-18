# gh22-completion — plan (high-risk lane)

Decisions D1-D9 in CONTEXT.md. Six cells, two waves:
wave 1: g22-1 ∥ g22-3 ∥ g22-5 (disjoint files)
wave 2: g22-2 (after g22-1) ∥ g22-4 (after g22-3) ∥ g22-6 (after g22-5)

## Mode gate
High-risk: new public CLI surface (dispatch group), the dispatch-integrity
layer (model guard interplay), doctor contract change, CI from zero. Advisor
consult before Gate 3.

### g22-1 — bee dispatch prepare (D1/D2)
Files: templates/lib/ new dispatch-prepare module + command-registry.mjs +
templates/bee.mjs (+4-way mirrors), tests (test_bee_cli registry bijection +
new scripts/test_dispatch_prepare.mjs e2e).
Verify: node scripts/test_dispatch_prepare.mjs && node skills/bee-hive/templates/tests/test_bee_cli.mjs && node scripts/test_lib_mirror.mjs && node scripts/release_manifest.mjs --check

### g22-2 — dispatch economics (D3), deps g22-1
Files: hooks/bee-model-guard.mjs logDispatch (+.bee/bin mirror), dispatch-
prepare economics output, swarming-reference prose note.
Verify: node hooks/test_model_guard.mjs && node scripts/test_dispatch_prepare.mjs && node scripts/test_lib_mirror.mjs

### g22-3 — doctor three-state + attest + version scoping (D4/D5/D6)
Files: templates/bee.mjs doctor section + registry (attest verb) + mirrors,
test_conformance.mjs + test_bee_cli.mjs fixtures for all three states +
attestation lifecycle (valid → hash change → stale).
Verify: node scripts/test_conformance.mjs && node skills/bee-hive/templates/tests/test_bee_cli.mjs && node scripts/test_lib_mirror.mjs

### g22-4 — sidecar v2 + doctor deep inventory (D7), deps g22-3
Files: render_plugin_skill_trees.mjs + onboard_bee.mjs renderSkillBytes sync
path (sidecar writer), templates/bee.mjs doctorSkillsInstalled, fixtures.
Verify: node scripts/test_skill_render.mjs && node skills/bee-hive/scripts/test_plugin_distribution.mjs && node skills/bee-hive/scripts/test_onboard_bee.mjs && node scripts/test_conformance.mjs && node scripts/release_manifest.mjs --check

### g22-5 — CI workflows (D8)
Files: .github/workflows/ci.yml + windows.yml (greenfield), README note.
Verify: YAML parse + a dry validation script run; full local verify must stay
green (workflows are inert files locally).

### g22-6 — codex canary + A/B protocol (D9), deps g22-5
Files: scripts/canary_codex.mjs, .github/workflows/canary.yml,
docs/decisions/ab-tiny-protocol.md.
Verify: node scripts/canary_codex.mjs (green on this machine — codex 0.144.4
present) && YAML parse.

## Close-out
Full configured verify green; scribing sync (advisor-protocol / hook-runtime
/ onboarding specs as touched); GH #22 final comment + close (all items
resolved or protocol-shipped); release only on user's call.
