# Validation — Slice 3B (W3 pinned agent types)

Date: 2026-07-17 · Lane: high-risk (inherited) · Cells: `ao-3b-1`, `ao-3b-2` (combined opus panel + cold-pickup pass)

## Reality gate

| Check | Verdict | Evidence |
|---|---|---|
| MODE FIT | PASS | New onboarding sync class + control-channel guard extension; high-risk protocol ran (adversarial pass, iteration 1 → resolved). |
| REPO FIT | PASS | No `.claude/agents/` exists yet; `REPO_SKILL_TARGETS` (onboard:269) untouched by design; settings-json merge (onboard:33) is the same-class precedent; `subagent_type` already read at guard.mjs:89. |
| ASSUMPTIONS | PASS | Panel verified: preflight scans only the two skill roots with `SKILL_DIR_RE` against directory names — `.claude/agents/*.md` and `templates/agents/*.tmpl` trip nothing (AO10 safe). Frontmatter format (name/description/tools/model) matches Claude Code agent definitions. |
| SMALLER PATH | PASS | Two cells, sync half + guard half; drift check descoped to an advisory helper, no refusal machinery. |
| PROOF SURFACE | PASS | All verify members in baseline; per-tier deny rows + regression rows named. |

## Feasibility matrix

| # | Assumption | Proof | Result |
|---|---|---|---|
| 1 | Flat sync cannot brick preflight (AO10) | panel: SKILL_DIR_RE dir-name scan only (onboard:823,531) | PASS |
| 2 | Guard sees subagent_type | guard.mjs:89 reads it today | PASS |
| 3 | No hidden prose site newly denies | panel grep: general-purpose in canonical prose only in bee-compounding (already Explore-mandated); reviewer dispatches carry no marker | PASS |
| 4 | Drift check hostable | **not in `validateModelsConfig`** (pure, no root — AO12); hosted in a new `validateAgentFilesDrift(root, config)` helper called from the status handler and config-validate verb (both hold root via `readRawConfigForValidation`, bee.mjs:331/383/2015) | PASS (after fix) |
| 5 | Ceiling carve-out honest | ceiling = session model, no pinned agent (decision 0015); allowing general-purpose there is required | PASS |
| 6 | Schedule | waves [[ao-3b-1],[ao-3b-2]] (dep + manifest overlap), zero cycles | PASS |

## Panel + cold-pickup findings (iteration 1 → resolved in cell text)

- **BLOCKER** — drift advisory hosted in a pure validator that never sees root → untriggerable as bounded. **Fixed:** separate root-taking helper in state.mjs, called from the two bee.mjs hosts; canonical `skills/bee-hive/templates/bee.mjs` + `.bee/bin/bee.mjs` mirror added to files; purity prohibition added.
- **WARNING** — pinned-type deny placed "after the decision order" is dead code (marker-only and marker+matching-param already allow). **Fixed:** rule fires as soon as the marker resolves to generation/extraction/review, before both allow branches; added the with-matching-param deny row.
- **CAVEAT** (recorded, not built-for): rendering is tested, runtime registration is not — a host whose config uses full model IDs may render green yet not register; noted as a portability gap for the report.

## Verdict

**READY WITH CONSTRAINTS** — constraints applied in cell text before Gate 3. Approval covers `ao-3b-1` + `ao-3b-2` only.

## Approval

Gate 3 auto-approved under `gate_bypass: total`; audit decision in `.bee/decisions.jsonl`.
