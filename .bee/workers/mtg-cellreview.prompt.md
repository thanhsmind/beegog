# Fresh-eyes cell review — feature model-tier-guard

You are a fresh-eyes cell reviewer with NO session history. Work from the repository root.
For each of the four cells `.bee/cells/model-tier-guard-1.json` … `model-tier-guard-4.json`,
answer: could a worker who has read only docs/history/model-tier-guard/plan.md and this
cell implement and verify it without guessing? (This feature has no separate CONTEXT.md —
plan.md's Scoping synthesis section carries the locked decisions.)

Actually run each cell's `verify` command's SYNTAX sanity where possible without changing
files (e.g. `bash -n` equivalence: check quoting/escaping by eye; do NOT execute verify
commands that require artifacts not yet built — instead judge whether they WILL run once
the artifact exists). Read budget: plan.md + the 4 cell files + any file a cell's
read_first names. Output cap ~120 lines.

Flag CRITICAL: assumed context, vague acceptance, scope overload, unproven feasibility,
broken verify command (bad quoting/escaping counts as broken).
Flag MINOR: missing rationale, implicit file assumption, fuzzy boundary, known tradeoff
not recorded.

As your LAST act, write the report to `.bee/workers/mtg-cellreview.result.md`, first line
`OUTCOME: done` (or `OUTCOME: blocked` + reason), then:

CELL REVIEW REPORT
Cells reviewed: N
CRITICAL FLAGS: <cell-id> problem / evidence / fix
MINOR FLAGS: <cell-id> problem / evidence / suggestion
CLEAN CELLS: ...
SUMMARY: 2-3 sentences

Do not modify any other file.
