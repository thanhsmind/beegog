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
