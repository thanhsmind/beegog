# harness10 — Validation Report, Slice 1 (A2: command detection)

**Date:** 2026-07-08 · **Mode:** standard, slice lane small · **Cells:** harness10-1, harness10-2 · **Verdict:** READY

## Reality Gate

| Check | Result | Evidence |
|---|---|---|
| MODE FIT | PASS | 2 flags (existing covered behavior, multi-domain) → standard; slice 1 = 2 small cells, 5 bounded files |
| REPO FIT | PASS | seam `commandsNotices()` exists (onboard_bee.mjs:265-277); `COMMAND_KEYS` exported (state.mjs:33); new lib modules auto-vendor via `listTemplateLibModules()` readdir (onboard_bee.mjs:317-331, 385-395) |
| ASSUMPTIONS | PASS | COMMAND_KEYS drift test already green; fixture harness Windows-safe (`E:\Temp\bee-onboard-test-*`); relative import survives vendoring (state.mjs lands beside detector in `.bee/bin/lib/`) |
| SMALLER PATH | PASS | no smaller path: dropping the detector keeps the skippable open question — the friction being removed |
| PROOF SURFACE | PASS | verify = both suites, runnable from repo root, baseline green this session (41 + 74 pass) |

## Feasibility Matrix

| Assumption | Risk | Proof required | Evidence | Result |
|---|---|---|---|---|
| Notice seam accepts candidate payloads without changing plan/apply semantics | LOW | code read | `commandsNotices()` returns string array consumed by both plan and apply payloads (onboard_bee.mjs:609, 627) | PASS |
| New lib file vendors automatically | LOW | code read | copy step + managed-versions hash iterate readdir of templates/lib | PASS |
| Detector CLI entry can run post-vendor from host repos | LOW | pattern check | `node .bee/bin/lib/commands_detect.mjs` — same invocation family as existing bin helpers; guarded entry keeps import side-effect-free | PASS |
| Existing verbatim-copy test loop covers the new module | LOW | test read | test_onboard_bee.mjs:146-156 loops `listMjs(TEMPLATES_LIB_DIR)` | PASS |

No MEDIUM/HIGH unproven assumptions → no spike required.

## Plan Checker (adversarial, generation tier)

- **Iteration 1:** 1 BLOCKER — no invocable detection surface for exploring (lib exports a function; nothing runnable). 5 WARNINGs — candidate-value semantics unspecified per manifest; drift-test import trap (local COMMAND_KEYS regex assertion); D3 write-path unprotected by any must_have; cell-1 verify narrower than plan; redundant vendoring assertion invited.
- **Repairs:** dual-use module with guarded CLI entry + truth pinning it; per-manifest mapping enumerated (explicit-match rule + convention candidates citing marker files, propose-only per D3); "leave local COMMAND_KEYS untouched"; artifact substantive extended with the write-confirmed-values clause; verify = two-suite chain; "confirm existing loop, no redundant assertion".
- **Iteration 2:** all six findings CLOSED, no new issues — **structurally clean, all five dimensions**.

## Cell Review (cold pickup, generation tier)

- harness10-1: 1 CRITICAL (manifest→key mapping unspecified beyond package.json) — fixed by the mapping-rule enumeration above. 1 MINOR (dedup tie-break ambiguity) — fixed (source order, lexicographic within glob).
- harness10-2: 2 MINOR (insertion point unnamed; redundant verbatim assertion) — both fixed (commandsNotices named with line anchor; existing-loop wording). Cross-cell COMMAND_KEYS-unification doubt resolved by the explicit leave-untouched clause.
- Verify commands confirmed runnable from repo root by the reviewer (exit 0).

## Approval Block

- Verdict: **READY** — feasibility proven, no open CRITICAL/BLOCKER, cells cold-executable.
- Approval covers **slice 1 only** (cells harness10-1, harness10-2). Slices 2–4 return to planning prep + validating when current.
- Constraint recorded for execution: convention candidates (pytest / dotnet test / go test ./...) must always carry their marker file as source — the user-facing question is what keeps never-invent honest.
