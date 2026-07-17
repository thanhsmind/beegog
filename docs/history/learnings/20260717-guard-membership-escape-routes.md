---
date: 2026-07-17
feature: advisor-and-orchestration
categories: [process, security]
severity: medium
tags: [model-guard, membership-check, deny-message, release-manifest, cell-writing]
---

# Slice 2A-iii — guard membership checks and the manifest trap, second sighting

## What Happened

1. **A config-membership deny nearly bricked a mandated dispatch pattern.** The 2A-iii shape added a membership check (a bare `model` param must be configured for some tier). The adversarial panel caught that `model:"fable"` — a pattern this repo's own CLAUDE.md mandates — is in no configured slot, and the marker grammar has no route to an arbitrary model. Shipped as designed *only because* the deny FIX teaches every legitimate escape route at the moment of denial: the configured models, `[bee-tier: ceiling]` for a session-model dispatch, and the config-slot route.
2. **The release-manifest trap recurred at cell-writing time (second sighting).** Both freshly planned cells edited manifest-tracked files and ended their verify in `release_manifest.mjs --check`, yet neither listed the manifest in `files` nor allowed the `--write` regen — a cold worker would have hit red verify with no sanctioned fix. The standing pattern ("shipping a lib file means shipping the manifest", critical-patterns 20260716-era) was *known and in read_first*, and the planner still dropped it; the cold-pickup cell reviewer caught it.
3. **A worker stream stall after `cap` is fully recoverable.** Kevin's provider stream died post-cap, pre-commit. The cell trace (`outcome`, `files_changed`, `verification_evidence`) carried everything needed for the orchestrator to goal-check fresh and finish the tail (report, release, commit) without re-dispatch.

## Root Cause

1. A membership check over config validates against *configuration*, but dispatches also come from *harness conventions* (CLAUDE.md mandates, agent-type defaults) that config never mentions — the collision is invisible until an adversarial pass walks the repo's own instructions against the new rule.
2. Prose patterns fire at implementation time but not reliably at *planning* time: the cell author reasons about the target files, not about what the verify chain's last command demands of the `files` list.
3. Cap-time evidence is stored in the cell record, not the worker's context — so worker death after cap loses nothing.

## Recommendation

- When adding any allowlist/membership deny to a guard, walk the repo's own instruction surfaces (CLAUDE.md, agent definitions, skill prose) for dispatch patterns the allowlist misses, and make the deny message teach every legitimate escape route — a deny that only says "no" converts a guard into a lockout.
- When writing a cell whose verify ends in `release_manifest.mjs --check`, the manifest belongs in `files`, the action's final step is `--write`, and the prohibition must carve out the regen. Candidate for mechanization: a `cells add` lint warning when verify mentions `release_manifest` but `files` lacks the manifest path (filed as friction).
- After a worker dies mid-flight, read the cell record before re-dispatching: a capped cell with trace evidence needs only the tail finished (goal-check, report, release, commit), never a re-run.

## Addendum — Slice 2B (same day)

**The "exists but nothing runs it" class recurred at cell-planning time (third sighting of the family).** `scripts/test_config_validate.mjs` — the validator's real behavioral suite — was orphaned from `commands.verify` since 2A-i, and the fresh 2B cell initially targeted the wrong test file entirely (`test_lib.mjs`, which only census-checks the export name). The adversarial panel caught both. Rule: **when a cell adds rows to a test suite, the cell names the suite by path AND proves the suite is in the baseline chain — if it is not, joining `commands.verify` (on a green tree) is part of the same cell, never a follow-up.** Companion rule confirmed again: bee's own config must pass bee's own validator — the repo ran red on `bee config validate` for a day and nothing surfaced it because no session ran the verb; it is now exercised by the baseline via the suite.

## Addendum 2 — Slice 3A (same day)

**A hand-edit to a generated surface dies at the next sync; the generator is the only durable home.** ao-3a-1 hand-added the tools-logger group to `.claude/settings.json` (correct per its cell), but the onboarding generator templates (`onboard_bee.mjs` settings merge + codex fallback + vendored-hook list + `plugin_distribution.mjs` handler set) did not know the new hook — so the orchestrator's own routine `self-onboard --apply` silently **clobbered the worker's live edit** hours later, and three onboarding suites went red. Rule: **a new hook's surface is not the 9 runtime files — it is those PLUS every generator inventory that re-renders them (4 more sites here). Adding a hook = teaching the generator in the same cell; a hand-edit to a generated file is a time bomb with the next apply as the fuse.** Candidate mechanization already exists in part (contract drift rows byte-check two projections); the onboarding templates have no drift row against the catalog — that gap is exactly where this slipped through.

## Addendum 3 — Slice 3B (same day)

**Third sighting of the export-census deviation:** any cell that adds an export to `state.mjs` WILL trip `test_lib.mjs`'s exact-match `EXPECTED_STATE_EXPORTS` allowlist — ao-2b-2 and ao-3b-2 both hit it as an undeclared mechanical deviation. Rule for cell authors: **a cell whose action adds/renames a `state.mjs` export lists `skills/bee-hive/templates/tests/test_lib.mjs` + its `.claude`/`.agents` mirrors in `files` up front.** Same family as the manifest trap: the verify chain's own instruments are part of the blast radius.
