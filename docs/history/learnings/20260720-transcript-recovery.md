---
date: 2026-07-20
feature: transcript-recovery
categories: [process, release-safety, patterns]
severity: high
tags: [version-tuple, silent-drift, glob-scoped-files, orchestrator-reverify, digest-only, reuse-primitives, render-manifest-ordering]
---

# transcript-recovery — Learnings

Crash-recovery transcript mining shipped (D1–D6, cells transcript-recovery-1..4, all
four judged PASS, full 33-suite verify green). The durable lessons are one release-safety
near-miss and a handful of reusable patterns.

## What Happened

**The headline: a silent, unrequested release-version bump rode a feature commit.**
During cell 4 (verify-chain wiring + skill re-render), `bump_version.mjs 1.7.6` ran
against the release tuple — no cell asked for a version bump, this feature is not a
release. The tuple has four members: `skills/bee-hive/templates/lib/state.mjs`,
`.bee/bin/lib/state.mjs`, and both plugin manifests. The two plugin manifests fell
inside cell 4's declared globs (`.claude-plugin/*`, `.codex-plugin/*`) and were swept
into commit c7c39a6 at 1.7.6; the two `state.mjs` members match no declared glob, so
they stayed uncommitted — invisible in the commit diff **and** absent from the worker's
`[DONE]` report. It was caught only at feature-close, when the orchestrator independently
re-inspected the working tree (`git status` showed `state.mjs` modified) and traced
`BEE_VERSION 1.7.5→1.7.6`. Reverted with `bump_version.mjs 1.7.5` + force-downgrade
onboard sync + plugin re-render + manifest regen; full verify green afterward.

**Second-order failure during the revert:** `release_manifest.mjs --write` was run
*before* the final `render_plugin_skill_trees.mjs`, so the manifest hashed a stale tree
and `plugin_distribution` went red (39/1). Fixed by regenerating the manifest **after**
the last render.

## Root Cause

1. **Glob-scoped `cell.files` conflates "path matches a declared glob" with "this write
   was intended."** A stray write landing inside `.claude-plugin/*` is indistinguishable
   from the intended render, so it commits silently. Worse, the tuple members that fall
   *outside* every glob don't commit at all — they become invisible uncommitted drift.
2. **No mechanical guard ties a release-version change to an explicit release intent.**
   `bump_version.mjs` will bump the whole tuple whenever any step invokes it; nothing
   asserts "the version only moves when a release was asked for."
3. **Render → manifest ordering is operator-sequenced, not enforced.**
   `release_manifest.mjs --write` trusts whatever tree state currently exists.

## Recommendation

- **When closing ANY feature, independently re-inspect `git status` and the full working
  tree before declaring done — never trust the worker's `[DONE]` file list.** The bump
  was invisible in both the commit diff and the worker report; only a fresh
  orchestrator-run `git status` + a tuple check surfaced it. This is the orchestrator's
  goal-check discipline (decision 0018) applied to the *whole tree*, not just the cell's
  verify.
- **When a feature is not a release, the release-version tuple must not move.** Every
  version bump in git history is an explicit `release X.Y.Z` commit; a feature close is
  not a release. If the tuple drifted, restore it with `bump_version.mjs <last-released>`,
  then re-render and regen the manifest **last**.
- **Regenerate `release-manifest.json` only AFTER the final render step.** Any render that
  changes a `.bee-render.json` sha invalidates a manifest written before it —
  `plugin_distribution` will go red. Order: bump/edit → render all trees → onboard sync →
  `release_manifest.mjs --write` → `--check`.
- **Prefer glob-narrow or exact `cell.files` for cells that touch generated trees.** A
  broad `.claude-plugin/*` glob authorizes far more than the intended render and hides
  stray writes; the narrower the declared scope, the louder an unintended write is.

## Reusable Patterns (lower severity, worth reapplying)

- **Reuse existing primitives over rebuilding.** `recovery.mjs` composed detection from
  `heartbeatStale` (900s law), `resolveTranscript`/`claudeProjectsRoot` (transcript
  location), and session/decision/cell readers — zero new staleness constants (D1).
  Extend the existing primitives; don't invent a parallel threshold.
- **Down-tier-miner / digest-only for unloadable stores (D4).** The CLI builds a bounded
  window + a miner prompt; a cheaper worker reads the raw transcript and returns only a
  digest — raw lines never enter the orchestrator context. Reapply to any large,
  private, or unloadable source (transcripts, logs, vendor dumps).
- **CONTEXT.md's locked glossary wins over a cell action's paraphrase.** Cell 1's action
  said the clean-end trio tolerates "trailing queue-operation entries"; the locked Terms
  glossary said "nothing conversational after." The implementation followed the glossary
  (tolerating all bookkeeping event types), and the judge ruled it sound. When a cell's
  summary wording conflicts with CONTEXT's locked terms, verify against CONTEXT directly.
- **Additive-only field for append-log/external-consumer compatibility.** `capture.mjs`
  sets `stub.source` only when non-null (key omitted, never defaulted), so existing
  stubs stay byte-shape-identical.
