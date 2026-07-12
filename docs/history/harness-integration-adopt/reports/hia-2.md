# hia-2 — adapt dispatcher to 0.1.26: cells.update + status re-sync

**Status:** [DONE] — worker stuart, capped 2026-07-12.

**Outcome:** Per DA3 (decision 30606de4), brought the imported `bee.mjs` dispatcher up to bee 0.1.26 without touching the 4 legacy helpers. (1) `command-registry.mjs`: added a `cells.update` entry mirroring `bee_cells.mjs`'s update verb contract (id required; file/stdin; JSON-Schema parameters; runnable example). (2) `bee.mjs`: imported `updateCell` from `./lib/cells.mjs`, added `handleCellsUpdate` replicating `bee_cells.mjs`'s `case 'update'` output byte-for-byte, registered as `cells.update` in `HANDLERS`. (3) Re-synced the copied status layer against the *current* `.bee/bin/bee_status.mjs`: ported `buildReviewBlock` (listCandidates/listReviews/deriveCandidateStatus), `POST_EXECUTION_REVIEW_PHASES`, `hasStaleAdvisorKey` staleness check, and the matching `renderStatusText` lines; removed the stale `advisor` field/render block and the gate-review staleness check that no longer exist upstream — `bee status` and `bee status --json` are now byte-identical to the helper. (4) `test_bee_cli.mjs`: added `cells.update` coverage (registry example, dispatcher-vs-helper parity for both a successful patch and a frozen-key refusal) and a text-mode `bee status` parity check alongside the existing `--json` one. (5) Mirrored both touched templates files into `.bee/bin`.

**Verify:** `node skills/bee-hive/templates/tests/test_bee_cli.mjs` → 71 passed, 0 failed. `bee status`/`--json` byte-diffed against `bee_status.mjs`/`--json` → both exit 0 (identical). `cmp` of both templates files against their `.bee/bin` mirrors → exit 0.

**Behavior-change evidence (red/before):** reconstructed the pre-change `bee.mjs` from git HEAD and re-ran the same probes — `bee cells update` was an unknown command (`Did you mean "cells.judge"?`, exit 1), and `bee status --json` diffed against the current helper showed a missing `review` block (real JSON parity break). Full evidence in the cell trace.

**Files:** `skills/bee-hive/templates/bee.mjs`, `skills/bee-hive/templates/lib/command-registry.mjs`, `skills/bee-hive/templates/tests/test_bee_cli.mjs`, `.bee/bin/bee.mjs`, `.bee/bin/lib/command-registry.mjs`.

Full trace and verification evidence: `.bee/cells/hia-2.json`.
