# contention-split — plan (frozen at Gate 2)

Mode: standard. 4 cells. cs-3 is contention-free and runs immediately in
parallel; cs-1 → cs-2a → cs-2b serialize on the test tree.

- **cs-1 — fixture helper.** `scripts/lib/test-fixture.mjs`: makeTempRepo()
  (the test_lib.mjs:218-242 bootstrap), makeCell(), and the check-runner
  (check/assert + summary/exit plumbing) extracted as importables.
  test_lib.mjs itself switches its top fixture + runner to the helper
  (byte-behavior identical, count unchanged). Registers nothing new.
- **cs-2a — split, part 1 (lib-module blocks).** Move the clean contiguous
  blocks out of test_lib.mjs into per-module files (cells ≈463-2076+judge/
  budgets, claims ≈2162-2400, reservations ≈2077-2160, feedback ≈4186-5287,
  reviews ≈8098-8842, plus their satellite sections), each importing the
  fixture helper, preserving section order. Register each in run_verify
  SUITES; MANDATORY_SUITES enumerates them. test_lib.mjs keeps the rest;
  conservation census green at every step.
- **cs-2b — split, part 2 (CLI block + remainder) + monolith deletion.**
  CLI/dispatcher block (≈5288-9253) into test_cli_<area> files; state/lanes/
  handoff, guards, backlog/capture, misc into their files; the
  template↔vendor byte-equality standing guard (≈9129) lands in test_misc.
  Delete test_lib.mjs; MANDATORY_SUITES lists every split file explicitly
  (no substring matching); final conservation census == the pre-split total.
- **cs-3 — regen concurrency safety.** render_plugin_skill_trees writeTree:
  wrap the whole render+write in withStoreLock(repoRoot,
  'plugin-render'); write each tree to a fresh tmp sibling dir then swap
  (rename old out, rename new in, remove old — minimal non-atomic window),
  sidecar last. Two concurrent runs serialize and converge; a crashed run
  never leaves a half-deleted tree for the next reader. Race test
  (two concurrent spawns, both exit 0, resulting tree valid + sidecar
  present) as a standalone scripts/test_render_race.mjs in SUITES +
  SERIAL_SENSITIVE.

Every cell: self-onboard + plugin-tree render + full run_verify green;
mirrors byte-identical; one commit per cell.

Risks: hidden cross-range fixture accumulation (mitigated: contiguous
ranges + census at each step + full verify); in-flight cells naming
test_lib.mjs are updated post-split (CONTEXT D6).
