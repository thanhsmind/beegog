---
name: bee-validating
description: >-
  Prove the plan against repo reality with concrete evidence before any code is written. Use when planning has an approved work shape that needs feasibility validation before swarming, or when a plan smells like plausibility instead of proof.
metadata:
  version: '0.1'
  ecosystem: bee
  dependencies:
    nodejs-runtime:
      kind: command
      command: node
      missing_effect: unavailable
      reason: Validation reads state and cells through the vendored .bee/bin helpers.
---

# Validating — Guard Bees

Validating is the hard gate between planning and execution. It rejects beautiful fantasy plans by demanding repo/system evidence, feasibility proof, and cells a stranger could pick up cold. Never skip validating — in tiny mode it collapses to a 2-minute reality check; it does not disappear.

Start with `node .bee/bin/bee_status.mjs --json`. If onboarding is missing or stale, stop and invoke bee-hive.

## Required Inputs

- `docs/history/<feature>/CONTEXT.md`
- `docs/history/<feature>/discovery.md`
- `docs/history/<feature>/approach.md`
- `docs/history/<feature>/plan.md` — approved at Gate 2 and enriched to `artifact_readiness: implementation-ready`
- current-work cells: `node .bee/bin/bee_cells.mjs list --feature <feature>`

If any input is missing, or `plan.md` is absent, unapproved, or its `artifact_readiness` is not `implementation-ready`, stop and return to bee-planning. Never validate an unapproved shape.

## Operating Contract

1. **Orient** on state, mode/lane, the approved shape, and the current-work cells.
2. **Reality gate:** MODE FIT / REPO FIT / ASSUMPTIONS / SMALLER PATH / PROOF SURFACE — each scored PASS|FAIL with file/command evidence. Fail on nonexistent code paths, unsupported commands, stale versions, missing credentials, hidden architecture work, or excess ceremony. A failed reality gate halts the pipeline and returns to bee-planning.
3. **Feasibility matrix:** every blocking assumption gets a row — assumption | risk | proof required | evidence | result. Accepted evidence only (below). Plausibility language is an automatic NOT READY.
4. **Spikes** for unproven assumptions that can invalidate the current work.
5. **Plan-checker subagent** (adversarial) until structurally clean or escalated.
6. **Cold-pickup cell review**; fix every CRITICAL flag.
7. **Decide** using the decision vocabulary, then ask Gate 3.

Load `references/validation-reference.md` for report formats, repair routing, and the subagent prompts.

## Accepted Evidence

Existing implementation, file/API/type inspection, command output, build/typecheck/test result, official version/doc proof, runtime probe, or a `.spikes/<feature>/` result. Evidence that is only "should work", "likely", "expected", or model knowledge → **NOT READY**.

## Spike Rules

- One spike answers exactly one yes/no question.
- Disposable code lives under `.spikes/<feature>/`.
- **NO** → return to bee-planning with the failed assumption and the required plan change.
- **YES** → record the discovered constraints for planning and execution.
- Spike code never silently becomes production code.

## Plan Checker (adversarial)

Dispatch a subagent at the **generation** tier (state the model explicitly; if the runtime cannot select per-agent models, cap its reads and output instead). It assumes the plan is flawed and verifies 5 dimensions: requirement/decision coverage, cell completeness, dependency correctness, key links, scope sanity. Every finding carries **BLOCKER** or **WARNING**. Maximum 3 structural-verification iterations; a BLOCKER still open after iteration 3 escalates to the user. Never attempt iteration 4.

**High-risk lane:** scale to a persona panel — coherence + feasibility lenses always, plus conditional lenses (security, product, scope-guardian) chosen by the diff of concerns. Dedupe findings, then synthesize into auto-fix vs present-for-decision buckets.

## Cell Review (cold pickup)

Dispatch the cell reviewer (generation tier): could a worker with no session history pick each cell up cold? **CRITICAL** flags — assumed context, vague acceptance, scope overload, unproven feasibility, broken verify — must be fixed before approval. **MINOR** flags may ship with a recorded note.

## Decision Vocabulary

```text
READY
READY WITH CONSTRAINTS
NOT READY - RUN SPIKE
NOT READY - RETURN TO PLANNING
```

READY is a feasibility verdict, not execution approval — Gate 3 still requires the user.

## Gate 3 — Execution Approval

Present the approval block from the reference, then ask verbatim: **"Feasibility validated. Approve execution?"** Optionally offer a cross-model second opinion first (agreement → mention it; disagreement → quote both positions; never auto-resolve). Approval covers the **current work only**; future slices return to planning and validating.

On approval, update `.bee/state.json`: set `approved_gates.execution: true`, `phase: "validated"`, `summary`, and `next_action: "Invoke bee-swarming for the validated work."`

## Headless

With `mode:headless`: run every check, apply unambiguous cell repairs, and defer ambiguous ones to an `Outstanding Questions` section of the structured terminal report. Headless **stops at the Gate 3 question** — it emits the approval block and the READY/NOT READY verdict and exits. It never self-approves execution.

## Red Flags

- skipping the reality gate or feasibility matrix
- accepting plausibility language as evidence
- continuing after a NO spike because a workaround "probably works"
- running a 4th plan-checker iteration instead of escalating
- approving (or letting approval cover) future slices
- CRITICAL cell flags left unfixed at approval time
- a tiny fix wearing epic ceremony; a hard-gate change routed below high-risk
- self-approving Gate 3, in any mode

Violating the letter of the rules is violating the spirit of the rules.

Validation complete and Gate 3 approved. Invoke bee-swarming skill.

## Reference Files

| File | When to Load |
|---|---|
| `references/validation-reference.md` | Report formats, repair routing, plan-checker and cell-reviewer prompts, approval block |
