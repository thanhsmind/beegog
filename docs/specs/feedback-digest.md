---
area: feedback-digest
updated: 2026-07-10
coverage: full
sources:
  - docs/history/evolving-loop/ (cells evolving-1 … evolving-11, capped)
  - docs/history/evolving-loop/reports/review-slice-a.md
  - docs/history/evolving-loop/reports/review-slice-b.md
decisions:
  - 8cd4c84e (D1, D2 allowlist, D2b consumer revalidation, D3, D4, D5)
  - c45d0fb3 (a defect-encoding frozen assertion is unfrozen by the planner, never the worker)
  - b8fe5c81 (a drift guard that greps its own source pins syntax, not behavior)
  - 0022 (ranking, the comparison-form rule, the self-improvement process gates)
  - c75fed88 (two acknowledged open findings at review close, filed to the friction backlog)
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

### B4 — Ranking the collected view

**Triggers:** an operator asks for a ranking; or the self-improvement process (below) starts.

**What it does.** All entries — local and collected — are grouped by what their title *means*, then
each group is scored and the groups are returned most-pressing-first.

- **Grouping ignores the safety wrapping.** A collected entry's title arrives wrapped in
  neutralization marks; the same title recorded locally is bare. Grouping compares an internal
  cleaned form of the title (wrapping removed to a fixed point, the same neutralization cleanups
  applied, case and spacing normalized), so wrapped and bare twins — and even double-wrapped ones —
  land in one group. The stored titles themselves stay wrapped; only the invisible comparison form
  is cleaned.
- **Score** = the group's highest severity × how many entries it holds × how many distinct
  repositories contributed (the local repository counts as one). Ties are broken by earliest first
  observation, then by the comparison form — so the same records always rank in the same order.
- **A group whose entries carry no severity scores at the floor value (one), never at zero** — a
  hole in the data must not bury a group.

**What blocks it:** nothing new — it consumes only the already-validated collected view (B2) and
reads nothing itself.

**What each actor observes:** the operator sees each group's representative title (**still wrapped
exactly as stored**), its score and score components, and where its entries came from. The internal
comparison form exists only to group; it is never meant for display, because displaying it would
undo the neutralization the reader applied (see Open Gaps — today the machine-readable output still
carries it).

### B5 — The self-improvement process

The maintainers' repository can run a gated process that turns the ranked groups into a shipped
improvement of the workflow itself: rank → a human chooses **what** to fix → the fix is built under
the discipline that a failing check exists before any content → the checks pass → a human approves
**the exact change** → publication as a deliberate, named, manual step.

The process refuses to run anywhere but the maintainers' repository, refuses to skip either human
choice, and never publishes on its own. Approval of a plan, a schedule, a standing rule, or a
previous change never counts as approval of the next publication.

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
- **R12** (0022) — A neutralization-wrapped title and its bare twin are **the same title** for
  grouping. The comparison uses an internal cleaned form; the stored value keeps its wrapping.
- **R13** (0022) — The internal comparison form is never displayed and never placed where something
  that acts on instructions can read it — showing it would strip the reader's own neutralization.
  (Enforced in the process's instructions today, not yet in the tool — see Open Gaps.)
- **R14** (0022) — Ranking is deterministic: the same collected view always yields the same order.
  Severity × occurrences × distinct contributing repositories, ties broken by earliest first
  observation then the comparison form.
- **R15** (0022, D3, D5) — The self-improvement process runs only in the maintainers' repository,
  only on demand, with two human decisions (what to fix; approve the exact change), and never
  publishes automatically. No standing rule or prior approval transfers.

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
- **The internal comparison form leaks into the machine-readable ranking output** (acknowledged at
  review close, 2026-07-10, decision `c75fed88`): the ranked groups carry the cleaned, unwrapped
  form of every title alongside the wrapped one, so a consumer that dumps the raw output re-exposes
  what the reader neutralized. Keeping it out of a prompt currently rests on the process's written
  instructions, not on the tool. Fix filed in the friction backlog.
- **The grouping's cleanup rules are a hand-copied twin of the neutralizer's** (same acknowledgment):
  if the neutralizer's cleanups are ever extended, wrapped and bare twins silently stop grouping and
  nothing goes red. Fix (one shared cleanup, plus a coupling check) filed in the friction backlog.
- **Accent-form twins do not group.** The same title written with composed vs decomposed accented
  characters (common across editors and platforms, and this corpus is bilingual) produces two groups.
- **A title that is only wrapping, or a title legitimately quoted with the wrapping marks, may
  collapse toward the empty comparison form** and falsely group.
- **The severity floor and the missing-date tie-break are believed but untested** — the behavior is
  read from the implementation; no check pins it.
- **Cross-repository corroboration is real but inert in practice**: measured on the live two-repository
  corpus, no group spans both repositories (titles are in different languages), so the distinct-repository
  factor is one everywhere until two repositories share a friction.

## Pointers (implementation)

- Collector, boundary, merge, and ranking: `skills/bee-hive/templates/lib/feedback.mjs`
  (`ENTRY_FIELD_SPEC`, `resolveInScope`, `listInScope`, `buildDigest`, `mergeDigests`,
  `normalizeTitle`, `clusterEntries`, `rankClusters`)
- Command surface: `skills/bee-hive/templates/bee_feedback.mjs` (`digest`, `count`, `collect`, `rank`)
- The self-improvement process: `skills/bee-evolving/SKILL.md`; contract in `docs/07-contracts.md`;
  decision record `docs/decisions/0022-evolving-loop.md`
- Source-repository list: `.bee/config.json` → `dogfood_repos`, normalized in
  `skills/bee-hive/templates/lib/state.mjs`
- Credential / instruction patterns and the neutralizer: `skills/bee-hive/templates/lib/decisions.mjs`
- Close-time refresh: `skills/bee-compounding/SKILL.md` step 8
- Written artifact: `.bee/feedback-digest.json`
- Tests: `skills/bee-hive/templates/tests/test_lib.mjs` (124 assertions, incl. a table-driven payload
  sweep over every allowed field, the ranking matrix, and a control-byte sweep over vendored sources)
