---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: small
---

# Plan: cells-update-verb — `bee_cells.mjs update` (door-validated cell revision)

**Why:** validation repair loops legitimately revise already-created cells; with no `update` verb, rule 11
forces friction + hand-edit, which renders full JSON diffs in the user's working view — the exact noise
the CLI-owned-state contract (`bb4bb18e`) was shipped to remove. Two friction items on record share this
root cause. User approved shipping the verb + release v0.1.26 (this session).

**Mode gate:** flags = existing covered behavior (cells suite) → 1 flag, ≤3 logical files, one direct
task, no gray areas → **small**.

## Discovery (L0)

Patterns all in-repo: allowlist+refusal door (`bee_state.mjs` prune flag validation, workers-prune
`a0285993`), strict-read write path (`readStateStrict` lib/state.mjs:241, `readReviewStrict`
lib/reviews.mjs), field-map validation (critical pattern 20260710: derive the field list from the map).

## Shape

`updateCell(root, id, patch)` in `lib/cells.mjs` + CLI verb `update --id <id> --file <patch.json>|--stdin`:

- **Strict read:** missing cell → refuse; present-but-corrupt JSON → refuse loudly, file untouched
  (never rebuild from defaults).
- **Status door:** only `open` and `blocked` cells are updatable. `claimed` (live worker), `capped`,
  `dropped` (frozen audit) → refuse, exit non-zero, file byte-unchanged.
- **Field allowlist as a validator MAP** (critical pattern 20260710): `title`, `action`, `verify`
  (non-empty strings) · `files`, `read_first`, `deps`, `decisions` (arrays of strings) · `must_haves`
  (object) · `behavior_change` (boolean) · `lane` (LANES member) · `pbi` (string|null). Any key NOT in
  the map — `id`, `feature`, `status`, `trace`, `tier` (own verb), anything unknown — refuses the whole
  patch. Post-merge invariant re-check: standard/high-risk result requires non-empty
  `must_haves.truths` (same rule as addCell).
- **Atomic write** of the merged cell; one-line CLI confirmation.
- CLI refuses unknown flags (workers-prune discipline).

**Files:** `skills/bee-hive/templates/lib/cells.mjs`, `skills/bee-hive/templates/bee_cells.mjs`,
`skills/bee-hive/templates/tests/test_lib.mjs` (+ mechanical `.bee/bin` mirrors enforced by the parity
sweep). No prose change: rule 11 already routes any mutation through its CLI verb once the verb exists.

**Verify:** `node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/scripts/test_onboard_bee.mjs`

## Reality check (inline, small lane)

- **MODE FIT** PASS — one verb + tests, no API/data change outside bee's own runtime files; 1 flag.
- **REPO FIT** PASS — addCell/writeCell exist (cells.mjs:74/66); CLI switch has 11 sibling verbs
  (bee_cells.mjs case list); strict-read + unknown-flag-refusal precedents named above with lines.
- **ASSUMPTIONS** PASS — cell files are one-per-entity JSON (read this session); parity sweep
  auto-covers edited templates (test_lib.mjs:3690, proven in review-on-demand).
- **SMALLER PATH** none — prose alone cannot stop the diff noise; the verb is the minimum.
- **PROOF SURFACE** PASS — suite 208/0 green this session; exits non-zero on failure (test_lib.mjs:3809).

## Test matrix (small)

update lands on open cell (only patched fields change; status/trace byte-stable) · blocked cell
updatable · claimed/capped/dropped refused, file byte-unchanged · each frozen key (id/feature/status/
trace/tier) refused · unknown key refused · corrupt cell JSON → fail closed · standard-lane result with
emptied truths refused · CLI: missing --id refused, unknown flag refused, --stdin path works.
