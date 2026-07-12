# Acceptance evidence map — review-on-demand (SPEC A1–A12)

Source of truth: `docs/history/review-on-demand/SPEC.md` §10 (scenario texts) and §13 (definition of done —
"A1–A12 either have automated evidence, or, for UAT-only behavior, a recorded kickstarted scenario").
Decision: `565e68d0-327f-404e-b49e-d1c61ba81bfd`.

Two evidence classes are used, per SPEC §13:

- **Mechanical** — a named, currently-passing test in `skills/bee-hive/templates/tests/test_lib.mjs`. These
  cover scenarios whose behavior is a pure function of stored records (candidate ledger, session file,
  derived status) and can be proven without spawning an agent.
- **UAT-recorded** — a step-by-step script (setup state / user utterance / expected observable bee
  behavior / the §9 line expected) for scenarios that are agent-dispatch behavior (whether a reviewer wave
  is spawned, whether a gate is asked) and cannot be exercised as a unit test. This split matches
  `plan.md`'s test-matrix sketch and this cell's own action text (A6/A7/A8/A10 mechanical; A1–A5, A9, A11,
  A12 UAT-recorded).

No test name below is invented — every mechanical row names a `check(...)` title that exists verbatim in
`skills/bee-hive/templates/tests/test_lib.mjs` and passed in this session's verify run.

## Evidence map

| # | Scenario (short) | Type | Evidence |
|---|---|---|---|
| A1 | Tiny task: no reviewer spend at close | UAT-recorded | Script A1 below |
| A2 | Standard feature: no auto-review either | UAT-recorded | Script A2 below |
| A3 | High-risk: warns, never auto-runs | UAT-recorded (+ mechanical support) | Script A3 below; mechanical support: `bee_status.mjs: a high-risk unreviewed candidate renders the prominent R7 warning line, and a repo with only non-high-risk candidates renders no such line` and `bee_status.mjs: a standard-mode candidate never triggers the R7 high-risk warning line, even when unreviewed` |
| A4 | Explicit single-feature review | UAT-recorded | Script A4 below |
| A5 | Explicit batch review, cumulative diff | UAT-recorded | Script A5 below |
| A6 | In-progress work excluded from scope | Mechanical | `createReview: A6 auto-excludes an open/claimed included cell with reason "in progress", never silently reviewed-in` |
| A7 | No re-review of an unchanged, already-covered range | Mechanical | `bee_reviews.mjs status: --json renders verified + four-label counts and per-candidate coverage, "reviewed (covered by <id>)" answers A7` |
| A8 | Coverage flips to stale after a post-head commit | Mechanical | `deriveCandidateStatus: an approved session covers the candidate's exact head as "reviewed"; one extra commit after that head flips the SAME candidate to "review stale" while the session file stays byte-unchanged (A8)` |
| A9 | Merge/ship/release is not a silent review trigger | UAT-recorded | Script A9 below |
| A10 | Verification still fails closed before reviewer spend | Mechanical | `createReview: A10 fails closed — a behavior_change cell with no verification_evidence refuses create and writes NO session file` and `bee_reviews.mjs create exits non-zero and writes nothing when the A10 preflight fails` |
| A11 | P1 blocks review session approval | UAT-recorded | Script A11 below |
| A12 | Localized P1 fix doesn't force a full-batch re-run | UAT-recorded | Script A12 below |

Census evidence supporting A1–A3's textual guarantee (that no live surface still *tells* the agent to
auto-dispatch) is this cell's own tests: `census: retired auto-review-trigger phrasing is absent from every
live prose surface...` and `census: the on-demand review contract carries its required anchors...`. These
prove the wording is gone/present; they are not a substitute for the UAT scripts below, which prove the
*runtime behavior*.

## UAT scripts

### A1 — Tiny task produces zero reviewer dispatch

- **Setup:** a `tiny`-lane feature with one cell already capped (verify passed, evidence recorded via
  `bee_cells.mjs cap`); phase about to move through `bee-scribing` → `bee-compounding`.
- **User utterance:** none about review — the user simply lets the session continue (or says something
  unrelated, e.g. "ok, what's next").
- **Expected observable behavior:** no `bee-reviewing` invocation, no Gate 4 question is ever asked;
  `bee-compounding` runs `bee_reviews.mjs candidate add --feature <feature> --head <sha> --mode tiny` and
  the feature closes as `unreviewed`.
- **§9 line expected:** `bee_status.mjs`'s text render carries — `Completed and verified; independent
  review not requested; 1 candidate(s) awaiting review.` (`skills/bee-hive/templates/bee_status.mjs`) and
  `bee-compounding` posts the spoken completion line: "Completed and verified: 1 cell. Independent review
  not requested; the change set was added to review candidates." (`skills/bee-compounding/SKILL.md`).

### A2 — Standard feature produces zero reviewer dispatch

- **Setup:** a `standard`-lane feature with several cells capped across one or more slices; execution
  work is done, no user review request was made at any point in the session.
- **User utterance:** none about review.
- **Expected observable behavior:** identical shape to A1 — the chain hands off `bee-executing` →
  `bee-scribing` → `bee-compounding` directly; no reviewer wave, no Gate 4, regardless of the larger cell
  count or `standard` lane.
- **§9 line expected:** same `bee_status.mjs` completed-and-verified render as A1, with the candidate count
  matching the feature's actual cell/candidate count (not fixed at 1).

### A3 — High-risk candidate warns but never auto-runs

- **Setup:** a completed, verified feature whose closing `candidate add` recorded `--mode high-risk`
  (hard-gate content: auth/authorization/data-loss/security/external-provider/migration); no review
  session has been requested.
- **User utterance:** none about review — user proceeds to a normal follow-up request.
- **Expected observable behavior:** `bee-hive`'s session scout surfaces the R7 warning prominently (never
  silently); no reviewer is spawned and nothing is labeled `reviewed`/`approved`.
- **§9 line expected:** `⚠ High-risk unreviewed: 1 high-risk candidate(s) have not passed independent
  review — bee will not auto-dispatch reviewers; request review before merge/release.`
  (`skills/bee-hive/templates/bee_status.mjs`, pinned exactly by the mechanical test cited in the table).

### A4 — Explicit single-feature review

- **Setup:** feature A is completed, verified, and `unreviewed` (a review candidate exists for it).
- **User utterance:** "review feature A."
- **Expected observable behavior:** `bee-hive` routes to `bee-reviewing` (routing table: "Review request
  (explicit...)" → `bee-reviewing`). `bee-reviewing` resolves scope to feature A's completed content only,
  runs `bee_reviews.mjs create` (A10 preflight), shows the scope preview (covered cells, baseline/head,
  expected reviewer count/tier) per "Scope Freeze and Preview" (`skills/bee-reviewing/SKILL.md`) *before*
  any reviewer is dispatched, then runs the full specialist wave, severity/synthesis, and asks Gate 4.
- **§9 line expected:** the scope preview follows §9's "Trước một review batch" shape — feature/cell list,
  baseline/head, expected reviewer count and tier, exclusions — rendered in English per house style (no
  single pinned string; content-shape checked against `skills/bee-reviewing/SKILL.md` "Scope Freeze and
  Preview" §3).

### A5 — Explicit batch review across multiple features

- **Setup:** features A, B, and C are all completed/unreviewed (candidates exist for each); no feature is
  currently claimed/in-progress.
- **User utterance:** "review everything from today" (or an equivalent named-batch request).
- **Expected observable behavior:** `bee-reviewing` resolves the matching candidates via
  `bee_reviews.mjs candidates`/`status`, builds ONE cumulative diff spanning A+B+C with a mapping from
  each diff region back to its source feature/cell (SPEC 7.3), shows the batch preview, then dispatches
  the panel once over the cumulative diff (not once per feature) so interaction bugs between the three
  changes are visible to the reviewers.
- **§9 line expected:** matches SPEC §9's "Trước một review batch" template, e.g. "Preparing to review 3
  features / N cells, from `<baseline>` to `<head>`. Expecting 4 core reviewers + K conditional. Excludes
  <M> cell(s) still in progress."

### A9 — Merge/ship/release request is never a silent review trigger

- **Setup:** at least one completed, verified, `unreviewed` (or `review stale`) candidate exists; no
  review session is open.
- **User utterance:** "merge this" / "ship it" / "let's release."
- **Expected observable behavior:** `bee-reviewing` is NOT dispatched. `bee-hive`'s routing contract fires
  instead: report the candidate count and risk level (`bee_reviews.mjs status`), then ask exactly ONE
  question. Only an explicit "yes" starts a session; silence or any other answer means no dispatch and the
  work stays labeled `unreviewed`.
- **§9 line expected:** the routing contract's pinned question — `"Create a review session for this
  scope?"` (`skills/bee-hive/references/routing-and-contracts.md`) — following a report of the
  unreviewed/stale count and risk level (SPEC 7.4/A9).

### A11 — A P1 finding blocks session approval until fixed and delta re-reviewed

- **Setup:** a review session is open (created via A4/A5-style flow), the specialist wave has returned at
  least one P1 finding, synthesis is complete.
- **User utterance:** none required — this is the gate's own behavior; alternately the user may say
  "approve merge" while the P1 is still open.
- **Expected observable behavior:** the session stays `blocked` — Gate 4 is never presented as "approve
  merge?" while P1 > 0. The P1 is fixed (own cell/cycle), its delta is re-reviewed and its defect class is
  swept, and only then does the session re-evaluate for approval (`skills/bee-reviewing/SKILL.md` §
  "Delta Re-review", "A session stays `blocked` (A11) until every P1's fix and delta re-review (§6)
  pass.").
- **§9 line expected:** Gate 4's P1-pending wording — `"P1 findings block merge. Fix before proceeding?"`
  (`skills/bee-hive/SKILL.md`, "The Four Gates") — never `"Review complete. Approve merge?"` while any P1
  remains open.

### A12 — A concrete, localized P1 fix does not force a full-batch re-run

- **Setup:** the same open session as A11; the P1 finding has a concrete, localized fix that does not
  cross a scope boundary, change a public contract, or destabilize an assumption the rest of the batch
  relied on.
- **User utterance:** none required — this is the reviewer/orchestrator's own re-review policy after the
  fix lands.
- **Expected observable behavior:** only the fix's own delta is re-reviewed, and the defect class the P1
  represented is swept across the rest of the diff (A12) — the full panel is NOT re-dispatched for content
  that never changed. A full-panel re-run is proposed to the user only if the fix crosses a boundary,
  changes a public contract, or destabilizes an existing assumption.
- **§9 line expected:** no fixed §9 template line (7.2/7.3 already covered the initial preview); the
  invariant is behavioral, pinned in `skills/bee-reviewing/SKILL.md`: "A concrete, localized P1 fix that
  stays inside its own boundary only needs its own delta re-reviewed and its defect class swept (A12) — it
  does not force a full-panel re-run for content that never changed."
