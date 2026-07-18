# cnr2-5 — State-write concurrency hardening

**Status:** [DONE]
**Outcome:** `writeJsonAtomic` (`skills/bee-hive/templates/lib/fsutil.mjs`, mirrored at `.bee/bin/lib/fsutil.mjs`) now uses a unique per-invocation tmp name (pid + counter + random suffix) instead of the single fixed `<file>.tmp`, closing the tmp-clobber/rename-race the advisor flagged. New `scripts/test_state_write_concurrency.mjs` spawns 18 real OS-process writers (10 hammer + 8 state-sync-shaped read-modify-write) against one shared target with a concurrent JSON-validity monitor: zero crashes, zero corrupt/truncated reads. Reverting to the old fixed-name code and rerunning the same test reliably reproduced the exact ENOENT rename-race crash the advisor described (red-before-green evidence). `release-manifest.json` regenerated since a `templates/lib`/`.bee/bin/lib` file changed.

**Files touched:**
- `skills/bee-hive/templates/lib/fsutil.mjs`
- `.bee/bin/lib/fsutil.mjs`
- `scripts/test_state_write_concurrency.mjs` (new)
- `docs/history/codex-harness-hardening/release-manifest.json`

**Commit:** `84e7805`

Full trace, verify output, and behavior-change evidence: `.bee/cells/cnr2-5.json`.
