# Validation 1: Skill Metadata Parity

## Reality gate

REALITY GATE REPORT  
Mode: standard  
Current work: derive and enforce Codex metadata projections for all shared bee skills.  
MODE FIT: PASS — 3 mechanical flags (public contract, covered behavior, multi-domain) justify standard; no hard-gate flag exists.  
REPO FIT: PASS — 15 live `skills/bee-*` directories exist; each has one folded `name`/`description` frontmatter source; `.codex-plugin/plugin.json` bundles `./skills/`; onboarding fingerprints and mirrors nested skill files.  
ASSUMPTIONS: PASS — all blocking assumptions are proved below.  
SMALLER PATH: PASS — hand-authored YAML would violate the requested same-information guarantee; a renderer plus one canonical suite link is the smallest durable path.  
PROOF SURFACE: PASS — cell commands use Node, shell built-ins, and the repo's recorded full verify; RED verification now requires an exact expected diagnostic rather than any nonzero exit.  
Decision: proceed.  

## Feasibility matrix

| Assumption | Risk | Proof required | Evidence | Result |
|---|---|---|---|---|
| OpenAI recognizes `agents/openai.yaml` fields | Medium | Official schema | Official Build Skills metadata section: `interface.display_name`, `interface.short_description`, `policy.allow_implicit_invocation` | PASS |
| One parser shape covers the live tree | Medium | Census | 15/15 live `SKILL.md` files use `description: >-` and a hyphen-case `name` in frontmatter | PASS |
| Nested metadata ships to Codex | Low | Manifest inspection | `.codex-plugin/plugin.json` points `skills` to `./skills/` | PASS |
| Nested metadata ships through Claude onboarding | Low | Implementation + existing tests | `walkSkillTree()` fingerprints all nested files; onboarding deep-mirror cases pass | PASS |
| Baseline is healthy | Medium | Full verify outside managed sandbox | library suite 215 passed; onboarding 0 failed / 1 filesystem-dependent skip | PASS |
| Missing/stale/orphan states are enforceable | Medium | Explicit fixture ownership | `smp-1` owns named fixtures; `smp-2` owns `--root`, exact schema, orphan detection, and idempotence | PASS |

## Plan checker

Iteration 1: 2 BLOCKER, 1 WARNING.

- Closed: canonical test-suite ownership added to `smp-1`.
- Closed: orphan/unexpected metadata and add/remove/rename fixture contracts added.
- Closed: exact emitted schema and serialization pinned.

Iteration 2: 0 BLOCKER, 1 WARNING.

- Closed: display-name algorithm pinned (`bee-hive` → `Bee Hive`; `bee-writing-skills` → `Bee Writing Skills`).

Final structure result: PASS.

## Cold-pickup cell review

Iteration 1: 4 CRITICAL, 1 MINOR. The suite link, exact RED diagnostic, pressure target, fixture rows, and schema were repaired in the cells.

Iteration 2: 1 CRITICAL, 1 MINOR. Whole-output equality replaced substring matching; display normalization was made exact.

Iteration 3: 0 CRITICAL, 0 MINOR. All three cells are cold-pickup ready.

## Approval block

VALIDATION COMPLETE - APPROVAL REQUIRED BEFORE EXECUTION  
Mode: standard  
Work: RED contract → generated metadata projection → full proof  
Reality gate: PASS  
Feasibility: READY WITH CONSTRAINTS  
Structure: PASS after 2 plan-checker iterations and 3 cell-review iterations  
Spikes: none  
Cell review: PASS (3 cells, 0 CRITICAL open)  
Unresolved concerns: full CLI-heavy verification must run outside the managed sandbox because nested Node processes are denied inside it.

