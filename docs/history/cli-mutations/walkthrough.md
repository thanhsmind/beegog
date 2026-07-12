# Walkthrough — cli-mutations (shipped 2026-07-11)

Standard lane · 6 cells capped · Gate 4 approved by the human after a P1-fix
wave. Reconstructed from cell traces, review findings, and the live session
record — not from the plan.

## What shipped

Agents no longer hand-edit bee's two most-mutated state files; every mutation
is one validated Bash call, and the hook layer enforces it:

- **`bee_state.mjs`** (new CLI, template + vendored): `set` (--phase/--mode/
  --feature/--next-action/--summary, phase validated via `isKnownPhase`),
  `gate` (--name context|shape|execution|review --approved, idempotent),
  `worker add|update|remove|clear`, `scribing-run` (stamps ISO `at`, writes
  the full `last_scribing_run` record). Verbs re-read state immediately
  before an atomic write, mutate only their own fields, and — after the P1
  fix — **refuse a present-but-corrupt state.json** (ERROR/WHY/FIX, exit
  non-zero, file untouched) instead of silently rebuilding defaults; an
  absent file still initializes defaults.
- **`bee_backlog.mjs add`**: schema-validated backlog append — `--type`
  checked against KIND_ALIASES keys *and* NORMALIZED_KINDS values (imported,
  never duplicated), severity P1–P3, title ≤200, layer a free string ≤40
  (live data carries `security`; an allowlist was rejected in validating).
  This forecloses the drift class that silently dropped 17 collected
  frictions (`kind:` vs `type:`).
- **Prose sweep** across 10 skills: all 9 hand-edit instructions now cite the
  exact CLI calls; bee-hive carries the standing rule "Never hand-edit
  `.bee/*.json(l)`"; 14 read-only mentions untouched.
- **Write-guard deny rule** (`checkWrite`, first-hit before
  `GATE_ALLOWED_PREFIXES`): Edit/Write/MultiEdit and Bash-extracted targets
  hitting `.bee/state.json` or `.bee/backlog.jsonl` are denied in every
  phase, naming the replacement verb; plain CLI invocations pass.
- **Standing vendor-drift test** (P1 fix): readdir-driven byte-comparison of
  every `templates/*.mjs` and `templates/lib/*.mjs` against its `.bee/bin/`
  sibling, in the standard suite.

## How it was verified (actual evidence)

- Suites, fresh at Gate 4: **149 passed / 0 failed** (test_lib.mjs, includes
  13 bee_state + 7 backlog-add + 3 corrupt-state + vendor-sweep rows),
  **ALL PASS** (test_write_guard.mjs, 20 assertions), onboard PASS.
- Orchestrator goal-checks (independent re-runs, not worker word): every
  cell's verify re-run; frozen judge intact on all 6 cells; no reservation
  leaks.
- Live in-session proof (unplanned but real UAT): the orchestrator used
  `bee_state.mjs` for actual worker bookkeeping and phase transitions —
  including it **rejecting an invented phase** (`swarming-complete`) with the
  correct enum; `bee_backlog add` filed 12 real review findings and rejected
  `--type kind` (exit 1, file untouched); the deny rule **blocked the
  orchestrator's own shell twice** (a heredoc write and a `cp` involving
  state.json).
- P1 fixes carry red/green evidence: fix-1 reproduced the clobber on
  pre-fix HEAD code, then showed the fixed CLI refusing on the identical
  fixture; fix-2 injected a one-byte vendor drift — new suite catches it
  naming the file, old suite ran green (the exact gap).

## How to test it yourself

```bash
node .bee/bin/bee_state.mjs                          # lists the four verbs
node .bee/bin/bee_state.mjs set --phase bogus        # ERROR/WHY/FIX + enum
node .bee/bin/bee_backlog.mjs add --type kind --title x   # rejected, exit 1
# ask an agent to Edit .bee/state.json → the write-guard denies, names the verb
node skills/bee-hive/templates/tests/test_lib.mjs    # 149 passing incl. drift sweep
```

## Deviations from plan

- **`scribing-run` hardcodes `phase=compounding`** (worker deviation, cell 1):
  SKILL.md:112 required touching top-level phase; the plan gave no flag. The
  chain's fixed next node was used. Review rated this P2 (routing knowledge in
  a mechanical CLI) — in backlog, smallest fix is a `--phase` flag.
- **Deny rule lives in `lib/guards.mjs`**, not the hook file the plan's slice
  list named — the validated (more correct) insertion point; cell was updated
  before dispatch.
- **Two provider-limit retries** (wave 3, session cap) — no task misses; the
  reruns were clean.
- **Worker incident (fix-1, disclosed in its report):** a repro command
  briefly overwrote the real state.json `summary` before its `cd` took
  effect; caught via git diff, restored through the CLI, no other fields
  disturbed.

## Known limitations / follow-ups (all in `.bee/backlog.jsonl`)

- 6 P2: unknown optional flags silently swallowed (typo'd `--teir` → tier
  null, exit 0); gate/phase flips unaudited (no gate.jsonl); scribing-run
  phase hardcode; `set --mode` unvalidated; gated-phase deny-precedence test
  row missing; duplicate worker nicknames accepted.
- 6 P3: RMW ordering unasserted; boundary values (200/40) not positively
  asserted; deny false-positives on `git add`/`cp` (hit live during the P1
  wave — workers use `git commit -- <pathspec>`); rule #11 wording broader
  than the 2-file enforcement; arg-parsing duplicated across three CLIs;
  detail/feature uncapped + next_action rendered undatamarked.
- Accepted by design: `node -e`/`python -c`/`dd`-class writes bypass the
  Bash-target extractor (any unlisted interpreter — wider than the "node -e"
  wording in validation C3); prose rule covers them.
- Environment note: `findRepoRoot`'s `.git` fallback (pre-existing lib
  behavior) let a rootless invocation adopt a stray `/tmp/.git` during
  review probing — machine noise, not a feature defect, but worth knowing.

Full findings: `reports/review-findings.md`. Validation: `reports/validation-1.md`.
Cell reports: `reports/cli-mutations-{1..4,fix-1,fix-2}.md`.
