# ao-3b-1 — W3 sync half: config-rendered bee agent files + AO10-safe flat onboarding sync + inventories

Worker: Mel (generation tier) · Capped: 2026-07-17T15:37:05Z · Status: DONE

## What changed

Three new pinned agent types (`skills/bee-hive/templates/agents/{bee-gather,bee-extract,bee-review}.md.tmpl`) — Claude Code agent-definition frontmatter (`name`/`description`/`tools`/`model: {{TIER_MODEL}}`) plus a short Delegation-contract worker body (digest back with `file:line` anchors, gather/extract never write, review may run read-only commands, no session history expected).

`skills/bee-hive/scripts/onboard_bee.mjs` gained a new flat managed-file sync — same class as the AGENTS.md block / settings.json hook merge, deliberately **not** joined to `REPO_SKILL_TARGETS` (AO10 — an agents root has no `bee-hive` version marker for the three-version preflight to resolve, and would brick onboarding non-forceably). Each template renders `{{TIER_MODEL}}` from the **target repo's own** `.bee/config.json` `models.claude` tier (gather←generation, extract←extraction, review←review) into `<repo>/.claude/agents/bee-*.md`; a cli-shaped or explicitly-null tier skips the render and removes any stale copy. Tier resolution is **duplicated, not imported** from `templates/lib/state.mjs` — this script already carries that discipline for `STALE_ADVISOR_KEY_WARNING`/`COMMAND_KEYS` (the skill-sync test fixture's fake `state.mjs` is minimal by design, and an import would break against it) — so `resolveAgentTierModel`/`normalizeAgentTierValueLocal`/`AGENT_TIER_DEFAULTS_CLAUDE` mirror `resolveTier`/`normalizeTierValue`/`DEFAULT_MODELS.claude` narrowly, text-pinned against `state.mjs` by a new no-drift test row (same pattern as the two existing ones). The sync's own version marker — `agents_sync: {bee_version, files, rendered_from, codex: {agents: [], note}}` — lands in `.bee/onboarding.json` as a sibling of `managed`, recording the Codex asymmetry (AO11: no per-agent model selection, no agent files under `.agents/`) inline rather than as a separate file.

**Generator inventories taught in this same cell** (today's learning, Addendum 2): `test_onboard_bee.mjs` gained render/config-source/idempotency/removal/no-drift rows; `test_installers_e2e.mjs`'s greenfield-missing-target check now asserts the real `install.sh` path renders all three files with no unrendered placeholder and never creates an `.agents/agents` root. `plugin_distribution.mjs` was inspected and left untouched — it inventories managed **skill directories** and hook-JSON entries only, never individual `.claude/agents/*.md` files, so there is no inventory for this new class to join.

Self-onboarded this repo (`onboard_bee.mjs --apply`): `.claude/agents/bee-{gather,extract,review}.md` now exist, rendered from the live config (generation=sonnet, extraction=haiku, review=opus); the `bee-hive` skill mirror sync carried the new templates/script changes into `.claude/skills/bee-hive` and `.agents/skills/bee-hive` automatically (generic recursive tree sync, no new code needed for the mirrors). Release manifest regenerated via `--write` (146 files).

## Files

`skills/bee-hive/templates/agents/bee-gather.md.tmpl`, `bee-extract.md.tmpl`, `bee-review.md.tmpl` (new) + their `.claude`/`.agents` mirrors (new, auto-synced), `skills/bee-hive/scripts/onboard_bee.mjs` + `.claude`/`.agents` mirrors, `skills/bee-hive/scripts/test_onboard_bee.mjs` + `.claude`/`.agents` mirrors, `scripts/test_installers_e2e.mjs`, `.claude/agents/bee-gather.md`, `bee-extract.md`, `bee-review.md` (new, rendered), `.bee/onboarding.json`, `docs/history/codex-harness-hardening/release-manifest.json` (regenerated via `--write`).

## Verification

`node skills/bee-hive/scripts/test_onboard_bee.mjs && node scripts/test_installers_e2e.mjs --installer bash && node skills/bee-hive/scripts/test_plugin_distribution.mjs && node scripts/release_manifest.mjs --check` → **exit 0.** `test_onboard_bee.mjs`: PASS, failures: 0, skipped: 1. `test_installers_e2e.mjs --installer bash`: 16 passed, 0 failed. `test_plugin_distribution.mjs`: 28 passed, 0 failed (untouched, confirmed by inspection). `release_manifest.mjs --check`: 146 file(s) match. Also spot-checked `scripts/test_lib_mirror.mjs` and `skills/bee-hive/scripts/test_split_brain_regression.mjs` (both green) since this cell touches the mirror-identity surface those suites police.

Rendered `.claude/agents/bee-review.md` head (frontmatter shows the live config's `review: opus`, not a hardcoded pin):

```
---
name: bee-review
description: Review-class subagent for the bee Delegation contract ...
tools: Read, Grep, Glob, Bash
model: opus
---
```

Full trace/evidence, including the `verification_evidence` object and the honest "genuinely new surface" note in `deliberate_exceptions`: `.bee/cells/ao-3b-1.json`.

## Notes

- No cost-reduction claim anywhere (CONTEXT ban).
- `REPO_SKILL_TARGETS` untouched — verified both by inspection and a new regression-guard test row.
- Ready for `ao-3b-2` (the guard rule naming these pinned types + the drift advisory), which depends on this cell.
