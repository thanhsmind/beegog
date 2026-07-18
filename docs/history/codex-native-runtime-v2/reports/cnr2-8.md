# cnr2-8 — Codex agent guard: PreToolUse spawn_agent + model-guard Codex ABI

**Status:** [DONE]

**Outcome:** Closed the Codex-side pre-spawn guard gap (decision 0023 parity, D4 lineage; NOT D8 — custom agents stay deferred). The catalog renders a PreToolUse `spawn_agent` group into the Codex projections only (Claude `Agent|Task` matcher byte-unchanged), wired to `bee-model-guard.mjs`. The guard gained an isolated Codex branch keyed on the observed 0.144.4 envelope (`agent_type` "worker" + `message`, `[bee-tier:]` anchored at the start of `message`): allows anchored-marker spawns, denies unmarked/mid-text spawns with an actionable Codex-shaped FIX, and fails open on every unobserved shape (non-object tool_input, empty/missing/non-string message, non-"worker" agent_type, `toolName` alias, prompt-only). Source and `.bee/bin` mirror kept byte-identical (new drift row pins the pair). Onboarding host renderer + all rendered manifests regenerated through the catalog; Codex command count 12 → 13 across manifests and assertions. Spike evidence citation corrected (no `pre_spawn.jsonl` existed).

**Files touched:**
- `hooks/catalog.mjs` — Codex-only PreToolUse `spawn_agent` group; header comment + `ALLOWED_DIFFERENCES` reworded, new `model-tier-guard-codex-spawn` difference
- `hooks/bee-model-guard.mjs` + `.bee/bin/hooks/bee-model-guard.mjs` (byte-identical) — isolated `codexSpawnGuard` branch
- `hooks/hooks.json`, `.codex/hooks.json` — regenerated (gained the guard entry); `hooks/claude-hooks.json` unchanged
- `skills/bee-hive/scripts/onboard_bee.mjs` — `renderCodexHookEntries()` gains the entry; stale comment fixed
- `hooks/test_model_guard.mjs` — Codex spawn-ABI fixtures (rows 40–55)
- `hooks/test_hook_contracts.mjs` — source↔mirror byte-parity row; route expectation keyed on script; PreToolUse rows reworked for two commands; count 12 → 13
- `skills/bee-hive/scripts/test_onboard_bee.mjs` — inverted stale negative assertion; count 12 → 13
- `docs/history/codex-harness-hardening/release-manifest.json` — regenerated hashes
- `.bee/spikes/codex-native-runtime-v2/capability-matrix.md` — corrected `pre_spawn.jsonl` citation (gitignored; on disk only)

**Verify:** `bash -c 'node hooks/test_model_guard.mjs && node hooks/test_hook_contracts.mjs && node skills/bee-hive/scripts/test_onboard_bee.mjs && grep -q spawn_agent .codex/hooks.json && node scripts/release_manifest.mjs --check && echo GUARD-OK'` → GUARD-OK (exit 0). Adjacent full-verify tests (test_lib_mirror, test_verify_manifest, test_release_tuple, census_stale_spawn_syntax, release_manifest --selftest) all PASS.

**Commit:** `02c323c`

Full trace / evidence: `.bee/cells/cnr2-8.json`.
