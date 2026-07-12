# Validation report — review-on-demand, slice 2 (workflow prose re-wiring)

Cells: review-od-4..7 · Lane: standard · Plan: `docs/history/review-on-demand/plan.md` §Current slice (slice 2)

## Reality gate

| Dim | Verdict | Evidence |
|---|---|---|
| MODE FIT | PASS | same standard lane as slice 1; prose-only cells, `behavior_change: false` (runtime behavior shipped in slice 1) |
| REPO FIT | PASS | every prescribed CLI verb/flag verified against shipped `bee_reviews.mjs` by both reviewers (create --file/--stdin, record --id --kind {manifest,preflight,finding,uat,decision}, candidate add --feature/--head/--mode required) |
| ASSUMPTIONS | PASS | verify greps dry-run both-directional against current text (retired wording present now → can fail; anchors absent now → can pass only after work) |
| SMALLER PATH | PASS | 4 cells: 3 disjoint parallel + 1 census sweep — the census cell exists because critical pattern 20260711 demands invariant-verified removals |
| PROOF SURFACE | PASS | suite 206/0 + onboard PASS at baseline; each verify runnable, `-e`-guarded where a pattern leads with a dash |

## Plan-checker (opus) — ITERATE → closed mechanically

1. **[BLOCKER]** cell 5 whole-token verify unsatisfiable vs its own untouched-protocol rule (swarming line 45 frozen-judge escalation). **Fixed:** action now names all four occurrences; line 45 reword explicitly granted with meaning-preserving text; verify unchanged and now satisfiable.
2. **[BLOCKER]** `docs/04-skills-spec.md:72` + `docs/05-roadmap.md:20,46` carry retired wording, unowned. **Fixed:** both added to cell 7 files + named known carriers.
3. **[BLOCKER]** repo `AGENTS.md:31` stale arrow uncaught (onboard suite checks tmp fixtures only, never repo AGENTS.md). **Fixed:** cell 6 verify appends `! grep -F -e "-> bee-reviewing" AGENTS.md`; action states hand-mirroring inside the markers is mandatory.
4. **[WARNING]** census would self-match slice-1 test fixtures (`test_lib.mjs:4577/4584`). **Fixed:** census scope redefined to prose surfaces; fixtures explicitly excluded and documented legit.
5. **[WARNING]** carrier list over/under-inclusive. **Fixed:** carrier list re-derived from live grep; legit mentions enumerated as do-not-reword (swarming-reference:37 review-slot, routing row, bee_status negation, workflow-state phase vocab per §11.4).

## Cell review (cold pickup, opus) — FIX-FIRST → all CRITICALs fixed

- **[CRITICAL, cell 5]** = checker 1 (corroborated). Fixed as above.
- **[CRITICAL, cell 7]** = checker 2 (corroborated, exact quote at docs/04-skills-spec.md:72). Fixed as above.
- **[MINOR, fixed]** cell 4: `lib/reviews.mjs` added to read_first (scope entry shape `{type: cell|feature|commit, id, reason?}` lives in normalizeScopeEntry); `record --id <id> --kind manifest` corrected.
- **[MINOR, fixed]** cell 6: hand-mirror requirement stated (onboarding never regenerates source-repo AGENTS.md); arrow-form ban extended to unicode arrows in the action.
- **[MINOR, noted]** cell 6 arrow grep is a proxy — semantic intent is enforced by cell 7's census + census tests (defense in depth), recorded here rather than over-engineering the verify.
- **[MINOR, fixed]** cell 7: docs/11-implement-plan-adoption.md:115 added to files + carriers.

Both reviewers independently converged on the same two defects (cell-5 verify conflict, docs/04 stray) — corroboration, mechanical-close precedent `d2788ac9`/`c05613d9`.

## Verdict

**READY** — approval covers slice 2 only (review-od-4..7). Wave plan: 4/5/6 parallel (file sets verified disjoint by checker), 7 after all three cap.
