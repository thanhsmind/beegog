# Independent review: worktree-isolation plan snapshot

Date: 2026-07-15  
Session: `worktree-isolation-plan-rereview-20260715`  
Baseline: `45cac8574411bec18a7a6f8fc91efaa6e52dabce`  
Snapshot: `b2e440bf477c6cfbad21d3cbbd66d708deb0823b6c3495b4e3b36c8f6f5077c7`  
Decision: **BLOCKED — 6 open P1 findings**

## Scope

Reviewed the content-addressed planning snapshot: CONTEXT, approach, plan,
implementation brief, validation report, decision log, and four work definitions.
The four implementations remain open and were excluded; this review makes no claim
that runtime behavior or verification evidence exists.

Reviewers: code quality, architecture, security, and test coverage. No conditional
reviewer trigger matched the planning-only diff.

## P1 findings

1. **Shared enabling wave recreates Git contention.** wt-2 and wt-3 are planned in
   parallel through one shared index/HEAD, so they can hit `index.lock` or create a
   mixed commit. Two reviewers independently found this.
2. **Invalid linked metadata can revive a worktree-local coordination store.** The
   library resolver falls back locally while only hooks carry `linked-invalid`, so
   direct CLI/store consumers can hide main state. Two reviewers corroborated it.
3. **Git metadata is not independent authority against a same-UID worker.** A worker
   can potentially modify both ends of the proposed backlink/HEAD check. The threat
   model needs a protected dispatch attestation or a narrower security claim.
4. **Path normalization lacks canonical containment.** Traversal, absolute-main
   targets, or symlink escapes can bypass logical reservation matching.
5. **Cleanup can destroy the only recoverable worktree state.** Explicit drop and
   feature-close pruning lack human destructive approval, recovery capture, and
   clean/reachable preconditions.
6. **The promised full post-integration verification has no owner or provenance.**
   wt-4 runs focused checks only and does not prove main checkout path, HEAD, merged
   ancestry, full command, and output. Architecture and test reviewers corroborated
   this gap.

## P2 findings

1. Integration is not transactional when main verification turns red; rejected
   changes can remain on main.
2. “Complete hook-directory parity” conflicts with source-only tests; the plan needs
   a derived production inventory and explicit exclusions.
3. Non-green dispositions have no executable fault-injection coverage for identity
   mismatch, merge conflict, red verification, or incomplete work.

The three P2 items are recorded in the project backlog and do not independently
block the review. The six P1 findings do.

## Artifact and evidence assessment

- Planning artifacts exist, are substantive, and are linked to bounded work.
- Implementation artifacts and behavior evidence are intentionally absent because
  all four work items remain in progress.
- UAT was not run: there is no completed runtime deliverable in this review scope.
- The current sandbox still denies nested child processes with `EPERM`; the review
  did not reinterpret that missing baseline as green evidence.

## Required next step

Return the P1 findings to planning, repair the threat model and execution contracts,
then freeze a new delta and re-review the changed defect classes before execution is
approved. No implementation or merge should proceed from this snapshot.

## Repair checkpoint

The planning repairs are now synchronized across CONTEXT, approach, plan,
implementation brief, validation report, decision log, and all four work
definitions. Their ordered content fingerprint is
`e3353cfd044566a290ec4d2002197fac89b95f101fc0d0f21921cc53f8b7fef1`.
A consistency sweep found no remaining contradiction in the nine repaired defect
classes, and the dependency schedule is strictly wt-1 → wt-2 → wt-3 → wt-4.

This checkpoint does not resolve the six P1 records by assertion. The fixes changed
the resolver contract and trust boundary, so the existing review remains blocked
until an expanded delta re-review independently verifies those boundary changes.
The full executable baseline also remains pending in a child-process-capable
environment.
