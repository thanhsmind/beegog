---
type: bee.area
title: "Bee OKF Profile — the context consumer, the promote proposer, and the session preamble"
description: "The budget-aware manifest a work item's curated context is returned as, the measured relevance ranking that cuts critical patterns without losing one, the propose-never-write loop closer, and the preamble that makes the bundle load-bearing."
timestamp: 2026-07-22
bee:
  id: okf-profile-context-and-promote
  lifecycle: active
  areas: [okf-profile]
  required_context: [areas/okf-profile/overview.md]
  decisions: [D2, D10, D12, D13, D27, D38, "G5/G11 (okf-switchover-f3 — critical patterns ranked, cut, floored and conserved)"]
  sources: ["okf-foundation cell okf-9 (`bee knowledge promote` — the propose-never-write loop closer, B5; trace in `.bee/cells/`, 2026-07-22)", "okf-foundation cell okf-6 (critical-patterns.md -> patterns/ migration, work/okf-foundation/ work item + plan concepts, Templates section; trace in `.bee/cells/`, 2026-07-22)", CONTEXT.md `docs/history/okf-foundation/CONTEXT.md`, "docs/specs/okf-profile.md#B5", "docs/specs/okf-profile.md#B6", "docs/specs/okf-profile.md#B6b", "docs/specs/okf-profile.md#B7", "docs/specs/okf-profile.md#P2", "docs/specs/okf-profile.md#P3"]
  authoritative_for: "okf-profile: the context consumer, the promote proposer, and the session preamble"
---

# Bee OKF Profile — The Context Consumer, the Promote Proposer, and the Session Preamble

This concept owns the two verbs that read the bundle on a work item's behalf — `context`, which
returns an ordered manifest inside a budget, and `promote`, which proposes the knowledge finished
work earned and never writes it — plus the session preamble that makes the bundle load-bearing
rather than optional.

## Behaviors & Operations

**B5 — `promote` proposes; it never writes (D38).** `bee knowledge promote --work <id>` resolves
the work item by `bee.id` (the same resolution `context` performs — an unresolvable id exits 1 with
a typed `unknown_work` error), then mines the **capped** cells of that feature from `.bee/cells/`
and returns exactly three sections:

| Section | What it proposes | Where every line comes from |
|---|---|---|
| **(a) Delivery draft** | A complete `bee.delivery` concept **in canonical emitter form**, ready to be saved as the work item's `delivery.md` sibling: what shipped, how it was verified, every recorded deviation. Because it is emitted through `emitFrontmatter`, saving it produces zero `not_canonical` findings. | Each cell's `trace.outcome`, `verify` command and `trace.verification_evidence`; the work item's own title, tags, `bee.decisions`, `bee.areas`, `bee.lane`. |
| **(b) Area updates** | For each area named in the work item's `bee.areas`, the capped **`behavior_change`** cells whose `files_changed` touch that area's subject — its concepts' own paths and their `bee.sources` — as candidate spec-sync bullets, each citing its cell id. | `trace.files_changed` matched against bundle concept paths and `bee.sources`. |
| **(c) Pattern candidates** | Every capped cell whose trace carries a **deviation** or a **failure signature**, shaped as a candidate `bee.pattern` concept with `bee.polarity: pitfall` and `bee.lifecycle: draft`, quoting the trace verbatim. A clean cell yields nothing. | `trace.deviations`, `trace.attempts[].failure_signature`, `trace.semantic_judge[].failure_signature`. |

The `--json` payload is `{work, work_item, cells, delivery, area_updates, pattern_candidates,
writes}`, and **`writes` is always `[]`** — the machine-readable form of the contract. There is no
`--apply` flag and no write path of any kind: `promote` never touches `docs/knowledge/`, never
touches `.bee/*.json(l)`, and never touches anything else. Deciding to save a proposal — and
editing it into curated prose first — is a human or agent decision.

**B6 — `context` returns a manifest, never content (D27).** `bee knowledge context --work <id>
--budget <tokens>` resolves the work item by `bee.id`, walks its `bee.required_context`
**transitively** with a cycle guard that dedupes silently (a cycle is never an error), adds every
concept with `bee.critical: true` and the bundle's `bee.decision` concepts whose `bee.areas`
overlap the work item's, ranks them, and cuts at the budget. The order is fixed: the work item, its
`bee.plan` sibling, `required_context` in BFS depth order, critical patterns, then area decisions.
Each entry carries `path`, `bytes`, `est_tokens` and a one-line `reason` naming *why* it was
selected (and, for a required_context hit, *through which parent*) — and **nothing else**: the
manifest never contains file bodies, because its whole purpose is to spend a few dozen tokens
instead of thousands. The budget cut is a **prefix cut** with one named exception (B6b): the first
overshooting entry ends the manifest, and it plus every lower-ranked entry is named in `truncated`,
so the output always means "the highest-ranked context that fits". The estimator is `bytes/4` and
the output **names itself as an estimate** — bee vendors no tokenizer (D12), so the number is never
dressed up as a token count. An unresolvable id exits 1 with a typed `unknown_work` error.

**B6b — critical patterns are ranked by relevance, cut, floored and conserved (G5/G11).** D27's
original "include every critical pattern" rule was written when three patterns existed. At 49 it
inverted: on the first real run, 40 of 45 manifest entries were critical patterns consuming 13,000
of 19,726 tokens, most of them unrelated, with 7 more truncated for lack of room — so an irrelevant
pattern could evict a relevant one, and the consumer built to stop context waste had become its
largest source.

The replacement ranks the critical concepts against the work item and cuts them to
`CRITICAL_RELEVANCE.KEEP`. **The relevance signal was chosen by measurement, not intuition.** Tag
overlap — the obvious candidate — is disqualified: measured against the live bundle it left 48 of
49 patterns tied at zero (AUC 0.550 against hand labels; `bee.areas` overlap 0.500, i.e. a coin
flip). The shipped signal is the **IDF-weighted fraction of a concept's own distinctive vocabulary
that the work item's text covers**, scored over two fields (title/description/tags, and body), plus
a small tag and area bonus: AUC 0.805, no ties, no zeros. IDF is computed over the ranked population
itself, so no word list ships. Widening the query with the `required_context` bodies was measured
and **rejected** — it dilutes the work item's own vocabulary (AUC 0.751 → 0.615).

Three properties make the cut safe to trust:

- **Floor.** The top `CRITICAL_RELEVANCE.FLOOR` criticals have their cost reserved out of the budget
  remaining after rank 1, so a genuinely universal lesson is never evicted by a long
  `required_context` chain — while the work item itself is never displaced by its own floor. The
  budget stays a hard ceiling: `total_est` never exceeds it, and a zero budget still includes
  nothing.
- **Conservation.** Every `bee.critical` concept is accounted for exactly once — in `entries` (whose
  `reason` names its score and rank), in `truncated`, or in `excluded` as `{path, score, reason}`.
  `critical_total` states the population and the assembler *throws* rather than lose one. A silent
  exclusion is worse than the noise it replaces: the failure being fixed was loud, and it must not
  be traded for a quiet one where a pattern that would have prevented a bug is simply absent.
- **Zero-signal guard.** `zero_signal_count` is always reported. When the population is at least
  `ZERO_SIGNAL_MIN_POPULATION` and more than `ZERO_SIGNAL_MAX_RATIO` of it scores zero, the run
  **fails** with a typed `zero_signal` error. A ranking where most items tie at zero is a path sort
  wearing a relevance label, and shipping it green is the defect — the guard exists so a future
  signal cannot rot into one silently. Below that population the count is reported but not enforced:
  a two-concept bundle is not a ranking problem.

Ties break by path, so the order is total and two runs over the same bundle are byte-identical.

**B7 — The session preamble makes the bundle load-bearing.** A tool nobody calls is a directory
rename. When `.bee/state.json`'s active feature has a matching `bee.work-item` concept, the session
preamble emits a three-line block naming the exact runnable `context` command and instructing the
session to read the manifest's files before touching code. Three rules keep it honest: the preamble
carries the **pointer, never the manifest** (embedding it would defeat the purpose); a feature with
no matching work item produces **silence, not a nag**; and a terminal phase (`idle`,
`compounding-complete`) produces nothing even when a stale `feature` string outlives the closed
feature — the phase, not the feature name, decides.

## Business Rules

- **`promote` proposes; it never writes (D38).** Finished work is allowed to *suggest* knowledge —
  a delivery draft, area bullets, pitfall candidates — and is never allowed to *commit* it. No
  section `promote` emits is written to disk by `promote`; accepting one is a human or agent
  decision, and `writes: []` in the payload states that in machine-readable form. The reason is the
  same one behind D10's never-invent rule: a proposal that writes itself into the bundle arrives
  reading as curated truth and is then trusted, without anyone having judged it.
- `promote` invents nothing: every proposed line is copied from a capped cell trace or from the
  work item concept (D10). A cell that was never capped, and a cell belonging to another feature,
  are never mined.

## Pointers (implementation)

- Proposal builder (B5): `buildPromotion` in the same module, with `readCappedCellTraces` as its
  read-only view of `.bee/cells/`. Neither function writes; the CLI handler
  (`handleKnowledgePromote` in `.bee/bin/bee.mjs`) only prints what they return.
- CLI wiring: `.bee/bin/lib/command-registry.mjs` (the `knowledge` group) +
  `.bee/bin/bee.mjs` dispatch (`HANDLERS`).
