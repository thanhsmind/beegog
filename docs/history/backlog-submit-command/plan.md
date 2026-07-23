---
artifact_contract: bee-plan/v1
mode: standard
approved_gate2: 2026-07-23
---

# Plan: backlog-submit-command

Mode: `standard` — 0 risk flags, but 4 product files (`skills/bee-hive/templates/lib/backlog.mjs`, `skills/bee-hive/templates/lib/command-registry.mjs`, `skills/bee-hive/templates/bee.mjs`, one test file) exceeds `small`'s 3-file cap, so this is standard by the mechanical file-count rule alone, not by risk.
Why this is the least workflow that protects the work: the file count is driven by D5's locked file split (a new shared function belongs in `lib/backlog.mjs`, alongside its siblings `readBacklogCounts`/`rankBacklog`/`renderBadges` — matching the existing pattern rather than dodging the cap by inlining it in `bee.mjs`); compressing to 3 files would mean reinterpreting a locked decision, which is a red flag in itself.

## Requirements (from CONTEXT.md)

- D1: new CLI verb `bee backlog propose --story "<title>" --cos "<acceptance criteria>" [--feature <slug>] [--json]`, invoked via normal natural-language routing (not a slash command).
- D2: auto-assigns the next PBI ID as `(highest existing P-number) + 1`; the P58 gap is never backfilled.
- D3: writes the `proposed` row and stops — no auto-start of `bee-qualifying`/`bee-exploring`.
- D4: standalone-only — no import from `.bee/backlog.jsonl` proposals.
- D5: new function `proposePbiRow` in `lib/backlog.mjs`; new `backlog.propose` entry in `lib/command-registry.mjs`; handler in `bee.mjs` (sibling pattern: `handleBacklogAdd` ~L2556, `handleBacklogCounts`/`handleBacklogRank`/`handleBacklogBadges` as the docs/backlog.md-targeting siblings to actually model this on); mirrored to `.bee/bin/**` via `onboard_bee.mjs --apply`. `bee-exploring`'s D11a and `bee-scribing`'s D8 are NOT refactored to call it (filed as backlog row P82).

## Discovery

L0/L1 — pattern already exists in-repo, cited, no separate discovery.md:
- `lib/backlog.mjs`'s `readBacklogCounts` (L50) parses the table via `splitRow`/`normalizeStatus`; `rankBacklog`/`renderBadges` (not yet read in full, read at execution) are the sibling docs/backlog.md-writing functions `proposePbiRow` joins.
- `bee.mjs`'s `handleBacklogAdd` (L2556) is the closest flag-parsing/validation-before-write pattern, though it targets `.bee/backlog.jsonl`, not `docs/backlog.md` — `handleBacklogCounts`/`handleBacklogRank`/`handleBacklogBadges` (thin `bee.mjs` wrappers calling into `lib/backlog.mjs`) are the more relevant shape for the new handler.
- `lib/command-registry.mjs`'s `backlog.add`/`backlog.counts` entries (L1016, L1060) are the registration schema to copy.
- No existing PBI-row-creation or ID-assignment function exists anywhere (confirmed twice: once during exploring's scout, once by the fresh-eyes reviewer's independent grep for `propose|PBI|assignId|nextId|highest`).
- No knowledge-area concept currently owns `docs/backlog.md`'s own mechanics (`readBacklogCounts`/`rankBacklog`/`renderBadges`) — confirmed via `grep -rl docs/backlog.md docs/knowledge/areas/*/*.md` (no hits). Scribing will need to author a first concept for this, not update an existing one — noted for the scribing handoff, not this plan's scope.

## Approach

**Recommended path:** Add `proposePbiRow(root, { story, cos, feature })` to `lib/backlog.mjs`, reusing `backlogPath`/`resolveProductRoot` (already imported there) to locate `docs/backlog.md`, and the same `splitRow` parsing `readBacklogCounts` uses to find the current max `P<n>` id across every row (not just recognized-status ones, so a row with the known status-parser bug — P77/P79-style link-annotated `done` — still counts toward the max). Appends one new row (`| P<n+1> | <story> | <cos> | proposed | <feature or —> |`) at the top of the data rows (matching `rankBacklog`'s convention that `in-flight`/`proposed` rows float to the top) — or simply appended and left for the next `backlog rank --write` pass to reposition; decide at execution based on which is less code, since both satisfy D2/D3 (per D5, this is an implementer-level call, not a locked decision). `bee.mjs` gets a thin `handleBacklogPropose` wrapper (mirrors `handleBacklogCounts`'s shape) that validates required flags (`--story`, `--cos`) and calls `proposePbiRow`, returning the assigned id. `lib/command-registry.mjs` gets one new entry, `backlog.propose`, modeled on `backlog.add`'s parameter/example shape. Mirror to `.bee/bin/**` via `onboard_bee.mjs --apply` (established pattern, proven in P79's close).

**Rejected alternatives:**
- Inlining the row-creation logic directly in `bee.mjs` instead of `lib/backlog.mjs` — rejected by locked D5 (matches the existing docs/backlog.md-writing sibling functions' location, not the `.bee/backlog.jsonl`-writing ones).
- Reusing/refactoring `bee-exploring`'s D11a or `bee-scribing`'s D8 hand-edit prose to call the new function — rejected by locked D5, filed as backlog row P82 for later.

**Risk map:**

| Component | Risk | Reason | Proof needed |
|---|---|---|---|
| ID assignment (max+1 scan) | LOW | Same parsing primitives `readBacklogCounts` already uses in production; P58's gap is explicitly a non-issue (D2) | Test: table with a gap still assigns max+1, not gap-fill |
| Row insertion position | LOW | Cosmetic — table still parses correctly regardless of row order; `backlog rank --write` already exists to fix ordering after the fact | Test: `readBacklogCounts`/`rankBacklog` accept the new row correctly wherever inserted |
| `--story`/`--cos` validation | LOW | Deferred-to-planning question from CONTEXT.md — needs a concrete answer this plan supplies | See Shape below |
| Mirror sync (`.bee/bin/**`) | LOW | Proven working pattern from P79's close this same session | Cell's verify re-runs `onboard_bee.mjs --apply` + diff-check, same as backlog-auto-commit-2's cell |

**Files and order:** `lib/backlog.mjs` (function) → `lib/command-registry.mjs` (registration) → `bee.mjs` (handler + dispatch wiring) → test file (coverage) → mirror sync. One cell, since all four are tightly coupled (same feature, same commit, same verify command) — see Shape.

**Relevant learnings:** `docs/history/backlog-auto-commit/CONTEXT.md`/reports (P79, this session) — the mirror-sync pattern and the single-execution-worker done-report discipline both apply here unchanged.

**Validation-needed answers (resolving CONTEXT.md's two deferred questions, locked here as plan-level decisions since they are implementer-level per D5, not user-facing product decisions):**
- **PD1** — `--story` required, ≤200 chars (matches `BACKLOG_MAX_TITLE` already used by `handleBacklogAdd`, reused for consistency); `--cos` required, ≤2000 chars (existing CoS cells run long — e.g. P69's CoS is ~1400 chars — a low cap would reject real usage; 2000 is generous headroom, not a locked business rule).
- **PD2** — `--feature` optional, defaults to `—` (the existing table's own convention for unassigned features, e.g. P75/P72/P73 in the live table).

## Shape

**Epic map (single-slice — no observable milestones to phase):**

Feature outcome: a human can run `bee backlog propose` and get back a new PBI id.
Repo-reality basis: `lib/backlog.mjs`/`command-registry.mjs`/`bee.mjs` all already have the sibling functions/entries/handlers this extends (Discovery above).

| Epic | Capability/Risk Area | Why It Exists | Slices | Proof Needed |
|---|---|---|---|---|
| E1 | New `backlog.propose` capability | Direct answer to P80's own acceptance criteria | 1 (this is the whole feature) | Green verify + a real invocation appending a correctly-formed row |

**Current slice to prepare:** E1, slice 1 — the entire feature, one cell (all four files are inseparable: the function has no caller without the handler, the handler has no discoverability without the registry entry, and none of it ships without a test proving it).

## Test matrix

Standard lane — one pass over all 12 edge dimensions (`edge-dimensions.md`), noting only the ones that bite for this feature:

1. **User types** — n/a (single caller class: any agent running the CLI verb).
2. **Input extremes** — `--story`/`--cos` at/over their length caps (PD1); empty/whitespace-only story; missing required flags.
3. **Timing** — n/a (single synchronous file operation, no concurrency window opened by this feature beyond what `docs/backlog.md` edits already have).
4. **Scale** — table with many rows (already ~78) parses correctly; new row doesn't corrupt existing rows.
5. **State transitions** — n/a (new rows are always born `proposed`; no transition logic in this feature).
6. **Environment** — repo with the P58-style gap present (confirmed via the live table) still assigns id correctly; a table with zero existing `P<n>` rows (degenerate case — not expected live, but must not crash) starts at P1.
7. **Error cascades** — a rejected `--story`/`--cos` (validation failure) leaves `docs/backlog.md` untouched, matching `handleBacklogAdd`'s "any rejection leaves the file untouched" convention.
8. **Authorization** — n/a (no auth surface; same trust level as every other bee CLI verb).
9. **Data integrity** — the new row must remain parseable by `readBacklogCounts` (no pipe-character escaping bugs, no accidental multi-line cell content); assigned id must never collide with an existing id even when called twice in immediate succession within one process (no concurrency guard needed for a single synchronous CLI invocation, but the id-scan must re-read the file fresh, never cache).
10. **Integration** — mirror sync to `.bee/bin/**` stays byte-identical post-`onboard_bee.mjs --apply`; `--json` output shape matches sibling verbs' `{result, text}` convention.
11. **Compliance** — n/a.
12. **Business logic** — id is strictly `max+1`, gap never backfilled (D2); row status is always `proposed`, never any other value (D1/D3 — this verb never writes `in-flight`/`done`).

## Out of scope

- Auto-starting `bee-qualifying`/`bee-exploring` after submit (D3).
- Importing/mapping a `.bee/backlog.jsonl` proposal entry into the new row (D4, filed as backlog row P81).
- Refactoring `bee-exploring`/`bee-scribing`'s hand-edit conventions to call the new function (D5, filed as backlog row P82).
- A Claude-Code-only slash-command wrapper (D1 — the option not chosen).
- Backfilling the P58 gap (D2).
