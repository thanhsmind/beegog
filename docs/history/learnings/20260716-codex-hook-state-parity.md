---
date: 2026-07-16
feature: codex-hook-state-parity
categories: [pattern, decision, failure]
severity: high-risk
tags: [codex, hooks, workflow-state, plugin, installer, migration]
---

# Learning: Make Runtime Parity Honest and Distribution Exclusive

## Learning 1 — Derive mutation authority from the pre-state

**Category:** pattern
**Severity:** standard
**Tags:** [state-machine, ownership, review-isolation]
**Applicable-when:** Several workflow stages share one generic state mutation command.

### What Happened

Generic routing changes now require the selected default or lane record's
current phase as the pre-change owner. A missing, invalid, or mismatched owner
refuses before writing; a successful phase change automatically makes the new
phase authoritative. Gate mutation remains separate, and independent review
writes only its own review-session record.

### Root Cause

The generic state command previously accepted routing changes without proving
which stage owned the transition. Review could therefore participate in active
pipeline mutation even though review is user-invoked and should remain isolated
from development execution readiness.

### Recommendation

Authorize a shared state-machine mutation with a fact derived from the strict
pre-state, not a second persisted owner that can drift. Refuse before mutation
and keep orthogonal operations such as gates and review outcomes on dedicated
commands and records.

Evidence: `docs/history/codex-hook-state-parity/reports/codex-hook-state-parity-1.md:5`,
`docs/specs/workflow-state.md:335`, `docs/specs/workflow-state.md:572`.

## Learning 2 — Share policy, declare capability-specific projections

**Category:** decision
**Severity:** standard
**Tags:** [hooks, runtime-parity, capability]
**Applicable-when:** Two runtimes expose unequal lifecycle interception APIs.

### What Happened

One catalog still defines the lifecycle policy, but it now names all three
directional differences: Claude alone can enforce the pre-spawn model-tier
guard, while Codex exposes post-start and post-stop lifecycle audit events.
Codex records bounded evidence and never claims that its post-event audit can
block a spawn.

### Root Cause

Treating parity as byte-identical hook lists hid a real host capability gap.
That made the Codex projection look equivalent on paper while omitting useful
events and overstating what a post-event callback could enforce.

### Recommendation

Keep semantic policy centralized, export every runtime-specific difference by
runtime, event, and handler, and test each projection through its real consumer.
Where only observation is possible, provide bounded audit evidence and state
the missing authority explicitly.

Evidence: `docs/history/codex-hook-state-parity/reports/codex-hook-state-parity-2.md:5`,
`docs/specs/hook-runtime.md:189`, `docs/specs/hook-runtime.md:210`.

## Learning 3 — Prove the replacement before destructive migration

**Category:** pattern
**Severity:** high-risk
**Tags:** [installer, cleanup, zero-mutation]
**Applicable-when:** An installer replaces one active source with another and removes legacy artifacts.

### What Happened

Plugin-first cleanup requires an enabled installed package, safe provenance,
and complete release-inventory equality. The installer preflights every target
and revalidates the whole-run snapshot immediately before applying. Any package,
ledger, path, symlink, alias, or hook-shape mismatch aborts the transaction with
zero writes.

### Root Cause

Successful install command status does not prove the runtime will load a
complete, intended package. Cleanup based only on names or command success can
delete the working fallback before its replacement is trustworthy.

### Recommendation

Make replacement proof a destructive precondition. Validate provenance and
complete inventory, fence cleanup by exact ownership, then revalidate all
inputs at the mutation boundary. Treat any drift as a whole-transaction refusal.

Evidence: `docs/history/codex-hook-state-parity/reports/validation-current.md:50`,
`docs/history/codex-hook-state-parity/reports/codex-hook-state-parity-3.md:5`,
`docs/specs/onboarding.md:445`.

## Learning 4 — Source arbitration must be symmetric and exclusive

**Category:** decision
**Severity:** high-risk
**Tags:** [plugin, repo-copy, source-arbitration]
**Applicable-when:** A runtime can load the same capability from package and project sources.

### What Happened

Plugin-first proves the package before removing repository copies. Repo-copy
proves the package inactive before creating managed copies. Both transitions
preserve foreign/user content and finish with exactly one active bee source.

### Root Cause

Allowing package and repository projections to coexist can execute skills or
hooks twice. A one-way migration rule also leaves the reverse transition free
to create the same split-brain state.

### Recommendation

Design source arbitration as two proof-gated inverse transitions with the same
exclusive postcondition. Preserve everything not positively recognized and
owned by the installer.

Evidence: `docs/history/codex-hook-state-parity/CONTEXT.md:23`,
`docs/history/codex-hook-state-parity/reports/codex-hook-state-parity-3.md:5`,
`docs/specs/onboarding.md:187`.

## Learning 5 — Test every generated projection through its consumer

**Category:** failure
**Severity:** standard
**Tags:** [generated-artifacts, onboarding, parity]
**Applicable-when:** One catalog produces package and fallback projections through different consumers.

### What Happened

After the canonical Codex projection gained paired lifecycle events, execution
found that the repo-copy onboarding path still emitted the older topology. The
package catalog itself was correct; the stale behavior lived in a downstream
generator. A later fresh-host audit found the inverse gap too: the generated
commands named the new audit handler, but the onboarding payload did not copy
that file. Consumer-level executable parity must therefore prove both topology
and that every referenced artifact is delivered.

### Root Cause

Testing only the canonical catalog proves its content but not that every
renderer, installer, and fallback path consumes the current semantics or ships
the files those semantics reference.

### Recommendation

Inventory every generated projection and exercise each through the entrypoint
that users actually invoke. Assert that every generated reference resolves in a
fresh target. Catalog equality is an input assertion, not an end-to-end delivery
proof.

Evidence: `.bee/cells/codex-hook-state-parity-3.json:146`,
`.bee/cells/codex-hook-state-parity-5.json`,
`docs/history/codex-hook-state-parity/CONTEXT.md:28`.

## Learning 6 — Separate product proof from environment acceptance

**Category:** failure
**Severity:** standard
**Tags:** [uat, codex-home, git, powershell]
**Applicable-when:** Repository verification is green but the execution environment blocks user-home, Git, or platform-native actions.

### What Happened

Fixtures, package metadata, the 136-file inventory, cross-platform shared
planner, and the full repository verify are green. Real Codex marketplace
registration failed before mutation because the user Codex home is read-only;
Git metadata is also read-only, and WSL interop failed before PowerShell could
parse the installer. No fallback cleanup ran, no immutable commit was claimed,
and these platform actions remain explicit acceptance work.

### Root Cause

Source writability does not imply user-runtime, Git-index, or native-platform
capability. A fixture can prove transaction semantics without proving that a
specific host permits or loads the installed package.

### Recommendation

Preflight external capabilities, preserve fail-safe zero mutation, and label
the remaining check precisely: writable user-home reinstall plus a fresh Codex
thread, writable Git metadata for immutable history, and native Windows parser
execution. Never reinterpret a transport failure as product evidence.

Evidence: `docs/history/codex-hook-state-parity/reports/codex-hook-state-parity-1.md:66`,
`docs/history/codex-hook-state-parity/reports/codex-hook-state-parity-3.md:11`.
