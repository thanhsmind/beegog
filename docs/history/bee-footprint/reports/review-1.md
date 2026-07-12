# Review Report — bee-footprint (standard lane, 4 core reviewers)

Reviewers: code-quality, architecture, security, test-coverage — all on the review slot (opus), isolated context (diff `51c97f9..` + plan.md, no session history). Synthesis by the orchestrator after all four returned.

## Verdict

**0 P1 · 2 P2 (both FIXED in-feature by footprint-4) · 6 P3 (3 backlogged, 2 deduped against already-filed items, 1 folded into footprint-4).**

## Findings and disposition

| # | Sev | Finding (reviewer) | Disposition |
|---|---|---|---|
| 1 | P2 | .gitignore is inert for already-tracked files — previously-onboarded hosts keep churning; onboard gave no signal (code-quality) | **FIXED** — footprint-4: onboard now detects tracked managed paths (`git ls-files` via execFile, fail-silent) and emits an advisory notice with the exact `git rm -r --cached` command; never auto-runs it |
| 2 | P2 | Update-path "byte-for-byte" only substring-tested; splice actually stripped the file's trailing whitespace (test-coverage, reproduced) | **FIXED** — footprint-4: user header/footer bytes preserved exactly; 9d strengthened to exact byte-equality |
| 3 | P3 | Marker match unanchored substring — a user line containing `# BEE:START …` could be adopted as the managed block (security) | **FIXED** — footprint-4: whole-line-anchored regexes; marker-lookalike test added |
| 4 | P3 | Byte-exact drift compare → perpetual rewrite on CRLF hosts (code-quality) | **FIXED** — footprint-4: CRLF-normalized compare, LF writes; CRLF test added |
| 5 | P3 | gitignore_block hash test proved existence, not source-tie (test-coverage) | **FIXED** — footprint-4: sha256-source equality assertion added |
| 6 | P3 | `.bee/spikes/` is write-allowlisted AND gitignored — staging there escapes review visibility (security; accepted D2/D3 tradeoff) | Backlogged (review-finding) |
| 7 | P3 | footprint-2's stored verify grep false-positives on re-run against the finished tree (code-quality) | Backlogged (review-finding) |
| 8 | P3 | AGENTS.md marker functions still substring-matched — parity hardening (security) | Backlogged (review-finding) |
| 9 | P3 | session-close hook pair is not byte-twinned, no sweep guards it; NUDGE_ALLOWED untested (architecture + test-coverage, corroborated; pre-existing) | Deduped — already filed as P3 debt during validation |
| 10 | P3 | `git update-index` unmodeled by extractBashTargets; DIRECT_EDIT_DENY false-positive incentivizes bypass (security) | Deduped — already filed as P3 friction during swarming |

## Gates

- **Verification-evidence gate:** PASS — footprint-1, footprint-2, footprint-4 (behavior_change) all carry structured evidence with genuine RED runs (footprint-4: 9 checks failed against pre-fix code with new tests kept). footprint-3 is behavior_change:false (repo hygiene).
- **Frozen judge:** intact for all four cells — no undeclared test/CI/lockfile/verify-config changes.
- **Artifact verification:** gitignore stage EXISTS/SUBSTANTIVE/WIRED (computePlan+applyPlan+managed hash, 8 wire points); allowlist shrink live in `.bee/bin/lib/guards.mjs:31`; installed global skills synced (spot-check: bee-validating SKILL.md carries `.bee/spikes/`); repo migration landed (`.spikes/` gone, `.bee/spikes/` populated, `.gitignore` = managed block).
- **Fresh suite runs (orchestrator shell):** test_onboard_bee.mjs `PASS - failures: 0, skipped: 1` (pre-existing case-alias skip); test_lib.mjs `171 passed, 0 failed`.

## Security reviewer's explicit clean bill

Allowlist change strictly tightens (`['.bee/','docs/','plans/','AGENTS.md']`); twins byte-identical; no attacker-controlled input reaches the block body (hardcoded constant); the managed block ignores only runtime state — vendored guard code, decisions, backlog, cells stay diff-visible, so the block cannot hide malicious changes from review.

## Residuals

Wave-1 commit-attribution cross-sweep (bob's d35c053 swept stuart's staged trace files) — content intact, filed as P3 friction; footprint-3 + footprint-4 changes are staged/working-tree, awaiting the orchestrator's closing commit after Gate 4.
