# Validation report — codex-harness-hardening, Slice 0 (Freeze reality)

**Lane:** standard · **Verdict:** READY · **Date:** 2026-07-15
**Plan:** ../plan.md · **Decisions:** ed0b2920 (§15 locked) · **Gate 3:** pending user

## Reality gate

| Dimension | Result | Evidence |
|---|---|---|
| MODE FIT | PASS | standard, 3 flags (cross-platform, weak-proof, public-contract), no hard-gate flag; slice adds tests/data/census, removes nothing, mutates no product behavior |
| REPO FIT | PASS | onboard-spawn-against-constructed-tree pattern exists (`test_onboard_bee.mjs`); `blocked_downgrade` is a real emitted status (`onboard_bee.mjs:734,757,796`); stale tokens confirmed at `swarming-reference.md:17,22` |
| ASSUMPTIONS | PASS | see feasibility matrix |
| SMALLER PATH | PASS | 4 disjoint cells, deps:[] parallel-safe; freezes are distinct concerns, not combinable without coupling |
| PROOF SURFACE | PASS (after repair) | wrapper verifies rewritten to be crash-distinguishing and non-false-passing |

## Feasibility matrix

| Assumption | Risk | Proof | Evidence | Result |
|---|---|---|---|---|
| `.bee/config.json` not clobbered by onboarding `--apply` | frozen assertion targets wrong layer | inspect onboard_bee | `onboard_bee.mjs:1610-1621` — config.json is create-if-missing only; existing never overwritten | PASS |
| onboard_bee observably returns `changes_needed` (not blocked) for stale-0.1.43-source vs 0.1.44-runtime (= the defect) | fixture red for wrong reason | E-03 live dry-run | `.agents` launcher returned `changes_needed` + `copy_lib` for command-registry.mjs/state.mjs | PASS |
| census can flag operative stale syntax while excluding history | over/under-match | grep | tokens in `swarming-reference.md:17,22`; `docs/history/**` (incl SPEC, plan) also match and must be fenced out; `CREATION-LOG.md:10` also matches → fence rule added | PASS |
| test_bee_cli currently green → verify stays green when added | baseline goes red | ran it | 141-row hook_contracts green + test_bee_cli 121/0 | PASS |

## Plan-checker (adversarial, review/opus) — 1 BLOCKER + 4 WARNING, all fixed

- **BLOCKER (fixed):** cell -1 verify `… | tail -1` masks `test_bee_cli` exit (`|` binds tighter than `&&`, pipefail off) → false-pass. Rewrote to honor the real exit + grep both suites present in config.
- **WARNING (fixed):** cell -3 wrapper grepped bare `swarming-reference.md` — a crash stack-trace also emits that path → false-pass on crash. Switched to a specific `CENSUS-VIOLATION …` sentinel.
- **WARNING (fixed):** census scope fence underspecified — `CREATION-LOG.md` matches tokens. Added explicit fence (scan `SKILL.md`+`references/**`, exclude `*-LOG.md`/history/decisions/SPEC).
- **WARNING (fixed):** plan open-question #1 contradicted the resolved self-contained approach; `hashTree` reuse unstated. Fixed plan.md; cell -2 action now states inline hashTree re-impl.
- **WARNING (noted):** cell -1 self-listing guard can't detect its own removal — belt-and-suspenders; the `test_bee_cli` (D-14) protection is sound. Accepted.
- Dimension summary: coverage / dependencies / key-links / scope-sanity all CLEAN.

## Cell review (cold pickup, review/opus) — 2 CRITICAL + MINORs, all fixed

- CRITICAL cell -1 (pipe false-pass) and CRITICAL cell -3 (fence ambiguity) — same as above, fixed.
- MINOR cell -2: `hashTree` is copy-not-import (file exports nothing) — stated in action.
- MINOR cell -4: verify under-checked provenance — tightened to assert codex tool surface + collaboration + claude profile + `pending_live_probe`.

## Post-repair verify strings (stored)

- C-1: `node scripts/test_verify_manifest.mjs && node …/test_bee_cli.mjs && grep -q test_bee_cli.mjs .bee/config.json && grep -q test_verify_manifest.mjs .bee/config.json && echo CELL1-PASS`
- C-2: fixture → grep `FREEZE-RED: split-brain defect present` AND exit **sentinel 3** (distinct from node throw-exit-1)
- C-3: census → grep `CENSUS-VIOLATION.*swarming-reference` AND exit 1
- C-4: JSON structural + provenance assertions

## Verdict

**READY.** Reality gate PASS, feasibility matrix all PASS with command/inspection evidence, plan-checker and cell-review structurally clean after surgical repairs. No source touched (Gate 3 pending). Constraint carried to execution: cell -2/-3 are red-now freezes — they must NOT be added to `commands.verify` while red (fold in at Slice 2 / Slice 5). Constraint carried to Slice 5: `CREATION-LOG.md` is fenced out of the census by rule.
