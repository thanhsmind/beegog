# chain-integrity — plan

**Mode:** standard · **Gates:** 1 ✅ · 2 pending · 3 pending
**Decisions:** see `CONTEXT.md` (D1–D5)

## What we are building

Two fail-close rules that make the post-mortem's exact sequence impossible rather than discouraged.

## Design constraints discovered while reading the code

1. **`state.mjs` cannot import `cells.mjs`.** `cells.mjs` already imports `state.mjs` (`cells.mjs` → `readState`), and `state.mjs`'s own header comment (`state.mjs:6-7`) says it deliberately imports leaf modules only to avoid exactly this cycle. `scribingDebt()` lives in `cells.mjs`.
   **Therefore:** the *transition table* is pure and lives in `state.mjs`; the *debt check* lives in `bee.mjs`, which already imports both.

2. **`state set` can target a lane record, not just global state** (`resolveMutationTarget`, `bee.mjs:777`). The transition check must read the phase off the *record being mutated*, not off global state.

3. **`scribingDebt(root)` reads global state only** (`cells.mjs:523` → `readState(root)`). For lane-scoped work it would answer about the wrong record. Out of scope for this feature — filed as friction, not silently ignored.

4. **`.bee/state.json` is already hook-denied for direct edit** (`guards.mjs:55`, `DIRECT_EDIT_DENY`). So the CLI is a genuine choke point: locking `state set` + `state scribing-run` locks every legitimate path.

## Validation outcome — the original design was WRONG, and is corrected

The open question below sank the first design, exactly as feared. Recorded, not quietly patched:

- **Nothing in the repo ever sets `--phase scribing`** (zero grep hits). `bee-scribing/SKILL.md:112` goes straight to `state scribing-run`, which hard-codes `phase = 'compounding'` (`bee.mjs:996`).
- So "compounding only from scribing" would have made `compounding` **unreachable** and refused the only scribing path that exists.
- **Corrected design (D1-REVISED): guard the door, not the phase name.**

## The rules, as they will actually be built

```
state set --phase compounding          → REFUSED always. Error names `state scribing-run`.
state scribing-run                     → sole producer of phase=compounding.
                                         requires current phase ∈ {swarming, reviewing, scribing}
state set --phase compounding-complete → requires current phase == compounding
                                         AND scribingDebt().count == 0
                                         (or an explicit, decision-logging waiver — D4)
```

Everything else stays permissive, including all backward moves and `--phase idle` (the de-facto abandon verb — confirmed still works).

The post-mortem's call, `state set --phase compounding-complete` from `swarming`, is now refused at **two independent points**: the phase predecessor check, and the debt check.

## Cells

| id | title | lane | behavior_change |
|---|---|---|---|
| `ci-1` | `checkPhaseTransition(from, to)` in `state.mjs` — pure, exported, unit-tested. No `cells.mjs` import (cycle). | small | yes |
| `ci-2` | Wire it into `handleStateSet` + `handleStateScribingRun`; refusals name the required predecessor and the correct command | small | yes |
| `ci-3` | Scribing-debt fail-close on `compounding-complete`, naming each unscribed cell; loud `--waive-scribing-debt` that logs a decision (D4) | small | yes |
| `ci-4` | Fix the three skills documenting non-existent phases (D6) | small | yes |
| `ci-5` | Update the prose asserting the old posture (`cells.mjs:521` "never a blocker", `bee-compounding/SKILL.md:77` "never hook-enforced"); sync vendored twins `.bee/bin/**` | small | yes |

`ci-1` → `ci-2` → `ci-3` sequential. `ci-4` independent. `ci-5` last.

## Tests that must change (all 3 are performing illegal transitions — they are evidence of the bug, not victims of the fix)

- `test_lib.mjs:3418` — `idle → compounding-complete`. Fixture gains `phase: 'compounding'`.
- `test_bee_cli.mjs:524` — scribing-run from `planning`. Fixture chain gains `swarming`.
- `test_bee_cli.mjs:568` — same, lane variant.

Rule B (debt) breaks **zero** existing tests.

## Known limitation, filed not hidden

`scribingDebt(root)` reads **global state only** (`cells.mjs:523` → `readState(root)`), so for `--lane`-scoped work it answers about the wrong record. This feature does not fix that. Filed as friction.

## Verify

`node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/scripts/test_onboard_bee.mjs && node scripts/test_portable_paths.mjs && node hooks/test_model_guard.mjs && node hooks/test_write_guard.mjs && node hooks/test_hook_contracts.mjs`

Baseline was green (all six suites exit 0) before any cell was claimed.

New tests required (in `test_lib.mjs`):
- legal tail walk `swarming → scribing → compounding → compounding-complete` passes
- `swarming → compounding-complete` is REFUSED (the exact post-mortem call)
- `exploring → compounding-complete` is REFUSED
- backward moves (`swarming → planning`) still pass
- `compounding → compounding-complete` with debt > 0 is REFUSED and names the cells
- the same with `--waive-scribing-debt` passes and logs a decision
- `scribing-run` from a non-`scribing` phase is REFUSED
