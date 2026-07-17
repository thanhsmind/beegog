# ao-2b-2

**Status:** DONE — capped, verify green, committed `c57b268`.

**Outcome:** `validateModelsConfig` (per AO8) now refuses a write-granting sandbox token on an ADVICE-CLASS cli slot (`advisor`, `review` — every runtime) with a new `cli-advice-slot-writable` code. Blocklist: `-s workspace-write`, `--sandbox workspace-write`, `--sandbox=workspace-write`, bare `danger-full-access` (honestly framed as known-bad tokens, not a positive read-only guarantee). `generation`/`extraction` cli slots are untouched — verified with a dedicated discriminator row. `danger-full-access` on an advice slot reports both the universal `cli-unsafe-flag` code and the new one. `.bee/config.json` migrated: `promptVia:"stdin"` added to `models.claude.advisor` and `models.codex.review`, and `scripts/test_config_validate.mjs` joined `commands.verify` (added only after confirming a green tree, ao-0b law). `bee config validate --json` now ends `{ok:true, problem_count:0}`. Mirror `.bee/bin/lib/state.mjs` stays byte-identical. Release manifest regenerated via `--write`.

**Files touched:** `skills/bee-hive/templates/lib/state.mjs`, `.bee/bin/lib/state.mjs` (byte-identical mirror), `scripts/test_config_validate.mjs`, `.bee/config.json`, `docs/history/codex-harness-hardening/release-manifest.json`.

**Deviation:** also updated `skills/bee-hive/templates/tests/test_lib.mjs`'s `EXPECTED_STATE_EXPORTS` allowlist to add the two new exports (`ADVICE_CLASS_SLOTS`, `ADVICE_CLASS_WRITABLE_TOKENS`) — outside the cell's bounded files, but a blocking mechanical consequence (deviation rule 3): the exact-set export census test fails the moment the new exports exist, with no design choice involved.

Full trace/evidence: `.bee/cells/ao-2b-2.json`.
