# Fresh-Session Artifact Generators + PBI Layer — Context

**Feature slug:** harness10-backlog-and-fresh-session
**Date:** 2026-07-08
**Exploring session:** complete (scope-earlier path)
**Scope:** Standard
**Domain types:** RUN | ORGANIZE | READ

## Feature Boundary

bee gains (A) generators for the Fresh Session Test artifacts it currently only detects as missing — a scribing bootstrap mode, command auto-detection, an AGENTS.md outside-markers audit, preamble project-map lines, and grooming probe items that name their one-command fix — and (B) a product-backlog layer above cells: `docs/backlog.md` with three statuses, proactively captured, wired into the existing chain with no new gates. Ends at: no hook enforcement of PBI transitions, no changes to cell capping/gating mechanics, no init-lane work (09 item 6 stays adopt-later).

## Locked Decisions

These are fixed. Planning must implement them exactly — cited, never reinterpreted.
Changing one requires the user, a new D-ID or an explicit supersession note, never
a silent edit.

| ID | Decision | Rationale (only if it changes implementation) |
|----|----------|-----------------------------------------------|
| D1 | Both parts (A generators, B PBI layer) ship as one feature, sliced per docs/10 sequencing: A2 → A1 → A3/A4 → B; the reference-doc paragraphs (A5, grooming drift lines) ride the last landing slice, never a slice of their own | slices are independently cappable; A2 unblocks the daily friction first |
| D2 | `bee-scribing` gains a **bootstrap** mode: when `docs/specs/` lacks system-overview or reading-map, offer (never auto-run) a bounded skeleton pass writing only mechanically provable facts; every meaning is an Open Gap, `coverage: partial`; no interviews (that stays harvest) | never-invent holds; bootstrap = inventory, harvest = meaning |
| D3 | Command detection **proposes, the user confirms**: scan package.json scripts / Makefile / pyproject.toml / composer.json / *.csproj / go.mod+Makefile; present one pre-filled confirmation question; write confirmed values to `.bee/config.json` commands; never write unconfirmed values | replaces the skippable open question from 09 item 1 capture |
| D4 | AGENTS.md outside the BEE markers is **propose-only**: onboarding checks whether the region answers "what is this project" (one line + pointers); if not, adds a `changes_needed` plan item; existing consent mechanism applies, no silent edits ever | the consent plan path already exists in onboard_bee.mjs |
| D5 | `inject.mjs` preamble gains a project-map section, 2–4 lines max: pointers + specced-area count when specs exist; one warning line when missing | token budget is the constraint; pointers, never content |
| D6 | Product backlog = `docs/backlog.md`: one markdown table `ID \| Story \| CoS \| Status \| Feature`, statuses exactly `proposed / in-flight / done`, priority-ordered, scribing-owned with in-place merge rules (specs pattern); NOT stored in `.bee/backlog.jsonl` (that file stays friction/bee-improvement) | human-first artifact; JSONL stays machine-layer |
| D7 | PBI transitions are prose-ruled + grooming-audited, **never hook-enforced**; mechanical enforcement remains cells-only | PBI moves are human priority calls without verify evidence |
| D8 | Deferred requests are captured as PBI rows **unprompted, same turn** (decision-0007 extension); exploring's Deferred Ideas feed backlog rows | user saying "ghi vào backlog" = detection already failed |
| D9 | Cell schema gains an **optional** `pbi` field (string, references a backlog ID); no validation coupling — a missing or stale reference is a grooming find, not a cap blocker | traceability without new refusal paths |
| D10 | `bee_status` reports PBI counts and the preamble carries one line `PBI: N done / N in-flight / N proposed`; grooming audits drift (in-flight row without active feature, done feature without row, duplicate rows), and each Fresh Session Test probe finding names its one-command fix (D2 bootstrap or D3 detect) instead of an open-ended task | Q5 answered at product level at session start |
| D11 | PBI row transitions have exactly two triggers: (a) exploring opens a feature matching a row → row flips `in-flight` + feature slug, creating the row first if the request never passed through the backlog; (b) feature close (scribing sync or compounding) → row flips `done` + link to `docs/history/<feature>/` | who/when is locked so planning cannot invent other flip points |
| D12 | Direction of truth: session todo lists (TaskCreate and equivalents) are ephemeral projections of cells/PBI rows, never the reverse; stated in the bee-hive routing reference | repo artifact is the source; chat/session state is derived |

### Agent's Discretion

Detector file-format coverage beyond the D3 list; exact wording of skeleton templates, preamble lines, and grooming reference paragraphs; whether A3's proposed header text lives in a template file or inline in onboard_bee.mjs — all within the locked bounds above.

## Specific Ideas And References

- User's diagram: lecture 03 Fresh Session Test — five questions, five artifacts, "a new session starts without asking a human". Part A exists to make every arrow land on a real file.
- User-supplied PBI "Project Policy" document: adopted-substance / skipped-shape mapping is in docs/10 Part B — the table there is binding context for planning.

## Existing Code Context

### Reusable Assets

- `skills/bee-hive/scripts/onboard_bee.mjs` — plan/apply consent flow (`changes_needed` items); A3 and the A2 onboarding hook extend this, pattern already tested by `test_onboard_bee.mjs`
- `skills/bee-hive/templates/lib/inject.mjs` — `buildSessionPreamble` already injects commands + baseline gate; D5 and D10's preamble line slot in here
- `skills/bee-hive/templates/lib/state.mjs` — `COMMAND_KEYS`, `readConfig`; D3 writes through the existing config path
- `skills/bee-scribing/SKILL.md` + `references/scribing-reference.md` — modes table (sync/capture/harvest) gains bootstrap; spec template conventions reuse for skeletons
- `skills/bee-grooming/references/grooming-reference.md` — Fresh Session Test probe table (A5) and audit lists (D10 drift lines) live here
- `skills/bee-hive/templates/tests/test_lib.mjs` + `scripts/test_onboard_bee.mjs` — the verify baseline; every mechanical slice adds assertions here

### Established Patterns

- Onboarding never touches user content without a consent plan item — D4 rides this, never bypasses it
- Vendored-helper drift test (`COMMAND_KEYS matches lib/state.mjs`) — any new shared constant (PBI statuses) needs the same drift guard
- Event-sourced writes via helpers (`bee_decisions.mjs`), never hand-edited JSONL — B stays out of JSONL entirely (D6)
- Lanes scale ceremony, never memory — backlog capture is docs-layer, allowed every phase, no gate

### Integration Points

- `AGENTS.block.md` template — startup/critical-rules text mentioning backlog capture and project-map preamble (keep block ≤ current length budget; pointers only)
- `bee_status.mjs` — PBI counts (D10)
- `skills/bee-exploring/SKILL.md` — Deferred Ideas → backlog row (D8), command question replaced by confirm-detected (D3)

## Canonical References

- `docs/10-backlog-and-fresh-session-artifacts.md` — the adoption analysis; verdict tables are binding
- `docs/09-harness-course-adoption.md` — items 1 (commands), 4 (FST probe), 6 (init lane stays adopt-later)
- `docs/decisions/0007-unprompted-capture.md` — capture duty D8 extends
- `learn-harness-engineering` lectures 03, 06 (external course, read this session)

## Outstanding Questions

### Resolve Before Planning

(none — decisions locked in user discussion)

### Deferred To Planning

- [ ] Detector output shape (JSON candidates list) and where it lives: new helper vs function in onboard path — planning picks per module conventions
- [ ] Skeleton template location: scribing `references/` vs hive `templates/` — planning picks; skeletons are written by the agent (skill instructions), not by a script
- [ ] Whether `bee_status --json` schema addition (`pbi` counts) needs a version note in 07-contracts.md

## Deferred Ideas

- Init lane for greenfield repos (09 item 6) — trigger unchanged: first onboard of a repo without a build
- PBI priority scoring / ranking automation — human-ordered table is the v1; revisit only if the backlog outgrows manual ordering
- Rendering backlog status into README badges — cosmetic, no demand yet

## Handoff Note

CONTEXT.md is the source of truth. Decision IDs are stable. Planning reads locked decisions, code context, canonical references, and deferred-to-planning questions. Validating and reviewing use locked decisions for coverage and UAT.
