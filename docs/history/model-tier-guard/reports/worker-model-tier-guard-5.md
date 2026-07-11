# worker report — model-tier-guard-5

[DONE] — Fixed P1-1/P1-2/P1-3 from `review-findings.md` in `hooks/bee-model-guard.mjs`
and `hooks/test_model_guard.mjs` only.

## Outcome

Red-first per cluster, reds reproduced against the pre-change hook before any edit:

- **P1-1 (anchor).** Deleted the unanchored 500-char scan window. The
  `[bee-tier: <tier>]` marker now only satisfies the transport when it is the
  first non-whitespace token of `tool_input.prompt`, or `tool_input.description`
  starts with it (leading whitespace allowed, case-insensitive). Confirmed red:
  a marker embedded ~100 chars into the prompt, and a marker mid-description,
  were both previously ALLOWED — now DENIED. New test rows cover both negatives
  plus a positive row proving a head-anchored marker stays valid regardless of
  how long the rest of the prompt is (no window cutoff anywhere).
- **P1-2 (fail-open).** The payload is normalized to a plain object before any
  property access (`null`/array top-level JSON no longer reaches `.cwd`), `cwd`
  falls back to `process.cwd()` unless it is a non-empty string, and root
  resolution now lives inside the try/catch so any throw — including a
  throwing vendored `state.mjs` — lands in `logCrash` + exit 0. Confirmed red:
  `echo null | node hooks/bee-model-guard.mjs` crashed with an uncaught
  TypeError on `payload.cwd`, exit 1; now exit 0, empty stderr. New fixture
  `buildThrowingStateFixture()` proves the crash record lands in that
  fixture's own `.bee/logs/hooks.jsonl`.
- **P1-3 (Task coverage).** `DISPATCH_TOOLS` already included `Task` pre-fix
  (no behavior red here — coverage-only), but every test row only ever used
  `tool_name: "Agent"`. Table-drove bare-deny / model-param-allow /
  anchored-marker-allow across both `"Agent"` and `"Task"`.

Deny-message contract (bee-tier + FIX + configured generation model) and the
deny-log event fields are unchanged; every previously-passing row still passes.

## Files touched

- `hooks/bee-model-guard.mjs`
- `hooks/test_model_guard.mjs`

## Verification

`node hooks/test_model_guard.mjs && node skills/bee-hive/templates/tests/test_lib.mjs`
→ passed (`test_model_guard.mjs`: 42/42 `ok`, ALL PASS; `test_lib.mjs`: 124
passed, 0 failed). Full trace, verify output, and `verification_evidence`
(red-failure characterization + verification run) recorded on the cell:
`.bee/cells/model-tier-guard-5.json`.

## Commit

`c943def` — `fix(model-tier-guard-5): anchor tier marker, harden fail-open, cover Task`
