# Codex Runtime Parity — Plan Review

**Date:** 2026-07-11
**Artifacts:** `CONTEXT.md`, `discovery.md`, `approach.md`, `plan.md`
**Mode:** high-risk, requirements-only

## Review Setup

- One clean-context Bee plan-contract reviewer (`fork_turns: none`).
- One runtime/hooks architecture reviewer continuing the read-only hook audit.
- Advisor mode was configured for `shape`, but the active Codex collaboration
  API exposes no model selector. The reviews are independent-context checks;
  they are not represented as a verified cross-model/Fable consult.

## Findings And Repairs

### Plan-contract review

- BLOCKER — future E2/E3/E4 probes were promised as current-slice cell mappings.
  Repaired by mapping only E1 after Gate 2 and carrying one cumulative ledger.
- WARNING — dispatch RED evidence had no producing milestone. Repaired by making
  it the first milestone of the Dispatch and skills slice.
- WARNING — marketplace proof wording exceeded the recorded smoke evidence.
  Repaired by separating observed discovery/install smoke from pending release,
  reinstall, activation, rollback, and UAT proof.

Final recheck: **PASS**.

### Runtime/security architecture review

- P1 — Codex default-catalog path and Claude manifest switch were in different
  slices. Repaired as one atomic Safety foundation change.
- P1 — install-time refusal alone could not stop an old fallback colliding with
  a newly enabled plugin. Repaired with per-repo source arbitration plus final
  inactive-fallback removal after UAT.
- P1 — an intercepted but unprovable `apply_patch` target was allowed to fail
  open. Repaired to deny; fail-open remains only for malformed outer payloads
  and genuinely unsupported host paths.
- P1 — feature start could clear evidence of active work. Repaired with terminal
  phase, no-HANDOFF, no-worker, no-reservation, and no-nonterminal-cell
  preconditions; abandonment is a separate recorded drop.
- P2 — migration rollback lacked checkpoints. Repaired with install/trust/version
  check, atomic selector switch, fresh-thread plugin UAT, selector restore on
  failure, and cleanup only after PASS.
- P2 — several feasibility questions could have drifted into execution. Repaired
  as mandatory bee-validating YES proofs before Gate 3.
- Re-review found and repaired one ordering defect in plugin probation: fallback
  stays available for rollback, selector switches to plugin before plugin UAT,
  and fallback entries are removed only after PASS.
- Re-review also moved the Claude manifest route switch into the same atomic
  foundation unit as the catalog inversion, and extended feature-start refusal
  from claimed work to every prior-feature nonterminal cell (open/claimed/
  blocked unless separately dropped).

Final recheck: **PASS**.

### Brief projection review

- WARNING — the first render combined two MEDIUM source risks (Claude
  regression and Windows/subdirectory paths) into one HIGH row. Repaired by
  restoring the two source ratings separately.

Final recheck: **PASS** — no invented decision, source contradiction, missing
high-risk Security/Rollback section, premature validation claim, or status
mismatch remains.

## Verdict

**PASS — ready to render the high-risk implementation brief for Gate 2.** No
cells or source-preparation artifacts exist yet.
