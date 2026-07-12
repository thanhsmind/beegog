# Validation — harness-integration-adopt, slice 1 (cells hia-1..hia-5)

Date: 2026-07-12 · Lane: standard · Validator: session (Fable), plan-checker + cell reviewer on review slot (opus)

## Reality gate

| Check | Result | Evidence |
|---|---|---|
| MODE FIT | PASS | 2 risk flags (public contracts: agent-facing manifest on every onboarded host; existing covered behavior: guard + status pinned by 215-test suite) → standard. >3 files, 2 domains. |
| REPO FIT | PASS | Onboarding vendors by glob (`onboard_bee.mjs:860-879` `templates/*.mjs`, `templates/lib/*.mjs`); byte-identity sweep `test_lib.mjs:4788` auto-covers new files; gitignore BEE block generated from `GITIGNORE_BLOCK_PATTERNS` (`onboard_bee.mjs:63`). |
| ASSUMPTIONS | PASS | All blocking assumptions proven by command — see matrix. |
| SMALLER PATH | PASS | Merging the PR directly is *larger* (brings vantt's `.bee` state + conflicts). Import-and-adapt of code-only files is the smallest honest path; spawnSync alternative rejected by locked DA1. |
| PROOF SURFACE | PASS | Every cell verify is a runnable command chain; suite additions execute inside existing isolation patterns. |

## Feasibility matrix

| Assumption | Risk | Proof required | Evidence | Result |
|---|---|---|---|---|
| PR's test_bee_cli.mjs never mutates this repo's `.bee` | HIGH if false | fixture inspection | `git show pr-1-vantt:...test_bee_cli.mjs` — `mkdtempSync(os.tmpdir(), 'bee-cli-test-')` line 87, second isolated root line 354; "NEVER runs a" (against real repo) header line 4 | PROVEN |
| Guard check (d) hunks port onto current main guard | MEDIUM | diff base..main | `git diff 088fcd8..main -- hooks/bee-write-guard.mjs` = +110/−61 (codex apply_patch parity landed after PR base) → wholesale replace forbidden; hia-1 mandates manual port of (d) only | PROVEN (constraint recorded) |
| Helper verb lists derivable from runtime | MEDIUM | probe | `bee_cells.mjs zzz` → "Use: list, ready, show, add, update, claim, verify, cap, block, drop, tier, judge."; same contract line for reservations (4 verbs) and decisions (5 verbs) | PROVEN |
| PR template ↔ vendored copies identical (extract from templates suffices) | LOW | byte diff on ref | `diff <(git show pr-1-vantt:templates path) <(git show pr-1-vantt:.bee/bin path)` identical for bee.mjs, command-registry.mjs, guard | PROVEN |
| Status parity diff (stdout only, stderr excluded) is a valid byte-parity check | LOW | mechanism check | PR P1 rule: drift hint goes to stderr only (bee.mjs `emit()`); hia-2 verify uses `2>/dev/null` on both sides | ACCEPTED — final proof executes at hia-2 verify time |
| Helpers refuse to run outside a bee repo (bijection test must run in a fixture root) | LOW | probe | running helpers from `/tmp` → "No bee repo root found" | PROVEN (constraint for hia-3: use suite temp-repo convention) |

## Pre-existing drift found during validation (bonus finding)

`.bee/bin/hooks/bee-write-guard.mjs` on main is **stale** vs `hooks/bee-write-guard.mjs` (192 diff lines — missing the codex apply_patch parity work), and `.claude/settings.json:40` wires the **stale vendored copy**. hia-1's byte-identical copy step fixes this as a side effect; noted for the close-out decision log.

## Plan-checker findings (opus, adversarial) — 0 BLOCKERS / 6 WARNINGS

Dimensions 1 (DA coverage), 3 (dep DAG), 4 (key links) verified CLEAN with evidence.
Warnings and their dispositions (all repaired in-place via `bee_cells.mjs update` before Gate 3):

1. **logCrash arity mis-port risk** (PR check-(d) calls 2-arg `logCrash`; main is 4-arg via adapter.mjs) → hia-1 action now mandates the 4-arg adaptation + libModuleUrl-style imports. FIXED.
2. **Guard hook test ungated until close-out** → hia-1 verify now runs `test_bee_write_guard_hook.mjs` + `hooks/test_write_guard.mjs`; test-API adaptation to main's adapter permitted (assertions come from unchanged lib/guards.mjs). FIXED.
3. **`bee --help --json` grep token is a non-runnable shorthand** absent from PR prose → hia-4 verify greps the runnable `bee.mjs --help --json`; action mandates the full `node .bee/bin/bee.mjs --help --json` form. FIXED.
4. **Bijection parse traps** (trailing period on the contract line; second flag-level `Use:` line in bee_cells update) → hia-3 action now names both traps explicitly. FIXED.
5. **Overstated AGENTS sync guarantee** (no standing test compares AGENTS.md block to template) → hia-4 action corrected: worker must byte-diff the two blocks itself and report. FIXED.
6. **hia-4 temporal prose vs hia-2** (docs claim cells.update before it exists) → hia-4 deps now [hia-1, hia-2]. FIXED.

## Cell review findings (opus, cold pickup) — 0 CRITICAL / 5 MINOR

- hia-1 hand-port difficulty + adapter note → folded into warning-1/2 fixes above.
- hia-4 `grep 'bee.mjs' docs/02` false-pass (2 pre-existing hits) → verify now greps `command-registry.mjs` (0 pre-existing hits). FIXED.
- hia-5 must_haves not machine-checked → verify now greps the backlog entry (`bee_feedback` token, 0 pre-existing hits in backlog.jsonl); decision entry stays self-reported (any grep would false-pass on this feature's planning decisions). PARTIALLY FIXED, note recorded.
- hia-5 CLI flags unspelled → probe-usage instruction added. FIXED.
- Remaining MINORs ship as notes.

## Verdict

**READY WITH CONSTRAINTS** — constraints: (i) status byte-parity is finally proven only at hia-2 verify time (mechanism validated); (ii) hia-1's guard port is hand-work with the hook suites as the tripwire at the same cell; (iii) PR comment/close stays outside cells, user-confirmed (DA7).

Iterations: 1 (structurally clean after repairs; no blockers at any point).
