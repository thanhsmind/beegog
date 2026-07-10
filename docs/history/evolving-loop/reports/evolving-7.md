# evolving-7 — [DONE]

**Outcome:** Finished the inherited P18 structural fix — `ENTRY_FIELD_SPEC` (field → validator/neutralizer) is the single source of truth, `ENTRY_FIELDS` derived from `Object.keys(ENTRY_FIELD_SPEC)`, `buildEntry` and the dropped[] record both iterate the spec on every trust level (an unspecced field cannot be emitted), and `first_seen` is unforgeable-by-format (anchored strict ISO, never `Date.parse` leniency; stays sortable). Per planner authorization `b8fe5c81`, deleted exactly the two ENTRY_FIELDS source-literal grep lines from the frozen drift-guard check; kept the `ENTRY_FIELDS.join` value-lock, the no-free-text assert, and the SCHEMA_VERSION/DROP_REASONS pins. The other 103 assertions stay frozen and untouched.

**Files touched:**
- `skills/bee-hive/templates/lib/feedback.mjs`
- `skills/bee-hive/templates/tests/test_lib.mjs`

**Verify:** `node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/scripts/test_onboard_bee.mjs` → test_lib.mjs **108 passed, 0 failed**; onboarding **PASS, 0 failures**; chain exit 0.

**RED-before-GREEN (re-run by this worker):** temporarily restoring the old `Date.parse`-based `validFirstSeen` turned the suite to **105 passed, 3 failed** — the table-driven per-field payload test and the exact round-3 `first_seen` payload test both went RED (role tag + AWS key rode through `first_seen`). Restoring the strict-regex version returned green. The inherited tests genuinely exercise the bug.

Full trace, RED evidence, and recorded verify output: `.bee/cells/evolving-7.json`.
