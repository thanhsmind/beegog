# adv-2 — bee-executing: worker consult protocol (D3 loop, evidence bundle, authority carve-out, Consults report section)

**Status:** [DONE]
**Worker:** stuart (generation/sonnet)

## Outcome

Added an **Advisor Consult** section to `skills/bee-executing/SKILL.md` (D1/D3):
worker-level, on-failure-only consult — `fail 1 -> consult 1 -> advised retry
-> (fail) -> consult 2 (follow-up, same advisor) -> final retry -> [BLOCKED]
with a Consults section`, max 2 consults per claim, fresh budget on a
re-dispatch. Mandatory evidence bundle (command, output, diagnosis, excerpts,
CONTEXT.md path) inline/stdin only, never `/tmp` (critical pattern 20260708).
Transport per the validation report: model-shaped via the worker's own Agent
tool with the `advisor-consult <cell-id>: <advisor-model>` description prefix
(A2 attribution), cli-shaped via stdin; a transport error is not advice and
burns at most one budget slot. Advice-only conduct (A1), authority-type
blocks (ambiguous cell, uncapped deps, architecture, package install,
locked-decision conflict) stay instant `[BLOCKED]` and never consult.
Headless no-questions rule (A4) stated explicitly as unchanged. The old
unconditional two-attempts line in Verify now branches on whether an
`Advisor` line is present in the dispatch; no gate-time or orchestrator
consult language was added (D1). Cap/Return steps gained a `Consults` report
field. No changes to the `[DONE]`/`[HANDOFF]`/`[NOOP]` contracts or the
verify-evidence cap rules.

## Files touched

- `skills/bee-executing/SKILL.md`

## Verification

`node skills/bee-hive/templates/tests/test_lib.mjs && grep -q "Advisor Consult" skills/bee-executing/SKILL.md`
— 222 passed, 0 failed; grep anchor 0 matches on HEAD before the edit, 6 after
(red before, green after by design).

Full trace, red-failure evidence, and verification_evidence are recorded in
`.bee/cells/adv-2.json`.
