<!--
GENERATED FILE — do not hand-edit.
Rendered by `bee knowledge index` from concept frontmatter inside docs/knowledge/ (okf-foundation D21).
Regenerate: `bee knowledge index`. Check freshness: `bee knowledge index --check`.
Deterministic: byte-identical for the same bundle contents — path-sorted entries, LF endings,
never a generation timestamp or any other wall-clock value.
-->

# areas/verify-pipeline/

## Concepts

- [Verify Pipeline — concurrency safety and hermetic runs](concurrency-and-hermetic-runs.md) — Keeping whole-tree regeneration lock-serialized and atomic-swapped, keeping every child suite hermetic to session identity, and the deterministic race/isolation proofs that back both claims.
- [Verify Pipeline — suite topology and discovery](suite-topology-and-discovery.md) — Keeping full-repo verification fast and contention-free by giving every module its own suite file, discovering suites by convention instead of a hand-registry, and failing loudly the moment a curated suite goes missing.
