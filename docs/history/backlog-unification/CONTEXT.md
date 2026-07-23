# backlog-unification — CONTEXT (locked decisions)

User request (2026-07-23, verbatim intent): why two backlog stores? `docs/backlog.md`
grows without bound, multi-session hand-edits of one file collide, and reading the
whole file burns tokens. Unify the concept and support concurrent sessions.

Measured pains (gather 2026-07-23): 72 data rows / 79 lines, paragraph-sized Story/CoS
cells; live statuses `declined` (P74) and `parked` (D13) sit OUTSIDE the machine enum
`BACKLOG_STATUSES = ['proposed','in-flight','done']` (backlog.mjs:13) so counts silently
drop them; ID allocation is "next free integer" executed by hand — already caused the
P50 duplicate incident (backlog.mjs:173-182); five skills flip rows by hand-editing the
shared table (scribing D8/close-sync, qualifying D13, exploring D11a, grooming, herding
reads Status as its dispatch interlock).

## Locked decisions

- **D1 — Two layers stay two layers; the unification is the PBI layer's storage.**
  `.bee/backlog.jsonl` (machine friction stream) is already append-only, CLI-guarded,
  multi-session-safe and token-cheap via the feedback digest — untouched. The product
  PBI layer is what gets rebuilt. The "one problem, two stores" impression dissolves
  because each layer's role is (re)stated where agents read: they never held the same
  items.
- **D2 — Per-item store + generated index (the knowledge-bundle pattern, reused).**
  Each PBI becomes one file `docs/backlog/items/P<n>.md` with frontmatter
  (`id, status, feature, opened, closed?`) and body (Story + CoS prose).
  `docs/backlog.md` becomes a GENERATED index with the exact `KNOWLEDGE_INDEX_HEADER`
  idiom (generated-file comment naming render + check commands; deterministic, no
  timestamps, path-sorted, LF): `proposed`/`in-flight`/`parked` render full rows;
  `done`/`declined` render one-line links only — the index stays short forever.
  Safety = purity + `--check` drift gate (no lockfile), same as knowledge.mjs.
- **D3 — CLI verbs replace every hand-edit.** Extend the `backlog` group:
  `pbi add` (mechanical next-free-ID allocation — kills the P50 bug class),
  `pbi status --id --to` (validated enum), `pbi list [--status] [--json]`
  (frontmatter-only read — the token-cheap query), `render --write|--check`
  (the index). Write-guard: `docs/backlog.md` + `docs/backlog/items/` become
  CLI-owned like `.bee/state.json` (direct edits denied, verb named in refusal).
- **D4 — Status enum matches reality:** `proposed | in-flight | parked | done |
  declined`. `readBacklogCounts`, rank, badges, `featureBacklogRank`, and the herding
  interlock re-derive from item frontmatter (or the generated index), never from a
  hand-table.
- **D5 — Migration is one script, one commit:** split the 72 existing rows into item
  files (status normalized incl. P74 `declined`), render the index, retarget
  `scripts/backlog_uniqueness.mjs` (uniqueness becomes id↔filename parity + index
  freshness — ground truth derived, never a second hand list). History rows keep their
  IDs; nothing renumbered.
- **D6 — Instruction layer migrates in the same feature** (the 2026-07-22 pattern):
  bee-scribing (D8 append + close-sync flip), bee-qualifying (D13 park flip),
  bee-exploring (D11a flip), bee-grooming (drift audit), bee-herding (Status
  interlock), scribing-reference "two backlogs" section, AGENTS.md working-files
  lines — all reworded to the CLI verbs; zero surfaces left teaching the hand-edit.

## Constraints (measured)

- backlog.mjs:150-344 carries rank/badges/counts/featureBacklogRank — all parse the
  markdown table today; every parser moves to the item store behind one shared reader.
- scripts/backlog_uniqueness.mjs is a mandatory verify suite (manifest floor) — must
  stay a suite, retargeted.
- bee-herding reads `docs/backlog.md` Status directly (SKILL.md:177,203,254) — its
  interlock must read the generated index or `pbi list --json`.
- Cells may carry an optional `pbi` field naming a row ID — unchanged (IDs stable).
- The generated index must keep the counts/badges data the README badges verb scrapes.

## Out of scope

- Any change to `.bee/backlog.jsonl`, feedback digest, clustering, or bee-evolving.
- A promote verb (jsonl finding → PBI); today's manual promote note stays; file as its
  own PBI if wanted later.
