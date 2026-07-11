# Phase 2 — Intervention log

## Context

- [docs/decisions/0024-harness-cross-pollination-analysis.md](../../docs/decisions/0024-harness-cross-pollination-analysis.md) — feedback-loop comparison (discussed in conversation, not yet written into 0024's file body)
- `docs/08-harness-adoption.md` "adopt now" item 2 (Intervention log) — original gap identification, never built
- harness source: `crates/harness-cli/src/domain.rs:1006` — `InterventionRecord {id, created_at, trace_id, story_id, intervention_type, description, source, impact}`; `crates/harness-cli/src/interface.rs:289-304` — `InterventionAddArgs`
- Verified bee gap (2026-07-11, via repo-wide grep): no file in `skills/` implements anything resembling this. `state.json.approved_gates` is a bare boolean per gate — no record of *what was actually said, changed, or pushed back on*.

## Requirements

- A durable, **event-sourced** log (mirrors `decisions.jsonl`'s append-only style, not a mutable table like harness's) recording every human correction/override/escalation at a gate or review:
  `{ts, type: correction|override|escalation|approval, source: human|ci|agent, description, feature, ref: {cell|gate|review-finding}}`
- Write points:
  - `bee-hive` — gate rejections, mid-flight corrections
  - `bee-reviewing` — P1 acknowledgments, UAT failures/re-runs
  - `bee-swarming` — rescue-ladder escalations
- Read points:
  - `bee-grooming`'s hunt — repeated intervention-pattern clustering, same spirit as the existing friction-cluster logic
  - `bee-compounding` — a decision reversed twice becomes a critical-pattern candidate
- Exposed as a `bee intervention` verb group on the Phase 1 dispatcher (`log` / `list` / `search --recent`), consistent with the existing decisions/cells/reservations command shape.

## Files

- Create: `bin/lib/interventions.mjs` (append/read logic, reusing `bin/lib/decisions.mjs`'s secret/injection-rejection guard at write time)
- Modify: `skills/bee-hive/SKILL.md` or its routing reference (log gate rejections)
- Modify: `skills/bee-reviewing/SKILL.md` (log P1 acknowledgment / UAT failure)
- Modify: `skills/bee-swarming/SKILL.md` (log rescue-ladder escalations)
- Modify: `skills/bee-grooming/references/grooming-reference.md` (add intervention-pattern clustering next to the existing friction-cluster check)
- Modify: `docs/02-architecture.md` (add `.bee/interventions.jsonl` to the target-repo layout table)

## Implementation steps

1. Define the event schema and append-only write function in `bin/lib/interventions.mjs`, reusing `bin/lib/decisions.mjs`'s write-time secret/injection rejection.
2. Add `log` / `list` / `search --recent` verbs, callable as `bee intervention log ...` once Phase 1 lands.
3. Instrument the three write points to call the log function at the moment they already know the fact — no separate collection pass needed.
4. Add intervention-pattern clustering to `bee-grooming`'s hunt, parallel to the existing friction-cluster logic (2+ hits = a cluster worth a proposal, same threshold bee already uses).
5. Document the new file in `docs/02-architecture.md` and the new verb group in `docs/07-contracts.md`.

## Tests / validation

- Unit tests mirroring `test_lib.mjs`'s `decisions.jsonl` tests: secret rejection, injection rejection, append-only ordering.
- Integration: force a Gate rejection in a scratch repo, confirm a row is written; force a UAT failure, confirm a row is written.

## Risks / rollback

- Risk: over-logging becomes noise nobody reads — mitigate with a minimal 5-field schema and only surfacing clusters (2+ hits) in grooming output, never a raw dump.
- Rollback: purely additive (new file + new write calls at existing decision points). Removing the write calls and the file leaves existing gate/review behavior untouched.
