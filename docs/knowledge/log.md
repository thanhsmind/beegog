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
