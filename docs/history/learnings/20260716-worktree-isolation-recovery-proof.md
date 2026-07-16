---
date: 2026-07-16
feature: worktree-isolation
categories: [pattern, decision, failure]
severity: critical
tags: [worktrees, containment, transactions, verification, recovery]
---

# Learning: Separate topology truth, mutation authority, and live acceptance

## Typed roots prevent split-brain coordination

**Category:** pattern
**Severity:** critical
**Tags:** [worktrees, state, fail-closed]
**Applicable-when:** Multiple physical checkouts must share one logical coordination store.

### What Happened

Root resolution now distinguishes the physical work root from the validated main
store and returns an explicit ordinary, linked-valid, or linked-invalid result.
Malformed linked metadata refuses coordination instead of silently creating a
second local store. Resolver and mirror verification passed with 333 library
checks and byte-identical runtime projections.

### Root Cause

One overloaded “repository root” cannot safely represent both the location being
edited and the location that owns shared workflow state.

### Recommendation

When physical checkouts share logical state, model work root and store root as
separate typed values and carry invalid topology to every consumer; never infer
shared authority from copied onboarding markers or worker-supplied paths.

## Prove containment before translating paths

**Category:** pattern
**Severity:** critical
**Tags:** [paths, authorization, symlinks]
**Applicable-when:** Authorization uses logical relative paths while writes occur through alternate physical roots.

### What Happened

The write guard resolves existing targets canonically and resolves new targets
through their nearest existing ancestor before it normalizes a reservation key.
Traversal, outside-root absolute paths, symlink escapes, and Windows separator or
case escapes are denied across every write-capable operation.

### Root Cause

Logical normalization cannot prove that a physical target remains inside the
authorized checkout; normalizing first can erase evidence of an escape.

### Recommendation

For every mutation surface, prove canonical physical containment first, then
derive the logical authorization key. Deny when the target or its nearest
existing ancestor cannot be resolved safely.

## Recovery is part of integration, not cleanup

**Category:** decision
**Severity:** critical
**Tags:** [merge, rollback, provenance]
**Applicable-when:** Automation accepts a worker branch, generated patch, migration, or deployment artifact.

### What Happened

The integration contract captures protected identity before dispatch, rechecks
identity, ancestry, and changed-path scope, stages the merge without finalizing,
and aborts on conflict or targeted red. Post-commit verification is bound to the
destination revision; unexpected red produces a non-destructive revert. Cleanup
is allowed only after clean state, green committed-destination verification, and
reachability are independently proven.

### Root Cause

A worker result is data from a cooperative but fallible producer. Treating merge
and cleanup as incidental steps lets a correct implementation still leave main
red or destroy the only recovery path.

### Recommendation

Capture control-plane identity before dispatch, treat integration as a
transaction, bind verification to the committed destination, and make deletion
the final consequence of proven recoverability rather than ordinary cleanup.

## A deterministic simulation does not satisfy a promised live acceptance

**Category:** failure
**Severity:** critical
**Tags:** [uat, git, sandbox, evidence]
**Applicable-when:** A completion contract requires a real commit, merge, deployment, or external side effect.

### What Happened

The live checkout exposed read-only repository metadata. All code suites and
deterministic temporary-repository fault cases passed, but no cell could create
its required commit and the final acceptance could not perform the promised
native worktree commit/merge against the live checkout. The capped traces record
green tests while their reports separately disclose the missing commits.

### Root Cause

Environment capability was checked only when commit time arrived, and the cap
contract validated test evidence without requiring the live commit/provenance
artifact named by the plan.

### Recommendation

Before claiming work whose acceptance requires a real side effect, preflight the
exact mutation capability. Require the resulting identity and provenance in the
completion evidence; use deterministic fixtures as strong supporting proof, but
never relabel them as the missing live acceptance.

## Temporary repository fixtures must control their ancestors

**Category:** failure
**Severity:** standard
**Tags:** [fixtures, git, isolation]
**Applicable-when:** Tests create repositories beneath a shared temporary directory.

### What Happened

An ambient ancestor repository marker under the temporary directory captured
nested fixtures and caused 41 unrelated failures before the resolver fixture was
corrected. The final suite now passes under the corrected nearest-root behavior.

### Root Cause

The fixture assumed its temporary parent was outside every repository—the same
ambient-topology assumption the feature was designed to remove.

### Recommendation

Make each temporary repository fixture establish and verify its own nearest
boundary, and include a deliberate repository-controlled ancestor case whenever
root discovery walks upward.
