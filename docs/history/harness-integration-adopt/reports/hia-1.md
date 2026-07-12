# hia-1 — import PR #1 code files, vendor, gitignore manifest-hash

**Status:** [DONE] — worker kevin, capped 2026-07-12.

**Outcome:** PR #1 code files imported verbatim from local ref `pr-1-vantt` (aa8f543): `bee.mjs` dispatcher, `command-registry.mjs`, `validate-args.mjs`, and both test suites into `skills/bee-hive/templates/`. Check (d) (CLI-shape validation) hand-ported as purely-additive hunks onto main's adapter-era `hooks/bee-write-guard.mjs` (4-arg `logCrash`, `libModuleUrl` imports; checks (a)-(c) byte-untouched apart from the three→four header line). Dispatcher + lib modules + guard vendored byte-identical to `.bee/bin/`; `.bee/manifest-hash.json` gitignored in both `onboard_bee.mjs` `GITIGNORE_BLOCK_PATTERNS` and the live `.gitignore` BEE block.

**Verify:** full cell chain green — imported guard-hook suite 16/16, `hooks/test_write_guard.mjs` ALL PASS (60 rows), all byte-parity `cmp`s and gitignore checks pass. `test_bee_cli.mjs` is intentionally red until hia-2 (excluded from this cell's verify per the cell action).

**Deviation (rule 2, auto-add):** vendored `hooks/adapter.mjs` to `.bee/bin/hooks/adapter.mjs` (reserved before write) — the stale vendored hooks dir lacked it, and the new guard imports `./adapter.mjs`; matches onboarding's own `HOOK_FILENAMES` behavior.

**Files:** templates (bee.mjs, lib/command-registry.mjs, lib/validate-args.mjs, tests/test_bee_cli.mjs, tests/test_bee_write_guard_hook.mjs), hooks/bee-write-guard.mjs, .bee/bin/{bee.mjs, lib/command-registry.mjs, lib/validate-args.mjs, hooks/bee-write-guard.mjs, hooks/adapter.mjs}, skills/bee-hive/scripts/onboard_bee.mjs, .gitignore.

Full trace and verification evidence: `.bee/cells/hia-1.json`.
