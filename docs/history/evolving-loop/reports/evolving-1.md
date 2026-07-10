# evolving-1 — collector lib (allowlist digest, realpath-contained)

**[DONE]** — capped, verify green.

Outcome: `lib/feedback.mjs` — `resolveInScope`/`listInScope` realpath-containment chokepoint (every read scope-proven), `buildDigest` byte-identical snapshot under an injected clock, allowlist entries = `ENTRY_FIELDS` only (no free-text field, D2/`8cd4c84e`), title secret/injection scan before cap with category-only `dropped`, `KIND_ALIASES` with `unknown_type` counted, pain P/lmh/default, `first_seen` per kind, `trace.worker` never emitted.

Files changed:
- `skills/bee-hive/templates/lib/feedback.mjs` (new collector)
- `skills/bee-hive/templates/tests/test_lib.mjs` (+15 checks)
- `skills/bee-hive/templates/lib/fsutil.mjs` (added `readText` — deviation, see trace)

Verify: `node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/scripts/test_onboard_bee.mjs` → 85 passed / 0 failed; PASS failures:0 skipped:0.

Full trace, evidence, deviations, and friction: [`.bee/cells/evolving-1.json`](../../../../.bee/cells/evolving-1.json).
