---
artifact_contract: bee-plan/v1
mode: standard
approved_gate2: 2026-07-23T04:32Z
---

# backlog-auto-triage — Slice 1: port `bee-qualifying`

## Mode Gate

Scoped to **this planning pass only** (slice 1 of 3 — see CONTEXT.md Handoff Note).
Risk flags counted against slice 1's actual diff, not the whole 3-slice feature:

- **data model** — `docs/backlog.md` `Status` column gains a 4th enum value `parked` (D13); this slice is the first place that value is actually written.
- **audit/security** — the ported skill's HARD-GATE step 2 is the mechanism that decides whether an auth/security-flagged backlog item auto-clears unattended or is forced to a human. A defect here has direct security consequence even though the diff is prose (a SKILL.md), not application code.

2 flags → **standard**. Product files touched: 1 (`skills/bee-qualifying/SKILL.md`, new). Rendered projections (`.claude/skills/bee-qualifying/`, `.agents/skills/bee-qualifying/`) are generated and never counted (D6). Matches CONTEXT.md's declared feature-level `Scope: Standard`; no override needed.

## Approach

**Chosen path:** port `bee-qualifying/SKILL.md` verbatim from the already RED/GREEN-tested
source in `herdr-gateway--wt--backlog-auto-triage` (139 lines, 4/4 GREEN re-test pass —
`docs/history/backlog-auto-triage/reports/bee-qualifying-red.md` in that worktree, read in
full this session), adding exactly two **additive** blocks (nothing removed, nothing
reworded) for the two fixes the handoff doc names:

1. **Fix (a) — D13's missing `Status: parked` write.** Add one new sub-step to the existing
   Flow step **4b (Park)**, between "hand the brief to `bee-context-locking`" and "Stop": the
   park hand-off to `bee-context-locking` also carries the instruction to set the backlog
   row's `Status` to `parked`, in the same commit as the brief. This is forward-declaring the
   contract slice 2's `bee-context-locking` must fulfill — `bee-context-locking` does not
   exist yet (slice 2, not started), so this cell only fixes what `bee-qualifying` *asks for*,
   not what fulfills it. Confirmed additive: the source Flow's step 4b currently has no
   Status-write sub-step at all (read in full this session), so this is a pure insertion, not
   a rewrite of existing prose.
2. **Fix (b) — missing atomic feature entry.** Add a new **Flow step 0**, mirroring this
   repo's own `skills/bee-exploring/SKILL.md` step 0 verbatim in spirit: `node .bee/bin/bee.mjs
   state start-feature --feature "<slug>" --mode "<mode>"` when entering from `idle`, skipped
   when a feature is already active. Confirmed additive: the source file's Flow has no step 0
   and never hand-writes `state set --owner exploring` either — this closes a real gap, it does
   not replace anything. Numbering stays `0, 1, 2, 3, 4` (existing steps keep their numbers,
   matching `bee-exploring`'s own step-0-before-step-1 convention) — no renumbering churn.

**Rejected alternative:** re-run the full 4-scenario RED phase from scratch in this repo.
Rejected because RED's purpose — proving the skill's *content* needs guardrails before writing
them — does not reset when byte-identical content is saved into a different repository; the
existing RED+GREEN evidence already proves the base 139 lines hold under pressure. Re-running
all 4 scenarios here would be ceremony duplication with no new information. Instead: **cell 2
below runs a focused GREEN validation** on exactly the two new/changed pieces (the park-path
Status write, scenario 2's territory; and a structural check on the new step 0), which is
where genuine new-content risk actually lives. Both cells cite `bee-writing-skills` as
`read_first` so the executing worker applies that skill's own judgment on the RED-reuse call,
not just this plan's assertion of it.

**Risk map:**

| Component | Risk | Proof needed |
|---|---|---|
| Ported prose fidelity (no accidental drift from source) | LOW | cell 1's verify diffs the ported file against the two named additive blocks only |
| Fix (a)'s new park-Status instruction actually followed by a fresh agent | MEDIUM | cell 2's GREEN re-run of scenario 2 against the ported file |
| Render sync (`.claude/skills/`, `.agents/skills/`) produces a correct projection | LOW | cell 1's verify runs the onboarding sync and checks both projections exist and carry the render-provenance marker |
| Repo-wide regression from adding a new skill directory | LOW | cell 1's verify runs the recorded repo `verify` command (baseline-gate discipline) |

**Likely files, in order:** `skills/bee-qualifying/SKILL.md` (new) → onboarding sync (generates
`.claude/skills/bee-qualifying/SKILL.md`, `.agents/skills/bee-qualifying/SKILL.md`) →
`docs/history/backlog-auto-triage/reports/bee-qualifying-port-green.md` (new, cell 2's
evidence).

**Relevant learnings:** none in `docs/history/learnings/critical-patterns.md` tag-matched to
skill-authoring beyond what `bee-writing-skills` itself already encodes (checked this session).

**Open questions for validating:** none — both fixes are fully specified by the handoff doc
and confirmed additive against the actual source content (read in full, not assumed).

## Out of scope (this planning pass)

- Slice 2 (`bee-context-locking`) and Slice 3 (narrow `bee-exploring` + `bee-hive` routing) —
  CONTEXT.md's Deferred To Planning already flags these as separate planning passes once this
  slice closes.
- The auto-trigger mechanism for `bee-qualifying` (D12, explicitly out of scope for the whole
  feature).

## Test Matrix (12 edge dimensions, scaled to a prose-skill slice)

| Dimension | Coverage |
|---|---|
| Happy path | Cell 2 scenario re-run: genuinely clear item completes unattended (existing GREEN scenario 3, re-verified still holds with the new step 0 present) |
| Boundary / hard-gate | Cell 2 scenario re-run: hard-gate item still parks (existing GREEN scenario 1) |
| New-content correctness | Cell 2: park path now instructs `Status: parked` (new — the actual fix under test) |
| Malformed / missing input | N/A — prose skill, not a parser; `bee-qualifying`'s own HARD-GATE already covers "no pre-existing CONTEXT.md to read the answer off" |
| Concurrency | Out of scope for this slice — D14 (isolated worktree) is preserved verbatim from source, unchanged by either fix |
| Regression | Cell 1 verify: repo's recorded `verify` command run clean after the new skill directory + render lands |
| Naming/structural fidelity | Cell 1 verify: rendered `.claude/`/`.agents/` projections carry the render-provenance marker, not hand-copied |

Remaining dimensions (auth, performance, i18n, accessibility, data-loss, external-service
failure) do not apply to a SKILL.md prose file with no runtime execution path of its own.

## Discovery

L0/L1 only — no `discovery.md`. Findings recorded above (Approach): the render mechanism is
this repo's own `bee-hive` onboarding `--apply` sync (`applySyncSkill` in
`skills/bee-hive/scripts/onboard_bee.mjs`), confirmed by reading that script's exports this
session — not a hand-copy, and not `bee-briefing` (that skill renders `implement-plan.md`, a
different artifact entirely; checked and ruled out this session).
