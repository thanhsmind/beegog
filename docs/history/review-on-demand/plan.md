---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: standard
---

# Plan: review-on-demand — user-invoked independent review

Source of truth: `docs/history/review-on-demand/SPEC.md` (R1–R10, flows 7.1–7.5, data §8, A1–A12).
Source decision: `565e68d0-327f-404e-b49e-d1c61ba81bfd` — full review runs only on explicit user request.

## Mode Gate (mechanical)

Flags counted: **existing covered behavior** (test_lib asserts the current chain/phase/status wording),
**public contracts** (AGENTS managed block + status JSON are projected into host repos by onboarding),
**multi-domain** (vendored helpers + skill prose + tests + docs). **Data model: counted NO** — the new
`.bee/reviews/` store is additive bee-runtime state (no user data, no transformation of existing records;
old features derive `unreviewed`, SPEC §11.3). No hard-gate flag: R2 explicitly preserves every
verification condition; nothing auth/external/data-loss.

**Count = 3 → `standard`.** Smaller modes are insufficient: story-sized behavior across ≥15 files in two
domains (runtime helpers + skill prose), with acceptance scenarios that need automated evidence.
Precedent: lane-scaling v2 (`d02a6bc6`, same class of workflow re-architecture) ran standard.

## Discovery

**L1** — all territory is in-repo with strong precedent; no external research.
- One-file-per-entity store + CLI verbs: `.bee/cells/<id>.json` + `bee_cells.mjs` (pattern to mirror).
- CLI-owned mutation contract: decision `bb4bb18e` — every `.bee` mutation gets a CLI verb, strict reads
  on write paths, hooks fail-open.
- Append-only ledgers: `decisions.jsonl` / `backlog.jsonl` pattern for the candidates ledger.
- Chain-encoding sweep (Explore, this session): auto-review is encoded in `bee-reviewing/SKILL.md:4,18`,
  `bee-swarming/SKILL.md:22,69,100`, `lib/state.mjs:20` (phase enum), `bee_status.mjs:78-83`
  (POST_REVIEW_PHASES warning), `AGENTS.block.md:24` + repo `AGENTS.md`, `routing-and-contracts.md:15,107`,
  `go-mode.md:34-38,129`, `docs/03-workflow.md:16,74,124,138-160`, `reviewing-reference.md:123`.

## Approach

### Chosen shape

Two domains, two slices. Review sessions and candidates become **first-class runtime records** with their
own CLI (mirroring cells), and the skill prose re-wires the chain so execution → scribing → compounding
closes a feature with a truthful `unreviewed` label; `bee-reviewing` becomes a user-invoked session over an
immutable scope.

**Runtime substrate (slice 1):**
- `skills/bee-hive/templates/lib/reviews.mjs` + `skills/bee-hive/templates/bee_reviews.mjs`
  (+ byte-identical `.bee/bin/` siblings — the existing templates↔bin sweep test enforces parity).
- Store: `.bee/reviews/<review-id>.json`, one session per file, fields per SPEC §8 (id, requested_by/at,
  scope_description, included, excluded+reasons, baseline, head, reviewer_manifest,
  verification_preflight, findings, uat, decision+gate4). Baseline/head are **immutable after create**;
  any verb that would change them is refused (R5).
- Candidates ledger: `.bee/review-candidates.jsonl`, append-only, one entry per feature close
  (`candidate add --feature F --head <sha> --cells ...`). Status is **derived, never stored**:
  `unreviewed` → `in review` (open session includes it) → `reviewed` (approved session covers its head) →
  `review stale` (commits exist after the covering session's head: `git rev-list <head>..HEAD --count`).
  Old features without records simply derive `unreviewed` — no fake history (SPEC §11.3).
- CLI verbs (each mutation has a verb, per `bb4bb18e`): `create` (freezes scope; runs verification
  preflight over included behavior-change cells and **fails closed** before any session file is written
  when evidence is missing — A10; auto-excludes open/claimed cells with reason `in progress` — A6),
  `list`, `show`, `record` (manifest/findings/uat/decision sub-records; refuses baseline/head mutation),
  `candidate add`, `candidates`, `status` (coverage summary distinguishing the five R10 labels).
- `bee_status.mjs`: **replace** the POST_REVIEW_PHASES staleness warning (scribing/compounding without
  Gate 4 is now the normal close, R3) with a `review` block — candidate counts by derived status + open
  sessions — and the §9 wording in text render; `recommended_next` after execution reports candidate
  count instead of proposing bee-reviewing (§11.5). Phase enum **unchanged** — `reviewing` stays valid
  for in-flight upgrades (§11.4) and for active sessions.

**Workflow re-wiring (slice 2, cells created only when slice 1 is capped):**
- `skills/bee-reviewing/SKILL.md` + reference: user-invoked session skill — explicit-intent trigger list
  (R1), scope resolution with at most one boundary question (R4), scope preview before dispatch (R5, §9
  wording), batch resolution + cumulative diff with per-finding feature/cell mapping (7.3), reviewer
  panel/severity/synthesis contract **unchanged** (goal 5), delta re-review + defect-class sweep for
  fixes (R9, A12), Gate 4 lives only inside a session (R8; bypass never creates sessions), active-work
  preservation (7.5).
- `skills/bee-swarming/SKILL.md`: final-slice handoff → bee-scribing (never bee-reviewing); small-lane
  solo handoff likewise closes without an auto reviewer (goal 1: zero reviewer tokens without request —
  the 1-correctness-reviewer contract moves inside the on-demand session for small scopes).
- `skills/bee-hive/SKILL.md` + `references/routing-and-contracts.md` + `references/go-mode.md`: chain
  diagram (swarming → scribing → compounding; reviewing = on-demand side entry), Gate 4 contract
  wording, merge/ship/release guard row (7.4/A9: report unreviewed status + ask, never silent dispatch),
  high-risk unreviewed warning (R7/A3).
- `skills/bee-scribing/SKILL.md`, `skills/bee-compounding/SKILL.md`: feature close allowed and truthful
  with `unreviewed`; compounding close appends the review candidate (7.1 step 6) and posts the §9
  completion line.
- `skills/bee-hive/templates/AGENTS.block.md` + repo `AGENTS.md` (via onboard sync) + `docs/03-workflow.md`.
- Removal census (critical pattern 20260711): repo-root grep for auto-chain wording
  ("Invoke bee-reviewing" as a completion signal, "final swarm slice" trigger) incl. bare-token variants;
  archaeology under `docs/history/` excluded.

### Rejected alternatives

- **Store candidate status in state.json** — rejected: derived status can never go stale-vs-truth; storing
  it duplicates git facts and breaks R10 traceability.
- **Reuse `approved_gates.review` as the coverage record** — rejected: gate flags are per-feature booleans
  reset by startFeature; coverage must attach to immutable baseline/head (§8), not a bit.
- **Drop the `reviewing` phase from the enum** — rejected: §11.4 requires in-flight sessions to finish
  under the old contract; removal would strand them and break `isKnownPhase` consumers.
- **A new hook to block reviewer dispatch** — rejected: dispatch is agent behavior, not a file write;
  prose contract + tests on the wording/status surfaces are the honest enforcement (same altitude as the
  rest of the chain).

### Risk map

| Component | Risk | Proof needed (validating) |
|---|---|---|
| git-based stale/coverage check (`rev-list`) in helpers | MEDIUM | probe: temp repo fixture, rev-list range counts, behavior on missing git/shallow repo (fail-open to `unknown`, never crash status) |
| preflight fail-closed create (A10) | MEDIUM | red-first test: behavior-change cell without evidence → non-zero exit, zero files written |
| onboarding auto-syncs NEW template files (bee_reviews.mjs) to host `.bee/bin` | LOW-MEDIUM | probe: onboard plan includes new template file without code change |
| prose removal census breadth | MEDIUM | repo-root grep census with bare tokens; verify strings dry-run before dispatch (critical patterns 20260708/20260712) |
| status warning replacement regressing decision 0004 drift detection | LOW | test: unknown-phase warning stays; only the Gate-4-pending warning is replaced |

### Migration + preflight notes (validation iteration 1)

- **SPEC §11.2 vs §11.3 reconciled:** bee has NO durable per-feature review-coverage records predating
  this feature — `approved_gates.review` resets at every `startFeature` (lib/state.mjs:520) and review
  reports live only as prose in `docs/history/*/reports/`. §11.2's "old Gate-4 features stay reviewed at
  their old range" is therefore moot as machine-derived coverage: the prose reports remain untouched as
  audit history (satisfying §11.2's audit intent), while derived status for legacy candidates is honestly
  `unreviewed` per §11.3. No fake session records are seeded.
- **A10 scope note:** preflight fail-closed is a defensive re-check — `capCell` already refuses a
  `behavior_change` cap without evidence (lib/cells.mjs:220-223), so the A10 path triggers on legacy or
  hand-crafted traces. Commit-range scopes (R4 type 4) with no mappable cells carry nothing to preflight:
  slice-2 scope resolution must state in the preview when a scope has no cell evidence to check —
  commit-only scopes are outside A10's guarantee. Owned by slice 2.

### Open questions for validating

1. Exact stale semantics when the covering session's head is not an ancestor of HEAD (rebase/amend):
   proposed — treat unresolvable ranges as `review stale` with an explicit `range unresolvable` note
   (fail toward honesty, R10). Prove with a rebase fixture.
2. `candidate add` head source at compounding time: `git rev-parse HEAD` at close vs last cell-cap commit.
   Proposed: HEAD at close (simple, immutable); validate against the release-flow commit ordering.
3. Whether `bee_reviews.mjs status` needs a `--feature` filter for the 7.2 single-feature flow or the
   session preview owns that projection.

## Test matrix sketch (12 edge dimensions, standard depth)

Mechanical/automated (test_lib.mjs): session roundtrip + scope immutability (R5) · preflight fail-closed
A10 · in-progress auto-exclusion A6 · derived statuses across the 5 labels R10 · reviewed→stale flip on
post-head commit A8 · already-covered range answer A7 · candidate append at close 7.1 · status render
carries §9 wording · unknown-phase warning survives, Gate-4-pending warning gone · templates↔bin parity
(existing sweep) · malformed inputs: corrupt session JSON, missing git, empty ledger (fail-open reads,
fail-closed writes — model-tier-guard pattern) · prose census greps (stable headings, not invented tokens).
UAT-recorded (SPEC §13 allows a recorded scenario for agent-behavior items): A1/A2/A3 zero-dispatch, A5
batch flow, A9 merge-guard wording, A11/A12 session findings flow.

## Slices

1. **runtime substrate** — reviews lib + CLI + candidates ledger + coverage/stale engine + bee_status
   integration + tests. Closes with: helpers green, status shows review block, zero prose changes.
2. **workflow re-wiring** — skill prose, AGENTS block + onboard projection, docs, removal census, UAT
   scenario records, remaining A-scenario evidence.

Slice 1 first: prose that references verbs which don't exist yet would be untestable; the reverse order
would leave the chain broken with no status truth to point at.

## Current slice (slice 1) — cells

| Cell | Scope | Deps | Verify |
|---|---|---|---|
| `review-od-1` | session store + candidates ledger: `lib/reviews.mjs`, `bee_reviews.mjs` (create/list/show/record/candidate), preflight fail-closed (A10), in-progress auto-exclusion (A6), scope immutability (R5) | — | `node skills/bee-hive/templates/tests/test_lib.mjs` |
| `review-od-2` | derived coverage/staleness engine (git rev-list, degrade ladder), `status` verb, A7/A8 mechanics | review-od-1 | same |
| `review-od-3` | `bee_status.mjs` review block + §9 wording, retire Gate-4-pending warning, candidate-aware `recommended_next`, R7 high-risk line | review-od-1,2 | same |

All three are `behavior_change: true`. Files bounded to `skills/bee-hive/templates/{lib/reviews.mjs,
bee_reviews.mjs,bee_status.mjs,tests/test_lib.mjs}` + byte-identical `.bee/bin` siblings. No prose files
in this slice. Tier left to the orchestrator at dispatch (decision 0016).

**Slice 1 outcome (2026-07-12):** review-od-1..3 capped clean — verify 206/0 + onboard PASS, judges
intact, zero reservation leaks. Commits `cc1c34d`, `e4f51a2`/`ac33c75`, `da2e165`/`73b3654`.

## Current slice (slice 2) — cells

| Cell | Scope | Deps | Verify anchor |
|---|---|---|---|
| `review-od-4` | `bee-reviewing` SKILL.md + reference → user-invoked review session (R1/R4/R5/R8/R9, flows 7.2–7.5); panel/severity/synthesis contract untouched (goal 5); skill drives `bee_reviews.mjs` verbs | — | retired auto-trigger gone; skill references bee_reviews.mjs |
| `review-od-5` | chain handoffs: `bee-swarming` final-slice + small-lane → scribing; `bee-scribing` chain note; `bee-compounding` close = `candidate add` + §9 line + truthful unreviewed (R3, 7.1) | — | `bee-reviewing` token gone from swarming; compounding carries candidate add |
| `review-od-6` | `bee-hive` SKILL.md + routing-and-contracts + go-mode + AGENTS.block.md + repo AGENTS.md + docs/03-workflow.md: chain diagram, Gate 4 = session-only (R8), merge/ship guard row (7.4/A9), high-risk warning (R7), lanes review column → on demand | — | AGENTS block chain no longer routes execution → reviewing; onboard suite green |
| `review-od-7` | repo-root removal census (bare-token variants, archaeology excluded) + stray fixes; test_lib census checks (self-match-safe patterns per 20260712); `reports/uat-scenarios.md` covering A1–A12 evidence map | 4,5,6 | census tests green; scenarios file exists |

Cells 4/5/6 have disjoint file sets → one parallel wave; cell 7 sweeps after. Slice-2 cells are prose
(`behavior_change: false` — observable runtime behavior shipped in slice 1; prose cells still verify via
the suite + format greps).
