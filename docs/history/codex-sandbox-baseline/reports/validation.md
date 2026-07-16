# Validation — Codex sandbox baseline

## Scope

Validate the two serialized follow-up cells that restore the unchanged repository baseline without weakening Node, Git, Bash, or Codex integration coverage.

## Repository evidence

- `codex-sandbox-baseline-1` is capped with a green onboarding suite and recorded output.
- A runtime probe proves this sandbox executes Worker threads and permits a Worker bootstrap to set virtual `process.cwd()`, preserve argv, capture stdout, and return exit status.
- Direct external Git and Bash probes execute with concrete status `0` and expected stdout even though the sandbox also attaches `EPERM` metadata.
- Direct nested Node child launches return empty output, so Node module entrypoints require Worker transport in the affected test harnesses.
- The subprocess census assigns every affected launch to one of the two follow-up cells; no production hook or CLI source is in their write scope.

## Cell repair

- Cell 2 now reads the proven Worker implementation in `skills/bee-hive/scripts/test_onboard_bee.mjs` before extracting the shared runner.
- Cell 2 owns that onboarding test in its write scope, requires removal of the inline duplicate, and reruns onboarding in its verify command.
- Cell 2 defines a falsifiable timeout contract: a deliberately hanging module must be terminated and return `status: null`, `signal: "SIGTERM"`, captured streams, and `error.code: "ETIMEDOUT"`.
- Cell 3 now owns the exact configured `commands.verify`, not only its two local suites.
- Machine comparison confirms cell 3's verify string equals `.bee/config.json` `commands.verify` byte-for-byte.
- Dependencies are serialized `1 -> 2 -> 3`; the full baseline cannot cap before both implementation slices finish.

## Verdict

The plan checker and cold-pickup reviewer findings were repaired in the cell contracts. The Worker transport is feasible in the current sandbox, every affected launch has an owner, timeout behavior has a deterministic oracle, and the terminal cell owns the unchanged full baseline. Ready for execution.

Gate 3 was auto-approved under the repository's explicit `total` bypass setting. Execution is serialized: the shared-runner cell is dispatched first; the external-integration cell remains dependency-blocked until the runner cell caps with recorded green output.

## Execution evidence

The shared-runner cell capped green. Its exact verify recorded onboarding with zero
failures, model/write guards green, CLI `132 passed, 0 failed`, split-brain plan and
apply both `blocked_downgrade` with `zero_mutation=true`, and a clean diff check.
The deterministic timeout row and stdin-dependent cap fixture both pass through the
shared runner. The worker released all reservations; only the cell commit was refused
because this sandbox exposes `.git/index.lock` read-only.

The terminal external-integration cell is now in progress and owns the unchanged full
repository verify.

The first terminal run exposed a transitive census gap before reaching the focused
suites: the configured `test_lib.mjs` path still contained 22 reachable nested Node
launches across the main harness, metadata renderer, and two concurrent race
orchestrators. An exhaustive follow-up census also found five reachable Git launches;
those remain external, with status/output-first handling only where attached sandbox
metadata caused a false failure.

The blocked terminal cell was superseded without discarding its green implementation.
Cell 4 owns and caps the focused portable-path/hook-contract repair. Cell 5 owns the
exhaustive transitive Node migration, preserves concurrent race semantics, keeps the
review runtime mirror byte-identical, and is the sole owner of the unchanged full
baseline.

Cell 4 has now capped green: the real Git path reported 913 tracked files, all 141
hook-contract rows passed with none skipped, the frozen judge found zero out-of-scope
hits, and reservations were released. Cell 5 is executing the terminal migration.

Cell 5 completed the transitive implementation and focused proof: metadata 14/14,
`test_lib.mjs` 322/0, claim and handoff races green with concurrent Worker racers,
and the 17-file lib mirror byte-identical. Its exact baseline passed every suite
through release-manifest self-test, then correctly stopped on only the two updated
reviews-mirror hashes. Because the canonical manifest was outside that cell, it was
superseded rather than widened while claimed.

Cell 6 explicitly owns the same preserved implementation plus
`docs/history/codex-harness-hardening/release-manifest.json`; it will regenerate that
identity through the canonical writer and owns the final unchanged baseline.

Cell 6 capped green. Canonical manifest generation changed exactly the two expected
reviews-mirror SHA-256 fields; the 36-file release check passed. The unchanged full
repository baseline exited zero with 1,224 recorded output lines. Focused evidence
remained metadata 14/14, `test_lib.mjs` 322/0 with concurrent negative controls, and
17 byte-identical library mirrors. No undeclared test, CI, lockfile, or shared-runner
change was included; all reservations were released.
