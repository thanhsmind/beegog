---
date: 2026-07-15
feature: codex-harness-hardening-1d
categories: [decision, pattern]
severity: low
tags: [formalization, report-not-decide, scope-control, classifier]
---

# Formalizing implicit logic: surface it read-only before you let it decide

## What Happened

SRC-01..06 (a five-way source-identity classifier) read like a big new subsystem, but most of it
already lived *implicitly* in `onboard_bee.mjs` — the `identityOk` realpath anchor (SRC-02/05), the
self-onboard detection, and the unknown-fail-closed path (SRC-04, already hardened by 1b). Slice 1d's
real work was to **extract the taxonomy into one pure, named, tested `classifySource()`** and surface
it (a `bee status` `source` field + the same detector in onboard's report, DIST-04) — not to rewrite
source resolution.

The deliberate constraint that kept it low-risk: the classifier is **report-only**. It names what
onboarding already decides; it does not drive any refusal. Letting it *replace* `identityOk` in the
decision path was explicitly deferred as its own high-risk slice.

## Root Cause / Why it matters

A locked SPEC requirement can be 80% already-implemented as scattered, unnamed conditionals. The value
of "formalizing" it is a shared, testable API + an observable surface — real, but a different (much
lower) risk than a behavior change. Conflating the two would have dragged a testable refactor into
hard-gate territory for no reason.

## Recommendation

- **When a locked rule is already implemented implicitly, scope the slice as "extract + name + surface,"
  and keep the new artifact report-only first.** Prove it matches reality (classify the real running
  tree; assert the existing decision path is byte-unchanged) before you let it *drive* anything. The
  "make it decide" step is a separate, higher-risk slice — split it out explicitly, don't let it ride
  in on the formalization.
- **A pure classifier is trivially testable across all its cases** (5 kinds + sentinel + purity +
  never-throws, no spawning) precisely because it only reads and returns — design formalizations as
  pure functions and the test matrix writes itself.
- One collision to remember: the legacy global root (`~/.claude/skills`) shares a `.claude` grandparent
  with a project projection, so order the checks so the realpath-anchored one (global) wins first.
