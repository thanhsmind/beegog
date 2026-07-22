# OKF Migration F2 — Context

**Feature slug:** okf-migration-f2
**Date:** 2026-07-22
**Scope:** Deep (inherited decisions; new decisions are F2-local)
**Lane:** high-risk
**Domain types:** ORGANIZE (taxonomy), READ (docs), CALL (`okf_migrate` gains a derived-inventory mode)

## Feature Boundary

Migrate every remaining `docs/specs/` area into `docs/knowledge/areas/`, retiring each source behind a
pointer stub with an anchor map, under the coverage law — **after** first making the coverage gate
derive its own ground truth. Ends when all 10 remaining areas are migrated and green; deleting the
stubs and rewiring the skills to read the bundle are **not** in scope (F3).

## Inherited Decisions (okf-foundation, binding here)

D17 (bundle root `docs/knowledge/`) · D18 (nine types + polarity) · D19/D32 (frontmatter, id/path
direction) · D20 (author-then-stub, never annotate) · D21 (generated indexes) · D23 (concepts are
bundle files only) · D24 (migrator in `scripts/`, not shipped) · D27 (context manifest) · D31
(authority uniqueness) · D33 (carry-over map) · D35 (coverage law) · D37 (anchor-map stubs) · D38
(loop closure). These are cited, never reinterpreted.

## Superseded (2026-07-22, by the advisor consult — `reports/advisor-digest-f2.md`)

| ID | Was | Superseded by | Why |
|----|-----|---------------|-----|
| F1 | The derived gate reuses "the SAME extraction the existing `--inventory` mode uses" | **F8** | Measurably false: the extractor is format-blind. `onboarding.md`'s 22 `- **R1** —` rules inventory as **R0** and its behaviors as **B0**; `decision-memory` and `worktree-parallelism` yield **0 anchors** entirely. The stated oracle ("reproduce 26 and 47") passes *by construction* — advisor-protocol is the file the regexes were written against. |
| F2 | Migrate ascending by line count | **F9** | Ascending size puts the two unparseable areas first, so the first cell hits a hard stop instead of cheaply proving the loop. Order by **shape**, not size. |
| F3 | `workflow-state` migrates as one cell against the D30 map | **F10** | It carries **139 anchors** (B36/R58/E25/P20) vs precedents of 26 and 47 — one commit, maximum drift, at the least reviewable moment. |

## Locked Decisions (F2)

| ID | Decision | Rationale |
|----|----------|-----------|
| F1 | **The coverage gate derives its ground truth before any new area is migrated.** `okf_migrate` gains an inventory mode that extracts anchors from a **git-pinned pre-migration blob** (`git show <sha>:<path>`), replacing the hand-authored `ANCHOR_REGISTRY` constant. The two shipped registries (advisor-protocol 26, critical-patterns 47) are retrofitted to the derived form and must reproduce their exact counts. | This repo's own promoted pattern (`pattern-20260722-coverage-gate-derives-ground-truth`) says a gate comparing two hand-authored lists proves consistency, not coverage. Hand-authoring 10 more registries would multiply that defect by ten. Fixing it first makes every later migration honest and cheaper. |
| F2 | **One area per cell, one commit per cell**, ordered smallest-structure-risk first: `decision-memory` (39) → `verify-pipeline` (132) → `performance-log` (225) → `worktree-parallelism` (225) → `feedback-digest` (355) → `doctrine-layer` (386) → `onboarding` (689) → `hook-runtime` (762) → `workflow-state` (1464). | Each migration is independently verifiable and independently revertible. Ascending size means the derived-inventory machinery is exercised on cheap areas before the expensive ones, and a systemic flaw surfaces at 39 lines, not 1464. |
| F3 | **`workflow-state` uses the map locked in okf-foundation D30** — nine concepts (overview, gates, cells, handoff, recovery, multi-session, review-sessions, dispatch, advisor-consult), with R-rules, edge cases and pointer bullets distributed to the concept each governs, never collected into a dumping ground. It is the LAST cell and gets its own validating pass. | The map was derived from real line anchors during okf-foundation's review loop 2; re-deriving it would repeat work already paid for. Its size and cross-cutting rules make it the only area whose failure mode differs in kind, not degree. |
| F4 | **`system-overview.md` and `reading-map.md` are NOT migrated as areas.** `system-overview.md` (7 lines) is an unwritten stub — it is *written* as a bundle concept (`bee.overview`… note: no such type exists, so it becomes a `bee.area` concept with `bee.authoritative_for: system-overview`) only if content can be derived from existing specs without invention (D10); otherwise it stays a stub and is filed as an open gap. `reading-map.md` stays a hand-written legacy index outside the bundle until F3 retires `docs/specs/` entirely. | Neither is an area spec. Migrating an empty stub would fabricate content; migrating the reading map would create the second-source-of-truth the profile forbids while `docs/specs/` still holds unmigrated areas. |
| F5 | **Every migrated area's concepts declare `bee.areas` and the work item's `required_context` is not retrofitted.** `context`'s area-decision tier stays fixture-covered until a `bee.decision` concept exists (F3). | Honest scope: F2 migrates areas; it does not invent decision concepts or rewrite F1's work item. |
| F6 | **A migration cell is not done until the area's coverage gate is a chain suite.** Each cell adds its own `okf_migrate --check <area>` entry to `EXTRA_SUITES` and pins it — declared in the cell's `files` from the start (the okf-6 lesson: a cell that adds a chain gate declares the chain files). | A coverage gate that exists but is not in the chain protects nothing after the cell closes. |
| F7 | **Legacy citations into a migrated area are rewired in the same cell as its stub (D37), except `docs/history/**` which stays archive.** Each cell greps `skills/`, `scripts/`, `hooks/`, `.bee/bin/`, `AGENTS.md` and `docs/specs/` for anchor citations into its source and repoints them. | A stub that preserves the path but orphans the anchors is the exact failure D37 exists to prevent; leaving it to a later sweep means shipping known-dangling citations. |

| F8 | **The extractor is shape-aware and self-reporting; the pin is content-addressed.** A pin is `{commit, path, blob_sha, expected_counts}` and **all four** are asserted — a count *mismatch*, not merely an empty set, is a loud typed failure. The inventory reports **unparsed lines** so a format it cannot read is visible instead of silently absent. Each area declares its anchor scheme (nine-section `B*/R*/E*/P*`, flat `PAT*`, or a per-area scheme chosen explicitly). The pre-migration source is **committed verbatim** under `docs/history/okf-migration-f2/sources/<area>.md` and verified with `git hash-object` against `blob_sha`, so a `--depth 1` clone (where `git show <sha>:<path>` fails outright) still verifies. | Advisor, measured. A derived set is trusted *more* than the hand list it replaces — so an extractor that cannot see an anchor format converts "lost content" into "content that never existed". Unparsed-line reporting is what makes format-blindness visible; expected_counts is what stops both the empty-set hole and a silent extractor regression. |
| F9 | **Order by spec shape, not size.** Prove the derived loop on a genuine nine-section area first (`doctrine-layer`, 20 anchors). Then the other conforming areas. The **shapeless** areas (`decision-memory`, `worktree-parallelism`, and any area whose inventory reports 0 or heavy unparsed lines) get an explicit per-area anchor scheme decided at authoring time — the `PAT*` precedent from okf-6 is the model — never a forced fit into `B*/R*`. | Ascending-by-size delivered the opposite of its stated benefit. Shape is the variable that actually decides whether the mechanism applies. |
| F10 | **`workflow-state` is split across multiple cells**, grouped by the D30 concept clusters, never one commit. Its 139 anchors arrive in reviewable batches, each with its own coverage delta. | 139 anchors is 3–5× either precedent; a single commit at the end of a long serial run is peak drift and minimum reviewability. |
| F11 | **Per-anchor fidelity floor.** For each anchor, the owning concept's body must retain a normalized token overlap (≥60%) with that anchor's text in the pinned blob. Below the floor is a coverage-gate failure naming the anchor. | Set-equality catches *loss*; it cannot catch **anchor-shaped compliance** — hitting the count by summarizing an anchor away. This is the degradation mode of a long serial re-authoring run, and it is mechanically checkable without a judge. |
| F12 | **Per-cell drift telemetry.** Every migration cell reports anchors-per-concept and concepts-per-100-source-lines and fails on an outlier against the running median of already-migrated areas; the whole-bundle invariants (authority uniqueness, zero `not_canonical`, index freshness) run every cell. | Drift should land as a chain red at cell 4, not be discovered at cell 10. |

## Existing Code Context

- `scripts/okf_migrate.mjs` — `--inventory`, `--check <area>`, `--check-patterns`; `ANCHOR_REGISTRY`
  is the hand-authored constant F1 replaces.
- `docs/knowledge/areas/advisor-protocol/` — the shape every migrated area follows (4 concepts +
  generated index); `docs/specs/advisor-protocol.md` — the stub shape (pointer + 26-row anchor map).
- `.bee/bin/lib/knowledge.mjs` — `emitFrontmatter`/`parseFrontmatter`; hand-written frontmatter WILL
  trip the round-trip guard (it caught the orchestrator twice during okf-foundation compounding).
  Author through the emitter or normalize afterwards.
- `scripts/run_verify.mjs` `EXTRA_SUITES` — where each area's gate lands (F6).

## Outstanding Questions

### Resolve Before Planning
None.

### Deferred To Planning
- [ ] Whether the derived inventory pins one blob per area (a sha recorded per area) or resolves the
  file's last commit before its stub landed — answered by implementing F1 against the two shipped areas.
- [ ] Whether `hook-runtime` (762) and `onboarding` (689) need a locked decomposition map like
  `workflow-state` did, or whether their headings are genuinely topical — answered by reading their
  heading structure at cell-authoring time, per the promoted surface-structure pattern.

## Deferred Ideas
- F3: delete the pointer stubs, retire `docs/specs/` and `reading-map.md`, rewire the skills to read
  the bundle, author `bee.decision` concepts, and take `check --strict` into the chain.
