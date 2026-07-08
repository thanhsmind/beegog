---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: standard
current_slice: 4
---

# harness10 — Plan

**Mode gate:** 2 flags counted — `existing covered behavior` (onboard_bee.mjs, inject.mjs, bee_status are all under test; every mechanical slice touches them) + `multi-domain` (vendored helpers + skill prose + onboarding script + templates). Story-sized behavior across four slices → `standard`. Smaller modes insufficient: `small` caps at ≤3 files/no gray areas — slice 3 alone touches the consent flow plus preamble with cross-file drift risks.

## Slices (sequence locked by D1)

### Slice 1 — A2: command detection, user-confirmed (D3)

Deliverable: `detectCommands(root)` in a new `templates/lib/commands_detect.mjs` returning `[{key, value, source}]` from package.json scripts / Makefile / pyproject.toml / composer.json / *.csproj / go.mod+Makefile; onboarding's existing commands-capture notice carries the candidates; exploring's command question becomes "confirm these detected values" (one message, pre-filled) writing only confirmed values to `.bee/config.json`.
Exit state: fresh onboard on a fixture repo surfaces detected candidates; nothing is written without confirmation; drift guard between helper and state.mjs COMMAND_KEYS holds.
Verify: `node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/scripts/test_onboard_bee.mjs` (new assertions included).

### Slice 2 — A1: scribing bootstrap mode (D2)

Deliverable: scribing modes table gains **bootstrap** (trigger: `docs/specs/` missing system-overview or reading-map; offered, never auto-run); reference gains the bounded-skeleton rules (provable facts only, meanings → Open Gaps, `coverage: partial`, no interviews); hive Session Scout offers bootstrap when the state layer is absent.
Exit state: prose complete and consistent across the three files; no mechanical change.
Verify: same command (regression) + fresh-eyes read at reviewing.

### Slice 3 — A3+A4: outside-markers audit + preamble project map (D4, D5)

Deliverable: `onboard_bee.mjs` plan gains a propose-only `changes_needed` item when the entry-file region outside BEE markers cannot answer "what is this project" (heuristic: no non-empty prose line outside markers); proposed minimal header (one what-line + pointers) lives in a template; `buildSessionPreamble` gains the project-map section (pointers + specced-area count when present; one warning line when absent).
Exit state: consent flow untouched in behavior (never silent writes, idempotent re-apply, user content preserved — existing assertions still green); preamble states covered by new assertions.
Verify: same command (new assertions included).

### Slice 4 — B: PBI layer (+ A5 riding) (D6–D12)

Deliverable: `docs/backlog.md` table conventions + merge rules in scribing reference (statuses `proposed/in-flight/done`, priority-ordered, in-place forever); capture duty for deferred requests (D8) in scribing SKILL + exploring Deferred Ideas wiring; flip triggers (D11) in scribing/compounding prose; projection rule (D12) in hive routing reference; grooming drift lines + FST-probe-names-fix (D10/A5); `bee_status` PBI counts + preamble `PBI: N done / N in-flight / N proposed` line (minimal Status-column parser, absence-tolerant); optional `pbi` field accepted on cells (D9, no validation coupling); AGENTS block pointer within budget.
Exit state: fixture backlog.md parsed correctly incl. missing/malformed cases; cap ignores `pbi`; block budget held.
Verify: same command (new assertions included).

## Test Matrix (edge dimensions, standard depth)

| Dimension | Concrete case |
|---|---|
| absence | repo with no manifest files (detector → empty, no crash); no backlog.md (status omits PBI line) |
| conflict | package.json and Makefile both define test → dedup/ordering rule asserted |
| malformed input | backlog row with missing columns / bold text → parser skips, never throws |
| duplication | duplicate PBI ids → grooming drift line (prose) + parser counts honestly |
| idempotency | onboard re-apply with audit item → byte-identical second apply |
| preservation | user content outside markers never modified without --apply + consent |
| platform | all new fs code uses Windows-safe absolute paths (critical-pattern 20260708) |
| budget | AGENTS block line count ≤ current after pointer line |
| degradation | no docs/specs → preamble warning line, not silence |
| tolerance | extra columns in backlog table → Status column still found |
| security | detector reads manifests only — never .env/secrets-shaped files (scout list untouched) |
| drift | new shared constants (PBI statuses) get a helper↔state.mjs drift assertion like COMMAND_KEYS |

## Current Slice — 1 (A2: command detection)

Files bounded:
- `skills/bee-hive/templates/lib/commands_detect.mjs` (new) — `detectCommands(root)` → `[{key, value, source}]`; manifest files only, never secret-shaped paths
- `skills/bee-hive/templates/tests/test_lib.mjs` — fixture-dir unit tests (empty repo, package.json, Makefile, conflict dedup, csproj/pyproject/composer/go.mod)
- `skills/bee-hive/scripts/onboard_bee.mjs` — commands-capture notice carries detected candidates
- `skills/bee-hive/scripts/test_onboard_bee.mjs` — notice-with-candidates assertions
- `skills/bee-exploring/SKILL.md` — command question becomes confirm-detected (per D3)

Verification: `node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/scripts/test_onboard_bee.mjs`

Cells: harness10-1 (detector + unit tests), harness10-2 (onboarding notice + exploring wiring, deps: harness10-1). **Executed and capped 2026-07-08** (commits 8c9ab98, 1022a3c).

## Current Slice — 2 (A1: scribing bootstrap mode)

Files bounded (prose-only; no mechanical change):
- `skills/bee-scribing/SKILL.md` — modes table gains **bootstrap** (trigger: `docs/specs/` missing system-overview or reading-map; offered, never auto-run)
- `skills/bee-scribing/references/scribing-reference.md` — bounded-skeleton rules: provable facts only, meanings → Open Gaps, `coverage: partial`, no interviews (harvest owns meaning), skeleton templates for system-overview + reading-map
- `skills/bee-hive/SKILL.md` — Session Scout offers bootstrap when the state layer is absent (one sentence)

Verification: regression only — `node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/scripts/test_onboard_bee.mjs` (prose changes must not break anything); prose quality lands on bee-reviewing (Gate 4).

Cells: harness10-3 (single small cell, deps: none). **Executed and capped 2026-07-08** (commit cce7021).

## Current Slice — 3 (A3: outside-markers audit + A4: preamble project map)

Two cells, disjoint files → one parallel wave:

**harness10-4 (A3, D4)** — `skills/bee-hive/scripts/onboard_bee.mjs` + `scripts/test_onboard_bee.mjs`. computePlan gains a `propose_agents_header` item when the entry-file region outside BEE markers has no non-empty prose line; apply prepends a minimal header above the block: repo folder name as title, pointer lines only to files that actually exist (README.md, docs/specs/system-overview.md, docs/specs/reading-map.md), and one loud `[unknown]`-style fill-me line for the project one-liner (bootstrap philosophy: provable facts + loud gap, never invented prose). Fires ONLY when the region is empty of prose — existing user content is never touched (consent mechanics unchanged).

**harness10-5 (A4, D5)** — `skills/bee-hive/templates/lib/inject.mjs` + `templates/tests/test_lib.mjs`. buildSessionPreamble gains a Project map section, 2–4 lines hard cap: when a map file exists → pointers to `docs/specs/system-overview.md` / `reading-map.md` + specced-area count; when both missing → one warning line naming bee-scribing bootstrap as the fix. PBI counts line stays out (slice 4, D10).

Verification (both): `node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/scripts/test_onboard_bee.mjs` with new assertions.

Cells: harness10-4, harness10-5 (no deps between them). **Executed and capped 2026-07-08** (commits 3e81ecf, b3e206c; sequential dispatch per validation constraint).

## Current Slice — 4 (B: PBI layer, A5 riding, dogfood sync)

Three cells, sequential (harness10-7 deps 6; harness10-8 deps 7):

**harness10-6 (mechanical — D6 parser surface, D9, D10)** — new `templates/lib/backlog.mjs`: minimal parser for `docs/backlog.md` reading only the Status column tokens (`proposed / in-flight / done`), tolerant of absence, extra columns, bold text, malformed rows (skip, never throw); duplicate-ID honest counting. `templates/bee_status.mjs` reports PBI counts; `templates/lib/inject.mjs` preamble gains one line `PBI: N done / N in-flight / N proposed` (only when backlog.md exists). `templates/lib/cells.mjs` accepts optional `pbi` string field (no validation coupling — D9). Tests for all states.

**harness10-7 (prose — D6 ownership, D8, D11, D12, A5/D10 audit lines)** — scribing reference: backlog table template (`ID | Story | CoS | Status | Feature`, 3 statuses, priority-ordered, in-place forever) + merge rules; scribing SKILL: capture duty for deferred requests (unprompted, same turn) + done-flip at sync (D11b); exploring SKILL: Deferred Ideas feed backlog rows + in-flight flip at feature open (D11a); compounding SKILL: done-flip fallback line; hive routing-and-contracts reference: projection rule (D12); grooming reference: PBI drift audit lines + FST-probe-items-name-their-fix (A5/D10); AGENTS.block.md: one backlog pointer line (budget: 90 lines now, stay ≤100).

**harness10-8 (dogfood sync — tiny)** — re-run onboarding `--apply` on the bee repo itself so vendored `.bee/bin` picks up all template changes (inject, backlog, cells, commands_detect, status) and the AGENTS block update; confirm `bee_status` and the preamble show the new sections in this very repo.

Verification (all): both suites; harness10-8 additionally asserts vendored-file freshness via onboarding recheck `up_to_date`.
