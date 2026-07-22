<!--
GENERATED FILE — do not hand-edit.
Rendered by `bee knowledge index` from concept frontmatter inside docs/knowledge/ (okf-foundation D21).
Regenerate: `bee knowledge index`. Check freshness: `bee knowledge index --check`.
Deterministic: byte-identical for the same bundle contents — path-sorted entries, LF endings,
never a generation timestamp or any other wall-clock value.
-->

# areas/performance-log/

## Concepts

- [Performance Log — Cross-Project Matrix](cross-project-matrix.md) — The read-only, per-project rollup view built from the shared persistent log, needing no prior tracking and grouped so different checkouts of the same project collapse into one row.
- [Performance Log — Persistent Store and Automatic Sync](persistent-store-and-sync.md) — Automatically rolling up every project's coding-session activity into one shared, append-only, per-machine log — safe to re-run, and never in the way of a session ending.
- [Performance Log — Sections: Lifecycle and Measurement](sections-lifecycle-and-measurement.md) — Opening, closing, and one-shot recording of a named piece of work; what a section captures; and the measurement rules that make its token and timing numbers trustworthy.
