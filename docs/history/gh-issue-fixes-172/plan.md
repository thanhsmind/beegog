---
artifact_contract: bee-plan/v1
mode: standard
approved_gate2: 2026-07-20 (gate-bypass total, audit decision logged)
---

# gh-issue-fixes-172 — fix GitHub issues #23, #26, #27 (correctness cluster)

## Mode gate

Flags counted: **cross-platform** (install.ps1, Windows-only clone path) + **changes behavior an existing test asserts** (budget pair-counting semantics, cap contract) + **multi-domain** (installer / CLI dispatcher / claims-budget lib) = **3 → standard**. No hard-gate flag: every change adds guards or validation; nothing weakens auth, audit, or existing proof. Product files: ~7 (bee.mjs template, cells.mjs, claims.mjs, install.ps1, 3 test files) — above the small cap, confirming standard.

Smaller modes insufficient: three independent issue surfaces + behavior-contract changes in covered code (budget counting, cap refusal) need per-cell verify + plan-check, not a merged tiny gate.

## Discovery

L0 — every pattern already exists in-repo, cited:
- Locked RMW: `withStoreLock` used by state.mjs:1649, reservations.mjs:136+, claims.mjs:543 — cells.mjs is the one store that never adopted it.
- Heartbeat renewal: `renewClaimTTL` claims.mjs:355-385 spreads the claim and overwrites `claimed_at`; an immutable sibling field survives the spread for free.
- Sparse-checkout staging: install.ps1:107-119 vs install.sh:170-172 (full clone) — divergence is the #26 root cause (gather digest, 2026-07-20).

## Evidence base (worker digests, 2026-07-20)

- **#23**: `main()` handles `--help` only at argv[0] (templates/bee.mjs:4086); a group token + `--help` falls to `GROUP_USAGE_FALLBACKS` → `Unknown command "(missing)"`, exit 1.
- **#26**: install.ps1:113 sparse-checkout set omits `.codex-plugin`; onboard's three-member tuple check (onboard_bee.mjs:462-487) then reports the exact user-visible error. The "bee 1.6.2" line reflected main's real state at install time (not a bug). "Failed to uninstall plugin" is unchecked native stderr from `plugin remove/uninstall` on hosts without the plugin (install.ps1:208/227) — cosmetic.
- **#27 claim verdicts** (gather-budget digest):
  1. Heartbeat double-count — TRUE. appendAttempt stamps live `claim.claimed_at` (cells.mjs:157); checkCellBudgets pairs `(claim_session, claimed_at)` (cells.mjs:1176-1180); renewClaimTTL rewrites `claimed_at` (claims.mjs:377). One claim + N heartbeats between failures = N+1 counted claims.
  2. Attempt-ledger RMW unlocked — TRUE. cells.mjs never imports lock.mjs; recordVerify/blockCell/capCell are read→mutate→writeJsonAtomic; concurrent writers drop entries.
  3. Budget clamps — PARTIAL. No upper clamp in resolveCellBudgets (cells.mjs:1117-1129); but workers CANNOT raise budgets live (`budgets` not updatable, claimed cells refuse patches) — authoring-time gap only.
  4. reset-budget — TRUE. No exhaustion guard (bee.mjs:927-933); cell written before decision log (cells.mjs:1235-1242); actor optional.
  5. Judge verdict log-only — TRUE. capCell (cells.mjs:700-833) never reads trace.semantic_judge; a FAIL verdict cannot block cap.

## Approach

One slice, six cells, each independently verifiable and committed per cell. Decisions D-GHF1..7 logged via decisions CLI.

1. **ghf-1 (#23)**: `bee <group> [verb] --help [--json]` returns registry help filtered to the resolved command/group prefix, exit 0. Unknown group still errors as today.
2. **ghf-2 (#26)**: add `.codex-plugin` to the sparse-checkout set (harmless on old refs — an unmatched pattern materializes nothing); guard `plugin remove/uninstall` behind a `plugin list` presence probe so the "not found" stderr never fires (PS 5.1 forbids `2>` redirection here — install.ps1:104-106 comment).
3. **ghf-3 (#27.1)**: claim files gain immutable `acquired_at` (set once at claim creation; renewClaimTTL preserves it). Ledger entries gain `acquired_at` (fallback: live `claimed_at`). checkCellBudgets pairs on `(claim_session, acquired_at ?? claimed_at)` — preserves Δ1's intent (count real acquisitions) which the heartbeat mutation broke; legacy ledgers behave identically.
4. **ghf-4 (#27.2)**: wrap the RMW bodies of recordVerify, blockCell, capCell (and resetCellBudget) in `withStoreLock(root, 'cells:<id>', …)`, same pattern as state/reservations.
5. **ghf-5 (#27.3+4)**: resolveCellBudgets clamps to integers within [1, hard-max] (hard-max = 3× default: max_claims 9, max_failed_attempts 12, max_same_signature 6); validateNewCell rejects malformed/out-of-range `budgets` at authoring time. resetCellBudget: refuses unless the cell is actually budget-blocked (checkCellBudgets not ok); decision log written BEFORE the cell write; actor recorded (`--operator` flag or BEE_AGENT_NAME, refused when neither yields an actor).
6. **ghf-6 (#27.5)**: capCell refuses (typed `JUDGE_REWORK_REQUIRED`) when the latest trace.semantic_judge verdict is a fail, unless an explicit audited `--override-judge "<reason>"` is supplied (appended to trace, decision logged). Full judge_pending→rework lifecycle + revise-from-judge verb stays 1.7.3 roadmap (issue reply), not this slice.

Mirror discipline: every cell touching `skills/bee-hive/templates/**` runs self-onboard (`onboard_bee.mjs --repo-root . --apply`) in the same cell so `.bee/bin` mirrors stay byte-equal (test_lib_mirror).

**Risk map**: cells.mjs budget/cap paths — MEDIUM (covered by test_claim_race/test_heartbeat_touch/test_bee_cli; proof = those suites green plus new assertions); claims.mjs claim-file shape — MEDIUM (cross-session claim files parsed by hooks; proof = test_heartbeat_touch + test_claim_race green); install.ps1 — LOW (line-scoped, bash E2E unaffected, no local PS runtime — static grep check + unaffected bash E2E as proof, Windows validation via issue reporter); bee.mjs help routing — LOW (additive early-return, DA5 bijection asserts fallback lines unchanged for non-help paths).

**Out of scope (1.7.3 roadmap, replied on #27)**: judge lifecycle state machine, runtime-neutral BEE_SESSION_ID, per-cell CAS/ownership rework, stale sweep to open, worktree mutex, small-lane serial loop, tiny-direct lane, ps1 confirmation/rollback parity, Windows CI E2E.

## Test matrix (edge dimensions, scaled)

- Concurrency: two concurrent recordVerify on one cell — both ledger entries survive (new assertion, ghf-4).
- Time: heartbeat between two failed attempts — claims_used stays 1 acquisition (new assertion, ghf-3).
- Legacy data: ledger entries without `acquired_at` count exactly as today (ghf-3 assertion).
- Boundary: budgets {max_claims: 999999} clamped to 9; {max_claims: 0}/non-integer refused at add (ghf-5).
- Authorization: reset-budget on a non-exhausted cell refused; no actor → refused (ghf-5).
- Contract: cap after judge FAIL refused; with --override-judge succeeds and audits (ghf-6).
- CLI: `state --help --json` exit 0 valid JSON manifest subset; `cells --help` text; unknown group unchanged (ghf-1).
