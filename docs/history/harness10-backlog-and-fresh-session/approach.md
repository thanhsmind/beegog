# harness10 — Approach

**Feature:** harness10-backlog-and-fresh-session · **Date:** 2026-07-08 · **Discovery level:** L1 (precedent: harness09 adopted docs/09 items 1–5 through the exact same seams — config commands, inject preamble, onboard notices, AGENTS block, skill references; this feature extends those seams, no new territory)

## Chosen Path

Extend existing seams only — no new subsystem:

- **Detector** (D3): new `templates/lib/commands_detect.mjs` — pure read, returns candidate `{key, value, source}` list; surfaced through the existing onboarding capture notice and exploring's command question. Vendored to `.bee/bin/lib/` by the existing copy step.
- **Bootstrap mode** (D2): prose-only — scribing SKILL modes table + reference section; hive onboarding offers it when `docs/specs/` lacks the two map files. Skeletons are written by the agent following the skill, not by a script.
- **Outside-markers audit** (D4): a new plan-item type inside `onboard_bee.mjs`'s existing `changes_needed` consent flow; proposed header text lives in a template file.
- **Preamble** (D5, D10): `buildSessionPreamble` gains a project-map section and one PBI-counts line — same pattern as the commands section added in harness09.
- **Backlog** (D6, D8, D11, D12): `docs/backlog.md` conventions owned by scribing (template + merge rules in its reference); hive routing reference gains the projection rule (D12) and flip triggers awareness; grooming reference gains drift audit lines + probe-fix naming (D10). `bee_status` parses only the Status column tokens, tolerant of absence.
- **Cells** (D9): additive optional `pbi` string field — schema comment + reference doc; no validation coupling.

## Rejected Alternatives

- **`bee_backlog.mjs` helper with enforced transitions** — violates D7 (no mechanical enforcement of PBI moves); adds a refusal path where no verify evidence exists.
- **PBIs in `.bee/backlog.jsonl` with a rendered markdown view** — violates D6; two representations of one fact is the fork-the-truth disease.
- **Script-generated skeletons** (bootstrap as a .mjs) — skeleton quality depends on judgment (what is "provable"); a script would either invent or produce noise. Skill-guided agent writing is the harvest precedent.
- **Generated init.sh / Makefile** — re-confirmed 09 skip.

## Risk Map

| Component | Risk | Proof needed |
|---|---|---|
| commands_detect.mjs (new, pure read) | LOW | unit tests over fixture dirs (package.json, Makefile, pyproject, none) |
| scribing/hive/grooming reference prose | LOW | fresh-eyes doc review at reviewing |
| onboard_bee.mjs audit item | MEDIUM — touches consent flow with strong existing tests | test_onboard_bee: item appears when region silent, absent when answered, never writes without --apply, idempotent re-apply, user content preserved |
| inject.mjs preamble additions | MEDIUM — covered behavior | test_lib preamble assertions extended (present/absent/warning states) |
| bee_status backlog parsing | MEDIUM — parses human-edited markdown | minimal parser (Status column tokens only), fixture tests incl. missing file + malformed row |
| cells `pbi` field | LOW | additive; one test that cap ignores it |

## Files And Order (per D1 slices)

1. **A2**: `templates/lib/commands_detect.mjs` + `templates/tests/test_lib.mjs` + onboard notice + `skills/bee-exploring/SKILL.md` (D3 wiring)
2. **A1**: `skills/bee-scribing/SKILL.md` + `references/scribing-reference.md` + `skills/bee-hive/SKILL.md` (offer line)
3. **A3/A4**: `skills/bee-hive/scripts/onboard_bee.mjs` + header template + `templates/lib/inject.mjs` + both test suites
4. **B** (+A5 riding): scribing reference (backlog template + merge rules), `skills/bee-hive/references/routing-and-contracts.md` (D12), grooming reference (drift + probe-fix), `templates/bee_status.mjs` + `templates/lib/state.mjs` (counts), `templates/lib/cells.mjs` (pbi field), `templates/lib/inject.mjs` (PBI line), `AGENTS.block.md` (pointer, budget-checked), tests

## Relevant Learnings

- critical-patterns [20260708]: node cannot resolve MSYS `/tmp` paths — tests keep using `E:` scratchpad temp dirs (test_onboard_bee already does).
- harness09: onboarding notice + preamble section + drift-guard test is the proven trio for a new config-carried fact; reuse verbatim.

## Open Questions For Validating

- Detector on a repo with *both* package.json scripts and Makefile targets for the same key — proposal ordering/dedup rule needs one concrete check.
- `bee_status` PBI parse against a backlog.md whose table has extra columns or bold text — confirm the minimal parser survives, else tighten the template wording.
- AGENTS block length after the pointer line — verify the block stays within its current line budget.
