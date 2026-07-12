# Walkthrough — Harness Integration Phase 1 (Unified CLI Entrypoint)

**Shipped:** 2026-07-12 | **Lane:** high-risk | Reconstructed from execution records (cell traces, review findings, UAT) — not from the plan.

## What Shipped

- `.bee/bin/bee.mjs` — one dispatcher covering all 21 subcommands of the 4 previously-separate helpers (`bee_status/cells/reservations/decisions.mjs`). It imports the same `lib/*.mjs` functions those 4 files already import; it never touches or imports the 4 files themselves.
- `bee --help` (human-readable) and `bee --help --json` (a versioned manifest in the same JSON-Schema tool-definition shape Claude Code's own tool surface uses) — sourced from one shared registry, `lib/command-registry.mjs`.
- Argument validation shared by the dispatcher and by `hooks/bee-write-guard.mjs`'s new 4th check: a malformed `bee`-shaped Bash call is now denied with a structured, actionable reason before it executes — additive to the 3 existing checks (gate/reservation/privacy), never modifying their logic.
- Manifest content-hash drift detection (`manifest_changed`), surfaced on stderr only, never altering a data command's stdout shape.
- `AGENTS.block.md` and `docs/02-architecture.md`/`docs/07-contracts.md` updated to describe the new surface.

## How It Was Verified

**Automated (re-run fresh, not asserted):**
- `test_lib.mjs` — 124/124 passing throughout (regression baseline never broke).
- `test_bee_cli.mjs` — 67/67 (registry validity, validator contract, dispatcher parity, drift behavior).
- `test_bee_write_guard_hook.mjs` — 16/16, including a forced-throw test proving the new check can never overwrite a denial already set by the 3 existing checks.
- `test_onboard_bee.mjs` — 0 failures, 1 pre-existing unrelated skip.

**Manual (orchestrator, hands-on, not test-suite-only):**
- Live-ran `bee --help --json`, confirmed valid schema-shaped manifest.
- Diffed `bee cells ready --json` against the legacy `bee_cells.mjs ready --json` — byte-identical.
- For each of the 3 P1 fixes: captured real before/after evidence by temporarily swapping in the pre-fix code against this repo's actual `.bee/` state (not a synthetic fixture) and showing the old exit code/output vs the new one.

**5-reviewer specialist wave** (code-quality, architecture, security, test-coverage, api-contract; conditional `api-contract` triggered by the new versioned manifest): 18 findings — 3 P1, 8 P2, 7 P3. All 3 P1s were fixed in follow-on cells (5, 6, 7) and independently re-reviewed; the re-review itself caught one more real gap (see Deviations) before confirming all 3 resolved.

**Human UAT — 4/4 Pass, user-confirmed live on their own machine**, not asserted by the agent:
1. `bee --help --json` returns a valid, schema-shaped manifest.
2. A malformed `bee`-shaped call is denied (exit 2) before execution.
3. `bee cells ready` is byte-identical to the legacy entrypoint.
4. Both P1 fixes hold live: a manifest example runs verbatim (no duplicated token), and a flag value starting with `--` is no longer falsely denied.

## How To Test It Yourself

```bash
cd /home/vantt/projects/research/beegog
node .bee/bin/bee.mjs --help --json
echo '{"tool_name":"Bash","tool_input":{"command":"node .bee/bin/bee_cells.mjs show"}}' | node .bee/bin/hooks/bee-write-guard.mjs; echo "exit: $?"
diff <(node .bee/bin/bee.mjs cells ready --json) <(node .bee/bin/bee_cells.mjs ready --json) && echo IDENTICAL
```

## Deviations From Plan

- **Delegation mechanism changed mid-flight.** The original cell-2 spec said `bee.mjs` would "delegate to the existing helper module's handler" — `bee-validating`'s first pass found this unbuildable (the 4 CLI files export nothing). Resolved without a design rewrite: all 4 already delegate to `lib/*.mjs` internally, so `bee.mjs` became a 5th thin wrapper over the same modules. Recorded as a D5 amendment in CONTEXT.md.
- **A real gap surfaced only after swarming, not caught by review or the 5-reviewer wave:** `.claude/settings.json` wires this session's actual PreToolUse hook to the *vendored* copy (`.bee/bin/hooks/bee-write-guard.mjs`), but `onboard_bee.mjs --apply` (without `--repo-hooks`) never vendors hooks — only helpers/lib. This meant cell-3's security check was verified correct at the source-file level (the test suite spawns the source path directly) but was **never actually live-enforcing in this session** until it was discovered and fixed during cell-5's work (`onboard_bee.mjs --apply --repo-hooks`). Named here because it could recur for any future cell touching `hooks/`.
- **Review found 3 P1s not anticipated in the plan**, each requiring a dedicated fix cell (5, 6, 7) outside the original 4-cell scope.
- **Re-review caught a real commit gap**, not a code defect: cell-6's fixed registry was correctly re-vendored to the working tree but never `git add`ed, leaving committed HEAD internally inconsistent (the live `.bee/bin/lib/command-registry.mjs` still served the old, broken examples). Fixed on the spot (commit `6fa45ba`) before Gate 4 was re-presented.

## Known Limitations / Follow-Ups

15 non-blocking findings (8 P2, 7 P3) filed to `.bee/backlog.jsonl`, full detail in `docs/history/harness-integration/reports/review-phase-1.md`. Notable ones worth reading before Phase 2 work: byte-parity is asserted for only 4 of 21 commands' legacy-vs-dispatcher output (test-coverage), the hook's new check enlarges its trusted-import surface (security), and `cells.verify --passed` still diverges between the dispatcher's hardcoded boolean list and the hook's schema-derived one (architecture) — this last one shares a root cause with the flag-parsing P1 that was fixed, but was scoped as a separate, non-blocking finding.

## Quiz (optional)

1. What does `bee.mjs` actually import to run each command — the 4 legacy CLI files, or something else?
2. Where does the `manifest_changed` drift hint appear now — stdout, stderr, or both?
3. What real gap did the re-review find that had nothing to do with code correctness?
4. Which file did all 4 human UAT items get demonstrated against — a test fixture, or this repo's own live `.bee/`?
