# backlog-unification — CONTEXT (locked decisions, v2)

User request (2026-07-23): unify the backlog concept, support many concurrent
sessions, stop paying whole-file token reads. **v2 pivot (user, mid-validating):
"tôi thích khái niệm backlog.jsonl"** — the append-only machine store IS the
unified backlog: in bee's own repo it holds bee-improvement items; deployed into a
real project it holds that project's items. One concept everywhere, with generated
IDs that never collide however many sessions run at once. v1's per-item-markdown
design (superseded below) is replaced by event-sourcing into the existing stream.

Measured pains (gather + plan-check, 2026-07-23): 76 unique P-ids (not 72/73 as
first counted), max P77; three rows carry decorated status cells (`P8`, `P13`,
`P32`) that exact-enum matching silently miscounts today; live statuses `declined`
(P74) and `parked` (D13) sit outside `BACKLOG_STATUSES`; hand ID allocation already
produced the P50 duplicate; five skills hand-edit one shared table;
`classify-lane.mjs` (herding's hard-gate classifier) reads row prose the short
index would no longer carry — it must read the store, not the view.

## Locked decisions (v2 — supersedes v1 D1-D6 of this feature)

- **D1 — ONE store: `.bee/backlog.jsonl`.** Append-only, CLI-owned (write-guard
  already names `backlog add` as sole writer — the new verbs join it). PBIs are
  **event-sourced records in the same stream**: `{ts, kind:"pbi",
  event:"add"|"status"|"amend", id, ...fields}`; current state = fold by id,
  last-event-wins per field. Friction/feedback events keep their existing shape
  untouched; `collectFeedback`/digest skip `kind:"pbi"` lines explicitly (never
  bucketed as unknown_type). In a host repo the same stream is simply that
  project's backlog — the two-concept split dissolves by unification, not by
  another parallel store.
- **D2 — IDs are generated, collision-free under concurrency.** New PBIs get
  `p-<8 hex>` from crypto randomness at `pbi add` — no read-then-increment, no
  lock, no coordination; the fold refuses a duplicate id defensively. Legacy
  `P<n>` ids are preserved verbatim by migration and stay first-class (cells'
  optional `pbi` field keeps pointing at them).
- **D3 — CLI verbs replace every hand-edit.** `backlog pbi add` (title/cos/
  status?/feature? → add event, prints the generated id), `backlog pbi status
  --id --to <enum> [--feature <slug>]` (status event; `--feature` stamps the slug
  — the exploring-D11a flip needs both in one move), `backlog pbi amend --id`
  (title/cos), `backlog pbi list [--status] [--json]` (the fold — the token-cheap
  query), `backlog render --write|--check` (the generated `docs/backlog.md` view).
  **`backlog rank --write` is retired** (the deterministic render owns the view;
  a second writer was the double-truth trap); `badges` re-derives counts from the
  fold. `docs/backlog.md` becomes CLI-owned in the write-guard (exact-path deny,
  same early-return branch as `.bee/state.json` — plan-check confirmed this does
  not disturb the docs-lane exemption for the rest of docs/).
- **D4 — status enum matches reality:** `proposed | in-flight | parked | done |
  declined`; counts/preamble include every value.
- **D5 — migration is one script, one commit, real numbers.** Fold all **76**
  legacy rows into `pbi` add(+status) events (P-ids kept; decorated statuses
  normalized to the enum with their decoration preserved in the item's cos/notes,
  never dropped — P8/P13/P32; status-anchored parsing, never positional — Story/
  CoS cells contain literal `|`). Then `render --write` produces the generated
  `docs/backlog.md` (proposed/in-flight/parked as full rows; done/declined as
  one-line links — the view stays short forever). `scripts/backlog_uniqueness.mjs`
  retargets (same path/name — manifest pins it, arg-variant `--check` included):
  fold invariants (unique ids, valid enum, every event parseable) + render
  freshness.
- **D6 — instruction layer + missed consumers migrate in the same feature.**
  bee-scribing (D8 append + close-flip), bee-qualifying (D13 park), bee-exploring
  (D11a flip incl. `--feature`), bee-grooming (drift audit), bee-herding (§6
  Status interlock **and** §6(a) slug read **and** §7 impact-text — its documented
  table schema is stale and gets fixed), **`skills/bee-herding/scripts/
  classify-lane.mjs`** (the plan-check P1: it keyword-scans row prose — retarget
  to `pbi list --json` fold output, enum updated), scribing-reference "two
  backlogs" section rewritten to the one-store model, AGENTS.block.md + root
  working-files lines byte-parallel. Zero surfaces left teaching the hand-edit.

## Constraints (measured, carried from plan-check)

- backlog.mjs twins byte-identical (test_lib_mirror); all five current exports are
  covered by templates/tests/test_backlog_capture.mjs:22-32 — extend, not new.
- `KNOWLEDGE_INDEX_HEADER` is module-private (knowledge.mjs:1100) — copy the
  idiom into the render, command strings swapped to `bee backlog render`.
- `DIRECT_EDIT_DENY` (guards.mjs:152) is exact-path, checked first in checkWrite
  (:576) — `docs/backlog.md` is one exact key; no prefix branch needed (no item
  files in v2).
- `okf_instructions_fence.mjs:506` writes a backlog.md fixture — confirm temp-root.
- inject.mjs/status/badges/featureBacklogRank/cells.mjs all flow through
  backlog.mjs exports — one rework point.

## Out of scope

- feedback digest/clustering/evolving semantics (only the explicit kind:"pbi"
  skip is added); a promote verb (friction → pbi) — its own PBI later.
