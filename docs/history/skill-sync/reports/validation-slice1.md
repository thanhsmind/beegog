# Validation report — skill-sync (single slice)

Lane: high-risk · Gate 2 approved 2026-07-11 · plan.md `implementation-ready`

## Reality gate

| Check | Result | Evidence |
|---|---|---|
| MODE FIT | PASS | D4 mirror deletes inside `~/.claude/skills` (user-global, non-bee neighbors) → data-loss hard-gate → high-risk per the hive mode table. Not inflated: advisor consult independently confirmed the lane call |
| REPO FIT | PASS | Extends the existing `computePlan`/`applyPlan` split (onboard_bee.mjs:381, :530); needed utilities already exist (`sha256` :117, `writeFileAtomic` :125, `readTextIfExists` :121); source anchoring via `HIVE_DIR` (:23) already structural |
| ASSUMPTIONS | PASS | All three shape-time assumptions re-proven this session with fresh command output (matrix below) |
| SMALLER PATH | PASS | Standalone script and version-bump-only sync rejected at Gate 1 (D2, D5 — owner choices, not planner preference); lane floor fixed by hard-gate rule |
| PROOF SURFACE | PASS | Hermetic suite is the proof (cell 2); cell verify strings dry-run discipline applied (cell-3 verify simplified at prep time after a dry-run smell — `||` grouping removed) |

## Feasibility matrix

| Assumption | Risk | Proof required | Evidence (fresh, 2026-07-11) | Result |
|---|---|---|---|---|
| `applyPlan` allows a clean pre-write preflight | preflight lands mid-write → refusal mutates | read write order | First write is inside the item loop (`applyPlan` :530-556 — `computePlan` call is read-only, loop `writeFileAtomic` per item); **unconditional `onboarding.json` write after the loop (:640-648)** — refusal must return before both. Cell-1 must_have records exactly this | READY (constraint recorded in cell) |
| Numeric x.y.z compare suffices | prerelease tags break compare | git history of `BEE_VERSION` | `git log --all -p --follow` over templates/lib/state.mjs: 17 distinct values, all plain `x.y.z`, no prerelease/build tags | READY |
| Existing suite would hit real `~/.claude` without retrofit | tests mutate developer home | read the suite | `runOnboard` (test_onboard_bee.mjs:37) spawns the real script; 5× `--apply` invocations (:81,:104,:148,:242,:254); zero HOME/homedir/target override anywhere | READY (retrofit is cell-2 step 1) |
| `realpath(source)===realpath(target)` detects installed-copy self-invocation | NOOP misfires through symlinks | runtime probe | node probe: symlinked dir realpaths equal its real dir (`true`); `os.homedir()` resolves non-empty on this platform (WSL) | READY |
| Fallback-free version reader is required | `--force-downgrade` overrides a resolution failure (D3 violation) | read `readBeeVersion` | onboard_bee.mjs:153-157 — silent `FALLBACK_BEE_VERSION = "0.1.0"` (:31) confirmed; cell-1 prohibits its use for preflight | READY (constraint recorded) |

## Spikes

None needed — every blocking assumption was provable by inspection or a 5-line runtime
probe; no yes/no unknown remains.

## Plan-checker persona panel (codex, review slot, isolated context)

**Iteration 1: 8 BLOCKERs (F1-F8), 3 WARNINGs (F9-F11).** Raw report:
`.bee/workers/validate-skill-sync-panel.result.md`. All repaired before iteration 2:

- F1 version-state contract → absent = fresh install, existing-but-unreadable = unknown =
  refuse, unknown never forceable (CONTEXT D3 clarification, Gate-3-presented; approach.md;
  cells 1/2).
- F2 → realpath identity anchor (HIVE_DIR ↔ sourceRoot/bee-hive) required in cell 1.
- F3 → full outcome table (host-only branch, unknown branches, source-newer, force
  asymmetry) spelled out in cell 2.
- F4 → fixture authority: fake-source cases execute a COPIED launcher inside the fake tree.
- F5 (security) → production target override REMOVED (the earlier BEE_SKILLS_TARGET repair
  was itself the defect); isolation via fake HOME/USERPROFILE sentinel, new cell 0.
- F6 (security) → symlink policy locked: lstat-only walks, per-skill loud skip
  (blocked_symlink), never unlink/traverse, unpredictable temp names, ancestor-overlap
  fail-closed.
- F7 → cell restructure: 0 isolation-first (green vs current script) → 1 impl + safety
  tests same cell (suite is the verify) → 2 matrix → 3 docs.
- F8 → dispatch constraint recorded: these cells run on NATIVE workers only (codex sandbox
  EPERMs nested spawn); orchestrator goal-check re-runs verifies in the session shell.
- F9 → forced apply reports forced_downgrade:true + versions; asserted in cell 2.
- F10 → cell 3 deps [1,2]. F11 → brief re-rendered.

**Iteration 2** (raw: `.bee/workers/validate-skill-sync-panel2.result.md`): 6/11 closed;
5 residues (stale wording in plan/brief/risk-map for F1/F3/F5/F7/F11) + 2 NEW blockers:
cell-0's suite-wide sentinel invariant was impossible against cell-1's intentional
home-writes (→ per-case fake homes, per-case opt-in non-mutation assertions), and
nested-symlink + ancestor-overlap zero-mutation tests were missing (→ added to cell 1;
source-unknown branch added to cell 2). All repaired.

**Iteration 3 — FINAL** (raw: `.bee/workers/validate-skill-sync-panel3.result.md`):
**0 still open** — all seven carried items CLOSED with quoted evidence. 2 NEW blockers
surfaced, both one-sentence projection defects in the brief (Security implied unknown is
forceable; Rollback omitted cell 0 from the revert range). Both fixed immediately after
iteration 3; per the 3-iteration rule NO fourth panel ran — these two fixes are
panel-unverified and are named explicitly in the Gate 3 presentation. The truth artifacts
(CONTEXT/approach/plan/cells) already carried the correct statements; only the brief's
rendering lagged.

## Cell review (cold pickup, codex, isolated context)

**6 CRITICAL + 3 MINOR across the original 3 cells; no cell was cold-pickup ready.** Raw:
`.bee/workers/validate-skill-sync-cells.result.md`. All CRITICALs repaired (they overlap
panel F1/F5/F6/F7 — first-install contract, symlink safety, hermeticity fail-safe,
behavioral proof in the impl cell); MINORs resolved by decision: target-override contract
became "no override" (F5), manifest ordering = sorted paths (approach.md), docs cell deps
[1,2] + evidence-printing verify. Cell verifies dry-run in the session shell: cell-1
pipeline part exit 0, cell-3 regex part exit 0, suite baseline green.

## Approval block

```text
VALIDATION COMPLETE - APPROVAL REQUIRED BEFORE EXECUTION
Mode: high-risk
Work: single slice - cells skill-sync-0,1,2,3
Reality gate: PASS
Feasibility: READY WITH CONSTRAINTS
  - native workers only for suite-running cells (codex sandbox EPERMs nested spawn)
  - D3 clarifications (absent-vs-corrupt, unknown-never-forceable, symlink skip policy,
    no-override) are Gate-3-presented refinements of locked decisions
  - two post-iteration-3 brief wording fixes are panel-unverified (projection only)
Structure: PASS after 3 iterations (8+2+2 BLOCKERs raised, all closed)
Spikes: none needed (all assumptions proven by inspection/probe)
Cell review: PASS (4 cells, 0 CRITICAL open - 6 CRITICALs found and repaired)
Unresolved concerns: none
```

