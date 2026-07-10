---
feature: evolving-loop
pbi: P18
lane: high-risk
status: Shipped
slice: B (the skill)
rendered_from:
  - docs/history/evolving-loop/plan.md (revision 3)
  - docs/history/evolving-loop/approach.md
  - decision 8cd4c84e (D2 allowlist), decision ff26725d (full Iron Law)
---

# Implement Plan — evolving loop, slice B

> Projection of the truth artifacts. Truth lives in [`plan.md`](./plan.md) (revision 3),
> [`approach.md`](./approach.md), and the cited decisions. Feedback on this brief flows back into
> those first, then this re-renders. Slice A's shipped record is
> [`walkthrough.md`](./walkthrough.md); this document covers only slice B.

## Review Status

| Gate | State |
|---|---|
| 1 — context | carried from the feature (decisions D1–D5 locked; D2 superseded to the allowlist by `8cd4c84e`) |
| 2 — shape | **Approved** — owner, at this document (2026-07-10). Rider: validating configures a real dogfood repo (anphabe-gogl) and generates its digest, so corroboration is measured on real foreign data |
| 3 — execution | **Approved** — owner, 2026-07-10, on `reports/validation-slice-b.md` (READY WITH CONSTRAINTS) |
| 4 — review | **Approved** — owner, 2026-07-10, UAT 3/3 pass; merge with 2 acknowledged open P1s (decision `c75fed88`, backlog-filed); record `reports/review-slice-b.md` |

Slice A (data plane): **shipped** — evolving-1..8 capped, 110 tests green, commit `86aa168` latest.

## Goal / Success

Bee reads the friction it has already collected and ships itself an improvement — with a human
approving **what** to fix (Gate A) and **the diff that fixes it** (Gate B), and a push that is never
automatic (D5).

Slice B succeeds when: `bee-evolving` exists and refuses to run anywhere but the bee repo (D3);
`bee_feedback.mjs rank` turns the merged digest into a deterministic ranked cluster list; the
skill's loop (cluster → rank → Gate A → Iron Law hand-off per D4 → suites green → Gate B → push)
is pressure-tested RED-first; P18 flips to done at version `0.1.19`.

## Current State (what slice A left behind)

- A real digest exists: **33 entries** (11 finding, 7 friction, 5 proposal, 5 outcome, 3 learning,
  1 blocked, 1 deviation), 0 dropped, pain 27×1 / 5×2 / 1×3. Titles carry usable Gate-A signal.
- `dogfood_repos` is **null** — no foreign repo has produced a digest, so `corroboration` has zero
  real data today (`[R4]` confirmed).
- The **datamark trap** is armed: foreign titles are stored wrapped (`«…»`), local titles bare, and
  `datamark` double-wraps on re-merge. Naive title-equality clustering never unifies across repos.
- `mergeDigests` (D2b) already revalidates and wraps every foreign field — the security boundary
  slice B consumes is in place and tested.

## Scope

**In:** `normalizeTitle` / `clusterEntries` / `rankClusters` in `lib/feedback.mjs`; a `rank`
subcommand in `bee_feedback.mjs`; the `bee-evolving` skill; hive routing row; `07-contracts.md`,
`config-reference.md`, `docs/decisions/0022-evolving-loop.md`; backlog P18 → done; version `0.1.19`.

**Out (answered by the corpus):** a "fetch the full entry" escape hatch — real titles plus the
`source` field (a cell id or bee-owned path the human can open) are sufficient Gate-A signal.

**Out (permanently, unchanged):** auto-applying a ranked fix; pushing without Gate B; digests
leaving the machine; `bee-evolving` reading a host repo's raw `.bee/`.

## Proposed Approach

From `plan.md` revision 3. The ranking is defined against the measured corpus, not the documented
schema — the exact failure that forced revision 2 is not repeated.

- **Cluster key** = fixed-point strip of the `«…»` wrapper, then casefold + whitespace collapse.
  Stored entries stay wrapped (D2b intact); only the comparison key is stripped. *Rejected
  alternative:* moving `datamark` to render time — reopens slice A's merge contract and its 20+
  assertions for a problem the comparison key solves locally.
- **`rank` = pain(max) × frequency(cluster size) × corroboration(distinct repos)**, tie-broken by
  earliest `first_seen` then key lexicographic — byte-identical over a pinned digest.
- **`corroboration` ships defined-but-inert**: unit-tested with synthetic foreign digests, measured
  against real data the day a dogfood repo ships a digest (a validating question, not an
  assumption).

## Technical Design

**Flow.** The user invokes `bee-evolving` in the bee repo. The skill first proves it is in the bee
repo (D3 guard — refuses elsewhere), then runs `bee_feedback.mjs rank`, which calls
`mergeDigests` over `dogfood_repos` + the local digest and feeds the merged view to
`clusterEntries` → `rankClusters`. Gate A renders the top clusters — a representative **stored**
title (datamark-wrapped exactly as stored for foreign entries; the stripped cluster key is an
internal handle and never reaches a prompt), rank terms, contributing `source` ids — and the human
picks what to fix (or stops). The chosen item is handed to
`bee-writing-skills` under the full Iron Law (D4, decision `ff26725d`): failing pressure test first,
then the fix, then suites green. Gate B shows the human the complete diff; only an explicit
approval leads to a push, and the push itself is a named manual step (D5).

**Data shape.** A cluster is `{key, entries[], pain, frequency, corroboration, rank}` — computed,
never stored; the digest file keeps its slice-A schema untouched. Rank output is a pure function of
the merged view.

**Prompt surface.** Everything Gate A renders originates from digest fields that `mergeDigests`
already revalidated and datamarked (D2b). The skill adds no new raw-text path from a foreign repo
into a prompt.

## Security / Permissions (mandatory — high-risk)

- **Self-modification is human-gated twice.** Gate A bounds *what* may change; Gate B reviews the
  *diff*; the push is never automatic (D5). No step of the skill writes source before its Iron Law
  RED exists (D4).
- **Bee-repo-only (D3), enforced not narrated:** the guard is a pressure-tested refusal, written
  RED-first, not a sentence in prose.
- **Never dispatched to an external CLI executor** (decision 0019): self-modifying and
  destructive-adjacent work stays on native tiers where the orchestrator's goal-check applies.
- **The trust boundary stays at `mergeDigests` (D2b).** The skill consumes only the merged,
  revalidated, datamarked view. It never opens a foreign repo path itself.
- The four RED pressure scenarios are enumerated in the cell spec (bee-repo guard refusal, Gate-A
  skip, Gate-B skip, auto-push attempt) so "RED first" is checkable, not asserted.

## Affected Files

Projected from `plan.md` revision 3 (cells do not exist yet; re-projected from cell `files` after
Gate 2 prep).

| File | Change |
|---|---|
| `skills/bee-hive/templates/lib/feedback.mjs` | `normalizeTitle`, `clusterEntries`, `rankClusters` |
| `skills/bee-hive/templates/bee_feedback.mjs` | new `rank` subcommand (thin, no business logic) |
| `skills/bee-hive/templates/tests/test_lib.mjs` | slice B test-matrix rows (trap, corroboration, determinism, non-cluster) |
| `skills/bee-evolving/SKILL.md` | **new** — the gated loop |
| `skills/bee-hive/SKILL.md` + routing reference | one routing row (skill edit → full Iron Law) |
| `docs/07-contracts.md`, `docs/config-reference.md` | contract + config surface for `rank` / `bee-evolving` |
| `docs/decisions/0022-evolving-loop.md` | the feature's decision record |
| `docs/backlog.md` | P18 → done |
| version constant consumed by onboarding | `0.1.18` → `0.1.19` (same file previous bumps touched) |

## Implementation Steps

Projected from the created cells `evolving-9/10/11` (authoritative). Only `evolving-9` is ready;
the rest unlock as their deps cap.

1. **`evolving-9` (standard, no deps)** — ranking lib + `rank` CLI, tested against the real digest
   snapshot and synthetic foreign digests (wrapped / bare / double-wrapped titles must unify).
2. **`evolving-10` (high-risk, deps: 9)** — `bee-evolving` SKILL.md under the full Iron Law; the
   four pressure scenarios RED before any skill content; never external-dispatched.
3. **`evolving-11` (standard, deps: 10)** — routing row, contracts + config docs, decision 0022,
   backlog flip, version bump.

## Validation Plan

**Validated 2026-07-10 — READY WITH CONSTRAINTS.** Full evidence:
[`reports/validation-slice-b.md`](./reports/validation-slice-b.md) — reality gate 5/5 PASS,
feasibility matrix 8/8 verified, adversarial plan-check STRUCTURALLY CLEAN after 2 blockers fixed
(Gate A renders stored wrapped titles, never the stripped key; routing Iron-Law evidence owns its
report), cell review 0 CRITICAL. The Gate 2 rider is executed: anphabe-gogl's real digest (59
entries, 0 dropped) merges live — every foreign title wrapped, cross-repo collisions today 0, so
corroboration ships measured-inert (constraint C2). Baseline: 110/110 + onboarding PASS, re-run
with `dogfood_repos` configured.

- Cells verify with the recorded command:
  `node skills/bee-hive/templates/tests/test_lib.mjs && node skills/bee-hive/scripts/test_onboard_bee.mjs`
- The suite must gain the slice B matrix rows: empty digest → `[]`; `«same title»` + `same title` →
  one cluster (and `««double»»` unifies); corroboration 2 with a synthetic foreign repo, 1 when
  disjoint; byte-identical rank over a pinned digest with tie-break fixtures; distinct titles never
  falsely unify.
- `evolving-10`'s RED evidence: each of the four pressure scenarios recorded failing before
  SKILL.md content exists, then GREEN after.
- Open validating question: configure a real dogfood repo (e.g. anphabe-gogl) and generate its
  digest, so `corroboration` and the trap test run against real foreign data at least once.

## Risks & Mitigation

| Component | Risk | Mitigation / proof at validating |
|---|---|---|
| Datamark trap — nothing ever clusters cross-repo | **HIGH** (silent) | Fixed-point strip in the cluster key + an explicit unification test with wrapped/bare/double-wrapped fixtures |
| Self-modifying loop drifts past its gates | **HIGH** | Gate A + Gate B human stops; Iron Law RED-first with the four scenarios enumerated; push never auto (D5) |
| `corroboration` believed meaningful with one repo | MEDIUM | Shipped defined-but-inert, stated in docs; real measurement deferred to a configured dogfood repo |
| Ranking non-determinism | MEDIUM | Pure function over the merged view; pinned-digest byte-identity test; explicit tie-break |
| Routing/skill edits regress the hive | LOW | Full Iron Law on every SKILL.md edit (decision `ff26725d`); suites stay the cap gate |

## Rollback Plan

Slice B adds a skill and pure functions; it migrates nothing and holds no state.

1. `git revert` the slice's cell commits (each commits with its cell id; the set is exact).
2. Delete `skills/bee-evolving/` — no other component references it except the routing row, which
   the revert removes.
3. Revert the version constant to `0.1.18`; re-run the verify command to confirm the suite returns
   to the 110-assertion baseline.
4. The digest and `dogfood_repos` are slice A surface and are untouched by a slice B rollback.

No host project can be affected: every slice B artifact lives in the bee repo and runs only there
(D3).

## Open Questions

1. Is slice B's "WSL deploy" a scripted step or the existing manual copy into `~/.claude/skills/`?
   *(Plan assumes: named, not scripted. Resolve at validating, before Gate 3.)*
2. ~~Should validating configure `dogfood_repos` → anphabe-gogl?~~ — **RESOLVED at Gate 2: yes.**
   Validating configures it and generates that repo's digest, so corroboration and the trap test
   run against real foreign data at least once.
3. `.bee/feedback-digest.json` gitignore posture in host repos — carried from slice A, still
   assumed "bee never touches the host's gitignore".
