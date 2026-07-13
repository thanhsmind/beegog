# Validation Report — advisor / slice advisor-consult

Date: 2026-07-13 · Lane: standard · Verdict: **READY WITH CONSTRAINTS**

## Reality gate

| Check | Score | Evidence |
|---|---|---|
| MODE FIT | PASS | standard, 3 flags recorded in plan.md frontmatter block (external systems, covered behavior, multi-domain); no hard-gate flag — the cli dispatch kind pre-exists (decision 0019), this feature only adds a consumer |
| REPO FIT | PASS | slot machinery inspected directly: CONFIGURABLE_SLOTS templates/lib/state.mjs:71, normalizeModels loop :165–167, resolveTier :362–380, stale-key strip :305, warning copy :326 |
| ASSUMPTIONS | PASS | all three named unknowns proven by runtime probes (matrix below) — no plausibility language remains |
| SMALLER PATH | PASS | small is dishonest: >3 files, and the two-attempts contract (bee-executing SKILL.md:68) is covered behavior being amended |
| PROOF SURFACE | PASS | `node skills/bee-hive/templates/tests/test_lib.mjs` → 220 passed, 0 failed (baseline this session); anchor greps in adv-2/adv-3 verifies are acceptance anchors, red before the cells land by design |

## Feasibility matrix

| Assumption | Risk | Proof required | Evidence | Result |
|---|---|---|---|---|
| Nested headless CLI works from inside a dispatched worker | MEDIUM | runtime probe from a real dispatched haiku worker | probe A: `claude -p "…" --model haiku` → stdout `OK`, `EXIT:0` | **PROVEN** |
| Workers carry the Agent tool | MEDIUM | tool-list check + live dispatch attempt from a worker | probe B: Agent tool present; nested dispatch accepted, child replied `DONE` | **PROVEN** |
| bee-model-guard logs worker-originated dispatches | MEDIUM | dispatch.jsonl entry correlated to the worker's nested dispatch | `.bee/logs/dispatch.jsonl` 2026-07-12T23:35:24.754Z `{"tool":"Agent","transport":"model-param","model":"haiku","subagent_type":null,"description":"haiku: minimal probe dispatch"}` — written by the probe worker's own dispatch | **PROVEN** |
| advisor slot resolvable without touching resolveTier | LOW | code inspection | separate normalize list + sibling resolver; CONFIGURABLE_SLOTS untouched (plan-checker confirmed the :366 coercion trap is correctly isolated) | PROVEN |

## Proven consult transport (binding for adv-2 / adv-3)

- **Model-shaped advisor** (e.g. `"opus"`, `{model, effort}`): the worker consults via **its own Agent tool**, model param set, description starting exactly `advisor-consult <cell-id>: <advisor-model>`. This lands one attributable line per consult in `.bee/logs/dispatch.jsonl` (A2 measurability, machine-readable, zero new machinery). Proven fallback when Agent dispatch is unavailable/rejected: headless `claude -p --model <m>` one-shot (probe A), evidence bundle inline or via stdin — never a /tmp path (critical pattern 20260708).
- **cli-shaped advisor** (`{kind:"cli", command}`): run the configured command with the evidence bundle on stdin, reusing the External Executors output-capture discipline (swarming-reference.md; decision 29b7f7bb).
- **Degenerate check** (orchestrator, at dispatch, per D2 + decision 0016): deterministic core — advisor resolves to the same model name as the worker → skip; ceiling-tier worker → always skip. Beyond that: known claude order haiku < sonnet < opus; an owner-configured advisor (incl. cli shapes) is otherwise presumed stronger.

## Plan-checker (opus, adversarial) — STRUCTURALLY CLEAN, 0 BLOCKER, 4 WARNING

1. adv-2 dep on adv-1 artificial → **fixed**: adv-2 deps now `[]` (can run parallel to adv-1); adv-3 still sequences after both.
2. A2 scope-reduced to a markdown report section → **resolved by probe C**: Agent-transport consults are auto-logged in dispatch.jsonl; the `advisor-consult <cell-id>:` description prefix (now in adv-2/adv-3 actions) makes each line attributable per cell.
3. Degenerate "stronger-than" untestable / plan overclaimed "deterministic" → **fixed**: plan.md matrix row 12 restated (deterministic core = same-name skip + ceiling skip; the rest is dispatch-time judgment per 0016); adv-3 action carries the rubric.
4. adv-3 transport contingent on a then-nonexistent validation report → **resolved**: this report exists and is in adv-2/adv-3 `read_first`.

## Cell review (opus, cold-pickup)

- adv-1 PICKABLE (2 MINOR → fixed: effort-passthrough truth added; separate-normalize-list spelled in artifacts).
- adv-2 PICKABLE (MINOR sources restated inline; critical-patterns + this report added to read_first).
- adv-3 NOT PICKABLE (2 CRITICAL: transport form assumed context; unproven feasibility stated as fact) → **both fixed**: plan.md + this report added to read_first; action rewritten to the proven transport above. Re-check basis: the CRITICALs were "missing/unproven reference", both now present-and-proven; no residual interpretation gap.

## Constraints carried into execution

1. adv-1 → adv-2/adv-3 share no files; adv-2 may run parallel to adv-1; adv-3 runs after both (cross-references their outputs).
2. Consult dispatch descriptions MUST carry the `advisor-consult <cell-id>: <advisor>` prefix — this is the A2 record; a consult without it is a protocol miss at goal-check.
3. Advice never substitutes for fresh verify output (goal-check unchanged).
4. Evidence bundles: stdin/inline only (critical pattern 20260708); never secrets/env.

## Approval

READY WITH CONSTRAINTS → Gate 3 per gate-bypass contract (standard, no hard-gate flag).
