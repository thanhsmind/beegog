# scl-4 — judge verdict schema validator + trace.semantic_judge + independence derivation (D5)

**Status:** [DONE]

**Outcome:** New `judge.mjs` lib (validateJudgeVerdict, deriveModelIndependence — both
pure, zero-I/O) plus `cells.mjs`'s `recordJudgeVerdict`, the sole mutator appending a
stamped verdict to the append-only `trace.semantic_judge`. New CLI verb
`cells judge-record --id --file <verdict.json> [--builder-model] [--judge-model]`.
Freeze-first baseline and a deliberate-red were both recorded (see cell trace).

**Files touched:** `skills/bee-hive/templates/lib/judge.mjs` (new), `cells.mjs`,
`dispatch-guard.mjs` (new `PINNED_MODEL_STATUS` export), `bee.mjs`,
`command-registry.mjs`, `test_lib.mjs`, `test_bee_cli.mjs` — mirrored across
`.bee/bin/lib`, `.claude-plugin/skills`, `.codex-plugin/skills` — plus
`docs/history/codex-harness-hardening/release-manifest.json`.

Full trace, verify output, and verification evidence: `.bee/cells/scl-4.json`.
