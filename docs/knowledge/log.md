## 2026-07-22

- Bundle created under `docs/knowledge/` (D17): `index.md` hand-seeded (root frontmatter carries
  only `okf_version`, per D4/OKF §9), this `log.md` opened. The format core —
  `.bee/bin/lib/knowledge.mjs`, the `bee knowledge check` verb, the emitter-first frontmatter
  codec, and the two-level OKF-error/profile-warning checker (D4/D13) — shipped in cell okf-1
  (feature `okf-foundation`, slice S1). This entry, the skeleton, and the Bee OKF Profile area
  spec (`docs/specs/okf-profile.md`) are cell okf-2.
- Generation takeover (cell okf-4, slice S3): `index.md` is **generated from now on** by
  `bee knowledge index` (D21) — the hand-seeded body is replaced by the byte-identical generated
  index (okf_version-only frontmatter kept, provenance moved into the HTML comment header;
  per-level indexes will appear as concepts land). `bee knowledge index --check` guards freshness
  in the verify chain, and `bee knowledge list` (D15) rows the bundle's concepts.
- First area migrated end-to-end (cell okf-5, slice S4a, D29): `docs/specs/advisor-protocol.md`
  re-authored into four `bee.area` concepts under `areas/advisor-protocol/` (`overview.md`,
  `triggers.md`, `consult-loop.md`, `slots-and-tiers.md`), frontmatter carried per D33. The
  legacy path is now a pointer stub carrying the full anchor map (D37: 26 anchors — B1-B4,
  R1-R9, E1-E6, P1-P7 — each mapped to its owning concept). Coverage is machine-checked by
  `scripts/okf_migrate.mjs --check advisor-protocol` (D35), now a chain suite in
  `scripts/run_verify.mjs`; the session-close capture nudge scans `docs/knowledge/**/*.md`
  mtimes alongside `docs/specs/` (D34).
- Critical patterns migrated, work item + plan authored, templates published (cell okf-6, slice
  S4b): `docs/history/learnings/critical-patterns.md`'s 47 dated pattern entries re-authored into
  47 `bee.pattern` concepts under `patterns/` (`bee.critical: true` throughout, `bee.polarity`
  judged per entry — 42 pitfall, 5 practice), each canonical by construction (generated via
  `emitFrontmatter`, zero `not_canonical` findings). The legacy path is now a pointer stub
  carrying the full 47-anchor map (D37: `PAT1`-`PAT47`). Coverage is machine-checked by the new
  `scripts/okf_migrate.mjs --check-patterns` (D35, additive — critical-patterns.md is a flat
  dated list, not a nine-section BA spec, so it does not fit `--check`'s `ANCHOR_REGISTRY`/area
  shape), now a chain suite in `scripts/run_verify.mjs`. This feature's own work item and plan
  now live as concepts too: `work/okf-foundation/work-item.md` (`bee.work-item`, D26, condensed
  from `CONTEXT.md`) and `work/okf-foundation/plan.md` (`bee.plan`, condensed from the frozen
  `plan.md`, carrying `bee.review_status: Approved`, D36). `docs/specs/okf-profile.md` gained a
  "## Templates" section with three canonical worked examples (`bee.work-item`, `bee.plan`,
  `bee.delivery`) — round-trip proven by pasting the `bee.delivery` example into a temp bundle
  file and confirming `bee knowledge check` reported zero `not_canonical` before removing it.

- Second area migrated, and the first under the honest derived gate (cell f2-3, feature
  `okf-migration-f2`, slice S3): `docs/specs/doctrine-layer.md` re-authored into seven
  `bee.area` concepts under `areas/doctrine-layer/` — `overview.md`,
  `placement-and-anchoring.md`, `unenforced-obedience.md`, `delegation-threshold.md`,
  `helper-classes-and-transports.md`, `native-wait-discipline.md`,
  `lane-and-working-discipline.md` — split by **topic** (what each rule governs) rather than
  by the BA template's headings, per the promoted surface-structure pattern. Frontmatter
  carried per D33, emitted canonically. The legacy path is now a pointer stub carrying the
  full 39-anchor map (D37: B1-B8 incl. B3a/B7a, R1-R17, E1-E5, P1-P7). Ground truth is
  DERIVED, not hand-listed (F8): pin `{ed65720, docs/specs/doctrine-layer.md, blob 351bf72,
  ba-nine-section, 39 anchors, unparsed_blocks: 2}`, with the pre-migration source committed
  verbatim at `docs/history/okf-migration-f2/sources/doctrine-layer.md`. The two id-less block
  starts the source really carries — a bold-lead continuation inside B8 and the unnumbered
  verify-ladder bullet after R17 — are pinned as unparsed rather than invented into anchors
  (D10); each still travels with the anchor whose block it sits in, so the F11 fidelity floor
  measures it. Coverage is machine-checked by `scripts/okf_migrate.mjs --check doctrine-layer`
  (D35), now a chain suite. Two gate defects surfaced and were closed in the same cell: the
  stub-row parser and the `bee.sources` claim matcher had not been widened alongside f2-4's
  letter-suffixed ids (so `B3a`/`B7a` could never be claimed by anything), and F12's drift
  median was being drawn across incomparable shapes — a `flat-pattern-list` migration is 1
  anchor per concept by construction, so pooling it with nine-section areas reported drift in
  already-shipped work no cell had touched. The median is now taken per pin `kind`.

- Third area migrated, the cleanest of the nine (cell f2-5, feature `okf-migration-f2`, slice
  S4a): `docs/specs/decision-memory.md` re-authored into a single `bee.area` concept,
  `areas/decision-memory/overview.md`, owning all nine anchors. Ground truth is DERIVED (F8):
  pin `{8710d03, docs/specs/decision-memory.md, blob 2e8ec59, ba-nine-section, 9 anchors
  (0 B / 9 R / 0 E / 0 P), unparsed_blocks: 0}`, with the pre-migration source committed
  verbatim at `docs/history/okf-migration-f2/sources/decision-memory.md`. This source had been
  filed by an earlier blind sweep as "shapeless, 0 anchors" — it was never shapeless, its nine
  `- **R1 — …**` rules were simply invisible to the pre-f2-4 classifier. Splitting the 39-line
  source into topic concepts (as doctrine-layer's 386 lines warranted) drove F12's drift
  telemetry outside its band the moment a third `area`-kind pin activated the running median: 4
  concepts over 9 anchors read as both too few anchors per concept and too many concepts per
  source line next to advisor-protocol and doctrine-layer's much larger sources. Consolidating
  to one concept — genuinely the right shape at this size, not a fit to the metric — brought
  both ratios back inside the [0.5x, 2x] band with content unchanged and fidelity at min/median/
  max 1.000 (verbatim re-homing). Coverage is machine-checked by `scripts/okf_migrate.mjs --check
  decision-memory` (D35), now a chain suite. `scripts/test_okf_pins.mjs`'s refusal assertions for
  decision-memory were retired (it is no longer unscheme'd) and replaced with a pass assertion,
  leaving worktree-parallelism as the sole remaining refused area.

- Fourth area migrated (cell f2-6, feature `okf-migration-f2`, slice S4b):
  `docs/specs/verify-pipeline.md` re-authored into two `bee.area` concepts, split by TOPIC rather
  than the old spec's headings — `areas/verify-pipeline/suite-topology-and-discovery.md` (how
  suites are shaped and found: per-module suites with no monolith, the shared fixture helper,
  convention-based discovery, the loud deletion guard, Windows CI proving the real suites through
  that same discovery mechanism) and `areas/verify-pipeline/concurrency-and-hermetic-runs.md`
  (how a run itself stays safe: locked atomic-swapped regeneration, multi-worker checkout
  etiquette, hermetic session-id scrubbing proven by deterministic race/isolation suites). Ground
  truth is DERIVED (F8): pin `{72fd828, docs/specs/verify-pipeline.md, blob eab70d7,
  ba-nine-section, 14 anchors (0 B / 5 R / 4 E / 5 P), unparsed_blocks: 7}`, with the
  pre-migration source committed verbatim at
  `docs/history/okf-migration-f2/sources/verify-pipeline.md`. The 7 unparsed blocks are the
  source's entire "Behaviors & Operations" section — 7 bold-lead bullets with no B-id at all —
  and none is invented into an anchor (D10); their content still travels into whichever concept's
  topic it matches. Two concepts over 14 anchors and 133 source lines land anchors_per_concept at
  7.00 and concepts_per_100_source_lines at 1.50, both inside the [0.5x, 2x] band across the four
  now-pinned "area"-shaped sources — a single consolidated concept (the decision-memory shape)
  was tried first and found to push concepts_per_100_source_lines to roughly half the running
  median, outside the band; splitting by the source's two genuinely distinct concerns (what
  suites there are and how they're found, vs. how a run stays concurrency-safe and hermetic)
  fixed both ratios without touching a single anchor's wording. Fidelity: min/median/max 1.000
  (verbatim re-homing). RED-FIRST: with the R4 claim deliberately removed from
  `concurrency-and-hermetic-runs.md`'s `bee.sources`, `--check verify-pipeline` failed with the
  real coverage-loss finding (`LOST in concepts: R4`), then was restored to green. Coverage is
  machine-checked by `scripts/okf_migrate.mjs --check verify-pipeline` (D35), now a chain suite.

- Fifth area migrated (cell f2-7, feature `okf-migration-f2`, slice S4c):
  `docs/specs/performance-log.md` re-authored into three `bee.area` concepts, split by TOPIC
  rather than the old spec's headings — `areas/performance-log/sections-lifecycle-and-measurement.md`
  (the operator-driven lifecycle of a named section: opening, closing, one-shot recording,
  reading/rendering, the section data dictionary, and the measurement rules that make its
  token/timing numbers trustworthy), `areas/performance-log/persistent-store-and-sync.md` (the one
  shared, append-only, per-machine store every section lands in, and the automatic sync mechanism
  that populates it from real session activity without the operator running anything), and
  `areas/performance-log/cross-project-matrix.md` (the read-only cross-project rollup view built
  from that same store, grouped by last folder name). Ground truth is DERIVED (F8): pin `{46a56a4,
  docs/specs/performance-log.md, blob efdc9f2, ba-nine-section, 23 anchors (0 B / 11 R / 5 E /
  7 P), unparsed_blocks: 10}`, with the pre-migration source committed verbatim at
  `docs/history/okf-migration-f2/sources/performance-log.md`. The 10 unparsed blocks are the
  source's entire "Behaviors & Operations" section — 7 bold-lead paragraphs plus 3 of Measurement
  rules' own un-ided sub-bullets — and none is invented into an anchor (D10); their content still
  travels into whichever concept's topic it matches. The source's own text already separates
  "Populating the store (sync)" and "Building the matrix (read-only view)" into two distinct
  behavior paragraphs, so three concepts follows the source's own structure rather than forcing
  one; three concepts over 23 anchors and 226 source lines land anchors_per_concept at 7.67 and
  concepts_per_100_source_lines at 1.33, both inside the [0.5x, 2x] band across the five now-pinned
  "area"-shaped sources — a 2-concept shape (folding store+sync and matrix together) was checked
  first and found to put concepts_per_100_source_lines at 0.89, a 0.49x outlier just outside the
  band, confirming the 3-way split as the honest shape rather than a forced one. Fidelity:
  min/median/max 1.000 (verbatim re-homing). RED-FIRST: with the R4 claim deliberately removed from
  `sections-lifecycle-and-measurement.md`'s `bee.sources`, `--check performance-log` failed with
  the real coverage-loss finding (`LOST in concepts: R4`), then was restored to green. Coverage is
  machine-checked by `scripts/okf_migrate.mjs --check performance-log` (D35), now a chain suite.
