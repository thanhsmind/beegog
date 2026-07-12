# Review findings — cli-mutations (standard, 4 native opus reviewers)

Synthesis by orchestrator after all four reviewers returned. Corroboration
across independent reviewers promotes one level; disagreement takes the
conservative route.

## P1 (block merge)

### P1-1 — Corrupt state.json is silently clobbered to defaults with a success message
Corroborated: test-coverage (P1) + code-quality (P2, reproduced).
Today: `readState` returns `defaultState()` for a present-but-unparseable file;
every `bee_state` verb then writes that skeleton back — gates reset, workers
emptied, feature nulled, exit 0. Reproduced: corrupt file + `gate --name
execution --approved true` → fresh default with the gate stamped on top.
Why: strictly worse than hand-edits for the feature's own "never silently lose
state" thesis; looks successful while destroying state.
Fix (smallest): mutation path distinguishes absent (create default, OK) from
present-but-corrupt (ERROR/WHY/FIX, exit non-zero, file untouched) — a
`readStateStrict` used by the CLI only; plus a test row pinning the semantics.
Files: .bee/bin/bee_state.mjs:116,151,161,239; lib/state.mjs:241-247.

### P1-2 — Template↔vendor byte-equality has no standing guard
Corroborated: test-coverage (P2) + architecture (P2) → promoted.
Today: tests import the template tree; live sessions execute `.bee/bin/`;
equality was proven only once at cell-verify time (`cmp`). A future one-sided
edit goes green forever while sessions run the stale copy.
Fix (smallest): extend the vendored-source sweep in test_lib.mjs to
byte-compare every `templates/*.mjs` (+ lib/guards.mjs) against its `.bee/bin/`
sibling.
Files: skills/bee-hive/templates/tests/test_lib.mjs:3019 area.

## P2

1. Unknown optional flags silently swallowed (code-quality, reproduced:
   `--teir` → `tier: null`, exit 0; `--sumary` → summary lost). Violates the
   plan's own matrix row ("unknown verb/flag → ERROR/WHY/FIX"). Fix: per-verb
   flag allowlist rejection. bee_state.mjs:44-67; bee_backlog.mjs:54-66.
2. Gate/phase flips are unaudited (security): `gate --approved true` and
   `set --phase swarming` unlock source writes with no log line; mirrors the
   P22 dispatch-log gap. Fix: append `{ts,gate|phase,from,to}` to
   `.bee/logs/gate.jsonl` on gate flips and gated-phase exits.
3. scribing-run hardcodes `phase=compounding` — routing knowledge in a
   mechanical CLI (architecture; matches the recorded worker deviation).
   Fix: `--phase` flag, skill passes the target.
4. `set --mode` unvalidated while everything else is enum-checked
   (architecture). Fix: validate against the LANES set.
5. Gated-phase deny-precedence test row missing — the exact branch the code
   comment justifies (test-coverage). Fix: planning-phase fixture row.
6. Worker nickname uniqueness unenforced; update touches first match, remove
   drops all (3× corroborated P3 → P2). Fix: reject dup add with
   ERROR/WHY/FIX pointing to `worker update`.

## P3

1. RMW/C1 ordering unasserted (test-coverage).
2. Boundary values title=200/layer=40 not positively asserted (test-coverage).
3. Deny false-positives: `git add .bee/state.json` / `cp` source paths denied
   with a misleading message (code-quality, reproduced).
4. Deny list covers 2 stores; bee-hive rule #11 promises all `.bee/*.json(l)`
   (architecture). Align wording or extend map.
5. Arg-parsing primitives duplicated across three CLIs (architecture).
6. `--detail`/`--feature` uncapped and un-neutralized at rest;
   `next_action`/`feature` rendered raw by inject.mjs while decisions/titles
   are datamarked (security ×2, merged). Smallest: length caps + datamark at
   render (inject.mjs:117,228).

## Cleared by security (explicitly proven safe)

Newline smuggling into backlog.jsonl (JSON.stringify escapes), path traversal
via flags (fixed paths), denial-message leaks (none).

## Sources

Reviewer outputs summarized above; full texts in the session task logs.
Diff range: e5d792e^..6542238.
