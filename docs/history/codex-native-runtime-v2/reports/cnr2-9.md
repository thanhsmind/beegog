# cnr2-9 — Skill-sync runtime-block renderer + frozen regression net

**[DONE]** — high-risk, capped 2026-07-18.

## Outcome (one line)
Built the D9 per-runtime skill renderer inside the real sync path (`applySyncSkill` + `computeSkillItems`), a strict whole-tree marker-grammar gate that refuses the entire apply with zero writes, byte-identical zero-marker passthrough, and rendered-projection provenance refusal — all green against the frozen regression net, with no skill content tagged.

## What changed
- **Renderer + grammar** (`onboard_bee.mjs`): `renderSkillBytes(bytes, runtime)` filters `<!-- bee:only claude|codex -->` / `<!-- bee:end -->` blocks and strips marker lines; `validateSkillMarkers` + `validateSkillTreeMarkers` refuse nesting / unclosed / stray-end / unknown-label / frontmatter / fenced / ambiguous markers whole-tree, BEFORE any mutation (status `blocked_render`, zero writes). No-marker files return the original buffer (BOM/CRLF/final-newline/arbitrary bytes preserved).
- **Both hash sites**: render threaded through `walkSkillTree` (optional transform) so `computeSkillItems` drift (`:693`) and the `applySyncSkill` fast-skip + write compare/emit `render(canonical, targetRuntime)`. Release hashing stays canonical; downgrade preflight untouched (version-based).
- **Provenance**: rendered target roots stamped with a deterministic `.bee-render.json` sidecar; `source-identity.mjs` (template + `.bee/bin` mirror, in lockstep) classifies it as `rendered_projection`, and `readSourceReleaseIdentity` refuses such a source for ANY target incl. own runtime (`blocked_no_source`, zero mutations).
- **Wiring**: `test_skill_render.mjs` (new, 27 cases) + `test_state_write_concurrency.mjs` added to `.bee/config.json` `commands.verify` and to the `test_verify_manifest.mjs` mandatory-suite guard.
- **Doc fix**: stale `self_skip` claim at `skills/bee-hive/SKILL.md:31` corrected to the real `applySyncSkill` sync path.

## Files touched
`skills/bee-hive/scripts/onboard_bee.mjs`, `skills/bee-hive/templates/lib/source-identity.mjs`, `.bee/bin/lib/source-identity.mjs`, `skills/bee-hive/SKILL.md`, `scripts/test_skill_render.mjs`, `scripts/test_verify_manifest.mjs`, `.bee/config.json`, `docs/history/codex-harness-hardening/release-manifest.json`.

## Verification
Frozen regression net green before first edit and after (full `commands.verify`, PIPE_EXIT=0). Per-cell chain green (RENDER-OK). Full trace, evidence, and deviations: `.bee/cells/cnr2-9.json`.

## Notes for downstream (cnr2-12 → cnr2-10 → cnr2-11)
- Renderer + provenance + the wired verify chain are in place; tagging cells add marked content and rely on this gate.
- `test_state_write_concurrency.mjs` carries a timing-sensitive sweep-heartbeat race subtest that can flake under load (green on retry / standalone) — logged as friction.
