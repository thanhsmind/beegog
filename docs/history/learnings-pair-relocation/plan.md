---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: small
---

# learnings-pair-relocation — plan

## Goal

Remove the `learnings-researcher` + `learnings-synthesizer` pair from bee-reviewing's
specialist wave. Standard lane becomes exactly 4 core reviewers; the knowledge duties the
pair carried stay owned where they already live.

Owner-approved direction (chat, 2026-07-11): move researcher to planning, fold synthesizer
into compounding, drop the pair from the standard roster.

## Scoping refinement found during bootstrap (evidence, not scope change)

The approved direction said "researcher → planning, synthesizer → compounding". Bootstrap
reads show both targets **already carry the duty**, so the honest change is a removal plus
one inline reassignment, not a relocation:

1. **Researcher's duty already lives in planning.** `skills/bee-planning/SKILL.md` §1
   Bootstrap step 4 mandates tag-matched precedent search over `docs/history/learnings/`
   ("we've solved X before: <file> — precedent beats research"), and §4 requires "relevant
   learnings" in the Approach. That output lands in `plan.md`, and reviewing's isolation
   contract already hands `plan.md` to every reviewer — precedent reaches review as input,
   not as a review-time dispatch. **No planning edit needed.**
2. **Synthesizer's real duty is finding-synthesis, not learnings.** Its focus line
   (reviewing-reference.md): dedupe overlaps, corroboration promotion, autofix_class,
   severity counts. That is review work and must stay in bee-reviewing — but it already runs
   at tier "ceiling (orchestrator's model)", so the subagent adds a dispatch without adding a
   different mind. The reassignment: **the review orchestrator performs synthesis inline**
   after all reviewers return (§2 rules already state the algorithm). Its only
   learnings-flavored duty ("known-pattern notes") is covered by precedent arriving via
   plan.md.
3. **Compounding needs no new duty.** `bee-compounding` already runs a pattern-extractor
   analyst (§2) that owns durable pattern work at capture time. **No compounding edit
   needed.**

Net effect per standard/high-risk feature: −2 subagent dispatches, zero knowledge machinery
removed (lanes scale ceremony, never memory — decision d02a6bc6).

## Mode gate (mechanical)

Risk flags counted: **0** — no auth/authorization, no data model, no audit/security surface,
no external systems, no public contracts, no cross-platform, not test-covered behavior
(skill prose), proof around the area is strong (greps), single domain (bee skills).

Files: **4** (grep-proven after the advisor-corrected census, see reality check) — one over
small's ≤3 guard; the 4th is a one-line README roster mention. Lane call: **small**, recorded
openly for the gate — 0 risk flags, one mechanical propagation, and standard's ceremony
(swarm workers + 4-reviewer wave) protects nothing a grep census does not already prove.
Per lane scaling v2 (decision d02a6bc6): Gates 2+3 merged into one question, reality check
inline here, solo in-session execution, review = 1 correctness reviewer.

## Discovery: L0

Pattern is internal; all sources read in-session. No research needed.

## Approach

Chosen path — edit 4 files, one cell:

1. `skills/bee-reviewing/SKILL.md`
   - Lane table (line 29): `standard` review becomes "4 core reviewers (§1 table)".
   - §1 roster table: delete the `learnings-researcher` and `learnings-synthesizer` rows.
   - §1/§2: state that the orchestrator performs synthesis itself after all reviewers
     return, and that precedent arrives pre-loaded in `plan.md` (planning bootstrap owns the
     search).
   - Red flag "learnings-synthesizer run before the other reviewers finish" → replaced with
     "synthesis started before every reviewer returned".
2. `skills/bee-reviewing/references/reviewing-reference.md`
   - Isolation paragraph: "Reviewers 1–5 … synthesizer after" → reviewers run in parallel;
     orchestrator synthesizes after all return.
   - Delete the two pair rows from the focus-line table; drop the pair from the tiers line
     (line 28, bare "researcher/synthesizer" names — advisor catch).
   - Red-flags list line 130 "synthesizer run before specialists finish" → "synthesis started
     before every reviewer returned" (advisor catch: dangling reference invisible to the
     pair-name grep).
3. `skills/bee-hive/SKILL.md`
   - Lane-scaling table row (line 105): "4 core reviewers + learnings pair" → "4 core
     reviewers".
4. `README.md`
   - Line 187 roster sentence: drop the "plus a learnings-researcher … and a
     learnings-synthesizer …" clause (advisor catch: live front-page doc, not archaeology).

Rejected alternative: literally adding a researcher step to planning and a synthesis step to
compounding — rejected as duplication; both skills already own the duty (evidence above).
Rejecting it does not reduce the owner-approved scope — the approved outcome (pair out of the
review wave, duties preserved pre-code and at capture) is fully honored.

Out of scope (archaeology, never edited): `docs/01-distillation.md`, `docs/04-skills-spec.md`
(lane scaling v2 precedent: design corpus not synced), `docs/decisions/0021` (append-only; a
new decision will be logged at close), `skills/bee-reviewing/CREATION-LOG.md`,
`docs/history/**`.

Risk map: all components LOW — prose edits, grep-provable, no code, no tests touched.
Residual risk: installed plugin copy at `~/.claude/skills` lags until next version
bump/re-onboard — existing release process, unchanged by this feature.

## Advisor consult — shape point (decision 0013)

One consult, fresh isolated context, 2026-07-11. Verdict: **OBJECT → fixed in this revision.**
Findings adopted: (1) README.md:187 is a live mention the census missed (grep never covered
repo root) — added as file 4; (2) reviewing-reference.md:130 red flag says bare "synthesizer",
invisible to the pair-name negative grep — edit enumerated, negative grep widened to the bare
token. Stress-tests passed per advisor: no independence lost dropping the synthesizer subagent
(same model/tier, mechanical rules); no schema or downstream consumer names the pair; precedent
reaches conditional reviewers via plan.md. Accepted trade-off noted by advisor: planning
searches precedent by planned keywords, the old researcher searched by diff-touched modules —
precedent for modules the plan did not anticipate is mildly weakened; the inline-synthesizing
orchestrator (which sees critical-patterns in every session preamble) is the backstop.

## Reality check (validating, inline per small lane)

- Mention census (corrected after advisor consult; grep -rn incl. repo root, excluding
  docs/history): pair-name + bare-"synthesizer" hits live in exactly the 4 target files;
  all other hits are archaeology (CREATION-LOG.md, docs/01, docs/04, decisions/0021).
  ✔ rerun 2026-07-11. Note: bare "synthesizer" does not substring-match "synthesizes"/
  "synthesis", so the post-edit prose stays clean of false positives.
- Planning already owns precedent: bee-planning SKILL.md §1 step 4 + §4. ✔ read.
- Reviewers already receive plan.md: bee-reviewing SKILL.md §1 isolation contract. ✔ read.
- Synthesizer already runs on the orchestrator's model: reviewing-reference.md tiers line. ✔ read.
- Verify string dry-run (critical pattern 20260708): negative grep (-F, no metachars, terms
  `learnings-researcher` / `learnings pair` / `synthesizer` — the last covers
  `learnings-synthesizer`) over the 4 files counts 11 pre-edit → must be 0 post-edit;
  positive grep targets the stable phrase "4 core reviewers" the two roster tables need
  anyway. ✔ dry-run passed pre-edit (11 hits).
- Baseline: 124 lib tests + onboard tests green this session. ✔

## Test matrix sketch (lane-scaled)

Prose-only change; the matrix collapses to: (a) negative grep = no live mention of the pair
in operative skills, (b) positive grep = new roster wording present in both tables, (c) full
lib test suite still green (no collateral file damage).

## Current slice (single)

One cell, `behavior_change: true` (the review wave's observable composition changes);
before-state characterization = the 8-hit grep census above.

## Open questions for validating

None — validating collapsed into the reality check above (small lane).
