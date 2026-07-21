# Validation — decision-propagation slice 1 (dp-1..dp-4)

Date: 2026-07-21 · Lane: standard · Verdict: **READY** · Gate 3: auto-approved (gate bypass total, audit decision logged)

## Reality gate

- MODE FIT — PASS: 2–3 flags (data model, multi-domain), story-sized; plan.md mode-gate record. Tiny/small insufficient (5 product files, 4 behavior cells).
- REPO FIT — PASS: extends existing `lib/decisions.mjs` + `bee.mjs` handlers (anchors verified by fresh-eyes + plan-checker); mirror law and run_verify discovery confirmed (`skills/bee-hive/templates/tests` is a DISCOVERY_ROOTS entry).
- ASSUMPTIONS — PASS: all blocking assumptions carry evidence (matrix below).
- SMALLER PATH — PASS: reuses `scope` instead of a new field; no graph store; no daemon (D5).
- PROOF SURFACE — PASS: new standalone suite `test_decisions_propagation.mjs` + full `run_verify`; red-first mandated per cell.

## Feasibility matrix

| assumption | risk | proof required | evidence | result |
|---|---|---|---|---|
| store lock primitive available for decisions store | M | lock module exists, pattern precedent | `lib/lock.mjs` present; `cells.mjs:414-426` writeCell-in-archive-lock retrofit precedent | PASS |
| append writers currently lock-free (must join lock in dp-3) | H | read the write path | `decisions.mjs:77,101,119` bare `appendJsonl` → folded into dp-3 as must_have (plan-checker BLOCKER, resolved) | PASS |
| capture stub write path reusable | L | module + signature | `lib/capture.mjs` `addCaptureStub` accepts `{outcome, source, dids}` | PASS |
| new suite auto-discovered by run_verify | L | discovery roots | `scripts/run_verify.mjs` DISCOVERY_ROOTS includes `skills/bee-hive/templates/tests` | PASS |
| short8 word-boundary negative achievable | L | regex semantics | hex chars are word chars → `\b` fails inside longer hex (cell reviewer confirmed) | PASS |
| schedule sane | L | `cells schedule` | 4 serial waves, `cycles: []`, no unsatisfiable deps | PASS |
| index determinism | L | stored dates only | `event.date` stored, no wall-clock in body (dp-4 prohibition) | PASS |

## Plan-checker (opus, adversarial) — iteration 1: 1 BLOCKER, 4 WARNINGs → iteration 2: CLEAN

- BLOCKER dp-3 concurrent-append lost-write → resolved: append writers share archive's store lock; jsonl-appropriate crash ordering (archive-append first, active rewrite second, union de-dup by id); rename-journal explicitly prohibited.
- WARNING dp-2 post-append event rewrite → resolved: sweep computed before the single append.
- WARNING dp-1 `--text` mandatory defeats tag-only recall → resolved: `--text` optional when a structured filter present.
- WARNING dp-3 journal analogy misleading → resolved (reworded).
- WARNING dp-1 `active` filters beyond D4a letter → kept as deliberate sibling extension, recorded here and in the cell text.

## Cell review (opus, cold-pickup) — FIX-FIRST → recheck CLEAN

- CRITICAL all four: red-first not forced → resolved: RED-FIRST step + truth in every cell.
- CRITICAL dp-3 append-side locking assumed context → resolved (see BLOCKER).
- MINOR fixture convention → `scripts/lib/test-fixture.mjs` (+ sibling test) added to every `read_first`.

## Approval block

- Gate 3 (execution, current slice dp-1..dp-4 only) — auto-approved under `gate_bypass: total`; audit decision logged. Advisor consult not mandatory (standard lane, no hard-gate flag); recorded as not-run.
- Execution shape: serial waves (same-file contention), one execution worker per cell, red-first evidence required before cap.
