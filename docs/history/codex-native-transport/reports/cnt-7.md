# cnt-7 — advisor slot folded into guard model-param allowlist (live bug) + slice-close manifest regen

**Status:** `[DONE]` — verify green, capped, committed.

**Outcome (one line):** Closed the live prepare/guard asymmetry — the claude model-param
allowlist now includes the advisor slot, so `bee dispatch prepare --runtime claude --kind advisor`'s
own `{model:'fable'}` payload passes the guard instead of being denied `param-not-configured`.
Codex branch untouched. Slice-close release manifest regenerated.

**Files touched (cell commit):**
- `skills/bee-hive/templates/lib/dispatch-guard.mjs` — `resolveAdvisor` imported and folded into
  `configuredModelSet`'s allowlist union (allow-only-widening; only a `{type:'model'}` advisor
  contributes its model name).
- `.bee/bin/lib/dispatch-guard.mjs` — byte-identical mirror of the above.
- `hooks/test_model_guard.mjs` — row 22 rewritten (orchestrator-chartered unfreeze: `model:'fable'`
  now ALLOWED + logged `model-param`); row 21 deny twin strengthened to assert the advisor model
  appears in the `param-not-configured` FIX list; member-set comment updated.

**Files touched (chore commit):**
- `docs/history/codex-harness-hardening/release-manifest.json` — regenerated (362 files match).

**RED-first evidence (behavior_change):** with the test rows rewritten but before the
`configuredModelSet` fold, the guard suite failed 3 assertions — `model:'fable'` was denied
`param-not-configured` (row 22) and the advisor model was absent from row 21's configured-models
FIX list — proving the rows catch the live bug. After the fold, the full verify is green.

**Scope decisions:**
- Passive V3 audit on the codex branch was SKIPPED (orchestrator-ratified): override fields are
  unobservable on every current codex build (V1 regressed to `native_budget_only`), and
  enumerating the three field names is the "list-of-names rots" trap (critical-patterns 20260710).
  Potential follow-up tiny cell only if a V3-positive build appears.
- No codex-branch behavior change; cnt-4's document-the-gap comment and pass-through rows untouched.

**Verify:** `node hooks/test_model_guard.mjs && node scripts/test_lib_mirror.mjs && node scripts/release_manifest.mjs --check` — green.

Full cell trace/evidence: `.bee/cells/cnt-7.json`.
