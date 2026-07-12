---
date: 2026-07-12
feature: harness-integration-adopt
categories: [pattern, failure]
severity: standard
tags: [integration, cli, verification, sandbox]
---

# Learning: Adopt Code Without Importing Foreign State

**Category:** pattern
**Severity:** standard
**Tags:** [integration, provenance, vendoring]
**Applicable-when:** importing a useful implementation from a branch or repository whose runtime state and release baseline differ from the target.

## What Happened

The feature extracted only the dispatcher, registry, validator, tests, and one additive guard
change from the reference branch. It explicitly excluded the reference repository's workflow
state, cells, logs, plans, and historical bookkeeping. Where the target guard had evolved, the
change was ported onto the current file instead of replacing it; distributable templates were
then mirrored byte-for-byte into the live runtime.

## Root Cause

The reference branch contained a sound mechanism but was based on an older bee release and carried
repository-specific state. Treating it as a merge would have coupled reusable code to stale runtime
records and overwritten locally valid behavior.

## Recommendation

When adopting from a stateful branch, inventory code and state separately, import only the code
whose contract is accepted, port additive changes onto diverged files, preserve attribution, and
verify every template-to-runtime projection byte-for-byte.

# Learning: Facade Parity Must Prove Both Producers Ran

**Category:** failure
**Severity:** standard
**Tags:** [cli, parity, verification]
**Applicable-when:** a compatibility facade and a legacy command are expected to return identical output.

## What Happened

The dispatcher parity check compared two process substitutions with `diff` while discarding both
commands' diagnostics. That proves stdout equality but can also pass when both producers fail and
emit the same empty output. The broader integration suite separately exercises real commands and
was green, so no shipped regression was found, but the standalone parity command remains weaker
than its wording implies.

## Root Cause

Output equality and producer success were collapsed into one assertion. Shell process substitution
does not propagate either producer's exit status into `diff`.

## Recommendation

When asserting CLI parity, run each producer separately, assert its exit status and expected output
shape, validate machine-readable output, and only then compare the captured outputs.

# Learning: Nested CLI Tests Need Sandbox-Aware Verification

**Category:** failure
**Severity:** standard
**Tags:** [codex, sandbox, child-process, baseline]
**Applicable-when:** a verification suite launches child commands from inside a sandboxed Codex execution.

## What Happened

The session baseline first reported `175 passed, 40 failed`; all failures clustered around child
commands returning empty output. A minimal probe exposed `spawnSync ... EPERM`. Re-running the exact
verify outside the sandbox produced `215 passed, 0 failed`, and onboarding completed with zero
failures and one filesystem-dependent skip.

## Root Cause

The managed sandbox denied nested process creation. Tests that parsed the empty stdout then emitted
secondary errors such as `Unexpected end of JSON input`, which looked like product regressions.

## Recommendation

When a CLI-heavy suite fails with empty child stdout/stderr, inspect the child-process error before
filing a fix cell. If it is a sandbox denial, rerun the unchanged verify with the required execution
permission and use that result as the baseline.
