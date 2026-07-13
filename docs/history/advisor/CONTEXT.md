# Advisor Rescue Rung — Context

**Feature slug:** advisor
**Date:** 2026-07-13
**Exploring session:** complete
**Scope:** Standard
**Domain types:** RUN | ORGANIZE

## Feature Boundary

A stuck swarming worker gains an in-turn consult step: after its first serious failed verify attempt it may consult a configured, stronger-than-itself, advice-only "advisor" model (or external CLI) with an evidence bundle — max 2 consults per cell — before falling back to today's `[BLOCKED]` flow. The orchestrator's rescue ladder is unchanged except for knowing that an arriving `[BLOCKED]` already spent its consult budget. The feature ends there: no gate-time consults, no orchestrator-level advisor, no changes to tiny/small lanes, review flows, or the human gates.

## Locked Decisions

These are fixed. Planning must implement them exactly — cited, never reinterpreted.
Changing one requires the user, a new D-ID or an explicit supersession note, never
a silent edit.

| ID | Decision | Rationale (only if it changes implementation) |
|----|----------|-----------------------------------------------|
| D1 | The advisor exists **only as a worker-level, on-failure consult** — a step inside the worker's own turn, not a new orchestrator behavior. Decision de967733 ("Bee runs ONE cost pattern") is **amended, not reversed**: fan-out orchestration stays the default for every phase; there are no gate-time or orchestrator-level advisor consults (the retired advisor mode of decision 0013 stays retired). Amending de967733 was explicitly approved by the owner in this exploring session (2026-07-13, Q1 answer "Amend — rescue rung only"). | Avoids reversal churn on a decision the owner approved one day earlier; cost is incurred only on failure, so the advisor stays scarce by construction. |
| D2 | Advisor identity is a new **`advisor` slot in the `models` map** (per runtime), following the `review` slot precedent (decision 0021): accepts a model name, `{model, effort}`, or `{kind: "cli", command}` (decision 0019). Decision 0015 stands untouched — the ceiling **tier** is never configured; the advisor is a separate slot, not a tier. The degenerate baseline is the **consulting worker's own model**: when the slot is unset, or the advisor is not stronger than the worker itself, the consult is skipped and the worker proceeds to `[BLOCKED]` as today. An advisor equal to the session model is valid and non-degenerate for a down-tier worker. | Under the fan-out pattern the session is already the strong orchestrator; the cheap party is the **worker**. The advisor gives a stuck down-tier worker access to stronger-than-itself judgment without escalating the whole cell. CLI shape additionally enables cross-provider, above-ceiling advisors (e.g. GPT advising a Sonnet swarm). |
| D3 | **Trigger and budget are objective, never self-assessed:** a worker may consult only after its **first serious failed verify attempt**, with a mandatory evidence bundle (exact command, failing output, diagnosis, relevant excerpts, CONTEXT.md path). **Max 2 consults per cell**, in this canonical loop: fail 1 → consult 1 → advised retry; advised retry fails → consult 2 (follow-up to the same advisor) → final retry; still failing → `[BLOCKED]` with both consults summarized in the report. Two serious failures with no consult budget remaining → `[BLOCKED]` (this amends bee-executing SKILL.md:68). **Authority-type blocks** — ambiguous cell, uncapped deps, architectural change, package install, locked-decision conflict — remain instant-`[BLOCKED]` and are never routed through the advisor. | Cheap models are poorly calibrated; "consult when you feel stuck" produces spam or false confidence. The advisor has no approval authority, so authority blocks must keep their current path. |

### Agent's Discretion

- A1 — The advisor is **advice-only and read-only**: it never edits files, never approves gates, never overrides locked decisions. Advice that conflicts with a locked decision → the worker returns `[BLOCKED]` citing both the D-ID and the advice.
- A2 — Consults are **recorded per cell** (count + advisor identity) so scarcity stays measurable, following the tier_mix precedent (P7) and the P22 dispatch log.
- A3 — Scope is **swarming workers only** (standard/high-risk lanes). tiny/small run in-session solo where the orchestrator is already present; no advisor pre-cap review exists (per D1).
- A4 — The headless no-questions rule (bee-executing SKILL.md:91–93) is unchanged: consulting the advisor is not "asking the parent or user"; it stays inside the worker's own turn.

## Terms

| Term | Meaning in this feature |
|------|-------------------------|
| Advisor | A configured stronger model or external CLI consulted by a stuck worker for advice-only guidance. Distinct from the retired "advisor mode" (gate-time orchestrator consults, decision 0013, removed by de967733). |
| Consult | One evidence-bundled question from a worker to the advisor plus its reply. Budgeted: max 2 per cell. |
| Degenerate consult | A consult whose advisor would not be stronger than the **consulting worker's own model** (or no advisor configured). Skipped; the worker proceeds to `[BLOCKED]` as today. |
| Authority-type block | A `[BLOCKED]` cause the advisor has no standing to resolve: ambiguous cell, uncapped deps, architectural change, package install, locked-decision conflict. Always instant-`[BLOCKED]`. |

## Specific Ideas And References

- Owner's framing (2026-07-13): "Dao sắc phải gọt được chuôi" — cheap model does the daily work; the expensive professor never touches grunt work, only answers evidence-backed questions when the student is stuck, then the student continues.
- Owner's stress-test anecdote: a Sonnet-class worker guided by a GPT-class advisor completed work it would certainly have failed alone — the target economics of this feature.
- Framing note: the "cheap main loop" in the anecdote maps to the **down-tier worker**, not the session. Under bee's fan-out pattern (de967733) the session remains the strong orchestrator; this feature is not a return to the retired cheap-session advisor mode.

## Existing Code Context

From the quick scout only. Downstream agents read these before planning.

### Reusable Assets

- `skills/bee-hive/templates/lib/state.mjs:339–380` — `modelForTier` / `resolveTier` typed dispatch (inherit / model / budget / cli); the advisor slot resolves through the same machinery.
- `skills/bee-hive/templates/lib/state.mjs:61–65` — `MODEL_TIERS` / `CONFIGURABLE_TIERS` (ceiling never configured, decision 0015 — untouched by this feature).
- `.bee/config.json` `models` map — `review` slot precedent (`review: "opus"`, decision 0021/P16) is the shape to copy.
- `.bee/logs/dispatch.jsonl` (P22, bee-model-guard) — existing audit surface for consult dispatches.

### Established Patterns

- Rescue ladder — `skills/bee-swarming/SKILL.md:50–56`; **unchanged in structure**. The consult is worker-side (bee-executing's attempt loop), before `[BLOCKED]` ever reaches the ladder; the ladder prose gains only a note that an arriving `[BLOCKED]` already spent its consult budget.
- Two-failed-attempts rule — `skills/bee-executing/SKILL.md:68`; amended per D3.
- External executor dispatch (decision 0019, P14) — reuse for `{kind:"cli"}` advisors.

### Integration Points

- `skills/bee-executing/SKILL.md` — worker-side consult protocol (trigger, evidence bundle, budget, post-advice conduct).
- `skills/bee-swarming/SKILL.md` + `references/swarming-reference.md` — ladder prose and the dispatch template (workers must learn the advisor slot exists and how to call it).
- `skills/bee-hive/templates/lib/state.mjs` + config schema — `advisor` slot resolution.
- Tests: `skills/bee-hive/templates/tests/test_lib.mjs` — slot resolution rows RED-first, following the review-slot rows.

## Canonical References

- `docs/decisions/0013-advisor-mode.md` — the retired advisor mode (what this feature must NOT recreate).
- Decision de967733 (2026-07-12) — ONE cost pattern; amended by D1, core stands.
- Decisions 0015 (ceiling = session model), 0019 (cli kind), 0021 (review slot, effort knob).
- `docs/specs/workflow-state.md` — stale-advisor-key tolerance contract (`STALE_ADVISOR_KEY_WARNING` — see open question below).

## Outstanding Questions

### Deferred To Planning

- [ ] Consult transport: fresh Agent dispatch per consult vs a persistent advisor continued across the cell (SendMessage), and what the cli-advisor transport looks like — investigate runtime support and the model-guard hook's view of worker-originated dispatches.
- [ ] Naming collision: the retired **top-level** `advisor` config key is stripped-and-warned (`hasStaleAdvisorKey`, workflow-state spec R8). The new slot lives at `models.<runtime>.advisor` — confirm no collision, and decide whether the stale-key warning copy needs updating so it doesn't confuse the two.
- [ ] Evidence-bundle template: exact fields and where it lives (swarming-reference vs bee-executing prose).
- [ ] How a consult is recorded per A2 (cell field vs dispatch-log-only) without hand-editing `.bee/*` (hive law 11 — may need a CLI verb).

## Deferred Ideas

Out-of-scope ideas captured during exploring. Not lost, not planned.

- Advisor pre-cap review for high-risk cells ("làm xong nhờ Advisor review") — explicitly declined at D1 (rescue rung only); revisit only if dogfood shows stuck-worker consults are working and demand exists.

## Handoff Note

CONTEXT.md is the source of truth. Decision IDs are stable. Planning reads locked
decisions, code context, canonical references, and deferred-to-planning questions.
Validating and reviewing use locked decisions for coverage and UAT.
