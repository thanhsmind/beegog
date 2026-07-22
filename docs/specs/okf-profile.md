---
area: okf-profile
updated: 2026-07-22
sources: [okf-foundation cell okf-1 (knowledge.mjs core — emitter-first frontmatter codec, concept model, two-level check verb; trace in `.bee/cells/`, report `docs/history/okf-foundation/reports/`, 2026-07-22); okf-foundation cell okf-2 (bundle skeleton + this spec, 2026-07-22); okf-foundation cell okf-6 (critical-patterns.md -> patterns/ migration, work/okf-foundation/ work item + plan concepts, Templates section; trace in `.bee/cells/`, 2026-07-22); okf-foundation cell okf-9 (`bee knowledge promote` — the propose-never-write loop closer, B5; trace in `.bee/cells/`, 2026-07-22); CONTEXT.md `docs/history/okf-foundation/CONTEXT.md`]
decisions: [D2, D4, D10, D11, D12, D13, D17, D18, D19, D20, D21, D23, D24, D27, D29, D30, D31, D32, D33, D34, D35, D36, D37, D38]
coverage: partial
---

# Bee OKF Profile

## Purpose

The Open Knowledge Format (OKF) v0.1 is deliberately permissive: `type` is its only required
field, consumers MUST tolerate unknown types, MUST NOT reject unknown fields, and MUST tolerate
broken links (OKF §5, §8). That permissiveness is right for a spec meant to fit many organizations,
but it gives an agent nothing to check. The **Bee OKF Profile** is the closed layer bee adds on top:
a nine-type vocabulary, a fixed field set with an identity/path direction, authority-uniqueness
rules, and a two-level validator (`bee knowledge check`) that turns "is this bundle in good shape"
into a machine-checkable question instead of a matter of taste.

**The profile is bee's own contract, not a standard.** OKF profiles are an open, unratified
proposal — `https://github.com/GoogleCloudPlatform/knowledge-catalog/issues/212` — not yet
standardized by the spec's maintainers. Nothing in this document binds any bundle outside this
repository; a different OKF consumer is free to define its own profile, or none.

## Entry Points & Triggers

- `bee knowledge check [--strict] [--json]` — the profile validator; every `knowledge` verb
  supports `--json` (D13). Walks **only** `docs/knowledge/` and never touches a file outside it
  (D23); a missing or empty bundle passes.
- `bee knowledge index [--check] [--json]` — regenerates every `index.md` inside the bundle from
  concept frontmatter (D21); `--check` re-renders in memory and fails naming any stale file.
- `bee knowledge list [--type T] [--lifecycle L] [--area A] [--json]` — one row per concept (path,
  id, type, lifecycle, title), never file content (D15).
- `bee knowledge context --work <id> --budget <tokens> [--json]` — the budget-aware consumer (D27):
  the curated context for a work item, as an ordered **manifest**, never content (B6 below).
- **The session preamble** (`inject.mjs`) — when the active feature has a matching `bee.work-item`
  concept, the preamble names the `context` command and instructs the session to load its manifest
  before touching code (B7 below). This is the trigger that makes the bundle load-bearing rather
  than optional.
- `node scripts/run_verify.mjs` — the verify chain `knowledge check` and `knowledge index --check`
  both join (D34); a profile violation fails the chain the same way any other suite does. The
  per-migration coverage gates (`scripts/okf_migrate.mjs --check <area>` and `--check-patterns`,
  D35) join the same chain, one entry per migrated source.
- `bee knowledge promote --work <id> [--json]` — the loop closer (D38): finished work **proposes**
  the knowledge it earned. It reads the work item's concept and the **capped** cell traces of that
  feature from `.bee/cells/*.json` (a read of the runtime store — D2 permits reads and forbids
  writes) and prints three proposals: a delivery draft, candidate area spec-sync bullets, and
  candidate pitfall patterns. It writes nothing (B5 below).
- Migration authoring (the D20 loop: read a legacy source, split it into concepts, carry its
  frontmatter across per D33, replace it with a pointer stub per D37) is the human/agent trigger
  that populates the bundle the checker then grades. The checker itself performs no writes (D2).

## Data Dictionary

**The nine concept types (D18, closed, slug-cased):**

| Type | What it holds |
|---|---|
| `bee.area` | Current truth about a subsystem. Several may share one `areas/<slug>/` directory — authority is per-subject, not per-directory (D31). |
| `bee.feature` | A feature's current-truth summary. |
| `bee.work-item` | One unit of work, at `work/<id>/`. |
| `bee.plan` | A work item's plan (absorbs `implement-plan.md`'s review-state role — D36). |
| `bee.delivery` | A work item's delivery record. |
| `bee.decision` | A locked decision, migrated form. |
| `bee.pattern` | A durable pattern **or pitfall** — `bee.polarity: practice \| pitfall` distinguishes them; there is no separate tenth "pitfall" type, because pattern and pitfall carry identical metadata and identical consumption (D18). |
| `bee.runbook` | An operational procedure. |
| `bee.evidence` | A proof artifact (e.g. a coverage report, D35). |

**Frontmatter field rules (D19, corrected by D32):**

- Root level: `type` (OKF-required) + `title`, `description`, `tags`, `timestamp` (+ `resource`
  only for a genuinely external asset).
- A nested `bee:` object carries `id`, `lifecycle` (`draft`\|`active`\|`superseded`\|`archived`),
  `areas`, `required_context` (bundle-relative **paths**), `decisions`, `sources`, and — per type —
  `lane`, `polarity`, `critical`, `authoritative_for`, `review_status`, `supersedes`/`superseded_by`.
- **Id/path direction (D32 — corrects D19's original wording, which had it backwards):** an id is
  **never** computed from a file's path. Instead the path segments `areas/<slug>/` and `work/<id>/`
  are **derived from the id**. `bee.id` is identity; the file **path is the link target** an OKF
  consumer follows (§5) — both exist because links are paths but ids must survive the splits and
  moves migration performs.
- Field supply at migration time: `timestamp` is set from the source file's last git commit;
  `tags` carries across from existing frontmatter where present, absent otherwise; `resource` is
  set only for a genuinely external asset (D32).
- `title`/`description` are profile-required and the migrator **never invents** a value where it
  cannot derive one — the key is left absent and `check` warns, naming the file (D10). A fabricated
  summary reads as curated and gets trusted; the never-invent rule that governs prose (D10 in
  CONTEXT.md's wider sense) governs metadata too.

**Authority rules (D31 — supersedes an unimplementable "one `bee.area` per directory" rule, D28):**

- `bee.id` is **globally unique** across the bundle.
- `bee.authoritative_for` is unique **per subject** — no two concepts claim the same subject.
- Neither rule is "one directory, one concept": several `bee.area` concepts legitimately share one
  `areas/<slug>/` directory, because authority belongs to a *subject*, not a directory. A generated
  `index.md` carries no frontmatter at all (D4), so it can never be — and never was eligible to be
  — the area concept.

**Legacy frontmatter carry-over map (D33 — corrects an undercount: `workflow-state.md:1-10` carries
seven keys, not five):**

| Legacy key | Bundle target |
|---|---|
| `area` | `bee.areas` |
| `decisions` | `bee.decisions` |
| `sources` + `parity_sources` + `parity_decisions` | `bee.sources` |
| `updated` | `timestamp` |
| `coverage` | **dropped** — grep confirms no code reads it |

**Coverage report (D35):** every migration emits a report proving each numbered behavior, rule,
edge case, and pointer bullet in the source (e.g. `B1`…`B36`, `R1`…`R55`) lands in **exactly one**
concept — no loss, no duplication. The verify chain asserts the report. This is what lets a
1464-line re-authoring (`workflow-state.md`, F2 — D30) proceed on evidence instead of care.

**Pointer-stub anchor map (D37):** a migrated legacy file is never deleted in this feature (D20);
it becomes a pointer stub carrying an anchor map — every numbered anchor the source exposed
(e.g. `B17`, `R26`) mapped to the concept path that now owns it. Any citation into the migrated
file (e.g. `docs/specs/reading-map.md`'s citations of `workflow-state.md` `B17`/`B18`, `R26`/`R27`,
`B33`, `R51`) is rewired in the **same cell** as the stub — a path-only stub would preserve the
path and silently destroy the anchors, which is the exact failure D37 exists to eliminate.

**`implement-plan.md` retirement (D36 — declared here, executed in F2):** the committed
`implement-plan.md` artifact is retired once `bee-briefing` is rewired. Its review-state ladder
(`Draft → Ready for Review → Approved → Needs Revision → Shipped`) moves into `bee.plan`'s
`bee.review_status` field; the brief renders from that field instead of from a committed file. The
brief was already a self-declared projection, but it was also the carrier of real gate-mirroring
state and the surface approval happens on — so the retirement is declared now, with a named home
for that state, and executed only when the rewiring itself lands.

**Standing exemption — `docs/decisions/index.md` (D11):** this file keeps its existing path, owner,
and shape permanently. `bee knowledge index` never writes it, and no future generator claims it.
The exemption exists because it already sits outside the bundle (`docs/decisions/` is a legacy
tree, D17), so no conformance rule reaches it in the first place — one generated path keeps one
generator.

## Behaviors & Operations

**B1 — Two-level check, OKF errors vs. profile warnings (D4).** `bee knowledge check` grades every
`.md` inside `docs/knowledge/` (D23) into two buckets. **OKF errors** are the spec's own MUSTs;
**profile warnings** are bee's SHOULD layer. `--strict` promotes every warning to an error. The
`--json` shape is fixed (D13): `{okf:{errors:[...]}, profile:{warnings:[...]}, counts}`, and the
command exits non-zero only when an OKF error exists, or (under `--strict`) when any finding at
all exists.

**B2 — Exact finding codes emitted by `.bee/bin/lib/knowledge.mjs`.**

OKF-error codes (each finding also carries `file` and a human `message`):

| Code | Fires when |
|---|---|
| `unreadable` | The file could not be read at all (a filesystem failure, not itself an OKF clause — but an unreadable file cannot be graded conformant, so it is surfaced as an error). |
| `missing_frontmatter` | A non-reserved `.md` inside the bundle (a concept, D23) has no leading `---` block. |
| `unparseable_frontmatter` | A concept's or the root `index.md`'s frontmatter starts but fails to parse under the emitted subset (D12) — the underlying parser error code and line are folded into the message. |
| `empty_type` | `type` is absent, not a string, or blank (OKF §4.1 MUST). |
| `index_frontmatter` | A **non-root** `index.md` carries any frontmatter at all (OKF §6: index files carry none). |
| `root_index_extra_keys` | The **root** `index.md` carries any key besides `okf_version` (OKF §9). |
| `log_heading_not_iso` | A `## `-level heading inside `log.md` is not an ISO 8601 date (OKF §7 MUST). |

Profile-warning codes:

| Code | Fires when |
|---|---|
| `unknown_type` | `type` parses but is outside the nine D18 types — an OKF consumer must tolerate it; bee flags it. |
| `missing_profile_field` | One of `title`, `description`, `bee.id`, `bee.lifecycle` is missing or blank (D10: never invented — must be authored). |
| `not_canonical` | Parsing the file's frontmatter and re-emitting it (`emitFrontmatter`) does not byte-match the file — a hand-edited colon/`#`/CRLF/key-order outside the canonical emitted form (the advisor round-trip guard). |
| `duplicate_id` | Two or more concepts share one `bee.id` (D31). |
| `duplicate_authoritative_for` | Two or more concepts claim the same `bee.authoritative_for` subject (D31). |
| `dangling_required_context` | A `bee.required_context` entry does not resolve to a real file inside the bundle. |
| `dangling_supersedes` | A `bee.supersedes` id matches no concept's `bee.id` in the bundle. |

**B3 — Emitter-first parsing, zero dependencies (D12).** `knowledge.mjs` ships its own frontmatter
codec covering exactly the YAML subset its own emitter can produce; anything outside that subset
fails loudly with a typed `{code, message, line}`, never a silent misparse. This is strictly easier
than parsing the three incompatible legacy frontmatter schemas across 114 files, because the bundle
is authored fresh (D20) — the subset is one bee controls.

**B4 — The bundle is read-only from the checker's side (D2).** `knowledge.mjs` performs no writes
at all, apart from `index`'s generated `index.md` files inside the bundle, and never writes into
`.bee/*.json(l)` runtime stores. The bundle is the knowledge layer; it is never a write path into
runtime state, though reads from it are permitted.

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

**B8 — Migration is gated by anchor coverage (D35).** Every migration of a legacy source into the
bundle is guarded by a chain suite that asserts set-equality: every numbered anchor in the frozen
source inventory (`B*`/`R*`/`E*`/`P*` for a nine-section BA spec, `PAT*` for the flat pattern list)
is claimed by **exactly one** concept's `bee.sources`, and the pointer stub's anchor map agrees.
No loss, no duplication. Shipped coverage: `advisor-protocol` 26/26, `critical-patterns` 47/47.
*Known limit:* the frozen inventory is a hand-editable constant with no cryptographic tie to git
history — an editor who shrinks the inventory and the concepts together keeps the gate green.
Binding it to the pre-migration blob is open work.

**B9 — A pin is content-addressed, and no unverified extraction may read as a pass (F8).** Every
migrated source is pinned as `{commit, path, blob_sha, scheme, expected_counts}` and **all five are
asserted at check time**. The pinned bytes are also committed verbatim under
`docs/history/okf-migration-f2/sources/<area>.md` and verified with `git hash-object`, so a
`--depth 1` clone — where `git show <sha>:<path>` fails outright — still verifies. Every failure
mode is a typed refusal with exit 1, never a silent skip: `PIN_NO_SCHEME`, `PIN_UNKNOWN_SCHEME`,
`PIN_INCOMPLETE` (including a missing `unparsed_blocks`), `PIN_SHA_MISMATCH`, `PIN_COPY_MISSING`,
`PIN_UNRESOLVED`, `PIN_DUPLICATE_ANCHOR`, and `PIN_EMPTY_EXTRACTION` — which is raised **before**
the count comparison, so a pin declaring `total: 0` cannot launder itself green. Where a source had
to be repaired before pinning (duplicate ids), the pin declares `repaired_from` + `repair_reason`
and the git leg asserts the **provenance** blob; an undeclared or unexplained disagreement stays a
`PIN_SHA_MISMATCH`.

**B10 — The extractor reports what it could not read (F8).** Every inventory returns unparsed block
and line counts per section, and `unparsed_blocks` is a **mandatory** pin field. This exists because
the original classifier required bare anchor ids and was blind to the `- **R1** — …` form, hiding
**86 anchors across five areas** and making two areas look "shapeless" when they were merely
unreadable — a blindness that converts *lost content* into *content that never existed*. Three
schemes ship: `ba-nine-section` (numbered `B*/R*/E*/P*`, letter suffixes and bold wrapping
accepted), `flat-pattern-list` (`## [YYYYMMDD] title` headings), and `narrative-sections` (the
source's own `## ` headings ARE the anchors, for a source with no numbering at all — a `###`
subheading is not an anchor, and a source with zero `## ` headings is refused, never passed 0/0).
Anchor ids are **read, never invented**: an unnumbered block stays unparsed and is counted.

**B11 — The fidelity floor measures whether content was migrated or summarised away (F11).** For
each anchor, the owning concept's **body** (never its frontmatter) must retain **≥ 0.60** normalized
token overlap with that anchor's text in the pinned blob; below the floor fails the gate naming the
anchor, its owner, and the ratio. Normalization lowercases, collapses non-alphanumerics, and drops
only articles, prepositions, pronouns and auxiliaries — **modal and negation words (`never`,
`always`, `must`, `only`, `refuses`) are content here and are never stopwords**. The metric
discriminates rather than merely detecting absence: a faithful re-wording scores 0.815, a markdown
re-format 0.963, a plausible paraphrase 0.296, a gutted concept 0.000. *Known limit:* the metric is
lexical, so a faithful rewrite that **renames terminology** scores near zero — the resolution is to
keep the source's terms (migration re-homes content, it does not improve its wording), never to
lower the floor. A suite assertion requires each area's **median ≥ 0.75**, so a future
over-strict normalization that hugs the floor goes red instead of passing quietly.

**B12 — Drift telemetry compares only comparable shapes (F12).** Each pinned source reports
`anchors_per_concept` and `concepts_per_100_source_lines`, failing when it is an outlier against
the running median of already-pinned sources **of the same scheme**; with fewer than three
comparable samples there is no median and it reports only. Comparability is keyed by scheme
because a `flat-pattern-list` migration is one anchor per concept *by construction* and can never
sit in a band drawn around nine-section areas — pooling them turned an already-shipped area red on
work it never touched. The gate additionally runs the whole-bundle invariants every check
(authority uniqueness, zero `not_canonical`, index freshness) and treats those three as hard
failures **for itself**, leaving `knowledge check`'s own non-strict exit contract (D13) untouched.

## Actors & Access

- **The migrator** (a scripted, non-shipped tool in `scripts/`, D24) — authors new concepts under
  `areas/<area>/`, carries frontmatter values across per D33, writes the coverage report (D35),
  and replaces the legacy source with a pointer stub carrying the anchor map (D37, D20).
- **`bee knowledge check`** — grades the bundle; never writes; the sole enforcement surface for
  this profile today.
- **`bee knowledge promote`** — reads the bundle and the capped cell traces; proposes the delivery
  draft, the area bullets and the pitfall candidates a finished work item earned; writes nothing.
  The **human or agent who accepts a proposal** is the actor that turns it into a concept — the
  profile deliberately keeps that step outside the tool (D38).
- **`node scripts/run_verify.mjs`** — the CI-equivalent chain `check` (and later `index --check`)
  joins; a profile violation fails the same way any other suite failure does.
- **The human owner** — configures nothing here; the profile has no runtime knobs. Owner-level
  input landed once, at exploring, as the locked decisions this document cites.

## Business Rules

- The vocabulary is closed at **nine** types (D18); a tenth type is never introduced to encode a
  distinction that fits inside an existing type's fields (pitfall inside pattern's `bee.polarity`
  is the standing example).
- Identity is `bee.id`, globally unique; authority is `bee.authoritative_for`, unique per subject —
  never "one concept per directory" (D31).
- An id is never derived from a path; a path is derived from an id (D32).
- `docs/decisions/index.md` is permanently exempt from generation and from this profile's reach —
  it already sits outside the bundle (D11, D17).
- A migration is not "done" until its coverage report accounts for every numbered source anchor
  exactly once (D35) and its pointer stub carries the anchor map those citations depend on (D37).
- `title`/`description` (and any profile-required field) are never fabricated; an absence is a
  named warning, not a guess (D10).
- The checker never leaves `docs/knowledge/` (D23) and never writes anything, anywhere (D2).
- **`promote` proposes; it never writes (D38).** Finished work is allowed to *suggest* knowledge —
  a delivery draft, area bullets, pitfall candidates — and is never allowed to *commit* it. No
  section `promote` emits is written to disk by `promote`; accepting one is a human or agent
  decision, and `writes: []` in the payload states that in machine-readable form. The reason is the
  same one behind D10's never-invent rule: a proposal that writes itself into the bundle arrives
  reading as curated truth and is then trusted, without anyone having judged it.
- `promote` invents nothing: every proposed line is copied from a capped cell trace or from the
  work item concept (D10). A cell that was never capped, and a cell belonging to another feature,
  are never mined.

## Edge Cases Settled

- A concept is any non-reserved `.md` **inside** `docs/knowledge/` — nothing outside the bundle is
  a concept, is checked, or carries a frontmatter obligation (D23). This removed a 593-file
  retrofit obligation, 14 prose-header legacy files, a filename-with-spaces hazard, and a
  `timestamp` double-source conflict in one decision.
- A hand-edited frontmatter block that still parses but does not re-emit byte-identically is a
  `not_canonical` warning naming the file, not a silent pass — the class of error a colon in an
  unquoted title, a `#` mid-value, or CRLF line endings would otherwise cause.
- A pointer stub is authored in the **same cell** as the citations that point into the file it
  replaces, closing the gap where a path survives migration but a numbered anchor a citation
  depends on does not (D37; the verified gap was `docs/specs/reading-map.md:101-102` citing
  `workflow-state.md` `B17`/`B18`/`R26`/`R27` and `B33`/`R51`).
- Migrated legacy files are **not deleted** in this feature (D20) — stubs keep existing consumers
  (`.bee/bin/lib/inject.mjs:70-95`'s filename-only spec count; `hooks/bee-session-close.mjs:100-140`'s
  mtime-based staleness nudge) working through the migration without a flag day.

## Templates

Three canonical worked examples — one per type most authors reach for first. Each frontmatter
block below is the **exact emitter-canonical form** (byte-identical to what `emitFrontmatter`
produces and `parseFrontmatter` accepts back, D12): copy it, edit the values, and the round-trip
guard (`not_canonical`) stays silent. Round-trip proof (okf-6): the `bee.delivery` example below
was pasted into a temp file inside `docs/knowledge/patterns/`, `bee knowledge check --json` ran
zero errors and zero warnings (no `not_canonical` finding) with it present, and the temp file was
then removed — the other two examples are live bundle concepts (`bee knowledge check` already
grades them on every run).

### `bee.work-item` — `docs/knowledge/work/okf-foundation/work-item.md` (live)

```yaml
---
type: bee.work-item
title: okf-foundation — Bee OKF Profile foundation
description: "Replace bee's document model with an OKF v0.1 bundle: docs/knowledge/, a validator, an index generator, a budget-aware context consumer, and the full migration loop proven end-to-end on one area."
tags: [okf, knowledge-bundle, migration, high-risk]
timestamp: 2026-07-22
bee:
  id: okf-foundation
  lifecycle: active
  required_context: [areas/advisor-protocol/overview.md, patterns/20260715-shipping-a-lib-file-means-shipping-the-manifest.md, patterns/20260716-a-tolerant-regression-net-frozen-green-before-the.md, patterns/20260712-cross-cell-contracts-and-census-carriers-are-plan.md]
  decisions: [D17-D38 active set (docs/history/okf-foundation/CONTEXT.md), "D29 (F1 proof area: docs/specs/advisor-protocol.md)", D30 (workflow-state.md decomposition locked as F2 input), D34 (ships list + guard propagation — ledger/manifest/plugin trees/session-close hook), "D35 (coverage report law: every numbered source anchor lands in exactly one concept)", D37 (pointer-stub anchor map — citations rewired in the same cell as the stub)]
  sources: [docs/history/okf-foundation/CONTEXT.md, docs/history/okf-foundation/plan.md]
  lane: high-risk
---

# okf-foundation — Bee OKF Profile Foundation

## Outcome

Replace bee's document model with an OKF v0.1 bundle governed by a **Bee OKF Profile** [...]

## Scope
## Acceptance
## Decisions
## Chosen Approach
```

A work item's body sections (agent's discretion, not profile-enforced) are: Outcome, Scope,
Acceptance, Decisions, Chosen Approach — each condensed FROM the feature's `CONTEXT.md`/`plan.md`,
never invented (D10). `bee.decisions` entries mix bare D-ids (`D30`) and quoted parenthetical
citations (`"D29 (F1 proof area: ...)"`) — the emitter quotes only the entries containing a colon,
comma, or other reserved character; both forms round-trip.

### `bee.plan` — `docs/knowledge/work/okf-foundation/plan.md` (live)

```yaml
---
type: bee.plan
title: okf-foundation — Plan
description: "The seven-slice plan for the Bee OKF Profile foundation: format core, chain wiring, generators, data, consumer, startup bridge, promote v1."
tags: [okf, plan, high-risk]
timestamp: 2026-07-22
bee:
  id: okf-foundation-plan
  lifecycle: active
  required_context: [work/okf-foundation/work-item.md]
  decisions: [D2 (chain never red between cells), D22 (consumer in scope), D29, D30, D34, D35, D38 (loop closure over coverage)]
  sources: [docs/history/okf-foundation/plan.md, docs/history/okf-foundation/CONTEXT.md]
  lane: high-risk
  review_status: Approved
---

# okf-foundation — Plan

## Mode gate
## Approach
## Slices
## Risk map
## Rejected Alternatives
```

`bee.review_status` carries the `Draft → Ready for Review → Approved → Needs Revision → Shipped`
ladder (D36) — the field `implement-plan.md`'s review state moves into once `bee-briefing` is
rewired (declared here, executed in F2). A `bee.plan`'s `required_context` typically points back
at its own work item, since the plan only makes sense alongside the outcome/scope it implements.

### `bee.delivery` — worked example (illustrative; not a committed concept — okf-foundation is not
closed yet), grounded in cell okf-5's real cap trace (`.bee/cells/okf-5.json`)

```yaml
---
type: bee.delivery
title: okf-foundation cell okf-5 — advisor-protocol migrated end-to-end
description: "Delivery record for cell okf-5: docs/specs/advisor-protocol.md re-authored into four bee.area concepts, coverage-gated (D35), full chain green."
tags: [okf, delivery, migration]
timestamp: 2026-07-22
bee:
  id: okf-foundation-okf-5-delivery
  lifecycle: active
  areas: [advisor-protocol]
  required_context: [work/okf-foundation/work-item.md]
  decisions: [D29, D35, D37]
  sources: [.bee/cells/okf-5.json, docs/specs/advisor-protocol.md]
  lane: high-risk
---

# okf-foundation cell okf-5 — Delivery

## Outcome

`docs/specs/advisor-protocol.md` migrated end-to-end into 4 `bee.area` concepts [...]

## Evidence
## Verify
```

A `bee.delivery`'s `sources` may cite a cell trace file directly (`.bee/cells/<id>.json`) — a
`.bee/*.json` path is outside the bundle and is never itself a concept (D2/D23), but `sources` is
free-text provenance, not a `required_context` link target, so citing it is not a dangling-target
finding. `areas` names the subsystem(s) the delivered work touched, matching one or more
`bee.area` concepts' `bee.areas` membership.

## Open Gaps

- `bee knowledge index` (the generator that replaces this hand-seeded `index.md`, D21) and
  `index --check`'s freshness guard are not built — targeted at **S3**.
- Only one legacy area (`advisor-protocol.md`, F1's proof, D29) is migrated end-to-end; the
  remaining ten `docs/specs/*.md` areas, and `workflow-state.md`'s locked nine-concept
  decomposition (D30), are deferred to **F2**.
- `bee knowledge stale`, work-item back-migration, pointer-stub deletion, and skill rewiring
  (scribing writes concepts, compounding promotes them, hive assembles its context packet, grooming
  hunts stale knowledge) are all deferred (F2/F3 — see CONTEXT.md "Deferred Ideas", filed P66-P69).
  `bee knowledge promote` shipped in S7 (B5); what stays deferred there is the *accepting* half —
  no skill yet routes a promote proposal into an authored concept, so today a human or agent reads
  the proposal and authors the file.
- A work item that declares no `bee.areas` gets an **empty** area-updates section from `promote` —
  correct behaviour (the profile never guesses which area a cell touched, D10), but it means the
  section is only as useful as the work item's own `bee.areas` list. `work/okf-foundation/`'s work
  item declares none, so this feature's own promote run proposes area bullets for nothing.
- Host-repo adoption of the migrator stays out of scope by design (D24: the migrator is bee-only,
  never shipped to hosts).

## Pointers (implementation)

- Checker + emitter-first codec + concept model: `.bee/bin/lib/knowledge.mjs` (mirrored from
  `skills/bee-hive/templates/lib/knowledge.mjs` — `scripts/test_lib_mirror.mjs:196` enforces the
  mirror). `checkBundle` is the two-level check; `emitFrontmatter`/`parseFrontmatter` are the D12
  codec; `CONCEPT_TYPES`/`LIFECYCLES`/`PROFILE_REQUIRED` are the D18/D19 tables.
- Proposal builder (B5): `buildPromotion` in the same module, with `readCappedCellTraces` as its
  read-only view of `.bee/cells/`. Neither function writes; the CLI handler
  (`handleKnowledgePromote` in `.bee/bin/bee.mjs`) only prints what they return.
- CLI wiring: `.bee/bin/lib/command-registry.mjs` (the `knowledge` group) +
  `.bee/bin/bee.mjs` dispatch (`HANDLERS`).
- The bundle itself: `docs/knowledge/index.md`, `docs/knowledge/log.md`.
- F1's proof area (D29), still living in its legacy location pending its own migration cell:
  `docs/specs/advisor-protocol.md`.
- Locked decisions this profile implements exactly, cited never reinterpreted:
  `docs/history/okf-foundation/CONTEXT.md`.
- Normative OKF v0.1 spec: `https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md`.
  Profile-as-open-proposal: `https://github.com/GoogleCloudPlatform/knowledge-catalog/issues/212`.
