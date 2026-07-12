# cli-mutations-4 — report

**Status:** [DONE]

**Outcome:** Added a first-hit deny rule to `checkWrite` in
`skills/bee-hive/templates/lib/guards.mjs` (synced byte-identical to
`.bee/bin/lib/guards.mjs`) that blocks direct edits to `.bee/state.json` and
`.bee/backlog.jsonl` in every phase, before phase logic and
`GATE_ALLOWED_PREFIXES`. The denial names the CLI replacement
(`bee_state.mjs set/gate/worker/scribing-run`, `bee_backlog.mjs add`). New
fixture test `hooks/test_write_guard.mjs` (20 assertions) covers deny,
bash-redirect deny, pass-through (including plain CLI invocations and an
unrelated `.bee/` path), idle-phase precedence, and the hook-level fail-open
try/catch.

**Files touched:**
- `skills/bee-hive/templates/lib/guards.mjs`
- `.bee/bin/lib/guards.mjs`
- `hooks/test_write_guard.mjs` (new)

Full trace/evidence: `.bee/cells/cli-mutations-4.json`
