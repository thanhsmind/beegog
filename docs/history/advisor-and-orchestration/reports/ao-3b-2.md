# ao-3b-2 — W3 guard half: pinned-type deny, agent-file drift advisory, spawn prose

Worker: Phil (generation tier) · Capped: 2026-07-17T15:53:05.876Z · Status: DONE

## What changed

1. `bee-model-guard.mjs` — a new decision branch (0), placed **before** every existing allow branch: `[bee-tier: generation|extraction|review]` paired with `subagent_type: "general-purpose"` is denied outright (`generic-type-denied`), bare or with a matching model param alike, naming the tier's pinned agent type (`bee-gather`/`bee-extract`/`bee-review`) in the FIX. `[bee-tier: ceiling]` + general-purpose stays allowed (no pinned agent); `Explore` + marker, absent `subagent_type`, and no-marker dispatches are all untouched.
2. `validateAgentFilesDrift(root, config)` added to `state.mjs` as a separate, root-taking sibling to the pure `validateModelsConfig` (AO12 purity split) — compares each rendered `.claude/agents/bee-*.md`'s `model:` frontmatter against the effective configured tier model. Absent files are clean; malformed frontmatter is reported, never thrown. Wired into both `bee status` (`buildStatus`) and `bee config validate` (`handleConfigValidate`), appended onto the same problem output.
3. Prose: `bee-swarming/SKILL.md` §3 and `references/swarming-reference.md` now teach spawning the tier-matched pinned type when its rendered agent exists (runtime default only for `ceiling` or an unrendered slot); `bee-validating/SKILL.md`'s plan-checker/cell-reviewer notes name `bee-review`. `.claude`/`.agents` mirrors synced.

## Files

`hooks/bee-model-guard.mjs` + `.bee/bin/hooks/bee-model-guard.mjs` (byte-identical), `hooks/test_model_guard.mjs` (+13 new rows 33-39), `skills/bee-hive/templates/lib/state.mjs` + `.bee/bin/lib/state.mjs` (byte-identical), `skills/bee-hive/templates/bee.mjs` + `.bee/bin/bee.mjs` (byte-identical), `scripts/test_config_validate.mjs` (+7 rows), `skills/bee-swarming/SKILL.md`, `skills/bee-swarming/references/swarming-reference.md`, `skills/bee-validating/SKILL.md` (+ `.claude`/`.agents` mirrors), `skills/bee-hive/templates/tests/test_lib.mjs` + `.claude`/`.agents` mirrors (deviation — export allowlist update, see below), `docs/history/codex-harness-hardening/release-manifest.json` (regenerated).

## Deviation

`skills/bee-hive/templates/tests/test_lib.mjs` was outside the cell's declared `files` list but is invoked directly by the cell's own verify command; adding `validateAgentFilesDrift` to `state.mjs`'s export surface broke that file's exact-match export allowlist (blocking issue per bee-executing rule 3 — auto-fixed). Added the new export name to `EXPECTED_STATE_EXPORTS` and synced its `.claude`/`.agents` mirrors.

## Verification (fresh, this claim)

`node hooks/test_model_guard.mjs && node hooks/test_write_guard.mjs && node hooks/test_hook_contracts.mjs && node scripts/test_config_validate.mjs && node skills/bee-hive/templates/tests/test_lib.mjs && node scripts/test_lib_mirror.mjs && node skills/bee-hive/templates/tests/test_bee_cli.mjs && node scripts/release_manifest.mjs --check` → **exit 0.** Full detail (including the `git show HEAD:` red-failure proof that the pre-change guard allowed the exact `generic-type-denied` case) is in the cell trace: `.bee/cells/ao-3b-2.json`.

## Notes carried

- Rendering is tested, runtime registration is not (panel caveat carried per the cell action): a host config using full model IDs instead of aliases renders green but may not register a subagent type at that name. Not built for — documented only.
