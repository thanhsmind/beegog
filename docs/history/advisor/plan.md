---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: standard
---

# Plan: Advisor (worker-level on-failure consult)

Mode: `standard` — 3 risk flags: external systems (CLI/nested-process consult transport), existing covered behavior (resolver + the SKILL.md:68 two-attempts contract are test-covered today), multi-domain (lib code + config schema + two skills' prose).
Why this is the least workflow that protects the work: one story-sized behavior across lib + prose; no hard-gate flag (no auth/data/security surface; the cli dispatch kind already exists per decision 0019 — this feature only adds a consumer of it). Smaller modes fail honesty: >3 files and a covered contract is being amended.

## Requirements (from CONTEXT.md)

- D1: worker-level, on-failure consult only — inside the worker's turn; ladder structurally unchanged; de967733 amended (owner Q1 answer recorded), advisor mode of 0013 stays retired.
- D2: `models.<runtime>.advisor` slot (review-slot precedent 0021; string | {model, effort} | {kind:"cli", command} per 0019). Decision 0015 untouched. Degenerate baseline = the consulting worker's own model; unset or not-stronger → skip. No generation fallback.
- D3: trigger = first serious failed verify attempt; mandatory evidence bundle; canonical loop fail 1 → consult 1 → advised retry → (fail) → consult 2 → final retry → `[BLOCKED]`; max 2 consults/cell; authority-type blocks stay instant-`[BLOCKED]`.
- A1 advice-only/read-only · A2 consults recorded per cell · A3 swarming workers only · A4 headless rule unchanged.

## Discovery

L1 — repo precedent covers nearly everything; findings verified by direct inspection 2026-07-13:

- Slot machinery: `CONFIGURABLE_SLOTS = [...CONFIGURABLE_TIERS, 'review']` (templates/lib/state.mjs:71), `normalizeModels` loops it (:165–167), `resolveTier` types string/{model,effort}/{kind:cli} (:362–380). The advisor slot copies this shape — L0 for the config side.
- Review-slot fallback (:368–370) is exactly what advisor must NOT do (per D2): a null advisor slot means "no advisor", never "fall back to generation". `resolveTier('advisor')` today would land in the `s = 'generation'` coercion (:366) — a dedicated `resolveAdvisor` avoids contaminating `resolveTier`'s covered behavior.
- Stale-key tolerance: `readConfig` strips only the **top-level** `advisor` key (:305); the nested `models.<rt>.advisor` slot never collides. `STALE_ADVISOR_KEY_WARNING` copy (:326) should say "top-level" to stop confusing the two.
- **The one real unknown (MEDIUM):** consult transport from inside a worker. Workers are runtime subagents and may not carry the Agent tool; the robust path is a headless runtime-CLI call from the worker's shell (`claude -p --model <advisor>` for model-shaped slots; the configured command for cli-shaped slots), precedented by the External Executors protocol (decision 0019). Whether nested Agent dispatch also works is a validating proof, not a plan assumption.

## Approach

**Recommended path:** (1) config + resolver: accept the `advisor` slot in `normalizeModels`, add `resolveAdvisor(root, runtime)` → `null` (unset/invalid) | `{type:'model',...}` | `{type:'cli',command}` — no budget type, no fallback (per D2); fix the stale-key warning copy; tests RED-first beside the review-slot rows. (2) worker-side protocol prose in bee-executing: trigger, evidence bundle, canonical loop, budget, authority-block carve-out, advice-only conduct, consult record in the report (per D3/A1/A2). (3) orchestrator-side prose in bee-swarming + swarming-reference: dispatch template gains an "Advisor" line only when the orchestrator's degenerate check passes (advisor stronger than the worker's resolved model, per D2 — the orchestrator decides at dispatch, the worker never self-assesses identity); ladder gains the budget-already-spent note.

**Rejected alternatives:**
- Advisor as a 4th tier in `MODEL_TIERS` — collides with decision 0015's tier vocabulary and tier_mix accounting; a slot beside `review` is the established shape.
- Orchestrator-mediated consult (worker returns, orchestrator consults, re-dispatches) — that already exists as the rescue ladder; D1 explicitly wants the consult inside the worker's turn.
- Reusing `resolveTier` with a special case — spreads advisor semantics into a function whose current behavior is pinned by tests; a sibling resolver is smaller.

**Risk map:**

| Component | Risk | Reason | Proof needed |
|---|---|---|---|
| `normalizeModels` + `resolveAdvisor` (lib/state.mjs) | LOW | copies the review-slot pattern, RED-first tests | `node skills/bee-hive/templates/tests/test_lib.mjs` |
| Worker consult transport (headless CLI from worker shell) | MEDIUM | nested `claude -p` inside a Claude Code worker session is unproven here (env inheritance, auth, cwd) | validating: run a one-shot `claude -p --model haiku` from a dispatched worker context and quote output; also probe whether workers carry the Agent tool |
| Advisor reply enters worker context | MEDIUM | cross-provider CLI output is external content | prose rule: advice is a suggestion — worker still runs the real `verify`, never pastes advice into state/commits unexamined; matrix row below |
| SKILL.md:68 amendment | LOW | prose change, census-test guarded phrasing | census rows in test_lib.mjs stay green |
| templates ↔ .bee/bin byte-parity | LOW | existing parity test enforces dual-write | same test suite |

**Files and order:** `skills/bee-hive/templates/lib/state.mjs` + `.bee/bin/lib/state.mjs` (byte-identical) + `skills/bee-hive/templates/tests/test_lib.mjs` → `skills/bee-executing/SKILL.md` → `skills/bee-swarming/SKILL.md` + `skills/bee-swarming/references/swarming-reference.md`.

**Relevant learnings:** critical pattern 20260708 (MSYS /tmp invisible to node — evidence bundles pipe via stdin, never /tmp paths); decision 0016 (orchestrator judges tier at dispatch — the degenerate check lands there for the same reason); decision 29b7f7bb (external finish contract — cli-advisor consult reuses its output-capture discipline).

**Questions for validating:**
1. Does a headless `claude -p --model <m>` call succeed from inside a dispatched worker (auth/env inherited)? What is the fallback when it fails at runtime (treat as consult spent or as transport error → proceed to `[BLOCKED]` without burning budget)?
2. Do workers carry the Agent tool in this runtime? (If yes, model-shaped advisors could dispatch via Agent and land in dispatch.jsonl for free — preferred for A2; if no, the CLI path is the only transport.)
3. Does the bee-model-guard hook see worker-originated dispatches (for the dispatch-log record), or does the consult record live only in the worker report?

## Shape

Single slice — the work has one demoable outcome (a stuck worker consults and recovers, or exhausts budget and blocks exactly as today). No phases forced onto it.

| Slice | What changes | Demo | Proof |
|---|---|---|---|
| advisor-consult | advisor slot resolvable; bee-executing consult loop; bee-swarming dispatch line + ladder note | configure `advisor: "opus"`, dispatch a worker at generation tier with a failing verify, watch consult 1 → advised retry in the report | test_lib.mjs slot rows green + one live dogfood dispatch during UAT |

Cell outline (created only after Gate 2): adv-1 resolver+tests · adv-2 bee-executing protocol · adv-3 bee-swarming dispatch/ladder prose. adv-2/adv-3 depend on adv-1 (prose cites the resolver's exact names).

## Test matrix (one pass over the 12 dimensions, standard depth)

1. User types — n/a (agent-internal); the "user" is the worker tier: extraction and generation workers both get the dispatch line; ceiling worker never does (always degenerate).
2. Input extremes — advisor slot: `null`, missing, `""`, junk object, `{kind:"cli"}` without command → all resolve to `null` (skip), never throw.
3. Timing — advisor CLI hangs: consult must carry a timeout discipline (reuse external-executor finish contract); a hung consult is a spent consult.
4. Scale — budget boundary: consults 1, 2, and the refused 3rd (quota 2 → test 1/2/3 per dimension 12).
5. State transitions — consult after `[BLOCKED]` already returned: prohibited (budget is per-claim, inside the turn); re-dispatched cell (rescue rung 1) gets a fresh budget — stated explicitly in prose.
6. Environment — Windows Git Bash: evidence bundle piped via stdin, never /tmp file paths (critical pattern 20260708).
7. Error cascades — advisor errors (CLI non-zero, model refuses): transport error ≠ advice; does not burn budget more than once; worker proceeds toward `[BLOCKED]` normally, never retry-storms the advisor.
8. Authorization — advisor never approves gates/installs; authority blocks bypass the consult entirely (D3); advice conflicting with a locked D-ID → `[BLOCKED]` citing both (A1).
9. Data integrity — no state writes from the consult path; record lives in the worker report (+ dispatch log if the hook sees it); templates ↔ .bee/bin byte-parity preserved.
10. Integration — stale top-level `advisor` key coexists with a nested advisor slot: warning still fires for the top-level key only, slot still resolves; census test stays green (no retired-phrasing regression).
11. Compliance — evidence bundle may carry code excerpts to an external CLI advisor: bundle rule limits content to the failing command, output, diagnosis, and cited file excerpts — never secrets/env; secrets-read guard already blocks workers from reading them anyway.
12. Business logic — degenerate comparison: the deterministic core is same-model-name → skip and ceiling worker → skip; beyond that it is orchestrator judgment at dispatch (decision 0016), guided by the known claude order (haiku < sonnet < opus) with an owner-configured advisor otherwise presumed stronger. advisor == session model but worker is down-tier → consult happens (D2's explicit case).

## Current slice

**advisor-consult** — entry state: no advisor slot exists, workers block after two failures. Exit state: `resolveAdvisor` resolves the slot (tests green), bee-executing carries the consult loop, bee-swarming dispatches the Advisor line and notes the spent budget. Files bounded per cell below. Verify: `node skills/bee-hive/templates/tests/test_lib.mjs` (+ anchor greps per cell). Transport judgment stays with the orchestrator: the dispatch's Advisor line carries the exact transport command; the worker runs what it is given, evidence bundle via stdin.

## Cells

- `adv-1` — advisor slot in normalizeModels + `resolveAdvisor` + RED-first tests + stale-key warning copy (lib, dual-write templates/.bee/bin)
- `adv-2` — bee-executing consult protocol (D3 loop, evidence bundle, authority carve-out, Consults report section, line-68 amendment) — deps: adv-1
- `adv-3` — bee-swarming dispatch-time degenerate check + Advisor line in the worker template + ladder budget note — deps: adv-1, adv-2

## Out of scope

- Gate-time or orchestrator-level consults (retired advisor mode) — D1.
- Advisor pre-cap review for high-risk cells — declined at D1, lives in CONTEXT Deferred Ideas.
- Aggregate consult metrics in bee_status/tier_mix — v1 records per cell (report + dispatch log); surfacing is a future backlog row if dogfood wants it.
- tiny/small lanes — no workers there (A3).
