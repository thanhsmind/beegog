---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: standard
---

# Plan: Codex-safe onboarding baseline

Mode: `standard` — 3 risk flags: cross-platform, external systems, existing
covered behavior.

This is the least workflow that protects the work: the first one-file repair proved
the Worker transport, while the remaining baseline crosses shared hook/CLI fixtures,
real Git/Bash/Codex integration, and Windows path safety. Production behavior stays
untouched, and the unchanged repository baseline is the exit proof.

## Requirements

- D1 / decision `17bfc14a`: execute the real onboarding CLI entrypoint in an
  isolated Worker when Codex denies nested child processes.
- Preserve argument parsing, environment overrides, stdout, stderr, exit status, and
  every existing assertion.
- Do not skip, soften, or conditionally pass any test on `EPERM`.
- Do not change production onboarding behavior.
- D2 / decision `a83a3613`: nested Node module entrypoints use one shared isolated
  Worker runner; real Git/Bash/Codex integration commands remain real and are judged
  by their actual status/stdout/stderr even if the sandbox also attaches `EPERM`.
- Preserve stdin, argv, virtual cwd, environment, stdout, stderr, exit status, timeout,
  direct-entry guards, and all existing assertions across every migrated test.

## Discovery

The existing fixture launcher uses `spawnSync`, which returns `EPERM` in the managed
Codex sandbox. A direct runtime probe proved that `worker_threads.Worker` can execute
`onboard_bee.mjs` as its real entrypoint with isolated `argv`/environment and captured
stdout/stderr, returning valid onboarding JSON and exit code 0.

## Approach

Replace only the test launcher's child-process transport with an asynchronous Worker
launcher. Run the actual script path as the worker entrypoint, pass the same arguments
and fake home environment, collect both streams to completion, and expose the same
result shape used by all current assertions. Mechanically await existing top-level
launcher calls.

Rejected alternatives:

- Treat `EPERM` as a skip or pass — this weakens the baseline.
- Change production onboarding logic — the defect is test transport compatibility.
- Maintain separate Codex assertions — both runtimes must prove the same behavior.

Risk: stream/exit ordering could truncate JSON. Proof requires waiting for worker exit
and both output streams before parsing.

For the follow-up slice, extract that proven transport into one test-only helper and
migrate every `node <module>` launch found by the subprocess census. Keep external
Git/Bash/Codex commands intact; their wrappers accept a sandbox-side `EPERM` only when
the command also returned a concrete status and its existing output assertions pass.
This avoids both false failures and false-green emulation.

## Shape

Outcome: the full onboarding suite runs under managed Codex without nested processes,
while continuing to exercise the real CLI entrypoint and all current cases.

Proof: run the onboarding suite, then the unchanged configured repository verify.

| Phase | What changes | Proof | Unlocks |
|---|---|---|---|
| 1 — complete | Onboarding fixtures run through an isolated Worker. | Onboarding suite: 0 failures. | Exposes the next real baseline failures. |
| 2 | Shared Worker runner migrates hook and bee CLI Node launches. | Model/write guard and bee CLI suites retain deny/output assertions. | Node fixture parity under Codex. |
| 3 | Git/Bash wrappers preserve real integration while tolerating sandbox metadata only when status/output are valid. | Portable paths and hook contract suites pass unchanged assertions. | Transitive baseline migration. |
| 4 | Remaining reachable `test_lib`/metadata/race Node launchers move to Worker transport; reachable Git keeps real status/output semantics. | `test_lib.mjs`, mirror checks, and the exact full baseline pass. | Resume Codex hook/state parity. |

## Test matrix

- Environment: child-process creation denied, Worker execution available.
- Error cascade: non-zero worker exit and stderr remain observable to assertions.
- State transitions: dry-run, apply, re-apply, downgrade and blocked paths retain their
  existing test sequence and isolation.

## Out of scope

- Production onboarding behavior changes.
- Codex hook or state implementation; those resume only after this baseline is green.
- Relaxing or replacing any configured verification suite.

## Completed slice

Entry: the onboarding suite fails before its first fixture because `spawnSync` is
denied with `EPERM`.

Exit: `test_onboard_bee.mjs` launches every real/fake CLI entrypoint through an
isolated Worker, all existing assertions pass, and the unchanged full repository
baseline is green.

Bounded file: `skills/bee-hive/scripts/test_onboard_bee.mjs`.

Verification:

```sh
node --check skills/bee-hive/scripts/test_onboard_bee.mjs
node skills/bee-hive/scripts/test_onboard_bee.mjs
git diff --check
```

Then run the unchanged configured repository verify before resuming Codex hooks.

Result: capped with onboarding `failures: 0`, one pre-existing case-sensitive-filesystem
skip, and clean diff validation.

## Current slice

Entry: the exact baseline reaches portable paths and hook/CLI suites, then exposes
transitive nested launchers inside `test_lib.mjs`, metadata rendering, and race
orchestrators. Real Git/Bash commands return valid results plus a sandbox `EPERM`
marker.

Exit: all affected suites preserve their existing assertions and the exact configured
repository verify exits zero.

Bounded files:

- `scripts/lib/run-module-worker.mjs` (new test-only helper)
- `hooks/test_model_guard.mjs`
- `hooks/test_write_guard.mjs`
- `skills/bee-hive/templates/tests/test_bee_cli.mjs`
- `skills/bee-hive/scripts/test_split_brain_regression.mjs`
- `scripts/test_portable_paths.mjs`
- `hooks/test_hook_contracts.mjs`
- `skills/bee-hive/templates/tests/test_lib.mjs`
- `skills/bee-hive/templates/tests/race_claims_child.mjs`
- `skills/bee-writing-skills/scripts/test_openai_metadata.mjs`
- `skills/bee-hive/templates/lib/reviews.mjs`
- `.bee/bin/lib/reviews.mjs` (required byte-identical runtime mirror)

Verification is staged by cell, then the unchanged configured repository verify.

## Cells

- `codex-sandbox-baseline-1` — replace the forbidden fixture transport without
  changing onboarding behavior or assertions (complete).
- `codex-sandbox-baseline-2` — add the shared Worker runner and migrate Node-only
  hook/CLI fixtures.
- `codex-sandbox-baseline-3` — superseded after its local repair went green but the
  terminal verify exposed out-of-scope transitive launchers.
- `codex-sandbox-baseline-4` — cap the already-green portable-path and hook-contract
  integration repair with focused proof.
- `codex-sandbox-baseline-5` — superseded after its implementation and focused suites
  went green but release-manifest identity drift was correctly found outside scope.
- `codex-sandbox-baseline-6` — adopt the green transitive implementation, regenerate
  the canonical release manifest with explicit ownership, and own the unchanged full
  baseline.
