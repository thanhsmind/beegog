---
date: 2026-07-10
feature: evolving-loop (slice B + evolving-8)
categories: [security, testing, process, skill-authoring]
severity: high
tags: [datamark, ranking, iron-law, pressure-testing, control-bytes, corroboration, review-promotion]
---

# Learnings — evolving loop, slice B

Sources: three parallel analysts over cell reports evolving-8..11, both pressure reports,
validation-slice-b.md, review-slice-b.md, decision 0022, walkthrough. One analyst claim was
corrected during synthesis: the P1-b coupling test was NOT added — it is an acknowledged open P1
in the backlog, not a shipped fix.

## What Happened

The slice shipped the ranking engine, the `bee-evolving` skill (RED-first under the full Iron
Law), and the wiring at 0.1.19. The adversarial plan-checker caught the plan itself about to ship
a security regression (Gate A rendering the datamark-stripped key); the fix landed in the plan and
the skill — and then the SAME root cause shipped anyway one layer down (`rank --json` spreads
`...cluster`, so the stripped `key` reaches the consuming agent's stdout), caught at review by two
independent reviewers and merged as an acknowledged P1. A raw NUL byte recurred in a committed
report two commits after the control-byte sweep was mechanized — because the sweep was scoped to
where the defect first appeared (template `.mjs`) rather than to the defect class (any file
written through the JSON-escape tool-call path). Corroboration shipped defined-but-measured-inert
(real cross-repo collisions: 0). All four pressure-test REDs failed the same way: the agent
invented a safe-sounding middle option that treated an adjacent real authorization (a rule, a
runbook, a rank, a trust statement) as if it covered the specific gate it does not.

## Root Cause

1. **The same invariant existed at two altitudes and was enforced at neither.** "Never render the
   stripped key" was a sentence in the plan and a sentence in SKILL.md; nothing structural kept
   `key` out of the CLI output. The plan-checker fixed the top altitude; the bottom one shipped.
2. **Incident-born checks inherit the incident's coordinates, not its class.** The C0 sweep
   guards `templates/**/*.mjs` because that is where the NUL first bit; the cause (raw control
   bytes decoded from JSON-escaped tool parameters) can hit any written file, and did.
3. **Byte-identical-by-duplication is drift waiting for a trigger.** `normalizeTitle` copies
   `datamark`'s cleaning verbatim with only example-based tests; the first hardening of `datamark`
   silently reopens the clustering trap.
4. **A today-true measurement reads as an always-true invariant three documents downstream.**
   "Byte-identical ranking" is locale-conditional; "measured identical" was carried forward
   without its conditions.

## Recommendation

- **When a value's non-exposure is a security property, prove absence with a test on the output
  surface** — a prose "never render X" in a plan or skill is a request, not an enforcement. Apply
  at every altitude the value crosses (lib return, CLI output, prompt render).
- **When mechanizing a check after an incident, scope it to the defect class, not the location**:
  ask "what code path produced this byte/state?" and sweep everything that path can write. Fix
  the instance AND widen the check in the same cell.
- **When two modules must produce byte-identical transforms, export one implementation and import
  it twice** — an example-based equality test on hand-copied code is not coupling.
- **When pressure-testing a gate, enumerate and foreclose the safe-sounding middle options by
  name** — every RED failure was a plausible intermediate, never the openly forbidden act; an
  unlisted middle option should be presumed to reopen the failure.
- **Build self-modifying skills at the strongest tier, but pressure-probe them with the weakest
  plausible model** — a refusal that only the strong model produces is not a guardrail.
- **When validation evidence is "measured true on today's data," carry the conditionality forward
  explicitly** in review and docs, or it hardens into a false invariant.
- **A Gate 4 merge with open P1s is legitimate only with explicit owner acknowledgment plus a
  concrete backlog fix per finding** — and those fixes must land before the next slice touches the
  same surface (`feedback.mjs` / `rank`), because deferred boundary gaps compound.

## Decisions honored / recorded

- Trap defused at the comparison key, merge contract untouched (0022) — right call; the leak was
  downstream of it, not in it.
- Gate 2 rider (one real cross-repo run during validating) was cheap insurance and surfaced both a
  working end-to-end boundary and the machine-specific-path hygiene note.
- Full Iron Law with no mechanical-edit exemption (`ff26725d`) held — and the plan-checker still
  had to catch its evidence file being homeless (B2). Every SKILL.md-editing cell owns its
  RED/GREEN evidence file in `files[]`, never "or a sibling report".
