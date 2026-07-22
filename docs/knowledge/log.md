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
