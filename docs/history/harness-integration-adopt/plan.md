---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: standard
---

# harness-integration-adopt — integrate vantt's PR #1 (unified CLI dispatcher + manifest)

## Request

The owner wants PR #1 (`vantt:main` → `thanhsmind/beegog`, "harness-integration Phase 1")
integrated into main **following vantt's stated direction**: a unified dispatcher that sits
*outside* the existing helpers, reuses the existing `lib/*.mjs` as a library, and leaves the
4 legacy helper CLIs (`bee_status/cells/reservations/decisions.mjs`) untouched.

The PR cannot merge as-is (reviewed 2026-07-12, this session):
- GitHub reports merge conflicts (PR was built on bee 0.1.22; main is 0.1.26).
- The PR carries vantt's own `.bee/` runtime state (state.json, config.json — which deletes
  this repo's `dogfood_repos` —, reservations.json, decisions.jsonl, backlog.jsonl, logs,
  onboarding.json, cells/*, manifest-hash.json) plus his `plans/` + `docs/history/` bookkeeping.
- Its anti-drift registry is already drifted: missing `cells.update` (shipped in 0.1.26),
  and the copied `buildStatus`/`renderStatusText` in `bee.mjs` predates the 0.1.26
  review-on-demand block in `bee_status.mjs`.

So: adopt the **code**, exclude the **state**, adapt to **0.1.26**, and add the missing
**drift enforcement** the PR's own goal implies.

## Locked decisions (scoping synthesis — D-IDs logged in .bee/decisions.jsonl)

- **DA1 — mechanism adopted as-is (vantt's D5):** `bee.mjs` imports the shared `lib/*.mjs`
  and reimplements each helper's thin run/render layer; it never imports, spawns, or edits
  the 4 helper files. We do NOT switch to spawnSync and do NOT refactor the helpers' render
  logic into lib in this feature — that is a follow-up candidate, not Phase 1.
- **DA2 — state exclusion:** nothing under `.bee/` from the PR is taken. Only code, tests,
  templates, and docs. `.bee/bin/**` copies are produced by vendoring our own templates,
  never by checking out vantt's `.bee/bin` files.
- **DA3 — 0.1.26 adaptation:** registry + dispatcher gain `cells.update`; the copied
  status logic is re-synced byte-parity against current `bee_status.mjs` (review block,
  `POST_EXECUTION_REVIEW_PHASES`, reviews import).
- **DA4 — runtime artifact hygiene:** `.bee/manifest-hash.json` is gitignored (it is
  rewritten on every `bee.mjs` invocation, including read-only ones).
- **DA5 — drift enforcement:** a standing parity test derives each helper's verb list from
  the helper's *runtime behavior* (its "Unknown command … Use: …" contract line), never
  from grepping its source (critical pattern 20260710: pinned syntax can be the bug), and
  asserts a bijection with the registry's `group.*` entries.
- **DA6 — scope freeze:** dispatcher covers exactly the 4 legacy helpers + `cells.update`.
  The 5 newer helpers (`bee_state`, `bee_backlog`, `bee_capture`, `bee_reviews`,
  `bee_feedback`) are a follow-up PBI, not this feature.
- **DA7 — attribution:** vantt's design record (`docs/decisions/0024`) is imported with
  authorship intact; the close-out commit and the PR comment credit him. Posting the PR
  comment / closing PR #1 is outward-facing → explicit user confirmation at the end,
  never automatic.

## Discovery (L1 — verified by command this session, no discovery.md)

- PR head fetched and reviewed in full (`gh pr diff 1`, 6.6k lines); 4 legacy helpers
  untouched by the PR — confirmed by file list.
- Onboarding vendors by glob: `listTemplateHelpers()` = `templates/*.mjs`,
  `listTemplateLibModules()` = `templates/lib/*.mjs` (onboard_bee.mjs:860-879). Dropping
  `bee.mjs` + 2 lib modules into templates auto-vendors them to every onboarded host.
- Standing sweep `test_lib.mjs:4788` enforces templates ↔ `.bee/bin` byte-identity and
  auto-covers new files; sweep `:4751` (C0 control bytes) also auto-covers them.
- Current main verbs: `bee_cells.mjs` = list ready show add update claim verify cap block
  drop tier judge (12); `bee_status.mjs` imports `lib/reviews.mjs`, has `buildReviewBlock`,
  `POST_EXECUTION_REVIEW_PHASES` — the PR's copy lacks all of this.
- `validate-args.mjs` accepts CLI string encodings for boolean/number — no false-denial
  on `--passed true`. Verified by reading the PR's validator + guard parsing.

## Mode gate (mechanical)

Flags counted: **public contracts** (the manifest + `bee <group> <action>` surface becomes
an agent-facing contract on every onboarded host), **existing covered behavior**
(write-guard and status output are pinned by the 215-test suite). = **2 flags**, story-sized
→ **standard**. Smaller modes are insufficient: >3 files, two domains (dispatcher + hook),
and a cross-repo vendoring surface.

## Approach

Import the PR's code files from the PR head (`gh pr diff` extraction or `git fetch` of the
PR ref), with templates as the single source of truth and `.bee/bin` produced by vendoring.
Then adapt in place, then enforce.

Rejected alternatives:
- **Merge the PR then fix forward** — rejected: the merge brings vantt's `.bee` state and
  conflicts; untangling costs more than importing code files cleanly.
- **spawnSync thin wrapper** (zero duplication) — rejected for this feature: contradicts
  the PR's locked D5 mechanism the user chose to follow; noted as the alternative if the
  byte-parity copy proves too costly to maintain (revisit via follow-up PBI).
- **Refactor helpers' render layers into lib/** — right long-term shape, but touches the
  4 helpers, violating vantt's "không thay đổi gì" constraint for Phase 1.

Risk map:
- Copied status logic drifts again — MEDIUM → mitigated by parity assertion in
  test_bee_cli.mjs (dispatcher output diffed against helper output at test time) + DA5 test.
- Guard check (d) false-denials on hosts — LOW (fail-open contained, verified in review;
  his 16 hook tests come along).
- Vendored-file set grows (hosts get bee.mjs on next onboard) — LOW, glob + sweep handle it;
  release flow (memory: bee-release-flow) re-onboards anphabe hosts explicitly.
- test_bee_cli.mjs examples run against a real repo root — MEDIUM unknown: his tests used a
  temp fixture; validating must confirm they don't mutate this repo's `.bee`.

Files (order): `skills/bee-hive/templates/bee.mjs`, `templates/lib/command-registry.mjs`,
`templates/lib/validate-args.mjs`, `templates/tests/test_bee_cli.mjs`,
`templates/tests/test_bee_write_guard_hook.mjs`, `hooks/bee-write-guard.mjs`,
`templates/AGENTS.block.md`, vendored siblings under `.bee/bin/`, `.gitignore`,
`docs/02-architecture.md`, `docs/07-contracts.md`, `docs/decisions/0024-*.md`, `AGENTS.md`
(via onboarding block sync).

## Test matrix (edge dimensions, standard depth)

- **Boundary/empty:** `bee` with no args; `bee cells` with no action; empty flag value.
- **Malformed input:** corrupt `.bee/manifest-hash.json` (readJson default-null path);
  non-JSON stdin to `cells add`.
- **Type encodings:** `--passed true|false` (string-boolean), `--ttl` non-numeric refusal.
- **Unknown command:** Levenshtein suggestion fires; guard fails open (not the guard's job).
- **Parity:** `bee status` / `bee status --json` byte-equal to `bee_status.mjs` on the same
  repo; same for one representative verb per group.
- **Drift:** DA5 bijection test goes red when a helper gains a verb absent from the
  registry (prove by the cells.update case itself: registry without it fails).
- **Guard fail-open:** malformed Bash payload, missing lib modules on host → exit 0.
- **Cross-platform:** guard path split handles `\` (present in PR code — keep covered by
  imported hook tests).

## Slices

**Slice 1 (current, whole feature):** import → adapt → enforce → docs. 5 cells, linear-ish.
No future-slice cells exist.

Cells (created post-Gate-2; PR head fetched as local ref `pr-1-vantt` = aa8f543):
1. `harness-integration-adopt-1` import PR code files from `pr-1-vantt` (templates + hook
   + gitignore), vendor to `.bee/bin`. Verify: `node --check` each imported file + the
   templates↔`.bee/bin` byte-equality sweep.
2. `harness-integration-adopt-2` adapt to 0.1.26 (`cells.update` registry entry + dispatcher
   handler; status logic re-sync incl. review block). Deps: 1. Verify: imported CLI suite
   green + `bee status`/`--json` byte-diff against `bee_status.mjs` output.
3. `harness-integration-adopt-3` DA5 behavior-derived registry↔helper-verb bijection test.
   Deps: 2. Verify: new test green inside the suite run.
4. `harness-integration-adopt-4` docs + AGENTS block + decision record 0024 import (adapted
   prose, vantt attribution). Deps: 1. Verify: stable-heading greps + onboard suite.
5. `harness-integration-adopt-5` close-out: full verify suite, backlog PBI for the 5
   remaining helpers, feature decision log. Deps: 2,3,4.

PR comment + close on GitHub: after user confirmation only (DA7), outside the cells.
