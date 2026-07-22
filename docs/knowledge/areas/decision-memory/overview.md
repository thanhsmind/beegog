---
type: bee.area
title: Decision Memory — what the system remembers about its own decisions
description: "How a decision event is classified, reversed and reconciled against its citing artifacts, recalled through a derived index, kept bounded by an explicit archive, and honored by a backlog row's own done-flip rule — all one topic at this source's size."
timestamp: 2026-07-21
bee:
  id: decision-memory-overview
  lifecycle: active
  areas: [decision-memory]
  decisions: ["decision-propagation GH #32/#33/#34 (2026-07-21)", D1 b9b9fee3 (backlog CoS-gated done-flip), D2 b9b9fee3 (reversal citation sweep), D3 b9b9fee3 (citation discipline), "D4c b9b9fee3 (bounded store, archive verb)", "D5 b9b9fee3 (no stored graph, no daemon)", D6 b9b9fee3 (reversals inherit place), D7 c81c6795 (write-time classification + retro-tag reclassification), D8 1cea7713 (derived index recall surface), bee-scribing D11b, "bee-compounding fallback (identical, never-looser)"]
  sources: ["docs/specs/decision-memory.md#R1", "docs/specs/decision-memory.md#R2", "docs/specs/decision-memory.md#R3", "docs/specs/decision-memory.md#R4", "docs/specs/decision-memory.md#R5", "docs/specs/decision-memory.md#R6", "docs/specs/decision-memory.md#R7", "docs/specs/decision-memory.md#R8", "docs/specs/decision-memory.md#R9", docs/history/decision-propagation/reports/e2e-supersede.md, test_decisions_propagation.mjs (84 checks incl. worker-thread log-vs-archive race), "backfill: 406/406 legacy events classified via extraction batches; --untagged --all returns zero; 5-event recall spot check green"]
  authoritative_for: "decision-memory: what the system remembers about its own decisions"
---

# Decision Memory (what the system remembers about its own decisions)

What the system remembers about its own decisions, how a reversal propagates to
everything that cited the old truth, and how any session finds the decisions
that matter without re-deriving dead conclusions. At this source's size (nine
rules, no Behaviors/Edge Cases/Pointers sections) the area is one coherent
topic rather than several — every rule below governs the same store, the same
index, and the same reversal path, so splitting it further would shred it past
usefulness rather than clarify it.

## The problem this area solves

Three field failures (reported against a host repo, fixed generically):

1. A reversed decision lived only in the log; the artifacts sessions actually
   read (tickets, backlog rows, specs) still stated the old conclusion — every
   new session re-derived it (#33).
2. A backlog row flipped `done` when a feature merely *matched* it, never
   checking the row's Conditions of Satisfaction — partial delivery silently
   read as full (#34).
3. The decision store outgrew substring grep: no classification, no
   completeness guarantee on recall (#32).

## Business Rules

- **R1 — Every decision event is classified at write time** (D7, `c81c6795`). A
  canonical taxonomy (`docs/decisions/taxonomy.json`, entries `{name,
  description}`) governs tags. Once the taxonomy exists, an untagged
  decide/supersede is refused with a typed error; before it exists (bootstrap),
  untagged writes warn and proceed. An unknown tag is never refused — it is
  accepted onto the event and appended to `candidates[]` for later curation.
  `candidates[]` never holds an already-canonical tag.
- **R2 — Reversal is not finished until citing artifacts are reconciled** (D2,
  `b9b9fee3`). A supersede computes a citation sweep over `docs/**` (full id +
  word-boundary short8) BEFORE its single append; the event carries the sweep
  result. Every hit is reconciled same-turn or explicitly waived with a
  recorded reason; each hit also becomes a capture stub so an unreconciled
  citation resurfaces at every flush. Historical records (reports) are
  reconciled by appended dated correction notes, never by rewriting history.
- **R3 — Reversals inherit their place** (D6, `b9b9fee3`). A supersede without
  explicit tags/scope inherits both from the (overlay-applied) decision it
  supersedes, so the reversal is discoverable exactly where the original
  lived.
- **R4 — Memory is re-classifiable without rewriting history** (D7, `c81c6795`).
  Retro-tag events (`decisions tag`, single or batch) are append-only; reads
  apply a latest-wins overlay (tags replace, scope only when carried). No
  stored line is ever edited.
- **R5 — The derived index is the recall surface** (D8, `1cea7713`).
  `docs/decisions/index.md` is regenerated, never hand-edited, grouped scope →
  first tag, superseded events excluded, byte-stable for the same store,
  complete by construction. Reading order per area: spec → decision index
  section → history. Search offers structured filters (`--tag`,
  `--scope`/`--area`, `--since`, `--untagged`, `--all`) and multi-term OR
  ranking; bare substring grep is fallback, never the recall path.
- **R6 — The store stays bounded** (D4c, `b9b9fee3`). An explicit archive verb
  moves superseded/redacted and aged-out events (explicit cutoff, never a
  default purge) to an archive file; union reads (`--all`) reach both and
  de-duplicate by id (active copy wins — which also self-heals a crash between
  the two archive writes). All store writers share one lock; append-only
  integrity is absolute.
- **R7 — A backlog row flips `done` only when every CoS clause has cited
  evidence** (D1, `b9b9fee3`; rule text lives in bee-scribing D11b and
  bee-compounding's identical, never-looser fallback). Partial delivery keeps
  the row `in-flight` with a `Delivered:`/`Remaining:` annotation; splitting
  the remainder into a new row is allowed when the delivered subset ships
  alone; silent full-flip never.
- **R8 — Citation discipline** (D3, `b9b9fee3`). An artifact that encodes a
  decision cites its short8 id — that is what makes R2's sweep able to reach
  it. Uncited embodiments are the accepted residual risk.
- **R9 — No stored graph, no daemon** (D5, `b9b9fee3`). All consistency is
  derived at read/mutation time; a second source of truth is exactly the
  failure mode this area exists to kill.

## Data dictionary

- **Decision event** — append-only record: `decide` (id, date, decision,
  rationale, alternatives, scope, source, confidence, tags[]), `supersede`
  (adds `supersedes`, `sweep`), `redact`, `tag` (target, tags[], scope?).
- **Taxonomy** — `docs/decisions/taxonomy.json`: `tags[] {name, description}`
  (canonical, human-curated) + `candidates[]` (strings awaiting promotion;
  CLI-appended).
- **Scope** — the area dimension (spec-area slug; legacy default `repo`).
- **Sweep** — `{scanned_at, hit_count, files[]}` recorded on the supersede
  event.
- **Index** — `docs/decisions/index.md`, provenance-headed, timestamp-free
  body; `--check` mode exits non-zero on drift.
- **Delivered subset** — the evidenced portion of a row's CoS at a refused
  flip (R7 annotation).

## Proven behavior (evidence anchors)

- Live e2e (2026-07-21): supersede of `d20f4c96` → `257ab1e5` — sweep 2 hits, 1
  reconciled, 1 waived with reason, stubs created/flushed, index self-corrected.
  `docs/history/decision-propagation/reports/e2e-supersede.md`.
- Backfill: 406/406 legacy events classified via extraction batches;
  `--untagged --all` returns zero; 5-event recall spot check green.
- Store/CLI behavior: suite `test_decisions_propagation.mjs` (84 checks incl.
  worker-thread log-vs-archive race) + full verify.

## Actors & Access

- **A session** — writes decision events (decide/supersede/redact/tag), reads
  the derived index before re-deriving a conclusion, and reconciles any
  citation hit a supersede's sweep surfaces.
- **The taxonomy** — `docs/decisions/taxonomy.json` — governs which tags are
  canonical; an unknown tag is accepted onto an event and appended to
  `candidates[]` for later curation, never refused.
- **bee-scribing / bee-compounding** — hold the backlog done-flip rule text
  (R7) as their own, identical, never-looser fallback.
- **The archive** — receives superseded/redacted and aged-out events at an
  explicit cutoff; union reads (`--all`) reach both the active store and the
  archive and de-duplicate by id.
