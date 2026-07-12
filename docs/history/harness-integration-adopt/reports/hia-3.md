# hia-3 — DA5 registry<->helper-verb bijection drift test

**Status:** [DONE] — worker bob, capped 2026-07-12.

**Outcome:** Per DA5 (decision 30606de4), added a standing test to `test_bee_cli.mjs` that turns registry drift red instead of a silent gap — the exact defect the PR shipped with (`cells.update` present on `bee_cells.mjs` but absent from the registry). Each helper's verb list is derived from its RUNTIME BEHAVIOR only: invoking `bee_cells.mjs`/`bee_reservations.mjs`/`bee_decisions.mjs` with a deliberately unknown top-level command inside the suite's existing temp-repo fixture and parsing the verb list from the `Unknown command ... Use: v1, v2, ...` line each helper already emits on stderr — never by grepping/reading helper source (critical pattern 20260710). Both parse traps handled: (t1) the contract line's trailing period is stripped before splitting, so the last verb doesn't parse as `judge.`; (t2) the parser anchors strictly on the stderr line starting with `Unknown command`, ignoring `bee_cells.mjs`'s separate flag-level `Use: --id ID --file ...` line from its `update` verb. Asserts set equality both directions against `COMMAND_REGISTRY` (every runtime verb has a `<group>.<verb>` entry; every `<group>.*` entry has a matching runtime verb) plus a check that `status` is the only dot-free entry and every entry's group is one of `status|cells|reservations|decisions`. Failure messages name the missing/extra verb and which side (helper or registry) owns the fix.

**Verify:** `node skills/bee-hive/templates/tests/test_bee_cli.mjs` → 73 passed, 0 failed.

**Red-proof (thought experiment, not committed):** temporarily removed the `cells.update` entry from `command-registry.mjs`, re-ran the suite — the new bijection check failed with `cells: verb(s) [update] exist on the bee_cells.mjs helper (runtime) but have no "cells.<verb>" entry in COMMAND_REGISTRY — registry side owns the fix (this is the exact cells.update gap the PR shipped with)`. Registry file restored byte-identical (`diff` clean) before any commit.

**Files:** `skills/bee-hive/templates/tests/test_bee_cli.mjs`.

Full trace and verification evidence: `.bee/cells/hia-3.json`.
