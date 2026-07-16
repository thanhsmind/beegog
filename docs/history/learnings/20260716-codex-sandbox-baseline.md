---
date: 2026-07-16
feature: codex-sandbox-baseline
categories: [pattern, decision, failure]
severity: standard
tags: [codex, sandbox, worker-threads, verification, concurrency, release-identity]
---

# Learning: Preserve Proof While Adapting Test Transport

## Learning 1 — Classify launch capabilities before replacing transport

**Category:** pattern
**Severity:** standard
**Tags:** [codex, sandbox, integration]
**Applicable-when:** A managed runtime reports broad launch errors around a mixed test suite.

### What Happened

The first probes separated nested Node module launches, which did not execute,
from real Git, Bash, installed-Node, and Codex commands, which still returned
concrete status and output even when the environment attached an auxiliary
`EPERM` warning. The repair routed only nested Node entrypoints through
`scripts/lib/run-module-worker.mjs`; external integration stayed external.

### Root Cause

The sandbox metadata described the launch environment more broadly than the
actual observable capability. Treating every attached warning as the primary
result would have produced false failures, while replacing every command would
have produced false-green emulation.

### Recommendation

When a sandbox reports a launch failure, probe each execution class and grade
concrete status plus required output before changing transport. Replace only
the capability that is demonstrably unavailable, and keep genuine external
integration real.

## Learning 2 — Serialize the harness, never the behavior under test

**Category:** decision
**Severity:** standard
**Tags:** [worker-threads, concurrency, race-tests]
**Applicable-when:** A process-based concurrency fixture must run in a sandbox that forbids nested processes.

### What Happened

Ordinary module scenarios use the shared serialized Worker runner because
virtual working-directory changes are process-global. Claim and handoff race
scenarios instead create genuinely concurrent Worker actors and release them
through a barrier; the outer suite only serializes one complete scenario
against the next. A deterministic hanging-module fixture also proves timeout,
stream-drain, signal, and error-code behavior.

### Root Cause

Transport serialization is safe for independent scenarios but would erase the
interleaving that a race test exists to verify. A green suite with serialized
racers would be weaker than the suite it replaced.

### Recommendation

When adapting concurrency tests to a restricted runtime, serialize only outer
scenario orchestration. Keep competing actors concurrent, add a barrier and a
negative control, and give asynchronous transports a deterministic timeout
oracle that asserts exit and both output streams.

## Learning 3 — Terminal ownership includes transitive launchers and generated identity

**Category:** failure
**Severity:** standard
**Tags:** [scope, verification, release-manifest]
**Applicable-when:** Freezing the final unit that must pass the repository's unchanged verify command.

### What Happened

The initial top-level census missed reachable launchers imported by metadata,
command, and race harnesses. After those became executable, the focused suites
passed but the release manifest failed because two changed review-library
mirrors were covered by a generated identity artifact outside the unit's scope.
The final owner adopted the green implementation, regenerated the manifest
through its canonical writer, and passed the unchanged 1,224-line baseline.

### Root Cause

Impact analysis stopped at top-level test files and did not traverse the exact
verify command's imported/generated execution graph or map release-covered
paths to their canonical manifest.

### Recommendation

Before freezing terminal scope, traverse every suite in the exact verify
command through imported and generated launchers. If a declared file is
release-manifest-covered or mirrored, include the complete identity unit and
its canonical regeneration/check command from the start.

## Learning 4 — Verification must be isolated from orchestration state

**Category:** failure
**Severity:** standard
**Tags:** [environment, reservations, verification]
**Applicable-when:** Running literal verification after write-heavy work owned by a worker or reservation.

### What Happened

The first terminal replay inherited `BEE_AGENT_NAME` from the write-heavy shell
and changed two ownership assertions even though the implementation was sound.
Rerunning the exact command without orchestration-only environment state passed.

### Root Cause

Reservation identity was scoped to the shell rather than to the write command,
so test behavior observed coordination metadata that was not part of the
repository contract.

### Recommendation

Prefix only write-heavy commands with reservation identity. Run verification
in a sanitized environment and compare the executed command byte-for-byte with
the unit's declared verify command before recording evidence.

## Learning 5 — Do not claim immutable completion without writable Git metadata

**Category:** failure
**Severity:** standard
**Tags:** [git, evidence, review-candidate]
**Applicable-when:** A managed checkout permits source writes but may restrict `.git` writes.

### What Happened

All functional verification passed, but `.git/index.lock` was read-only. No
feature commit exists, so current `HEAD` does not contain the working-tree
change and cannot truthfully identify this feature as an immutable review
candidate. Two superseded units also lost useful focused-green machine evidence
even though their reports retained it.

### Root Cause

Git-index writability and evidence-preserving supersession were not validated
before execution. Completion mechanics assumed that a source-writable checkout
was also commit-writable.

### Recommendation

Preflight Git-index capability before execution when commits are required. If
the environment cannot commit, report that limitation and never register the
unchanged `HEAD` as the completed change set. When superseding a unit, preserve
its scoped verification, successor link, and report/trace parity.
