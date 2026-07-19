# msh-1 — withStoreLock O_EXCL lockfile primitive + racer selftest (D2)

**[DONE]** — `withStoreLock(root, name, fn)` landed in
`skills/bee-hive/templates/lib/lock.mjs` (+ `.bee/bin/lib/lock.mjs` mirror),
proven by a forked-racer child-orchestrator (`scripts/test_store_lock.mjs`)
covering no-lost-update, an unguarded control that demonstrates the loss the
lock prevents, stale-takeover-by-atomic-rename safety under concurrency, and
the typed `LOCK_BUSY` timeout refusal. No callers wired — msh-2/3/5 own that.

**Files touched:** `skills/bee-hive/templates/lib/lock.mjs`,
`.bee/bin/lib/lock.mjs`, `scripts/test_store_lock.mjs`, `.gitignore`,
`docs/history/codex-harness-hardening/release-manifest.json`.

**Commit:** `f808873` (branch `wt/multi-session-hardening`).

Full trace, verify output, and `verification_evidence` (including the
deliberate-red falsifiability run): `.bee/cells/msh-1.json`.
