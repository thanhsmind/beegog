# Validation report — evolving loop, slice B (evolving-9/10/11)

Date: 2026-07-10 · Lane: high-risk · Plan: `plan.md` revision 3 (implementation-ready) · Validator: session orchestrator (Fable) · Plan checker + cell reviewer: opus (`review` slot, decision 0021), background per decision 0017.

## Verdict

**READY WITH CONSTRAINTS** (constraints C1–C3 below). Gate 3 presented to the owner after the
plan-checker's re-verification of its two blockers.

## Reality gate

| Check | Result | Evidence |
|---|---|---|
| MODE FIT | PASS | high-risk inherited from the feature (self-modifying + push = hard-gate; plan.md mode-gate table, 7 flags). Slice B is the slice that edits and ships bee itself. |
| REPO FIT | PASS | CLI shape (`bee_feedback.mjs run()` switch, lines 77–110), lib + tests (110 green), skill discipline precedent (`reports/pressure-tests.md` `## RED / ## GREEN / ## REFACTOR` from evolving-4), routing table (`bee-hive/SKILL.md:61`). |
| ASSUMPTIONS | PASS | matrix below — 8/8 verified by code inspection or runtime probe; zero plausibility language. |
| SMALLER PATH | PASS | the A/B split already is the smaller path; 3 cells map 1:1 to the plan's deliverables; nothing gold-plated found by the checker beyond W8 (usage strings — folded in). |
| PROOF SURFACE | PASS | verify command runs green right now (110/110 + onboarding PASS, re-run with `dogfood_repos` configured); pressure-evidence format has an in-repo precedent. |

## Feasibility matrix

| # | Assumption | Risk | Proof | Evidence | Result |
|---|---|---|---|---|---|
| A1 | merged view carries per-repo identity for corroboration | blocks cell 9 | code | `feedback.mjs:692–698`: flat list keyed by `repo_label`; runtime probe returned `merged:[{repo_label:'anphabe-gogl',…}]` | VERIFIED |
| A2 | a real foreign digest can exist (Gate 2 rider) | blocks the rider | runtime | `buildDigest(gogl_root)` → 59 entries, 0 dropped, written to `anphabe-gogl/.bee/feedback-digest.json` | VERIFIED |
| A3 | datamark wrapper is exactly `«…»` | blocks normalizeTitle | code | `decisions.mjs:144–151`: `` return `«${cleaned}»` `` | VERIFIED |
| A4 | CLI accommodates a `rank` subcommand | blocks cell 9 | code | `bee_feedback.mjs:77–110` — `run(args)` switch with digest/count/collect cases | VERIFIED |
| A5 | version constant location | blocks cell 11 | code | `state.mjs:7` `BEE_VERSION = '0.1.18'`; `onboarding.json.bee_version` derives from it at onboard (`onboard_bee.mjs:155–156`, 643) — checker W5 resolved: no extra bump site | VERIFIED |
| A6 | routing table location + mirror surface | blocks cell 11 | code | `bee-hive/SKILL.md:61` + two tables in `references/routing-and-contracts.md` (roster + request-type) — mirror spots now enumerated in the cell | VERIFIED |
| A7 | RED-first pressure tests for a SKILL.md are practicable | blocks cell 10 | precedent | evolving-4: `pressure-tests.md` RED-before-content log + CREATION-LOG amendment | VERIFIED |
| A8 | corroboration measurable on real foreign data | rider | runtime | real merge: `repos_merged:1`, 59 foreign entries 100% datamark-wrapped, 0 dropped; **cross-repo key collisions today: 0** (with and without strip) — corroboration = 1 on the live corpus, `[R4]` reconfirmed; strip correctness therefore rests on the synthetic fixtures cell 9 requires | MEASURED |

## Gate 2 rider — executed

`dogfood_repos` → `[{path: /home/thanhsmind/projects/anphabe/anphabe-gogl, label: anphabe-gogl}]`
in `.bee/config.json`; that repo's digest generated with the slice A lib (59 entries, 0 dropped —
the same 59→59 lossless corpus slice A was proven on). `mergeDigests` run live over it: every
foreign title wrapped, nothing dropped, unknown-kind regression (evolving-6) absent on real data.

## Plan checker (adversarial, opus) — iteration 1: 2 BLOCKERS, 7 WARNINGS

- **B1 (security/coherence)** — plan wording had Gate A rendering the datamark-**stripped**
  cluster key, silently removing the D2b neutralization for any payload that evades
  `INJECTION_PATTERNS`. **Fixed:** Gate A renders stored still-wrapped titles; the stripped key is
  declared an internal, never-rendered handle (plan.md, brief, evolving-10 action/truths/key_links).
- **B2 (coverage/bounded-files)** — the routing row's Iron-Law evidence had no owned home (pointed
  into evolving-10's report "or a sibling"). **Fixed:** `evolving-11-routing-pressure.md` added to
  evolving-11's `files` and named in its action. (Also closes W9.)
- **W3** dual-location traversal of the merged view now explicit in evolving-9's action.
- **W4** `normalizeTitle` must replicate datamark's cleaning transforms; invariant
  `normalizeTitle(datamark(t)) === normalizeTitle(t)` added as a truth. Plan bullet updated.
- **W5** resolved by inspection (A5): `onboarding.json` derives its version — no cell change.
- **W6** → constraint C1 below + a CLI-entry `rank` test added to evolving-9's truths.
- **W7** stale `approach.md` lines (superseded D2 wording, dead ranking formula) marked superseded
  with decision IDs.
- **W8** usage/help strings added to evolving-9's action.

Iteration 2: blocker re-verification dispatched to the same checker; Gate 3 is presented only
with its CLOSED/CLEAN reply recorded below.

**Iteration 2 result:** B1 CLOSED, B2 CLOSED, all warnings landed — **VERDICT: STRUCTURALLY
CLEAN** (checker's verbatim reply in the addendum). The checker's residual W5 note ("confirm
onboarding.json regenerates from BEE_VERSION") is closed by matrix row A5's evidence:
`onboard_bee.mjs:155–156` derives it, 643/737 write it, 483 drift-checks it.

## Addendum — checker iteration 2, verbatim

> B1 CLOSED (evolving-10 action/truths/key_links now mandate Gate A renders a representative
> stored still-wrapped title and declare the stripped key an internal never-rendered handle;
> plan.md and implement-plan.md say the same; evolving-9 mirrors it lib-side), B2 CLOSED
> (evolving-11 files[] now owns evolving-11-routing-pressure.md and the action explicitly says
> "this cell owns that file; never write into evolving-10's report"), warnings landed: W3, W4,
> W6 (partial by design: skill-behavior verification still rests on the pressure report, as
> accepted), W7, W8, W9. VERDICT: STRUCTURALLY CLEAN.

## Cell review (cold pickup, opus) — 0 CRITICAL, 7 MINOR

All three cells PICKUP OK. All minors applied to the cell JSONs: merged-view shape note +
assertion-count wording (9), `bee-grooming` added to read_first (10), routing mirror spots
enumerated + route-collision disambiguation + `8cd4c84e` in decisions (11).

## Constraints (the "WITH CONSTRAINTS" part)

- **C1 — verify ≠ acceptance for cells 10/11 (checker W6).** The suite cannot execute a SKILL.md.
  The acceptance artifacts are the pressure reports (`evolving-10-pressure.md`,
  `evolving-11-routing-pressure.md`), RED-before-content, gated at bee-reviewing. The orchestrator's
  goal-check for these cells must read the reports, not just re-run the green suite.
- **C2 — corroboration ships measured-inert.** Real cross-repo collisions today: 0. The strip's
  correctness is carried by synthetic fixtures (cell 9 truths); docs (cell 11) must state the term
  is real-data-inert until a second repo shares a friction.
- **C3 — evolving-10 never dispatches to an external CLI executor** (decision 0019), and its
  frozen-judge surface (a skill that edits bee) makes the Gate B diff review non-negotiable.

## Approval block

Decision: **READY WITH CONSTRAINTS** → Gate 3 question to the owner. Approval covers slice B
(evolving-9/10/11) only; any further slice returns to planning.
