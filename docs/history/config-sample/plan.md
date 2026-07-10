---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: tiny
---

# Plan: Complete config sample

Mode: `tiny` — 0 risk flags: none.
Why this is the least workflow that protects the work: the deliverable is one inert JSON example file; it changes no runtime config, parser, API, or data.

## Requirements

For this clear-scope tiny lane, this approved plan is the hive scoping synthesis and authoritative source for D1–D4; a separate `CONTEXT.md` is intentionally not generated.

- D1: Add `config-sample.json` at the repository root as a copyable, strict-JSON example.
- D2: Cover every configuration surface currently consumed, documented, or initialized by Bee: `hooks`, `guards`, `lanes`, `capabilities`, `commands`, `gate_bypass`, `models` (including the `review` slot and supported value shapes), `advisor`, and `dogfood_repos`.
- D3: Use safe illustrative values only: bypass and advisor disabled, no secrets, no machine-specific absolute path, and no unsupported `ceiling` model entry.
- D4: Do not modify the active `.bee/config.json` or runtime behavior.

## Discovery

L0 — the repository already defines the shape in `skills/bee-hive/scripts/onboard_bee.mjs`, normalizes active values in `skills/bee-hive/templates/lib/state.mjs`, and documents operator-facing fields in `docs/config-reference.md`. No external research is needed.

## Approach

Create one formatted JSON file from the union of those local sources. When sources differ, `skills/bee-hive/templates/lib/state.mjs` defines the currently supported runtime shape, `skills/bee-hive/scripts/onboard_bee.mjs` supplies initialized defaults, and `docs/config-reference.md` supplies operator-facing examples. Keep empty extension namespaces as `{}`, include all six hook toggles, all four standard command slots, both runtime model maps with `extraction`/`generation`/`review`, every advisor consultation point, and a relative example dogfood repository. Demonstrate the supported string, `null`, `{model, effort}`, and `{kind, command}` model-slot forms across the two runtime maps. Reject JSON-with-comments because the target must remain directly parseable; reject copying the current `.bee/config.json` because it contains repo- and machine-specific values.

| Component | Risk | Reason | Proof needed |
|---|---|---|---|
| JSON syntax | LOW | A trailing comma or comment would make the sample unusable | `node -e` parses the file |
| Key coverage | LOW | An omitted supported surface would make “full” inaccurate | compare top-level keys to the documented/initialized union |
| Active config isolation | LOW | The sample must not alter runtime | confirm `.bee/config.json` is not in the cell files |

## Shape

Outcome: a root-level `config-sample.json` that users can copy and edit. Proof: parse it as JSON and assert the expected top-level keys and nested hook/command/advisor sets. Out of scope: changing config semantics, adding new config keys, or editing the active config.

## Test matrix

- Input extremes: strict JSON parses with `null`, booleans, arrays, objects, and CLI-executor example values intact.
- Environment: sample paths are relative, so no developer-machine absolute path is committed.
- Integration: keys match the current onboarding defaults, runtime parser, hook readers, and config reference.

## Out of scope

- Changing `.bee/config.json`.
- Adding validation or JSON Schema support.
- Resolving the existing documentation/version history around model ceiling semantics.

## Current slice

Create only `config-sample.json` at the repository root. Entry state: no sample file exists and the active config remains untouched. Exit state: strict JSON parses successfully and contains the complete expected top-level, hook, command, model, advisor, guard, and dogfood-repository shapes.

Verification command: `node -e` reads and asserts the sample structure using only Node.js built-ins.

## Cells

- `config-sample-1` — create and verify the complete inert JSON sample.
