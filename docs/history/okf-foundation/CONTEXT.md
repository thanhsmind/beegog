# OKF Foundation — Context

**Feature slug:** okf-foundation
**Date:** 2026-07-22
**Exploring session:** complete (fresh-eyes review loops 1 and 2 applied; owner redirection applied)
**Scope:** Deep
**Lane:** high-risk (data model · public contracts · multi-domain · changes behavior existing suites assert)
**Domain types:** ORGANIZE (primary — document model and taxonomy), CALL (the `knowledge` command group), READ (docs bundle)

## Feature Boundary

Replace bee's document model with an OKF v0.1 bundle governed by a **Bee OKF Profile**: a new
`docs/knowledge/` bundle holding only curated current truth, a validator, an index generator, a
**budget-aware context consumer**, and the full migration loop proven end-to-end on one area —
`docs/specs/advisor-protocol.md` (202 lines) — plus this feature's own work item and the critical
patterns, so the consumer has real data to resolve on day one. Legacy trees are retired by
migration behind pointer stubs, never annotated in place. `docs/specs/workflow-state.md` (1464
lines) is **not** migrated here; its decomposition map is locked as F2's input (D30).

## Locked Decisions

Fixed. Planning implements them exactly — cited, never reinterpreted. Decision IDs are stable
forever; a changed decision is **superseded by a new ID**, never renumbered.

### Superseded

| ID | Was | Superseded by |
|----|-----|---------------|
| D1 | Bundle root is `docs/`; type in place, no moves | **D17** |
| D3 | Twelve types incl. `bee.guide`/`bee.overview`/`bee.reference` | **D18** |
| D5 | Field set with the path as identity | **D19**, refined by **D32** |
| D6 | Existing frontmatter preserved in place by a retrofit | **D20** |
| D7 | Index generated at two levels of `docs/` | **D21** |
| D8 | Scope stops at the format layer; consumer deferred | **D22**, extended by **D34** |
| D9 | Idempotent retrofit stamps all 593 `.md` under `docs/` | **withdrawn** (D23) |
| D14 | A concept is any non-reserved `.md` under `docs/` | **D23** |
| D16 | Retrofit script lives in `scripts/` | **D24** |
| D25 | `workflow-state.md` split into five concepts, in this feature | **D29** (proof area changes) + **D30** (its real map, deferred to F2) |
| D28 | Exactly one `bee.area` concept per `areas/<slug>/` | **D31** |
| D26 | `implement-plan.md` retired as a committed artifact | **D36** (declared here, executed in F2) |

### Active

| ID | Decision | Rationale |
|----|----------|-----------|
| D2 | `.bee/*.json(l)` stays authoritative for runtime state — `state.json`, `cells/`, gates, claims, reservations, `HANDOFF.json`, `decisions.jsonl`. The bundle is the knowledge layer and is **never a write path** into them. Reads are permitted. | OKF replaces the *document* model, never the *runtime* model. |
| D4 | `bee knowledge check` reports two levels. **OKF errors:** missing/unparseable frontmatter on a non-reserved `.md`; empty or absent `type`; frontmatter in a non-root `index.md`; a root `index.md` carrying any key but `okf_version`; a `log.md` date heading not ISO 8601. **Profile warnings:** type outside D18, missing profile-required field, dangling `required_context`/`supersedes` target, duplicate `bee.id`, duplicate `bee.authoritative_for`, **stale generated index** (D21). `--strict` promotes warnings to errors. | OKF §9 conformance is exactly three clauses; the rest is SHOULD/MAY. Grading a SHOULD as an error would make bee's checker misrepresent the spec it implements. The stale-index finding closes the gap the cited precedent already covers via `bee decisions render --check`. |
| D10 | `title` and `description` are profile-required; the migrator **never invents one**. Where it cannot derive a value, it leaves the key absent and `check` warns, naming the file. | The never-invent rule governs metadata as it governs prose. A fabricated summary reads as curated and is then trusted. |
| D11 | `docs/decisions/index.md` keeps its path, owner, and shape. `bee knowledge index` never writes it. | One generated path, one generator. It also sits outside the bundle (D17), so no conformance rule reaches it. |
| D12 | **No new runtime dependency.** `knowledge.mjs` ships its own frontmatter parser covering exactly the YAML subset the profile emits, failing loudly outside it. | bee vendors zero dependencies. The bundle is authored fresh (D20), so the subset is one bee controls — strictly easier than parsing the 114 legacy frontmatter files. |
| D13 | Every `knowledge` verb supports `--json`. `check --json` returns `{okf:{errors},profile:{warnings},counts}`, exiting non-zero only on OKF errors, or on any finding under `--strict`. | The command surface is a tool-schema manifest; a verb without `--json` is invisible to it. |
| D15 | `bee knowledge list [--type][--lifecycle][--area][--json]` emits one row per concept — path, id, type, lifecycle, title — never content. | The primitive `context` (D27) is built from; keeps query flags off `check` and `index`. |
| D17 | **Bundle root is `docs/knowledge/`**: `index.md`, `log.md`, `areas/<area>/`, `features/`, `work/<id>/`, `decisions/`, `patterns/`, `runbooks/`. `docs/specs/`, `docs/history/`, `docs/REFs/`, root-level `docs/*.md` stay **outside** and are retired area-by-area. | Owner requirement that knowledge stay under `docs/`. A subdirectory gives a conformant bundle from day one with zero legacy debt inside it, keeps old paths working during migration, and makes migration incremental. `docs/history/` is never migrated wholesale — chronology comes from Git and `log.md`. |
| D18 | Vocabulary closed at **nine**, slug-cased: `bee.area`, `bee.feature`, `bee.work-item`, `bee.plan`, `bee.delivery`, `bee.decision`, `bee.pattern`, `bee.runbook`, `bee.evidence`. "Pitfall" is `bee.pattern` with `bee.polarity: practice \| pitfall`. | Pattern and pitfall carry identical metadata and identical consumption — two types to encode one polarity bit doubles the vocabulary for nothing. Slug case because the value is a CLI filter that must not need shell quoting. |
| D19 | Concept frontmatter: **`type`** (OKF-required) + `title`, `description`, `tags`, `timestamp` (+ `resource` only for an external asset) + a nested `bee:` object carrying `id`, `lifecycle` (`draft`\|`active`\|`superseded`\|`archived`), `areas`, `required_context` (bundle-relative **paths**), `decisions`, `sources`. Per type: `lane`, `polarity`, `critical`, `authoritative_for`, `review_status`, `supersedes`/`superseded_by`. | `bee.id` is identity; the **path is the link target**. Both are needed: OKF links are paths (§5) so a foreign consumer can follow them, while a stable id survives the splits and moves migration performs. `required_context` holds paths so it resolves without bee. |
| D20 | Migration **authors new concepts and retires the source**; it never annotates a legacy file in place. Per area: read the source, split it into concepts under `areas/<area>/`, carry its frontmatter values across (D33), then replace the source with a **pointer stub** (D37). Legacy files are not deleted in this feature. | Stubs keep `inject.mjs:70-95` spec counting and `hooks/bee-session-close.mjs:100-140` working through the migration — replacement without a flag day. Deleting stubs is F2's job. |
| D21 | `bee knowledge index` generates `index.md` at **every level inside the bundle** plus the root `index.md` (sole carrier of `okf_version: "0.1"`), byte-identically from concept frontmatter, each with an HTML-comment provenance header. `index --check` verifies freshness and joins the verify chain. The `critical-patterns.md` equivalent is a **generated index** over `bee.critical: true`. | Per-level indexes are the progressive-disclosure mechanism `context` walks. A hand-maintained critical list drifts; a generated one cannot. Frontmatter in a non-root `index.md` is an OKF error (D4), so provenance must be a comment. |
| D22 | Scope includes the consumer. Ships list is D34 (superseding the original enumeration). Deferred to F2/F3: the remaining 10 areas, `workflow-state` (D30), work-item back-migration, `promote`, `stale`, stub deletion, skill rewiring. | Owner correction, accepted: without context selection, OKF only organises files and does not fix post-compaction degradation. A format without a consumer is a directory rename. The `ledger_parity.mjs` "report-only" precedent was **miscited and is withdrawn** — that suite is chain-failing (`run_verify.mjs:64`; `runCheck()` returns 1, `ledger_parity.mjs:187-195`). |
| D23 | A **concept** is any non-reserved `.md` inside `docs/knowledge/`. Files outside the bundle are not concepts, are not checked, carry no frontmatter obligation. | Conformance over a curated set is real; over an archive it is bookkeeping. This removes the 593-file retrofit, the 14 prose-header learnings, the filename-with-spaces hazard, and the `timestamp` double-source conflict in one move. |
| D24 | The migrator lives in `scripts/`, not shipped to hosts. `knowledge.mjs` and the command group **do** ship via `.bee/bin/lib/` and must be mirrored into `skills/bee-hive/templates/lib/` (`scripts/test_lib_mirror.mjs:196` asserts `compareDirs(TEMPLATES_LIB, BIN_LIB)`). | The mirror is an obligation, not an option. Host-repo adoption is its own feature. |
| D27 | `bee knowledge context --work <id> --budget <tokens>` resolves the work item, walks `required_context` **transitively with a cycle guard** (a cycle is deduped, not an error), adds the active decisions for its `areas` and every `bee.critical: true` pattern, ranks, and cuts at budget. Returns an ordered **manifest** — paths, size estimates, and an inclusion reason per entry — **never content**. Budget is estimated as bytes/4, and the output names the estimator. | A manifest keeps the tool cheap, keeps the agent in control of what it reads, and makes selection auditable. Bee vendors no tokenizer, so the estimate is declared as an estimate rather than dressed as a count. |
| **D29** | F1's proof area is **`docs/specs/advisor-protocol.md`** (202 lines): same nine-section BA template as `workflow-state.md`, same `area`/`updated`/`sources`/`decisions`/`coverage` frontmatter, one-seventh the size. It splits into `areas/advisor-protocol/` as `overview`, `triggers`, `consult-loop`, `slots-and-tiers` (exact boundaries at planning's discretion, coverage-checked by D35). | It exercises every migration path — frontmatter carry-over, numbered-rule redistribution, stub, anchor map — without betting the feature on a 1464-line re-authoring. Proving the loop is F1's job; applying it at scale is F2's. |
| **D30** | `workflow-state.md` (**1464 lines**, 11 `##` headings and one `###`) moves to **F2**, with its decomposition locked here as F2's input: `overview` (Purpose+Entry Points+Data Dictionary+Actors, ~93 lines), `gates` (B1, B2, B9a, B19, "Closing a feature" `:534-581`, ~91), `cells` (B7, B10, B17, B18, B23, B25-B32, B34-B36, ~254), `handoff` (B15, B16, ~47), `recovery` (B33 `:699-752`, ~54), **`multi-session`** (B11-B14 `:237-324`, B20-B24 `:415-533`, ~207), **`review-sessions`** (B3-B6 `:110-151`, ~42), **`dispatch`** (B8 `:167-185`, ~19), **`advisor-consult`** (B9 `:186-206`, ~21). The 58 R-rules (`:824-1109`), 25 edge cases, hardening settlements, and 20 Pointer bullets (`:1288-1464`) are **distributed to the concept each governs**, not collected into a dumping-ground concept. | The file's headings are a BA template, not topics, so a heading split does not work: the five names originally proposed left ~700 lines homeless, with multi-session coordination — the second-largest cluster — having no destination at all. Locking the real map now means F2 inherits a decomposition derived from line anchors instead of re-deriving it. |
| **D31** | `bee.area` types **every** current-truth concept about a subsystem; several live in one `areas/<slug>/`. Uniqueness is enforced on `bee.id` (globally unique) and on `bee.authoritative_for` (no two concepts claim the same subject) — **not** on "one `bee.area` per directory". A generated `index.md` carries no frontmatter (D4), so it is never the area concept. | Supersedes D28's unimplementable form: four of five concepts in an area had no legal type under D18, and the index could not be the area concept because it may not carry frontmatter. Authority belongs to a *subject*, not a directory. |
| **D32** | Id/path direction: ids are **never computed from an arbitrary file path**; instead the path segments `areas/<slug>/` and `work/<id>/` are **derived from the id**. Field supply: the migrator sets `timestamp` from the source's last git commit, carries `tags` from existing frontmatter where present (absent otherwise — D10), and sets `resource` only for a genuinely external asset. | Corrects D19's wording, which asserted the opposite direction and was contradicted by D17, D27, and D31 at once. |
| **D33** | Frontmatter carry-over is explicit: `area`→`bee.areas`, `decisions`→`bee.decisions`, `sources`+`parity_sources`+`parity_decisions`→`bee.sources`, `updated`→`timestamp`. **`coverage` is dropped** — grep confirms no code reads it. | `workflow-state.md:1-10` carries **seven** keys, not five; `sources` is a multi-thousand-character provenance blob. Without a named target for each, D20's "carry across" is unexecutable on the very files it governs. |
| **D34** | **Ships** (superseding D22's enumeration): the Bee OKF Profile area spec; `.bee/bin/lib/knowledge.mjs` + template mirror; `bee knowledge check \| index \| list \| context`; the migrator; the `docs/knowledge/` skeleton with `index.md` + `log.md`; `advisor-protocol` migrated end-to-end (D29) with its stub and anchor map (D37); **this feature's own work item** at `work/okf-foundation/`; **`critical-patterns.md` migrated into `patterns/`**; the work-item/plan/delivery templates; `knowledge check` and `index --check` in the verify chain; and the guard propagation below. **Guard propagation is not optional:** a new `.bee/bin/lib/knowledge.mjs` fails `scripts/ledger_parity.mjs` ("extra: unrecorded `*.mjs`", `:78`) until a self-onboard refreshes `.bee/onboarding.json`; a new command group propagates through `command-registry.mjs` into `scripts/release_manifest.mjs --check` (`run_verify.mjs:57-58`) and the `.claude-plugin/`/`.codex-plugin/` renders plus the `.claude/`/`.agents/` mirrors; `hooks/bee-session-close.mjs:100-140` compares the newest decision against `max(mtime)` of `docs/specs/*.md` and will fire on every session close once knowledge moves, so it must learn about the bundle. | Fixes the round-2 finding that `context` shipped with no `<id>` that resolves and no critical pattern to include — a consumer with no data is the directory rename D22 exists to avoid. The guard propagation is the trap where this feature's own deliverable is blocked by this feature's own cited precedent. |
| **D35** | Every migration emits a **coverage report** proving each numbered behavior, rule, edge case, and pointer bullet in the source lands in **exactly one** concept — no loss, no duplication. The report is asserted by the verify chain. | This is what makes re-authoring a BA spec safe rather than hopeful, and it is the mechanism that lets F2 attack 1464 lines with evidence instead of care. Numbered ids (B1-B36, R1-R55) make the invariant machine-checkable. |
| **D36** | `implement-plan.md`'s retirement is **declared in the profile here and executed in F2**, when `bee-briefing` is rewired. Its review state — `Draft → Ready for Review → Approved → Needs Revision → Shipped` (`skills/bee-briefing/SKILL.md:83`) — moves into `plan.md` as `bee.review_status`; the brief renders from it. | The brief is already self-declared a projection (`SKILL.md:80`), but it is **also** the carrier of real gate-mirroring state and the surface approval happens on (`:82`). Retiring the committed file without naming a home for that state would silently drop it. Declaring in F1 and executing in F2 keeps the declaration honest while skill rewiring stays deferred. |
| **D37** | A pointer stub carries an **anchor map**: every numbered anchor the source exposed (`B17`, `R26`, …) mapped to the concept path that now owns it. Citations into the migrated file are rewired in the same cell as the stub — for `advisor-protocol` that includes any `reading-map.md` entry citing its sections. | Verified gap: `reading-map.md:101-102` cites `workflow-state.md` **B17/B18, R26/R27** and **B33, R51**. A path-only stub preserves the path and destroys the anchors, leaving silent dangling citations — the exact failure this feature exists to eliminate. |

### Agent's Discretion

Module boundary between `knowledge.mjs` and the command handlers; exact split boundaries inside
`advisor-protocol.md` (coverage-checked by D35); human-readable output shape of each verb; the
ranking function inside `context`; cell slicing.

## Terms

| Term | Meaning |
|------|---------|
| Bundle | `docs/knowledge/` — the OKF v0.1 unit. Bee has exactly one. |
| Concept | Any non-reserved `.md` inside the bundle (D23). |
| Legacy tree | `docs/specs/`, `docs/history/`, `docs/REFs/`, root-level `docs/*.md`. Outside the bundle; retired by migration. |
| Pointer stub | What a migrated legacy file becomes: successor concepts plus an anchor map (D20, D37). |
| Profile | Bee's layer *on top of* OKF: closed vocabulary, per-type required fields, lifecycle, id and link rules. Not part of the spec — OKF profiles are an open proposal (knowledge-catalog#212), not yet standard. |
| Coverage report | The per-migration proof that every numbered source anchor lands in exactly one concept (D35). |
| Notation | `bee.area` (D18) is a literal `type` **string value**; `bee.lifecycle` (D19) is a **key path** inside the nested `bee:` map. |

## Specific Ideas And References

- The owner's three mechanisms land as: **Profile** and **consumer** in full here; **validation** here,
  **promotion** in F2.
- Target tree adopted as given, rooted at `docs/knowledge/` per the owner's closing note (D17).
- `bee.id` as identity is the owner's correction, accepted (D19) with the direction fixed in D32.
- Adopted verbatim: `implement-plan.md` retired as a self-declared projection (D36);
  `critical-patterns.md` becomes a generated index over `critical: true` (D21); `docs/history/` not
  migrated wholesale (D17); `.bee/` runtime untouched (D2).
- Adjusted from the owner's draft, each reversible in one line: slug-cased types rather than
  `Bee Work Item` (CLI ergonomics); pitfall folded into pattern via `polarity` (identical metadata);
  and `workflow-state` deferred to F2 (D29/D30) because its real structure needs a 9-concept
  re-authoring, not a 5-way split.

## Existing Code Context

### Reusable Assets

- `.bee/bin/lib/decisions.mjs:895-902` — byte-identical generated projection with a `--check`
  freshness guard; the pattern D21 follows, including the guard D4 now requires.
- `.bee/bin/lib/capture.mjs`, `reviews.mjs` — the shape `knowledge.mjs` follows: pure store logic.
- `.bee/bin/lib/fsutil.mjs` — shared filesystem primitives.

### Established Patterns

- **Command registration** — `command-registry.mjs` is the single source of truth; `bee.mjs:5145`
  dispatches via `HANDLERS[commandName]` (table at `bee.mjs:4641`).
- **Generated-file discipline** — `docs/decisions/index.md:1-8` uses an **HTML-comment** header;
  frontmatter there would be an OKF error (D4).
- **Legacy frontmatter (D33 reads it, never rewrites it)** — three schemas across **114** files:
  `docs/specs/*.md` (8), `docs/history/learnings/*.md` (43 of 57 — **14 use a prose header line**),
  plan artifacts with `artifact_contract:` (63).
- **BA spec template** — `advisor-protocol.md` and `workflow-state.md` share the same nine sections
  (Purpose, Entry Points, Data Dictionary, Behaviors, Actors, Business Rules, Edge Cases, Open Gaps,
  Pointers). This is what makes the small file a valid proof for the large one.

### Integration Points

- `.bee/bin/lib/command-registry.mjs` + `bee.mjs:4641`/`:5145` — the `knowledge` group.
- `scripts/run_verify.mjs` — `EXTRA_SUITES` begins at `:56`; `ledger_parity.mjs` is the `:64` row;
  `release_manifest.mjs --check` at `:57-58`; `DISCOVERY_ROOTS` at `:40-43`.
- `skills/bee-hive/templates/lib/` — the mirror `scripts/test_lib_mirror.mjs:196` enforces.
- `.bee/bin/lib/inject.mjs:70-95` — counts `docs/specs/*.md` by filename only; **stub-safe**.
- `hooks/bee-session-close.mjs:100-140` — mtime-based spec-staleness nudge; **not** stub-safe long
  term (D34).
- `.bee/bin/bee.mjs:1897` → `cells.mjs:1689-1708` — the spec-debt close guard reads `.bee/state.json`
  and cell traces only; it never opens `docs/specs/`, so migration neither protects nor endangers it.
- `docs/specs/reading-map.md:101-102` — anchor citations that D37's map must rewire.

## Canonical References

- `https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md` — normative OKF
  v0.1, verified: `type` REQUIRED (§4.1); `title`/`description`/`resource`/`tags`/`timestamp`
  recommended; `index.md`/`log.md` reserved (§3.1); index files carry **no** frontmatter and group
  concepts in sections under headings, linked entries with descriptions only a **SHOULD** (§6);
  `log.md` date headings **MUST** be ISO 8601 (§7); `okf_version` only in the root `index.md` (§9);
  conformance is exactly three clauses (§9); consumers MUST tolerate unknown types, MUST NOT reject
  unknown fields, MUST tolerate broken links (§5, §8).
- `https://github.com/GoogleCloudPlatform/knowledge-catalog/issues/212` — the OKF **profile**
  proposal: open, not standard. Bee's profile is bee's own contract, not a claimed standard.
- `skills/bee-briefing/SKILL.md:80,82,83` — the brief as projection, approval surface, and state carrier (D36).

## Outstanding Questions

### Resolve Before Planning

None. Every round-2 blocker is closed: the type-vocabulary deadlock by D31; the unsplittable
five-way decomposition by D29 + D30; the consumer with no data by D34; the id/path contradiction by
D32.

### Deferred To Planning

- [ ] Exact split boundaries inside `advisor-protocol.md` — read its Behaviors/Rules numbering and
  let D35's coverage report decide, rather than guessing at authoring time.
- [ ] Whether the ledger self-onboard (D34) runs as its own cell or rides the cell that adds
  `knowledge.mjs` — turns on whether `ledger_parity` can pass mid-feature at all.
- [ ] How `hooks/bee-session-close.mjs` should learn about the bundle: widen its mtime scan to
  include `docs/knowledge/`, or replace the mtime heuristic with a `knowledge check` call.

## Deferred Ideas

Filed as P66–P69.

- **F2: `workflow-state.md`** — the 9-concept decomposition locked in D30, executed with D35's
  coverage report and D37's anchor map, plus `reading-map.md:101-102` rewiring.
- **F2: the remaining 10 areas**, work-item back-migration, and pointer-stub deletion once every
  consumer has moved.
- **`bee knowledge promote --work <id>`** — cell traces and `delivery.md` become updated
  Area/Feature concepts, new Decisions, new Patterns, with temporary detail dropped.
- **`bee knowledge stale`** — concepts whose area changed underneath them. (`links` is largely
  covered already by D4's dangling-target warning.)
- **Skill rewiring** — scribing writes concepts, compounding promotes them, hive assembles its
  packet from `context`, grooming hunts stale knowledge; one bundle, per-runtime adapters.
- **`onboard_bee.mjs:2047-2048`** still creates `docs/specs/system-overview.md` and `reading-map.md`
  skeletons as managed files — a D17 conflict for whoever retires `docs/specs/` entirely.
- **Host-repo adoption** — D24 keeps the migrator bee-only.

## Handoff Note

CONTEXT.md is the source of truth. Decision IDs are stable; superseded IDs are listed with their
successors and never reused. Planning reads locked decisions, code context, canonical references,
and deferred-to-planning questions.
