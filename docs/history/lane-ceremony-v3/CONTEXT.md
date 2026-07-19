# Lane Ceremony v3 — Context

**Feature slug:** lane-ceremony-v3
**Date:** 2026-07-19
**Exploring session:** complete
**Scope:** Standard
**Domain types:** READ | ORGANIZE (doctrine text + templates + doctrine tests; no runtime UI/API)

## Feature Boundary

Redesign the tiny/small lane ceremony and the plan/slice contract in bee's doctrine layer — skill texts, references, templates, and the doctrine/conformance tests that assert the old wording — so that small work starts from an executable work packet instead of a shrunken feature plan, and an approved plan is never mutated after its gate. No new storage formats, no new CLI verbs, no state-machine behavior changes beyond what the doctrine tests require.

Origin: user-supplied design critique (2026-07-19) verified claim-by-claim against v1.6.2 source; all six accepted findings were filed as backlog rows (`.bee/backlog.jsonl`, 3× proposal P1 + 3× friction P2, ts 2026-07-19T11:12:52.*) and the user directed "làm toàn bộ cho hoàn chỉnh tốt nhất" (implement the full set, best-quality).

## Locked Decisions

These are fixed. Planning must implement them exactly — cited, never reinterpreted.
Changing one requires the user, a new D-ID or an explicit supersession note, never
a silent edit.

| ID | Decision | Rationale (only if it changes implementation) |
|----|----------|-----------------------------------------------|
| D1 | `plan.md` is **frozen at Gate 2**: once `approved_gates.shape` is set, its content sections are immutable; the only permitted post-approval write is an approval stamp (status + timestamp). The current "enrich the same plan.md in place to implementation-ready" instruction (bee-planning §6) is removed; the `artifact_readiness` requirements-only→implementation-ready mutation dies with it. | The artifact the human approved must stay byte-equal to the artifact that ships; post-approval enrichment created approval churn and made the brief drift rule fire by design. |
| D2 | The **current slice lives only in cells** (`.bee/cells/*.json`). Prep creates the current slice's cells; "active slice" = the feature's open (uncapped) cells. No current-slice section in `plan.md`, no new slice artifact, no new CLI verb, no `slice_id` field in v3. | Cells already carry files/action/read_first/must_haves/verify — a slice document would re-create the three-layer duplication this feature removes. Machine-layer slice records are explicitly deferred. |
| D3 | **Tiny lane drops `plan.md` entirely**: request + one cell is the complete work shape; the cell is the micro-plan. The mode-gate record (flag count + product-file count + lane choice) lands in the cell itself (its action/notes text) for tiny, and in the logged scoping-synthesis decision for small — never in a plan document. The AO14 dispatched execution worker and the orchestrator-authored done-report (worker's verbatim diff + orchestrator's own fresh verify) are unchanged. | Replaces bee-planning §3's "record the count and the flags in plan.md" for lanes that no longer have one. |
| D4 | **Small lane:** a short scoping synthesis (logged through the decisions CLI, with D-IDs) + 1–3 cells is the default complete shape. `plan.md` becomes opt-in for small — created only when a durable multi-slice strategy or product-decision document is genuinely needed, never by default. | |
| D5 | **Tiny/small gate ordering inverts:** draft cell(s) preview + the inline reality check happen BEFORE the merged shape+execution question; the approval (or bypass auto-approval) covers the exact previewed work packet; cells are persisted and claimed only after approval. Execution approval is never granted before the execution package exists. The preview is a rendered draft in the gate message (or, under bypass, in the auto-approval audit line) — `cells add` runs only after approval; never persist-then-preview. | |
| D6 | **Lane file caps count product files only** — production source, tests, and runtime config the behavior change itself must touch. Never counted: `.bee/**`, `docs/**` (history, specs, backlog), plans/briefs/reports, and generated projections/manifests (plugin renders, release manifest). | Stops bee's own artifacts from inflating a tiny fix past its lane. |
| D7 | **Risk flags narrowed:** "existing covered behavior" becomes "changes behavior an existing test asserts (a covered contract must change)"; "weak proof around the area" becomes "the change requires weakening, deleting, or replacing existing proof". A covered bugfix that keeps existing tests green and adds a new one scores 0 on both. All other flags and the 2-3→standard / 4+→high-risk thresholds are unchanged. | |
| D8 | **Planning order inverts: cheap intake classification first** (request text + at most 2 targeted file reads), then lane-scaled bootstrap — tiny: targeted reads only; small: bounded bootstrap (CONTEXT.md if one exists + recent decisions); standard/high-risk: full bootstrap as today. The critical-patterns digest stays mandatory in EVERY lane, tiny included — it is already surfaced in the session preamble, so honoring it costs no extra read; D8 rescopes only the *additional* bootstrap reads (full CONTEXT/decisions/learnings/status sweeps). This deliberately supersedes bee-planning §1's unconditional full-bootstrap ordering; AGENTS.md startup step 5 (read critical-patterns before planning) is unchanged. The mode gate re-runs upward any time evidence demands escalation; de-escalation requires cited evidence. | Tiny work must not pay full context reads before knowing it is tiny — but never at the cost of the mandatory patterns digest. |
| D9 | **Standard/high-risk chain keeps** Gate 2 → Prep (cells) → validating → Gate 3, now with D1's frozen plan. bee-briefing projects from the frozen plan + cells; its drift rule ("Needs Revision" re-render) now triggers on cell changes only, since the plan can no longer drift after approval. | |
| D10 | **Scope guard:** doctrine layer only — `skills/*/SKILL.md`, `skills/bee-hive/references/*`, skill templates, **the AGENTS.md operating block and any README.md sections that restate the lane/plan doctrine (updated in lockstep — shipping contradictory doctrine surfaces is out of the question)**, and whatever tests/renders assert the old wording (doctrine, conformance, skill render, plugin projections, release manifest). `bee.mjs`, hooks, and the state machine change only where a doctrine test forces a matching assertion update. | Keeps the feature shippable in one pass; machine enforcement of D1/D2 is deferred work, not silent scope. |

### Agent's Discretion

Exact prose of the rewritten skill sections, section ordering/renaming, which sentences move to references, and how doctrine-test assertions are updated — free within D1–D9. Anything that would weaken a gate, an evidence rule, or the AO14 worker contract is out of discretion.

## Terms

| Term | Meaning in this feature |
|------|-------------------------|
| work packet | The previewed cell(s) + verify command(s) that a merged shape+execution gate approves — the exact thing execution will run. |
| active slice | The feature's currently open (uncapped) cells; not a document. |
| product files | Files counted by the lane caps per D6: production source, tests, runtime config touched by the behavior change itself. |
| plan freeze | D1's rule: post-Gate-2 `plan.md` accepts only an approval stamp, never content edits. |

## Existing Code Context

From the verified scout (claim-check digest, 2026-07-19, against v1.6.2):

### Integration Points

- `skills/bee-planning/SKILL.md` — §1 Bootstrap (lines ~26-34, reads before mode gate → D8), §5 merged gate (~83-85), §6 "Prep (after Gate 2 approval only)" incl. line ~89 in-place enrichment (→ D1, D5), cell contract (~97).
- `skills/bee-hive/SKILL.md` — Modes and Lanes table (~94-127): risk-flag list line ~98 (→ D7), tiny/small rows ~103-105 file caps (→ D6), lane-ceremony table ~115-123 and Tiny fast path (~125+) (→ D3, D4, D5).
- `skills/bee-briefing/SKILL.md` — line ~34 (tiny/spike: no brief), ~60-61 (projection sources), ~80 (projection framing), ~84 (drift rule → D9).
- `skills/bee-exploring/SKILL.md` — Quick/Standard/Deep classification (line ~28); unchanged in scope but referenced by D8's intake wording.
- `AGENTS.md` operating block + `skills/bee-hive/references/routing-and-contracts.md`, `references/go-mode.md` — any restated lane/gate doctrine must be updated in lockstep.
- Doctrine/conformance tests: `scripts/test_gate_bypass_doctrine.mjs`, `scripts/test_conformance.mjs`, `scripts/test_skill_render.mjs`, `scripts/release_manifest.mjs --check` — inventory in planning which assertions pin the old text.
- Render/projection pipeline: managed skill roots (`.claude/skills/bee-*`, `.agents/skills/bee-*`) re-render via onboarding apply; release manifest regen after skill edits (repo git history pattern: "re-render plugin projections post-guard-edit").

### Established Patterns

- Doctrine changes ship as skill-text edits + doctrine-test updates + projection re-render + manifest regen, one cell per coherent surface (repo history: cnt-7, gate-bypass doctrine work).
- Skill edits follow `bee-writing-skills` discipline (pressure test RED first, minimal change, GREEN re-test) — decision ff26725d: no mechanical-edit exemption.

## Canonical References

- `docs/history/lane-ceremony-v3/CONTEXT.md` (this file) — locked decisions.
- `.bee/backlog.jsonl` rows ts 2026-07-19T11:12:52.* — the six accepted findings (3 proposal P1, 3 friction P2).
- User-supplied critique message (2026-07-19 session) — problem statement; its two overreaches (projection ≠ duplication; done-report ≠ extra verify step) are corrected by D2/D9 framing.

## Outstanding Questions

### Deferred To Planning

- [ ] Which exact assertions in `test_gate_bypass_doctrine.mjs` / `test_conformance.mjs` / `test_skill_render.mjs` pin the current lane/plan wording — grep inventory before editing.
- [ ] Inventory which exact `AGENTS.md` / `README.md` sections restate the tiny/small flow (they are in scope per D10; the open question is only *which lines*, found by grep during planning).
- [ ] Whether planning/briefing templates carry `artifact_readiness` or current-slice sections to remove.

## Deferred Ideas

- Machine-enforced plan freeze (hash recorded at Gate 2, hook denies post-approval plan.md content writes) — v3 is prose-ruled; enforcement is follow-up work.
- `slice_id` on cells + explicit multi-slice bookkeeping for long standard/high-risk features.
- Automated lane graduation (tiny → small → standard mid-flight when evidence crosses a threshold) beyond D8's re-run rule.

## Handoff Note

CONTEXT.md is the source of truth. Decision IDs are stable. Planning reads locked
decisions, code context, canonical references, and deferred-to-planning questions.
Validating and reviewing use locked decisions for coverage and UAT.
