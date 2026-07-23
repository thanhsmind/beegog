# Validation report — backlog-submit-command, E1 slice 1

**Cell:** `backlog-submit-command-1` (standard lane)
**Verdict:** READY WITH CONSTRAINTS (2 non-blocking WARNINGs from plan-checker, 1 MINOR from cell review — fixed in-place)

## Reality Gate

| Dimension | Result | Evidence |
|---|---|---|
| MODE FIT | PASS | `standard` is correct: 0 risk flags but 4 product files exceeds `small`'s 3-file cap (locked D5 file split). |
| REPO FIT | PASS | Sibling functions confirmed present: `readBacklogCounts` (backlog.mjs:50), `rankBacklog` (backlog.mjs:150), `handleBacklogCounts/Rank/Badges/Add` (bee.mjs:2456/2465/2476/2556), `backlog.add`/`backlog.counts` registry entries (command-registry.mjs:1016/1060). |
| ASSUMPTIONS | PASS | Grep for `propose\|assignId\|nextId` in `lib/backlog.mjs`/`bee.mjs` confirms no existing PBI-row-creation code — this is genuinely new, not a duplicate. Confirmed independently by both exploring's scout and the fresh-eyes reviewer's own grep. |
| SMALLER PATH | PASS | Already reasoned in plan.md: compressing to 3 files would require reinterpreting locked D5 (the function's file location), a red flag in itself. |
| PROOF SURFACE | PASS | `node scripts/run_verify.mjs` exists, `node --check`-clean, discovers `test_*.mjs` under `skills/bee-hive/templates/tests` by glob — the new `test_cli_cells.mjs` coverage is exercised automatically. |

## Feasibility Matrix

| Assumption | Risk | Proof required | Evidence | Result |
|---|---|---|---|---|
| ID assignment (max+1 scan, gap-tolerant) | LOW | Cell must not hardcode an expected next id (live table advances) | Cell action patched to require reading the max back out of the fixture, never a literal | PASS |
| Row insertion doesn't corrupt existing rows | LOW | `readBacklogCounts` must still parse the full 80+-row live table cleanly | Confirmed during this session's own P80/P81/P82 row additions (rank/badges/counts all ran clean after) | PASS |
| Mirror sync (6 tracked roots) | LOW | Exact sync script path + full mirror-root count | Cell action patched: `skills/bee-hive/scripts/onboard_bee.mjs --repo-root . --apply`, 6 mirror roots named | PASS |
| Wave/schedule | LOW | No cycles, correct wave placement | `cells schedule --json`: `cycles: []`, `backlog-submit-command-1` alone in wave 0 | PASS |

## Plan-Checker (adversarial, `bee-review`/opus)

5-dimension verdict: **no BLOCKERs.**
- Requirement/decision coverage: PASS — D1-D5 all mapped into the cell.
- Cell completeness: PASS (1 WARNING — verify doesn't itself prove a live-table invocation beyond fixture tests; accepted as non-blocking, fixture coverage is the intended proof surface per plan.md's Test matrix).
- Dependency correctness: PASS — confirmed via `cells schedule --json`.
- Key links: PASS — both `must_haves.key_links` match the action's described wiring.
- Scope sanity: PASS — cell prohibitions mirror plan.md's Out of scope exactly.
- Plan spot-check: 1 WARNING — plan.md prose cites `renderBadges`, the real export is `renderBacklogBadges` (backlog.mjs:295). `plan.md` is frozen at Gate 2 (D1) — not corrected, since it's a doc-only citation typo the cell itself doesn't rely on (no execution impact, confirmed by the reviewer).
- Noted (not a defect): the live backlog table's max P-id has advanced past the P79/P80 examples used in CONTEXT.md/plan.md prose (now includes P81/P82, filed as deferred-idea rows during exploring) — D2's max+1 logic is unaffected; the cell action was patched to never hardcode an expected id for exactly this reason.

## Cell Review (cold pickup, `bee-review`/opus)

**CRITICAL:** none.
**MINOR:** 1 — action didn't name the exact `onboard_bee.mjs` path among 6 tracked mirror roots, forcing a cold worker to hunt for it. **Fixed**: `cells update` patched the cell's `action`/`read_first` with the exact path (`skills/bee-hive/scripts/onboard_bee.mjs`) and the mirror-root count.

All `must_haves.truths` confirmed yes/no testable (exact row format, max+1-with-gap, byte-identical-on-reject, counted-as-proposed, three-copies-match). Single-cell scope confirmed justified — function/handler/registry/test are inseparable, not overloaded.

## Decision

**READY WITH CONSTRAINTS** — no CRITICAL/BLOCKER findings; the one MINOR fix (exact sync path) is applied; the two WARNINGs are accepted as non-blocking (a plan.md prose typo with no execution impact, since plan.md is frozen; and fixture-only proof, which was always the intended coverage strategy per the plan's own Test matrix).
