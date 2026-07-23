---
type: bee.area
title: Hook Runtime — the intent anchor and compaction survival
description: "The durable, verbatim statement of what the user asked for: written on disk, re-asserted at compaction, and read first when a compacted session restarts — so the objective outranks the harness bookkeeping instead of decaying beneath it."
timestamp: 2026-07-23
bee:
  id: hook-runtime-intent-anchor-and-compaction-survival
  lifecycle: active
  areas: [hook-runtime]
  required_context: [areas/hook-runtime/advisories-and-turn-control.md]
  decisions: [intent-anchor D1, D2, D3, D4, D5, D6]
  sources: ["intent-anchor cell ia-1 (the anchor, the PreCompact re-assertion, the compact-resume lead; trace in `.bee/cells/`, 2026-07-23)", .bee/spikes/intent-anchor/FINDINGS.md (the measurement that justified it), CONTEXT.md `docs/history/intent-anchor/CONTEXT.md`, "advisor issue #54 (the compact-resume checkpoint field set)"]
  authoritative_for: "hook-runtime: the intent anchor and compaction survival"
---

# Hook Runtime — The Intent Anchor and Compaction Survival

## Purpose

A long session is compacted: the conversation is replaced by a summary plus a
recent tail. The **oldest** thing in that conversation is the user's original
request, so it is the first thing compression takes. Meanwhile the harness
re-reads its own state from disk at every start, in full.

That asymmetry is the defect, and it is worth naming precisely, because it is not
a capacity problem and a larger context window does not fix it:

| | re-injected in full, every compaction | decays with every compaction |
|---|---|---|
| what | the harness's workflow state — phase, gates, the next workflow step | **the user's request and what "done" means** |
| why | it lives on disk | it lives only in the conversation |

The thing that should be **most** durable is the least; the thing that should be
secondary is anchored hardest. After two compactions the workflow scaffolding is
at full strength and the goal is gone — so the agent optimises for *finishing the
workflow* instead of *answering the person*. The anchor inverts the asymmetry by
giving the objective the same durability the bookkeeping already had.

## Entry Points & Triggers

- **Written** when work begins — including work that never becomes a feature.
- **Re-asserted** at the compaction checkpoint, before the summary is produced.
- **Read first** when a session restarts from a compaction or a resume.
- **Advanced** as segments complete; the objective itself never changes.

## Data Dictionary

| Field | Meaning |
|---|---|
| request | The user's ask, **verbatim**. Never paraphrased, never truncated, never re-worded. |
| acceptance | What "done" means — the sentence that lets a later session tell whether it has drifted. |
| next_action | The single next step. The only field a segment boundary updates. |
| feature / lane / cell | Where the work currently sits, when it sits anywhere. |
| do_not_reverse | Decisions a later session must not undo — the constraints most easily lost to a summary. |
| stop_conditions | What should halt the work and return to the human. |

## Behaviors & Operations

**The request is verbatim, and immutable once set.** A paraphrase is the first
step of the drift the anchor exists to prevent: each restatement is lossy, and
losses compound across restarts. Only the next action advances; changing the
objective is a new anchor, deliberately, not a silent edit.

**It exists for work that never enters a feature.** A direct question or a small
fix has no locked-decisions document and no work item, so before this there was
*nothing at all* holding its intent — the case where drift is both most likely
and least noticed.

**Compaction re-asserts it, and stays advisory.** The compaction checkpoint emits
the anchor labelled as the objective, so a summarizer cannot fold it into
ordinary prose. It carries **no turn-control verdict** — compaction never steers
the turn, which is the standing contract in
[`advisories-and-turn-control.md`](advisories-and-turn-control.md), untouched here.

**On a compacted or resumed start, the objective leads.** The anchor is rendered
first and the phase, gates and workflow state follow it, explicitly framed as
serving it. The ordering *is* the behaviour: the defect was that the harness
re-anchored on its own bookkeeping, so putting the bookkeeping second is the fix,
not a presentation preference. Handoff adoption is unchanged — a compacted
session still never auto-adopts a planned-next handoff.

**Absence changes nothing.** With no anchor the emitted text is byte-identical to
what shipped before: the anchor path is strictly **additive**, a prefix on an
otherwise untouched block. A corrupt anchor reads as no anchor. A repo that never
writes one cannot tell this exists.

## Actors & Access

- **The user** supplies the request and what "done" means; both are recorded in
  their own words.
- **The agent** writes the anchor when work starts and advances only the next
  action as segments close.
- **The compaction checkpoint** re-asserts it; it never edits it.
- **A restarting session** reads it before anything else and treats it as the
  objective that the workflow state serves.

## Business Rules

- R1 — The request is stored verbatim and is immutable once set; only the next
  action advances (D1).
- R2 — An anchor is writable with no active feature (D2).
- R3 — The compaction checkpoint re-asserts the anchor and never emits a
  turn-control verdict (D3).
- R4 — On a compaction or resume start the anchor is rendered **first**; workflow
  state follows and is framed as serving it (D4).
- R5 — With no anchor, every surface is byte-identical to its pre-anchor
  behaviour (D5).
- R6 — The claim "it survives compaction" is proven by a simulation across at
  least two compaction boundaries **with a control arm**, not by inspection (D6).

## Edge Cases Settled

- **A stale feature slug outliving its feature.** Keying the anchor on the feature
  *field* would attach a fresh question's intent to a closed feature, because the
  slug survives the close. The active feature is therefore decided by the phase,
  and retrieval walks the candidates in order, so an anchor written without a
  session is still found by a checkpoint, and one written under a feature is still
  found after that feature closes.
- **A control arm that passes by being empty.** A simulation showing "the request
  is absent without the anchor" proves nothing if the whole context is empty, so
  the control also asserts that the harness scaffolding *did* survive — which is
  what makes the inversion visible rather than merely asserted.
- **Proving "unchanged" against the previous commit** goes tautological the moment
  the change lands. The durable form is the additive property: the new output ends
  with the entire old output, byte for byte.

## Open Gaps

- The anchor is proven against a **simulation** of compaction, not against a live
  session driven through two real autocompacts. That end-to-end run is the honest
  next step and is not yet done.
- Nothing yet *prompts* an agent to write an anchor at the start of unstructured
  work; it is available and documented, not enforced.

## Pointers (implementation)

- Store and renderers: `skills/bee-hive/templates/lib/intent.mjs`
  (`writeIntent`/`readIntent`/`advanceIntent`/`clearIntent`, `precompactBlock`,
  `resumeBlock`), mirrored to `.bee/bin/lib/`.
- CLI: the `intent` group in `command-registry.mjs` + `bee.mjs`.
- Checkpoints: `hooks/bee-session-close.mjs` (compaction re-assertion) and
  `hooks/bee-session-init.mjs` (compact/resume lead).
- Proof: `skills/bee-hive/templates/tests/test_intent.mjs` (incl. the
  two-boundary simulation) and the intent rows in `hooks/test_hook_contracts.mjs`.
