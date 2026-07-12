# Validation report — review-on-demand, slice 1 (runtime substrate)

Plan: `docs/history/review-on-demand/plan.md` (implementation-ready) · Cells: review-od-1..3 · Lane: standard

## Reality gate

| Dim | Verdict | Evidence |
|---|---|---|
| MODE FIT | PASS | 3 flags counted mechanically in plan.md (covered behavior, public contracts, multi-domain); no hard-gate flag — R2 keeps every verification condition; precedent lane-scaling v2 (`d02a6bc6`) ran standard |
| REPO FIT | PASS | store+CLI mirrors `.bee/cells/` + `bee_cells.mjs` (exists); strict-read write path precedent `readStateStrict` (lib/state.mjs:241); parity sweep test already enforces templates↔.bee/bin byte-identity (test_lib run this session: 171 passed) |
| ASSUMPTIONS | PASS | all four blocking assumptions spiked/inspected — see matrix; results in `.bee/spikes/review-on-demand/RESULT.md` |
| SMALLER PATH | PASS | stored-status and gate-bit alternatives rejected in plan §Approach with reasons (staleness truth, §8 immutability); 3 cells is the floor for store/engine/surface separation with per-cell verify |
| PROOF SURFACE | PASS | verify `node skills/bee-hive/templates/tests/test_lib.mjs` ran green this session (171 passed, 0 failed) — command exists and can fail (non-zero on failed assert) |

## Feasibility matrix

| Assumption | Risk | Proof required | Evidence | Result |
|---|---|---|---|---|
| git rev-list distinguishes reviewed (0) vs stale (>0) at immutable head | MEDIUM | live probe | fixture repo: at-head `0`, one-behind `1` | PROVEN |
| unknown sha (rebase/amend) is a detectable degrade, not a crash | MEDIUM | live probe | `rev-list deadbeef..HEAD` → exit 128, stderr | PROVEN |
| git-absent host degrades read path without throw | MEDIUM | live probe | node spawnSync PATH=/nonexistent → error=ENOENT, status=null, no throw | PROVEN |
| onboarding auto-syncs NEW template files to host `.bee/bin` | LOW-MED | code inspection | onboard_bee.mjs enumerates via readdirSync (lines 864, 875) — no fixed list | PROVEN |
| preflight has a real evidence field to inspect | MEDIUM | code inspection | `verification_evidence` in lib/cells.mjs; capCell refuses behavior_change without it (cells.mjs:220-222) | PROVEN |
| new .bee review files need the managed .gitignore block | LOW | inspection | block covers mutable runtime only; sessions/candidates are durable audit records, same class as tracked `.bee/cells/` + `decisions.jsonl` → tracked, no block change | RESOLVED (no) |

## Plan-checker findings (review slot: opus) — iteration 1: ITERATE → closed mechanically

1. **[BLOCKER] Cross-cell contract gap:** review-od-3's R7 high-risk warning read a candidate `mode`
   field review-od-1's `candidate add` never recorded (also a mode-vs-lane category error).
   **Fix applied:** review-od-1 `candidate add` now REQUIRES `--mode <lane>` on every ledger entry
   (+ must_have truth); review-od-3 reads the guaranteed field, fallback derivation removed.
2. **[WARNING] §11.2 vs §11.3 unreconciled:** resolved in plan.md "Migration + preflight notes" — no
   durable pre-existing coverage records exist (gates reset at startFeature; old reviews are prose
   reports); prose reports stay as audit history, legacy candidates derive `unreviewed` per §11.3.
3. **[WARNING] A10 reachability + commit-only scopes:** noted in plan.md — preflight is a defensive
   re-check behind capCell's own refusal; commit-range scopes without mappable cells are outside A10's
   guarantee and slice-2 scope preview must say so.

Confirmed sound by checker: parity sweep auto-covers new files (test_lib.mjs:3690); preflight evidence
field real (cells.mjs:283); lib-export contract stated both sides; retiring the POST_REVIEW warning hits
no frozen assertion; dep order 1→2→3 serializes shared-file edits; §12 surfaces all owned.

## Cell review (cold pickup, review slot: opus) — FIX-FIRST → all CRITICALs fixed

- **[CRITICAL, review-od-2]** git-fixture/PATH-strip precedent unreachable + inaccurately cited.
  **Fix applied:** `test_onboard_bee.mjs` added to read_first; action now states test_lib has no git
  precedent, points at the real spawnSync+availability-guard lines (873-875), names PATH-strip as a new
  variation proven by the spike, and requires explicit root/cwd (never process.cwd()).
- **[CRITICAL, review-od-3]** same cross-cell `mode` drift as checker finding 1 — fixed as above
  (corroboration across independent reviewers).
- **[MINOR, fixed]** review-od-1: scope.json input keys + session-id non-reuse rule now in the action.
- **[MINOR, fixed]** review-od-3: render language pinned to the English equivalent (house style),
  asserts match that exact string; critical-patterns.md added to read_first.
- Confirmed: verify command exists, runs green (171/0), exits non-zero on failure (test_lib.mjs:3809).

Mechanical-close precedent: decisions `d2788ac9` (ITERATE round closed mechanically) / `c05613d9`
(deterministic prescribed fixes applied with evidence, no extra round).

## Verdict

**READY** — reality gate 5/5 PASS, matrix 6/6 PROVEN/RESOLVED, checker BLOCKER + both cell CRITICALs
fixed with prescribed edits (both reviewers independently converged on the same cross-cell defect),
warnings recorded in plan.md. Approval covers slice 1 only (review-od-1..3); slice 2 returns to
planning/validating.
