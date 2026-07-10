---
area: feedback-digest
updated: 2026-07-10
coverage: full
sources:
  - docs/history/evolving-loop/ (cells evolving-1 … evolving-7, capped)
  - docs/history/evolving-loop/reports/review-slice-a.md
decisions:
  - 8cd4c84e (D1, D2 allowlist, D2b consumer revalidation, D3, D4, D5)
  - c45d0fb3 (a defect-encoding frozen assertion is unfrozen by the planner, never the worker)
  - b8fe5c81 (a drift guard that greps its own source pins syntax, not behavior)
---

# Feedback Digest

## Purpose

Each repository that runs the workflow accumulates a private record of how the work actually went:
friction that was hit, findings that were filed, debt that was named, cells that blocked, deviations
from plan, and lessons written down at the end.

The feedback digest turns that scattered record into **one safe, portable snapshot per repository**,
so the workflow's own maintainers can learn from real usage without ever reading the participating
projects' code.

Two properties define the area, and everything else follows from them:

1. **Producing a digest costs a project nothing.** It happens as a side effect of closing a feature.
   Nobody schedules it, and a failure to produce it never stops anyone's work.
2. **A digest is the only thing that crosses a repository boundary**, and the reader trusts none of
   it. The maintainers' repository reads other repositories' digests to decide changes to the
   workflow's own instructions — so a digest is treated as hostile input, not as a friendly export.

## Entry Points & Triggers

| Trigger | Who fires it | Result |
|---|---|---|
| A feature closes (the lessons record is written) | The closing routine, unprompted, every time | The repository's digest is regenerated from scratch |
| An operator asks for the digest directly | Operator | Same regeneration, written to a chosen location |
| An operator asks for a count only | Operator | Entry and drop counts reported, nothing written |
| An operator asks the maintainers' repository to collect | Operator | Every configured source repository's already-written digest is read and merged into one view |

The digest is **regenerated, never appended to**. It is a photograph of standing friction, not a
ledger. An append log would count the same friction once for every time it was re-observed and so
corrupt any measure of how often something hurts.

## Data Dictionary

A digest carries a schema version, the moment it was generated, the repository's label, counts, a
list of **dropped** records, and a list of **entries**.

### Entry — exactly six fields, and no others

| Field | Meaning |
|---|---|
| `kind` | What sort of record this is, from a closed vocabulary (below) |
| `layer` | Which layer of the workflow the record was attributed to, when the author bothered to say. Optional; frequently absent |
| `source` | Where the record came from: a work-item identifier, or a workflow-owned document path. Never project content |
| `title` | The short human-written label of the record |
| `first_seen` | When the record was first written |
| `pain` | How much this record hurt, as an integer (below) |

**There is no free-text field.** No description, no detail, no narrative, no reproduction steps.

This is the single most important rule in the area, and it was learned rather than designed. The
original intent was to carry the record's descriptive prose and strip code out of it. Measurement of
real repositories showed that such prose is ordinary sentences that happen to name functions, files,
and configuration keys — nothing that any code-stripping or secret-detection rule can find. The
surface was therefore **removed instead of filtered**, because a filter that cannot be trusted is
worse than no field at all: it advertises a guarantee it cannot keep.

### `kind` — the closed vocabulary

Repositories name their record types freely, and they diverge: one real repository invented eleven
type names and did not use the workflow's own canonical name for its most numerous class. So a raw
type is **translated** into a canonical kind. Canonical kinds and their meanings:

| Kind | Meaning |
|---|---|
| `friction` | Something repeatedly hurt while doing the work |
| `finding` | A defect or risk raised during review |
| `debt` | Known shortcut that will cost later |
| `audit` | A record produced by a housekeeping sweep |
| `deviation` | Execution departed from the agreed plan |
| `blocked` | A work item could not proceed |
| `learning` | A lesson written at the end of a feature |
| `proposal` | Something suggested but not yet decided |
| `outcome` | The recorded result of an earlier proposal |
| `approval` | A decision to proceed was granted |
| `correction` | Scope or direction was corrected mid-flight |
| `closed` | A record was retired |
| `harness-issue` | A defect in the workflow's own tooling |

A type that translates to none of these is **not silently discarded**. It is recorded as a drop with
the reason "unrecognized type" and counted, so an unknown vocabulary is visible rather than invisible.

### `pain` — an integer, computed once, never judged later

| Source of the record | `pain` |
|---|---|
| A review finding marked highest severity | 3 |
| … marked middle severity | 2 |
| … marked lowest severity | 1 |
| A lessons record marked high / medium / low importance | 3 / 2 / 1 |
| Everything else, including all plain friction | **1** |

`pain` is computed when the digest is written, not when it is read. If a reader judged pain, two
readings of the same digest could rank differently, and the ranking would stop being reproducible.

In practice `pain` is 1 for the overwhelming majority of records, because plain friction carries no
severity anywhere. This is honest and known: the field exists so that ranking is *possible and
deterministic*, not because it currently discriminates well.

### `dropped` — a list, not a number

Each dropped record carries the same identifying fields as an entry, plus a **reason**, drawn from:
`secret`, `injection`, `oversize`, `unrecognized type`.

It carries the reason **category only** — never the text that matched. A bare count would not
distinguish one careless author from a repository systematically probing the reader every time it
closes a feature.

## Behaviors & Operations

### B1 — Generating a repository's digest

**Triggers:** a feature closes; or an operator asks.

**What is read:** only the workflow's own records inside the repository — its friction and findings
list, its decision log, its work-item records, and its lessons documents. Every read is resolved
through a single gate that refuses any location outside the two workflow-owned areas, after
following every link to its true destination. A link that *appears* to sit inside a permitted area
but truly points elsewhere is refused and reported. A record location that does not exist is
**absent, not forbidden**: it is skipped, counted, and never treated as an error.

**What is emitted:** one entry per record, carrying only the six allowed fields.

**What blocks it:** nothing. A malformed record, an unreadable file, a work item with no execution
trace — each is skipped and counted. Generation cannot fail on bad input.

**What each actor observes:** the operator sees the entry count and the drop count broken down by
reason. The closing routine sees a warning if generation failed, and continues.

**Reproducibility:** generating twice from unchanged records yields an identical digest, except for
the generation moment. Ordering never depends on the order the storage happened to enumerate records.

### B2 — Collecting digests across repositories

**Triggers:** an operator asks the maintainers' repository to collect.

**What is read:** for each configured source repository, **only that repository's already-written
digest**. Never its raw records, never its code. The digest is the boundary; if the reader could
reach behind it, the boundary would exist nowhere.

**How the boundary is enforced.** The digest's location is followed to its true destination and must
still be an ordinary file inside the source repository's workflow-owned area. Then **every field of
every entry** is re-examined as hostile input:

- Values of the wrong shape become empty.
- The record type is re-translated through the closed vocabulary; an unknown type is dropped.
- Every text value is scanned for credentials and for text that tries to issue instructions. Any hit
  drops the whole entry, and the drop record's own fields are emptied so that the offending text is
  never stored either.
- The date value is accepted **only** if it matches a strict calendar format. It is not passed to a
  lenient interpreter, because lenient date interpreters ignore parenthesised text — which makes a
  date field a perfectly good smuggling channel.
- Every surviving text value is neutralized before it can ever be shown to a reader that acts on
  instructions.

**Why the reader distrusts the writer.** The producing repository scans its own records when it
writes them. That protects *that* repository from its own authors. It does not protect the reader,
who is a different party, reads a file the producer controls entirely, and uses what it reads to
change the workflow's own instructions. A digest edited by hand, or gone stale, or written with
intent, is just a file on disk.

**What blocks it:** nothing. A source repository that does not exist, cannot be read, has no digest
yet, or has a corrupt one, is warned about and skipped. One dead source never stops the reader.

**What each actor observes:** the operator sees, per source repository, how many entries survived and
how many were dropped with which reasons.

### B3 — Refreshing the digest when a feature closes

The closing routine regenerates the digest immediately after writing the lessons record, on every
run, without being asked and without anyone mentioning it.

If regeneration fails for any reason — the tool is missing, the command errors, the file cannot be
written — the routine emits **one warning line and continues**. This holds *regardless of whether the
failure is understood*. An unfamiliar error is still only a telemetry failure: the digest is a
read-only side effect that runs after all the feature's work is already finished and recorded, so it
cannot damage the feature.

If the refresh is skipped for any reason, the skip is **stated out loud** in the closing summary. A
silent omission is a violation even when the summary has no obvious place to put it.

## Actors & Access

| Actor | May |
|---|---|
| A repository using the workflow | Produce its own digest. It never reads anyone else's |
| The workflow's maintainers' repository | Read its own digest, and the written digests of repositories it explicitly lists |
| An operator | Trigger generation, ask for counts, trigger collection |

A repository is a source only if the maintainers list it. Listing accepts either a bare location or a
location with a friendly label; a location with no label is labelled by its own final path segment.

## Business Rules

- **R1** (D1) — Producing a digest is a side effect of closing a feature. A failing or absent
  refresh warns and never blocks, delays, or reverses a feature's close. Telemetry never stops
  someone else's work, and this holds even when the failure is not understood.
- **R2** (D2) — A digest carries the six allowed fields and nothing else. No free-text field exists.
  A field that is not allowed is removed rather than sanitized.
- **R3** (D2) — No location outside the two workflow-owned areas is ever opened, and containment is
  decided after following links to their true destination, not by comparing location names.
- **R4** (D2) — A record that cannot be made safe is dropped and counted, with its reason category
  recorded and its offending text never recorded.
- **R5** (D2b) — The reader re-validates every field of every entry it did not itself produce, and
  neutralizes every surviving text value before it can reach anything that acts on instructions.
  **Never trust a boundary artifact you did not produce.**
- **R6** (D2b) — A date is accepted only against a strict calendar format. Lenient interpretation is
  forbidden, because it silently ignores embedded text.
- **R7** — The reader's checks are never weaker than the writer's. Both construct records through one
  shared path, so a rule added on one side cannot be forgotten on the other.
- **R8** — **Every allowed field owns a declared validator.** The set of allowed fields is derived
  from the set of validators, so a field can never exist without one. This is the rule that closed a
  defect which had already survived two narrower fixes: each fix protected the fields someone
  remembered, and the next unremembered field was the next hole.
- **R9** — Translating a record's type is idempotent: translating an already-translated type returns
  it unchanged. Without this the reader rejects exactly the vocabulary the writer emits.
- **R10** — A digest is a snapshot, regenerated whole. It is never appended to.
- **R11** — Generation never fails on bad input. Malformed, unreadable, and absent records are
  skipped and counted.

## Edge Cases Settled

- A repository with no friction, no findings, and no lessons produces a valid, empty digest — it does
  not fail.
- A record location that does not exist is *absent*, and absence is not a containment violation. A
  location that exists but cannot be read, or that resolves outside its permitted area, still is.
- A work item with no execution trace is skipped and counted.
- A record whose text names an internal function, file, or configuration key is not a problem,
  because no such text is ever collected.
- A source repository that has never closed a feature has no digest; it is skipped, not an error.
- Two generations from unchanged records differ only in the recorded generation moment.

## Open Gaps

- **Ordering across machines.** Entries are ordered using a comparison that depends on the reading
  machine's language settings, while real record titles are not all in one language. Two machines may
  therefore order the same records differently. Reproducibility is proven only within one machine.
- **Neutralization is escapable.** The neutralizing wrapper marks text with delimiters but does not
  remove those delimiters from the text itself, so a value containing the closing delimiter escapes
  the wrapper. It also leaves text-direction override characters intact.
- **Credential and instruction detection is heuristic.** Several widely used credential formats and
  several ordinary phrasings of an instruction are not recognized. Detection reduces risk; it does
  not establish a boundary.
- **A foreign digest is read without a size limit**, so an enormous one exhausts the reader's memory —
  which contradicts the rule that one dead source never stops the reader.
- **`oversize` is a declared drop reason that nothing can currently produce**: over-long titles are
  shortened rather than dropped.
- **A digest has never been consumed by the process it exists to serve.** Nothing yet reads a merged
  digest and proposes a change to the workflow. The boundary is proven against payloads, not against
  a live reader.
- **The richest planned input is empty in practice.** In the only repository with substantial history,
  every single work item recorded no friction at all. Whether the digest carries enough signal to rank
  anything is unanswered until something tries.

## Pointers (implementation)

- Collector, boundary, and merge: `skills/bee-hive/templates/lib/feedback.mjs`
  (`ENTRY_FIELD_SPEC`, `resolveInScope`, `listInScope`, `buildDigest`, `mergeDigests`)
- Command surface: `skills/bee-hive/templates/bee_feedback.mjs` (`digest`, `count`, `collect`)
- Source-repository list: `.bee/config.json` → `dogfood_repos`, normalized in
  `skills/bee-hive/templates/lib/state.mjs`
- Credential / instruction patterns and the neutralizer: `skills/bee-hive/templates/lib/decisions.mjs`
- Close-time refresh: `skills/bee-compounding/SKILL.md` step 8
- Written artifact: `.bee/feedback-digest.json`
- Tests: `skills/bee-hive/templates/tests/test_lib.mjs` (108 assertions, incl. a table-driven payload
  sweep over every allowed field)
