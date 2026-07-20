---
area: verify-pipeline
status: current
sources: [contention-split cells cs-1/cs-2a/cs-2b/cs-3/cs-4 (fixture extraction, monolith split 430-check conservation, monolith deletion, locked tmp-swap render, convention-based suite discovery; traces in .bee/cells/, 2026-07-20); verify-parallel-runner (parallel pool, 2026-07-20, commit 6caceb4)]
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

## Open Gaps

- `test_bee_write_guard_hook.mjs` (9/21 failing vs the live hook) awaits
  its fix-first cell: net-first freeze of current hook behavior, then a
  branch-by-branch verdict of test-wrong vs hook-wrong (P1 backlog,
  2026-07-20).
- The CLI dispatcher (4.4k lines, all handlers inline) remains the last
  structural hotspot; handler extraction is deferred to its own feature
  (contention-split D5).

## Pointers (implementation)

- `scripts/run_verify.mjs` — discovery roots, EXTRA/EXCLUDE, serial
  convention, pool.
- `scripts/test_verify_manifest.mjs` — floor + existence + membership guard.
- `scripts/lib/test-fixture.mjs` — shared fixture/check-runner.
- `skills/bee-hive/templates/tests/` — per-module suites (11 files).
- `scripts/render_plugin_skill_trees.mjs`, `scripts/test_render_race.mjs` —
  locked tmp-swap render + race proof.
