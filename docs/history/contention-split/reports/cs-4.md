# cs-4 — Verify suite auto-discovery: kill the SUITES registry hotspot

**Status:** `[DONE]`

**Outcome:** `scripts/run_verify.mjs` SUITES/SERIAL_SENSITIVE are no longer hand-written arrays — they're computed by convention (glob `test_*.mjs` under four fixed roots, filename-pattern serial routing) so adding a new suite requires zero edits to the file. Discovery surfaced 3 real pre-existing suites the old registry had silently never run, and 1 broken one that stays excluded pending its own fix. `scripts/test_verify_manifest.mjs` flips to a floor-count + on-disk-existence + discovered-membership guard. Full `node scripts/run_verify.mjs` green (50/50).

**Files touched:** `scripts/run_verify.mjs`, `scripts/test_verify_manifest.mjs`, `docs/history/codex-harness-hardening/release-manifest.json` (mechanical regen, hash of the two edited files changed).

**Full trace/evidence:** `.bee/cells/cs-4.json` (`status: "capped"`, `trace.worker: "exec-cs4"`, verify recorded, full `verification_evidence` with red/green evidence and the old-vs-discovered set diff).

**Commit:** `d61c143` — "feat(verify): convention-based suite auto-discovery [cs-4]"
