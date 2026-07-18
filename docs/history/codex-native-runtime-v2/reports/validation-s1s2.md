# Validation report — codex-native-runtime-v2, slice S1+S2

Date: 2026-07-18. Lane: high-risk. Cells: cnr2-1, cnr2-2, cnr2-4 (cnr2-3 dropped — see below).

## Reality gate

- **MODE FIT: PASS** — 5 flags counted mechanically (external systems, public contracts, cross-platform, existing covered behavior, multi-domain); no hard-gate flag; high-risk honest.
- **REPO FIT: PASS** — generator model confirmed real: `hooks/catalog.mjs` single source renders both plugin projections + repo target (header lines 6-48); catalog drift-check exists (`test_hook_contracts.mjs:751+`); host-repo renderer separate (`onboard_bee.mjs:1712/:1810/:2299`) and now in-scope for cnr2-2.
- **ASSUMPTIONS: PASS (one disproved and repaired)** — the D5 "split-brain" assumption was DISPROVED by evidence (intentional per-runtime projections, test-pinned); cnr2-3 dropped, CONTEXT.md corrected, decision logged. Remaining assumptions carry evidence rows below.
- **SMALLER PATH: PASS** — slice already minimal: three independent repairs + one evidence spike; everything else deferred behind the capability matrix.
- **PROOF SURFACE: PASS** — every cell verify runnable; baseline suite green this session (exit 0, full recorded chain).

## Feasibility matrix

| Assumption | Risk | Proof required | Evidence | Result |
|---|---|---|---|---|
| codex CLI inspectable read-only | M | binary present, responds | `codex --version` → `codex-cli 0.144.4`; binary at `/home/thanhsmind/.local/bin/codex` (cell reviewer) | PASS |
| `.codex/hooks.json` is generator-rendered | M | named source | `catalog.mjs` header: repo target; PLUS host-side `renderCodexHookEntries()`/`renderRepoHookEntries()` (`onboard_bee.mjs:1810/:1712`), version hash `:2299` | PASS (two generators, both in cnr2-2 scope) |
| Manifest "split-brain" needs convergence | — | route wiring | DISPROVED: intentional projections, ALLOWED_DIFFERENCES pinned (`test_hook_contracts.mjs:751+`) | cnr2-3 dropped |
| Stale doc lines exist as cited | L | grep | cell reviewer confirmed verbatim at INSTALL.md:120, README.md:434, 06-runtime-integration.md:52; cnr2-1 verify RED today, flips green on fix | PASS |
| Contract tests green pre-change | M | run | `test_hook_contracts.mjs` (162 rows) PASS, `test_model_guard.mjs` PASS (cell reviewer, today) | PASS |
| Schedule sane | L | `cells schedule` | waves `[[cnr2-1, cnr2-2, cnr2-4]]`, zero cycles, no unsatisfiable deps | PASS |

## Plan-checker panel (review tier)

Verdict: **STRUCTURALLY CLEAN**. 2 original blockers mooted by the cnr2-3 drop; 3 warnings, all folded into cells: (1) host-repo matcher renderer added to cnr2-2 files+action; (2) cnr2-4 now names the read-only observability ceiling (c/d/e rows may honestly end `unknown`; gating consequence documented instead of assumed `observed`); (3) cnr2-1 gains the never-quote-banned-phrase guard.

## Cell review (cold pickup)

1 CRITICAL (cnr2-2 second generator + version hash `:2299`) — fixed as a new must_have truth. 4 MINOR (brittle fixed-order grep — accepted, matches produced order; redundant `-qc` — fixed; spike evidence file unverified — verify extended; re-quote caution — folded into action). All CRITICAL flags closed.

## Advisor consult

cli-shaped advisor `codex exec -m gpt-5.6-sol -s read-only` — bundle: `reports/advisor-bundle.md`; digest: `reports/advisor-digest.md`; recorded via `state advisor-ref record` (AO2b/AO3). Consult ran against the post-repair plan; its findings reconciled before dispatch (constraints-before-dispatch, p49 precedent).

## Verdict

**READY** (pending advisor digest reconciliation). Gate 3: auto-approved under bypass=total (audit decision logged at approval time).
