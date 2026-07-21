# 2026-07-21 — The CI timing-flake class: structure beats scheduler luck (release-1-7-10-rc)

**Feature:** release-1-7-10-rc (cells rel1710rc-3/4/5) · **Tags:** [tests, ci, concurrency, windows, determinism]

Three consecutive CI failures on GitHub's 2-core runners, each a different symptom of ONE class:
a test asserting something the scheduler merely tends to make true on a many-core dev box.

1. **Racer refusal ≠ crash (store_lock f/c, claim_race d).** When a racer legitimately loses
   (lock busy, budget exhausted), the test must count a typed refusal as an OUTCOME, never let the
   exception escape as a crash. Invariants stay strict (mutual exclusion, no lost updates,
   ≥1 winner); only "everyone completes" is the lie. Collect EVERY racer's exit before asserting
   shared-state conclusions.
2. **Output-capture assertions need a generous kill window (onboard shared-Worker timeout).**
   `timeout: 100` can SIGTERM a child before node boots and prints. Split the properties: timeout
   semantics (short timeout, no output assertions) vs capture preservation (prints-then-hangs
   module, ≥5s timeout). Never assert output produced under a timeout tighter than process spawn.
3. **Windows denies rename/unlink over briefly-open files (claims sweep-heartbeat race).**
   POSIX allows `renameSync`/`rmSync` over a file another thread holds open; Windows throws
   EBUSY/EPERM — and an uncaught throw inside a racer thread died SILENTLY (status 1, empty
   output). Two fixes, both durable: (a) every race harness prints status+signal+stdout+stderr+
   worker error on failure — an empty failure message is itself a bug; (b) fs mutators that can
   race a reader get a bounded transient-retry (15×20ms, EBUSY/EPERM/ENOTEMPTY class) —
   `withTransientFsRetry` in claims.mjs, same budget shape as `acquireGateWithRetry`.

**Proof discipline that worked:** every fix proven `taskset -c 0,1` 10/10 + unconstrained 5/5
locally, then the exact-tag CI run as the real-world proof. One lucky green (Windows on a146dca)
is not evidence — the honest windows-portable subset only surfaced the latent bug when it started
running the suite at all.

**Also settled (from crash-recovery mining, same feature):** the RC tag follows the
CI-stabilization commit, not the original release commit — re-point `v<ver>-rc` (delete+recreate,
never branch force-push) until the exact-tag CI is green on both platforms; the release is not
done before that.
