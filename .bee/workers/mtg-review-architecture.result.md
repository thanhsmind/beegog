OUTCOME: done

# FINDINGS

## P2 - Prompt content can accidentally satisfy the tier transport contract

- Evidence: `hooks/bee-model-guard.mjs:94-101` searches for the marker anywhere in the full description or first 500 prompt characters. `hooks/test_model_guard.mjs:188-194` explicitly accepts a marker after arbitrary padding rather than requiring it to occupy a transport/header position.
- Failure scenario: a dispatcher omits `model` and forgets to choose a tier, but the prompt starts with quoted plan, artifact, or user-controlled text containing `[bee-tier: generation]`. The guard allows the call even though no dispatch-tier decision was made, recreating the silent-inheritance failure the feature is intended to prevent.
- Smallest credible fix: make the marker a reserved header (for example, the first non-whitespace token/line of `prompt` or an anchored prefix in `description`) and update D1 plus the boundary tests to reject embedded occurrences.

## P2 - The canonical swarming reference still documents the superseded omission-only API

- Evidence: `skills/bee-swarming/references/swarming-reference.md:39` says ceiling dispatches "omit the model param" and line 50 describes `{type:'inherit'}` the same way; only line 52 adds the new marker requirement. This directly misses plan D3 at `docs/history/model-tier-guard/plan.md:47-48`, which required the resolveTier wording itself to become "omit param and carry the marker."
- Failure scenario: an orchestrator follows the tier bullet or typed `resolveTier` contract at lines 39/50, emits an omission-only ceiling dispatch, and is blocked by the new hook. The same authoritative reference now exposes two incompatible transport contracts.
- Smallest credible fix: amend lines 39 and 50 so omission and `[bee-tier: ceiling]` are one inseparable `{type:'inherit'}` transport rule, leaving line 52 as a concise enforcement summary.

## P3 - The default configuration no longer inventories every default-on hook

- Evidence: `skills/bee-hive/scripts/onboard_bee.mjs:65-73` lists six enabled hooks but omits `model-guard`, while plan D2 at `docs/history/model-tier-guard/plan.md:36-42` says it is toggleable and on by default like the other hooks.
- Failure scenario: a newly scaffolded `.bee/config.json` gives operators no discoverable `model-guard` toggle and makes the config's hook list cease to represent the actual default-on set; future config tooling can also mistake the omission for an unregistered hook.
- Smallest credible fix: add `"model-guard": true` to `DEFAULT_CONFIG.hooks`; retain the existing absent-key default for backward compatibility.

## P3 - Plugin and vendored hook registrations are parallel hand-maintained contracts without parity coverage

- Evidence: `hooks/hooks.json:26-46` defines plugin-mode `PreToolUse` wiring, while `skills/bee-hive/scripts/onboard_bee.mjs:952-962` independently recreates the repo-mode wiring. `skills/bee-hive/scripts/test_onboard_bee.mjs:399-410` checks only that the filename appears and is copied; it does not compare matcher/event semantics with `hooks/hooks.json`.
- Failure scenario: a later matcher, command, or event change lands in one registration surface only. Plugin users and onboarded repo-hook users then receive different enforcement while both test paths remain green.
- Smallest credible fix: add a parity test that normalizes environment-specific command roots/status messages and compares event, matcher, and hook filename between `hooks/hooks.json` and `renderRepoHookEntries()`; exporting a shared manifest can follow only if needed.

# SUMMARY
The source/vendored hook boundary and onboarding flow broadly match D1-D4, but the marker API can false-pass on embedded prompt data and the canonical swarming reference remains internally contradictory.
No P1 architecture issue found; resolve the two P2 reliability items before treating explicit-tier enforcement as mechanically dependable.
