# RED-first evidence — the preamble before f4-3

Captured 2026-07-22 by calling `buildSessionPreamble(repoRoot, {})` against the live repo (which
IS in bundle mode: 122 concepts, 11 areas) and printing only the two sections under change.

```
### Project map
- System overview: docs/specs/system-overview.md
- Reading map: docs/specs/reading-map.md
- Specced areas: 11 (docs/specs/ — read the spec before the code)
- PBI: 38 done / 3 in-flight / 22 proposed

### Critical patterns (digest)
---
area: critical-patterns
updated: 2026-07-22
migrated_to: docs/knowledge/patterns/
---
# Critical Patterns (migrated — pointer stub)
Bee's hard-won patterns now live as individual `bee.pattern` concepts in the knowledge bundle:
[`docs/knowledge/patterns/`](../../knowledge/patterns/index.md) (okf-foundation D20/D34/D37). Each
concept carries `bee.critical: true`, so the bundle's own generated root index
(`docs/knowledge/index.md`, "## Critical patterns" section, D21) is now the live equivalent of the
```

## What this proves

**The digest is dead weight.** Four of its ten lines are YAML frontmatter delimiters and keys; the
remaining six are the pointer stub's own redirect prose. Not one line is a lesson. Every session
since the pattern migration has paid this cost and received a forwarding address instead of the
patterns.

**The project map teaches the retired model.** It counts the read-only compatibility surface as
`Specced areas: 11` and instructs the reader to *"read the spec before the code"* — the exact
reading order G4 replaced with bundle-first, in a repo that has had a bundle since the migration.

## Feasibility note for the fix (D1)

`docs/knowledge/index.md` carries the `## Critical patterns` section at line 20, one markdown list
row per critical concept: `- [Title](patterns/<file>.md) — <one-line hook>`. The rows are in
**date order** (the concept filenames are date-prefixed), and there are ~50 of them — so a naive
"first N lines" against this section would surface the ten OLDEST lessons forever and never a
recent one.

**Refinement locked into D1:** the bundle-mode digest states the total count and lists the N most
recent rows, plus the path to the full index. It does not pretend to rank — relevance ranking is
`knowledge context`'s job and needs a work item to rank against, which the preamble does not have.
Newest-first is honest, cheap, and strictly better than an arbitrary alphabetical or file-order cut.
