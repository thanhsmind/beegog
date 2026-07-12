---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: standard
---

# Plan: Skill Metadata Parity

Mode: `standard` — 3 risk flags: public contracts, existing covered behavior, multi-domain.
This is the smallest honest lane because one metadata contract must remain consistent across every bee skill, both plugin runtimes, and onboarding's deep mirror.

## Requirements

- D1: `SKILL.md` frontmatter remains the canonical skill identity and trigger description read by Claude Code and by runtime-neutral skill loaders.
- D2: Every live `skills/bee-*` directory carries `agents/openai.yaml` for Codex/ChatGPT UI metadata and invocation policy.
- D3: The Codex projection derives its name and description from the same `SKILL.md`; hand-maintained duplicate prose is prohibited.
- D4: Codex implicit invocation stays enabled so a matching user request can activate a bee skill without requiring `$bee-*`, matching Claude Code's description-trigger behavior.
- D5: A deterministic check fails when a bee skill is missing metadata, contains stale metadata, or when an unexpected metadata file survives after its source skill changes.
- D6: Existing skill packaging and onboarding deep-mirror behavior distributes the nested `agents/openai.yaml` files without a second installer path.

## Discovery

Official OpenAI documentation defines `agents/openai.yaml` as optional skill metadata for UI, invocation policy, and tool dependencies. Local inspection confirms the Codex plugin already bundles `./skills/`, Claude Code reads each shared `SKILL.md`, and onboarding mirrors every nested skill file byte-for-byte.

## Approach

Add one small renderer/checker under `bee-writing-skills`, generate a minimal `agents/openai.yaml` for each bee skill, and pin the projection contract in the existing test suite. Reject manually authored independent descriptions because they will drift; reject runtime-specific copies of `SKILL.md` because bee already distributes one shared skill tree.

| Component | Risk | Reason | Proof needed |
|---|---|---|---|
| Frontmatter extraction | MEDIUM | Folded YAML descriptions must normalize deterministically | fixture and live-tree checks |
| Metadata projection | MEDIUM | 15 skills must remain complete and byte-stable | renderer `--check` over all `skills/bee-*` |
| Distribution | LOW | Plugin and onboarding already deep-copy nested files | existing onboarding deep-mirror suite |

## Shape

| Phase | What changes | Why now | Demo | Unlocks |
|---|---|---|---|---|
| RED contract | Add failing parity tests and pressure-test evidence before metadata exists | Makes missing/stale projections observable | Test fails on the current tree for the named reason | Safe implementation |
| Shared projection | Add the renderer/checker and generated metadata for every bee skill | Establishes one source of truth across runtimes | `--check` succeeds and samples match `SKILL.md` | Distribution proof |
| Close | Run full verification and record the cross-runtime contract | Prevents a local-only green claim | Full repo verify passes outside the sandbox | Feature completion |

## Test matrix

- Inputs and validation: folded/multiline descriptions, missing name/description, unexpected skill directory.
- State and lifecycle: add/remove/rename a bee skill, stale projection after description edit, idempotent rerender.
- Integration: Codex plugin discovers nested metadata; onboarding mirrors it into installed skill trees; Claude-facing `SKILL.md` bytes remain unchanged.
- Security and abuse: YAML quoting preserves punctuation and cannot turn description text into new keys.
- Performance and scale: one linear scan of the small `skills/bee-*` tree with no dependency install.
- Observability and recovery: `--check` names the exact missing or stale path and exits non-zero; rerender restores parity.

The skill-authoring RED/GREEN pressure loop targets three choices that can create runtime drift: deriving descriptions versus copying them, keeping implicit invocation aligned versus disabling it, and emitting only the required fields versus adding independent workflow prompts. RED withholds D1-D6; GREEN reruns the identical prompts with this contract loaded.

## Out of scope

- Icons, brand assets, MCP dependencies, or runtime-specific model configuration.
- Changing any skill's trigger semantics or workflow body.
- Installing or modifying user-global skill copies during this feature.

## Current slice

One slice: lock a RED parity test, implement the deterministic projection, then close with the full sandbox-aware verification command. Entry state is the existing shared `SKILL.md` tree with no `agents/openai.yaml`; exit state is complete byte-stable metadata parity across all live bee skills.

Bounded files: `skills/bee-writing-skills/scripts/`, `skills/bee-writing-skills/agents/`, every `skills/bee-*/agents/openai.yaml`, the existing library test entry point, and this feature's history/report artifacts.

## Cells

- `smp-1` — RED: pressure scenarios plus a parity test that fails against the current tree.
- `smp-2` — GREEN: renderer/checker plus generated metadata for every bee skill.
- `smp-3` — close: TDD creation log, contract documentation, and full verification.
