# cz-3 — [DONE]

One shared compaction module (`lib/compaction.mjs` + mirror) now owns the durable
log and its counting rule, the D9 survival advisory, the D10 anchor predicate and
the read-only D12/D13 sweep — hooks and verbs become two thin callers (D3).

**Files touched**

- `skills/bee-hive/templates/lib/compaction.mjs` (new, the source — D17)
- `.bee/bin/lib/compaction.mjs` (byte-identical mirror)
- `scripts/test_compaction_module.mjs` (new suite, 25 checks)
- `docs/history/codex-harness-hardening/release-manifest.json`, `.bee/onboarding.json`
- rendered projections of the new lib file in `.agents/`, `.claude/`,
  `.claude-plugin/`, `.codex-plugin/` (D24 chain: render → onboard --apply →
  manifest --write, in that order)

**Verify:** `node scripts/test_compaction_module.mjs && node scripts/test_lib_mirror.mjs
&& node scripts/release_manifest.mjs --check && node scripts/ledger_parity.mjs --check`
— green (exit 0).

Full trace, `verification_evidence` and both red-failure records:
[`.bee/cells/cz-3.json`](../../../../.bee/cells/cz-3.json).

**Note for downstream cells:** the module exports `ANCHOR_NUDGE_KEY`
(`anchor-missing-nudge`) and `anchorMissing()` returns the D11 dedup `hash`
(`<sessionId>:<feature>:<cell>`) ready-made, so cz-7 wires `shouldInject` /
`markInjected` without recomputing the predicate.
