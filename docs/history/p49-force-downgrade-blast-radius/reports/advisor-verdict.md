# Advisor verdict — p49-force-downgrade-blast-radius (pre-dispatch consult)

Adviser: codex/gpt-5.6-sol (cli, read-only, reasoning high). Raw transcript: advisor-digest.md. Bundle: advisor-bundle.md.

**Verdict: PROCEED-WITH-CHANGES**

1. `host_items` only when the aggregate refusal is `forceable: true`; derive directly from the existing `plan` via `plan.filter(({action}) => action === "copy_lib" || action === "copy_helper")`, order preserved. Forceable skill-only downgrade with no runtime drift → `host_items: []`. Omit the field entirely for unknown-version, mixed-unforceable, and `blocked_no_source` refusals.
2. Strengthen the three-step assertion: 10v's "exact set" check is permissive (discards action/path/target, allows applied ⊂ preview — test_onboard_bee.mjs:3311). Compare exact normalized `{action, path}` arrays across dry-run `plan`, refused-apply `host_items`, and forced-apply `applied`.
3. 10v's fixture populates `templates/lib` only — no top-level template helpers — so reusing it unchanged tests `copy_lib` but not `copy_helper`. Seed helpers through filesystem discovery (never a maintained filename list) and assert the fixture exercises both action classes.
4. Add a negative assertion to an existing unknown-version test: `host_items` absent AND forcing still refuses. Add a forceable-empty case asserting `host_items: []`.
5. Placement: top-level sibling beside `skills` is correct (the internal `blocked` object is not emitted in the public payload). Thread the field through BOTH `applyPlan()` and `main()`.
6. Compatibility risk low — first-party consumers inspect individual fields; additive JSON change.
7. Do NOT add `scope`/`target` to host items: those fields exist on skill items because skill paths resolve against varying target roots; lib/helper paths are always repo-root-relative. Omitting preserves the established contract.
8. Non-blocking adjacent gap: forced apply can also restore legacy-global refresh items the refusal never enumerates. Out of scope here (not repo-relative); tracked as separate friction.
