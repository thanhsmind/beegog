---
area: verify-pipeline
status: current
updated: 2026-07-21
sources: [contention-split cells cs-1/cs-2a/cs-2b/cs-3/cs-4 (fixture extraction, monolith split 430-check conservation, monolith deletion, locked tmp-swap render, convention-based suite discovery; traces in .bee/cells/, 2026-07-20); verify-parallel-runner (parallel pool, 2026-07-20, commit 6caceb4); hardening-1-7-10 cells 1710-1..1710-11 (2026-07-21 — session-id env scrubbing at both runner and bootstrap for hermetic local/CI parity; Windows CI runs the real split suites through the runner's own discovery rather than a hand-maintained list; deterministic fs-barrier claim-race negative control, 10/10 both env modes; chmod-based write-failure simulations skip loudly under root; nested-clone isolation regression pins root resolution off the parent repo's git config)]
decisions: [contention-split D1-D6 (decision 1ce777d9); verify-parallel-runner]
---

# Verify Pipeline (test topology & discovery)

## Purpose

Keep the full-repo verification fast, complete, and — above all —
contention-free: two features working in parallel must not need to edit the
same test artifact unless they genuinely change the same module.

## Behaviors & Operations

- **Per-module suites, no monolith.** Every lib module or CLI area owns its
  own standalone suite file. The former single-file monolith (9.6k lines,
  ~100 sections, 430 checks) was split by contiguous section ranges with an
  exact check-count conservation proof (430 = 204 + 226) and then deleted.
  A new module brings a new suite file beside it, never a section appended
  to a shared file.
- **Shared fixture helper.** Suites import their temp-repo bootstrap,
  cell factory, and check-runner from one helper
  (`scripts/lib/test-fixture.mjs`) instead of duplicating setup. Each suite
  file owns its own temp root; cross-suite state sharing is prohibited.
- **Convention-based discovery.** The runner discovers suites by glob
  (`test_*.mjs` under the four test roots) plus a small EXTRA list for
  legacy names and an EXCLUDE list for non-suite helpers. Adding a test
  file requires zero runner edits — the registry hotspot is gone.
  Serial-sensitive routing (lock/race/timing suites run in one serial
  chain) derives from filename convention (`*_race`, `*_lock`,
  `*_concurrency`) plus a named exception list.
- **Deletion still fails loudly.** The manifest guard asserts a floor
  count, on-disk existence of every curated mandatory suite, and their
  membership in the discovered set — a vanished suite fails verify even
  though nothing "registers" it anymore.
- **Concurrency-safe artifact regeneration.** The plugin-tree render locks
  (`plugin-render` store lock), builds into a tmp sibling dir, and swaps by
  rename; concurrent renders serialize and converge. Proven by a permanent
  race suite whose deliberate-red twin replays the old torn-tree behavior.
- **Hermetic by construction, not by convention (hardening-1-7-10).** Every
  child suite the verify runner launches has `CLAUDE_CODE_SESSION_ID` and
  `BEE_SESSION_ID` scrubbed from its own environment before it starts, and any
  suite whose subject matter is session-sensitive (claim/session/identity
  behavior) scrubs the same variables again at its own bootstrap, in case
  something downstream of the runner re-introduces them. The effect is that a
  developer's own local shell — which may well be sitting inside a live
  harness session with one or both variables set — cannot produce a run that
  is only green because it inherited that ambient identity: a local run and a
  CI run now see the identical (absent) session identity, so a local green
  cannot silently diverge from what CI would report.
- **Windows CI proves the real suites, not a stand-in list.** The split
  per-module template suites run on Windows CI through the runner's own
  discovery mechanism — a root-filter environment variable narrows discovery
  to the relevant roots, and discovery refusing to run when that filter
  matches zero suites is itself a guarded failure — rather than through a
  second, hand-maintained enumeration of which suites "should" run on
  Windows. There is exactly one place a suite is ever listed: the discovery
  convention itself (hardening-1-7-10).

## Business Rules

- R1 — A test suite is one file, one module/area, one temp root; adding
  tests for module X touches only X's suite file.
- R2 — Suite membership is discovered, never hand-registered; exclusions
  carry a dated comment naming the reason.
- R3 — Check-count conservation is the required evidence for any test-file
  migration (counts recorded before/after; additive setup fixes allowed,
  weakened or dropped checks are not).
- R4 — Whole-tree regeneration steps must be lock-serialized and
  atomic-swapped; a crashed regen may never leave a torn tree.
- R5 — Multi-worker checkout etiquette: cap → commit (own hunks only) →
  release reservations, in that order; aggregate regen artifacts
  (render sidecars, release manifest, onboarding state) ride a
  consolidated pass, not per-cell commits.

## Edge Cases Settled

- Discovery flip surfaced 4 orphan test files the hand registry never ran;
  3 were adopted (suite count 47→50), 1 (`test_bee_write_guard_hook`)
  fails standalone against the live hook and is excluded with a dated
  comment — filed as a P1 fix-first item, not silently adopted or trusted.
- Known WSL2 host flakes under heavy concurrent load: `test_store_lock`,
  `test_render_race` — a flake is rerun once and both runs reported;
  a clean rerun is acceptable, hiding a flake is not.
- The claim-race negative control (proving exactly one winner among
  simultaneous claimants) no longer relies on timing to force the race: a
  deterministic filesystem-barrier handshake holds every racer at the same
  starting line and releases them together, proven 10/10 clean under both
  session-id-present and session-id-absent modes. A chmod-based simulation of
  a write failure is a separate, narrower proof (permission denial, not a
  race) and skips loudly — rather than reporting a false pass or a false fail
  — when the suite itself is running as root, since root ignores the
  permission bits a chmod-based simulation depends on (hardening-1-7-10).
- A nested-clone isolation regression pins down a scoping requirement that
  worktree/root-resolution code must hold everywhere: cloning the repository
  into a nested directory and running root resolution or a worktree operation
  from inside that nested clone must never read or write the PARENT
  repository's own git configuration. Without this pin, a root-resolution bug
  could silently walk past the nested clone's own `.git` and act on the
  outer repository instead (hardening-1-7-10).

## Open Gaps

- The CLI dispatcher (4.4k lines, all handlers inline) remains the last
  structural hotspot; handler extraction is deferred to its own feature
  (contention-split D5).

## Resolved Gaps

- The guard-hook suite's 9/21 failures (P1, 2026-07-20) were TEST-WRONG with
  one shared cause: the fixture's hand-maintained lib-module list under-
  vendored the hook's import closure (10 listed vs 17 needed), so the hook's
  first dynamic import threw and its documented fail-open caught every deny
  path. The hook had no hole. Fixed 2026-07-21 (write-guard-hook-fix wgf-1):
  the fixture now vendors the lib directory wholesale — killing the stale-
  hand-list class, which had bitten at least twice — and the suite runs in
  CI for the first time. Corollary rule: **R6 — a fixture that mirrors a
  module tree copies the tree, never a hand-maintained file list.**

## Pointers (implementation)

- `scripts/run_verify.mjs` — discovery roots, EXTRA/EXCLUDE, serial
  convention, pool.
- `scripts/test_verify_manifest.mjs` — floor + existence + membership guard.
- `scripts/lib/test-fixture.mjs` — shared fixture/check-runner.
- `skills/bee-hive/templates/tests/` — per-module suites (11 files).
- `scripts/render_plugin_skill_trees.mjs`, `scripts/test_render_race.mjs` —
  locked tmp-swap render + race proof.
