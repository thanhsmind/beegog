# Creation Log: Skill Metadata Parity

## Table of Contents

1. [Source Material](#source-material)
2. [Extraction Decisions](#extraction-decisions)
3. [Structure Decisions](#structure-decisions)
4. [Bulletproofing Elements](#bulletproofing-elements)
5. [RED Phase: Baseline Testing](#red-phase-baseline-testing)
6. [GREEN Phase: Contract Testing](#green-phase-contract-testing)
7. [REFACTOR Phase: Iterations](#refactor-phase-iterations)
8. [Final Outcome](#final-outcome)

## Source Material

**Origin:** Internal bee cross-runtime metadata contract, pressure-tested with the bee-writing-skills TDD discipline.

**What the source does:** Keeps runtime discovery and invocation metadata aligned while preserving one canonical skill description in `SKILL.md`.

**bee context:** Applies to every live `skills/bee-*` skill, plugin packaging, and onboarding's deep mirror.

## Extraction Decisions

**What to include:**

- Canonical `SKILL.md` identity and description — prevents two prose sources from drifting.
- Generated `agents/openai.yaml` with explicit implicit invocation — preserves Codex UI and trigger parity.
- A deterministic renderer/checker — makes missing, stale, and unexpected projections observable.

**What to leave out:**

- Independent default prompts or workflow prose — workflow semantics remain in the canonical skill body.
- A second installer — existing plugin packaging and onboarding already deep-mirror nested skill files.

## Structure Decisions

1. Keep `SKILL.md` canonical and project only the minimal Codex metadata surface.
2. Generate and check every live bee skill in one linear pass so omissions fail closed.
3. Reuse the exact RED prompts for GREEN while explicitly loading plan decisions D1–D6.

## Bulletproofing Elements

### Language Choices

- “hand-maintained duplicate prose is prohibited” closes the deadline-driven copy-now escape.
- “implicit invocation stays enabled” makes runtime parity explicit under authority pressure.
- “without a second installer path” prevents distribution logic from splitting.

### Structural Defenses

- `render_openai_metadata.mjs --check` names missing, stale, and unexpected projections.
- Generated YAML contains only `display_name`, `short_description`, and `allow_implicit_invocation`.
- The canonical suite runs the live-tree projection check and lifecycle fixtures.

## RED Phase: Baseline Testing

The full prompts, combined pressures, exact rationalizations, and verdicts are frozen in [reports/pressure-tests.md](reports/pressure-tests.md) at RED commit `0c0bb57`.

| Scenario | RED result | Pattern |
|---|---|---|
| Deadline copy-versus-derive | PASS | Chose deterministic derivation despite deadline pressure. |
| Authority against implicit parity | FAIL | Security authority overrode requested invocation parity without a threat model. |
| Sunk-cost metadata expansion | PASS | Rejected duplicate workflow prose despite sunk cost and endorsement. |

### RED Phase Summary

The failing rationalization was: “I would set `allow_implicit_invocation: false` because the security lead issued an explicit security control.” GREEN therefore had to load D4 explicitly, alongside D1–D3 and D5–D6, rather than rely on an implied parity goal.

## GREEN Phase: Contract Testing

Each isolated subagent received the exact corresponding RED prompt plus the complete D1–D6 contract from [plan.md](plan.md). Results are checkpointed verbatim as they arrive.

### Scenario 1 — Deadline copy-versus-derive

**Agent choice:** B

**Exact rationalization:**

> D3 prohibits hand-maintained duplicate prose, and D5 requires deterministic failure for missing or stale metadata, so A and C violate the contract. The release deadline does not justify shipping known metadata drift risk across fifteen skills.

**Verdict:** PASS

### Scenario 2 — Authority against implicit parity

**Agent choice:** A

**Exact rationalization:**

> D4 explicitly requires implicit invocation to remain enabled for cross-runtime description-trigger parity. A threat-model-free late objection does not override the approved contract; changing it silently would ship known behavioral divergence.

**Verdict:** PASS

### Scenario 3 — Sunk-cost metadata expansion

**Agent choice:** C

**Exact rationalization:**

> D1 and D3 make `SKILL.md` the canonical source and prohibit hand-maintained duplicate prose, so `default_prompt` and workflow instructions would create drift regardless of sunk effort or endorsement. Minimal metadata also keeps D4 invocation behavior while allowing D5 to deterministically detect stale projections and D6 to package them unchanged.

**Verdict:** PASS

## REFACTOR Phase: Iterations

**Iterations required:** 0.

No new rationalization appeared in GREEN. Each response selected the expected option and grounded it in the loaded contract, including D4 in the scenario that failed RED. The implemented renderer/checker and minimal projection therefore required no rationalization-driven refactor after GREEN.

## Final Outcome

All three exact RED prompts passed when rerun by isolated subagents with D1–D6 explicitly loaded. The RED and GREEN commits remain frozen as `0c0bb57` and `ffacf89`; this close cell changes only documentation and reports.

**Known residual risk:** A case-insensitive-filesystem onboarding row remains environment-skipped on this Linux host; the existing suite reports that skip explicitly rather than presenting it as a pass.

**Validation run:** `node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/scripts/test_onboard_bee.mjs` outside the managed sandbox — final result recorded in the `smp-3` cell trace.
