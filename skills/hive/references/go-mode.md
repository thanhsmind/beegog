# Go Mode — Step-by-Step Reference

Load this when executing go mode. Go mode is the full bee pipeline from raw feature request to merged, compounded learnings. It chains every skill in sequence with exactly **4 human gates**. Each gate protects the next irreversible commitment.

Trigger: `/go [feature]`, "run the full pipeline", or "go mode".

```text
User: "/go [feature]"
       │
       ▼
[BOOTSTRAP] onboarding check, bee_status scout, critical-patterns.md, recent decisions
       │
       ▼
[STEP 1] bee:exploring        → history/<feature>/CONTEXT.md
       ▼
[GATE 1] ← HARD STOP
       ▼
[STEP 2] bee:planning (shape) → approach.md, plan.md (requirements-only)
       ▼
[GATE 2] ← HARD STOP
       ▼
[STEP 3] bee:planning (prep)  → plan.md enriched to implementation-ready, current-slice cells
       ▼
[STEP 4] bee:validating       → reality gate, feasibility matrix, spikes, plan-checker, cell review
       ▼
[GATE 3] ← HARD STOP (the most critical gate)
       ▼
[STEP 5] bee:swarming (+ bee:executing × N) — current slice only
       │
       ├── more approved work remains → return to STEP 3 for the next slice
       ▼
[STEP 6] bee:reviewing        → P1/P2/P3, artifact verification, UAT (after final slice only)
       ▼
[GATE 4] ← HARD STOP (never auto-merge)
       ▼
[STEP 7] bee:compounding      → history/learnings/, decision log
       ▼
DONE
```

## Pre-Pipeline: Bootstrap

Before invoking `bee:exploring`:

1. Run the State Bootstrap from `routing-and-contracts.md` (onboarding, `node .bee/bin/bee_status.mjs --json`, critical-patterns, `node .bee/bin/bee_decisions.mjs active --recent 3`).
2. Apply the surface-scope-earlier check — clear acceptance criteria plus pattern references may skip Step 1 with user approval.
3. Determine the feature slug (lowercase-hyphenated) and create `history/<feature>/` if missing.
4. Update `.bee/state.json`: `feature: <slug>`, `phase: exploring`, `mode: null` (set at the mode gate).

## Gate Wording (fixed)

- **Gate 1:** "Decisions locked. Approve CONTEXT.md before planning?"
- **Gate 2:** "Work shape is ready. Approve before current-work preparation?"
- **Gate 3:** "Feasibility validated. Approve execution?"
- **Gate 4:** P1 > 0 → "P1 findings block merge. Fix before proceeding?" ; P1 = 0 → "Review complete. Approve merge?"

Each gate is one question in the standard CONTEXT / QUESTION / RECOMMENDATION / options format. Gates are asked **one at a time** — never batch Gate 2 and Gate 3 into a single question, even when validation looks trivially clean. Optional at Gates 2–4: a cross-model second opinion; disagreement is quoted to the user, never auto-resolved.

## Gate Presentations

**GATE 1** — after exploring:

```text
Exploration complete for [feature].
[N] decisions locked in history/<feature>/CONTEXT.md, [M] open questions noted.
Key decisions: D1: [summary] ... (max 5, then "see CONTEXT.md")
Decisions locked. Approve CONTEXT.md before planning? (yes / revise / show full CONTEXT.md)
```

Revise → return to exploring for the specific gray areas, update CONTEXT.md in place, re-present.

**GATE 2** — after the planning shape pass:

```text
Planning complete for [feature]. Mode: [tiny/spike/small/standard/high-risk] ([k] risk flags: [list]).
Proposed shape: [work item / spike question / plan summary / epic list].
Why this is the least workflow that protects the work: [one sentence].
Work shape is ready. Approve before current-work preparation? (yes / revise / show full plan.md)
```

Revise → return to the shape pass, update `plan.md` (still `requirements-only`), re-present.

**GATE 3** — after validating:

```text
Validation complete for [feature], current work. Mode: [mode].
Reality gate: [passed/failed by check]. Feasibility: [READY / READY WITH CONSTRAINTS / NOT READY].
Spikes: [all passed / N failed]. [N] cells ready. Unresolved concerns: [list or "none"].
Feasibility validated. Approve execution? (yes / review cells / no — revise plan)
```

Approval covers the **current slice only**. No → return to planning or validating.

**GATE 4** — after reviewing the final slice:

```text
Review complete for [feature].
P1 (blocks merge): [count] — [titles]   P2: [count]   P3: [count]
```

- P1 > 0 → "P1 findings block merge. Fix before proceeding? (a) fix now (b) show details (c) explicit user override" — silence is not acknowledgment.
- P1 = 0 → "Review complete. Approve merge? (yes / show P2s first / no)"

Fix cells created for P1s run through swarming, then reviewing re-runs (targeted to the fix diff) before Gate 4 is re-presented. Repeat until P1 = 0 or explicit override.

## The Slice Loop

After each slice's swarm completes: later approved work remains → return to Step 3 (planning prep for the next slice) then Step 4 (validating) then Gate 3 again. Final slice done → Step 6. Reviewing runs once, after the final slice.

## Fallback Paths

- **Spike returns NO:** STOP before Gate 3. Present "Spike [id] failed: [reason]. Current work is blocked." Options: revise approach / descope the risky part / change mode or boundaries. A workaround that "probably works" is not a path — plausibility is not evidence.
- **Feasibility evidence missing:** STOP before Gate 3. Present the missing matrix rows and required proof; route to spike or planning revision. No execution cells for that work until proof exists.
- **Plan-checker still failing after 3 iterations:** escalate — present the failing dimensions, ask "Return to planning with these specific concerns?", never iterate a 4th time silently.
- **Context hits ~65% mid-swarm:** write `.bee/HANDOFF.json`, present "[X] cells capped, [Y] in flight. Resume in a new session." End gracefully.
- **User rejects at any gate:** identify what feels wrong, return to the owning stage, update the artifact in place, re-present the same gate.

## Close-out

After compounding: set state `phase: idle`, `feature: null`, `mode: null`, summary "Go mode complete for <feature>", and delete `.bee/HANDOFF.json` if present.

## Headless Go Mode

`mode:headless` runs stages headlessly **between** gates only. Every gate still stops the pipeline and reports "awaiting Gate N approval" in the terminal report. `auto_approve_gates` does not exist in bee. The four gates are never self-approved.
