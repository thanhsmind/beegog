---
type: bee.area
title: Doctrine Layer — lane classification and working discipline
description: "The standing rules that size a piece of work and govern its by-products: work-packet-first tiny/small shapes, product-file-only caps, test-anchored risk flags, classification before context loading, the one canonical scratch home, and the verify ladder."
timestamp: 2026-07-23
bee:
  id: doctrine-layer-lane-and-working-discipline
  lifecycle: active
  areas: [doctrine-layer]
  required_context: [areas/doctrine-layer/overview.md]
  decisions: ["lane-ceremony-v3 D1-D10 (docs/history/lane-ceremony-v3/CONTEXT.md, 2026-07-19)", "f21efe6e (tree-hygiene D1/D4 — one canonical scratch home, the write-guard that enforces it)", I51 (issues-46-53 — claim-triggered baseline), I53a (issues-46-53 — sweeper reaches what the guard produces)]
  sources: ["lane-ceremony-v3 cells lcv3-1..lcv3-4 (traces in .bee/cells/, reports docs/history/lane-ceremony-v3/reports/, 2026-07-19 — plan freeze, lane work-packet shapes, product-file caps, test-anchored flags, intake-first classification; each RED-first against the doctrine assertion suite)", "tree-hygiene (cell th-6, 2026-07-21 — write-guard scratch-shape denial + the three competing prose homes collapsed into one doctrine rule)", "docs/specs/doctrine-layer.md#R13", "docs/specs/doctrine-layer.md#R14", "docs/specs/doctrine-layer.md#R15", "docs/specs/doctrine-layer.md#R16", "docs/specs/doctrine-layer.md#R17", "issues-46-53 cells i-3 (GH #51 — the baseline gate is claim-triggered and lives in the execution discipline; GH #53-adjacent — a guard that directs writes obliges the sweeper to reach there; traces in `.bee/cells/`, 2026-07-23)"]
  authoritative_for: "doctrine-layer: lane classification and working discipline"
---

# Doctrine Layer — Lane Classification and Working Discipline

These rules ride the standing sheet because they decide how a piece of work is
*sized* and where its by-products *land* — questions that arrive before any
stage is invoked. The unnumbered verify-ladder rule travels with R17: both
govern the working residue of a cell rather than its content.

## Business Rules

- **R13** — Small work starts from an executable work packet, never a shrunken
  feature plan (lane-ceremony-v3 D3/D4/D5). The tiny lane's complete work shape
  is the request plus one work unit — the unit is the micro-plan, carrying the
  touched paths, the directive, the acceptance contract, the verification
  command, and the classification record (flag count, product-file count, lane);
  no plan document exists. The small lane's default shape is a short scoping
  synthesis logged through the decision log plus one-to-three units; a plan
  document is opt-in, written only when a durable multi-slice strategy genuinely
  needs one. In both lanes the approval order is fixed: draft unit(s) are
  previewed in the approval message, the inline reality check runs, THEN the one
  merged shape+execution approval is asked (or auto-recorded under bypass), and
  only after approval are units persisted and claimed — execution approval is
  never granted before the execution package exists, and never
  persist-then-preview.
- **R14** — Lane caps count product files only (lane-ceremony-v3 D6):
  production source, tests, and runtime configuration the behavior change
  itself must touch. Workflow bookkeeping, history and specification documents,
  plans/briefs/reports, and generated projections or manifests never count
  toward a lane cap — the workflow's own artifacts can never promote a change
  out of its honest lane.
- **R15** — The two experience-based risk flags are test-anchored
  (lane-ceremony-v3 D7): "changes behavior an existing test asserts (a covered
  contract must change)" and "the change requires weakening, deleting, or
  replacing existing proof". A covered bugfix that keeps existing tests green
  and adds a new one scores zero on both. The remaining flags and the
  2-3→standard / 4+→high-risk thresholds are unchanged.
- **R16** — Classification precedes context loading (lane-ceremony-v3 D8): the
  planning stage classifies the lane first from the request plus at most two
  targeted reads, then loads context scaled to the lane — targeted reads only
  for tiny, bounded for small, full bootstrap for standard and high-risk. The
  critical-patterns digest stays mandatory in every lane (it already rides the
  session preamble at zero extra cost). The lane decision re-runs upward any
  time evidence demands escalation; de-escalation requires cited evidence.
- **R17** — There is one canonical scratch home (`f21efe6e`): every ephemeral
  file bee writes for its own working purposes — judge payloads, evidence/
  deviation files, batch inputs, digests, verify logs, probe/debug scripts,
  review manifests — goes to `.bee/tmp/<feature-or-session>/`; disposable
  feasibility code goes to `.bee/spikes/<feature>/`. Deliverables (reports,
  specs, decisions, backlog, the cell/decision stores, plugin renders) keep
  the paths their own workflow stage already requires — never rerouted
  through scratch. A write-guard denies a scratch-shaped write that targets a
  tracked directory instead, naming `.bee/tmp/` in the refusal; scratch is
  swept at feature close and session finish via `bee tmp sweep`. Three
  procedure references used to each state a partial, competing version of
  this home — they now cite this rule instead.

- **R17a — A guard that directs writes somewhere obliges the sweeper to reach
  there.** The write-guard's refusal names the scratch **root** and tells the
  author to write there; the sweeper's own inventory saw only directories, so
  every plain file written exactly where the guard sent it was unreachable by
  every flag — including the one documented as clearing the lot. Bee was
  contradicting itself: one half of the rule directed the write, the other half
  could not see it, and the gap was invisible because both halves independently
  looked correct. The sweeper's inventory therefore covers what the guard
  actually produces, and the per-feature sweep reaches a feature's artifacts
  whether they sit in that feature's own directory or loose in the root under
  bee's own `<feature>-<n>` cell-id naming.

  Two safeguards ride the widened reach, because a sweeper that deletes more is
  a sweeper that can delete wrongly. Containment is unchanged — every candidate
  is proved inside the scratch home when the removal is planned and proved again
  immediately before it happens. And a name-prefix match is an **inference**,
  not the exact-name override: it requires a separator boundary so a short
  feature name can never swallow a longer unrelated one, and it refuses to
  remove a sibling that is itself live, reporting that refusal rather than
  swallowing it. The general rule: when one mechanism decides where by-products
  go, the mechanism that reclaims them is specified against that same shape, not
  against the shape someone assumed.

- **The verify ladder (cli-performance D4, `e54878b1`):** a cell's verify is its
  TARGETED suite (seconds), run red-first and green by the worker; the full
  configured chain (~minute) runs at exactly four milestones — the **baseline
  before a session's first cell claim**, wave close (once, by the orchestrator,
  the independent full proof for the whole wave), session finish, and
  worktree-merge/release gates.

  **The baseline's trigger is the claim, not arrival.** It is stated
  claim-first, in the execution discipline rather than in any startup
  checklist, because a conditional rule rendered inside an unconditional list
  reads as unconditional: an agent working a numbered "every session" list
  top-to-bottom ran a minute-long chain to answer a question that touched no
  cell. A session that answers, reads or explores without ever claiming owes no
  baseline run. Nothing about the gate's strength changed — a red baseline is
  still surfaced and still becomes its own fix-first cell, and building on red
  is still forbidden. What changed is when it fires, and where the rule lives so
  that its structure and its meaning agree.
  Judges and reviewers never run the full chain as part of a verdict. Proven
  the day it landed: the wave-close run caught a real escape (raw NUL bytes in
  a lib file) that every targeted suite had missed. Companion performance
  idiom for derived read paths (D1/D2, cells cp-1/cp-2): shared inputs are
  read once per call and threaded down — never re-read per item — and
  repeated child-process answers are memoized in a pass-local map that dies
  with the pass; no cross-call caches, no TTLs, no daemons.
