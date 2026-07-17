# Validation — Slice 2A-iii (guard integrity)

Date: 2026-07-17 · Lane: high-risk (inherited; hard-gate flags audit/security + external provider) · Cells: `ao-2aiii-1`, `ao-2aiii-2`

## Reality gate

| Check | Verdict | Evidence |
|---|---|---|
| MODE FIT | PASS | Edits `bee-model-guard` (control-channel guard, decision 0023 lineage) — audit/security hard-gate; high-risk per plan.md Mode Gate (6 flags). |
| REPO FIT | PASS | Short-circuit verified by direct read at `hooks/bee-model-guard.mjs:123-126`; guard already imports `state.mjs` (`:110`), which exports `resolveTier`/`modelForTier` in both mirrors. |
| ASSUMPTIONS | PASS | Runtime probe this session (see matrix rows 1–4) — typed returns, no throws, against the real `.bee/config.json`. |
| SMALLER PATH | PASS | Two cells: guard+tests, prose. B5 is a live shipped defect (`model:"banana"` logged as legitimate); doc-only is not honest. |
| PROOF SURFACE | PASS | All verify commands are members of the baseline chain, green this session (full chain exit 0). |

## Feasibility matrix

| # | Assumption | Risk | Proof | Evidence | Result |
|---|---|---|---|---|---|
| 1 | `resolveTier` 3-arg returns typed shapes for every marker tier | H | runtime probe | generation→`{type:'model',model:'sonnet',effort:'medium'}`, extraction→haiku, review→opus, ceiling→`{type:'inherit'}`; no throw | PASS |
| 2 | cli-shaped slot detectable without throw on hook hot path | H | runtime probe | codex review 3-arg → `{type:'refused',reason:'cli_tier_gather_only'}`; 4-arg `{for:'gather'}` → `{type:'cli',command:…}` | PASS |
| 3 | Equality/membership comparands exist | M | runtime probe | `modelForTier` → `'sonnet'/'haiku'/'opus'`, `null` for ceiling/cli — member set = {sonnet, haiku, opus} | PASS |
| 4 | `{model,effort}` object shape handled | M | runtime probe | generation `{model:'sonnet',effort:'medium'}` → modelForTier `'sonnet'` | PASS |
| 5 | Fixture harness can express cli-shaped/malformed config | M | file inspection | `test_model_guard.mjs:66` copies real config; `:71,77` writes fixture config directly — pattern for new builders (panel WARNING-3 → builders named in cell action) | PASS |
| 6 | Existing rows regress green under membership rule | M | file inspection | row2 (`:196`) and the row-table (`:366`) pass `model:"sonnet"` — a member | PASS |
| 7 | Schedule sanity | L | `bee cells schedule` | waves `[[ao-2aiii-1],[ao-2aiii-2]]`, zero cycles, zero unsatisfiable deps | PASS |
| 8 | Prose line anchors current | L | panel + reviewer | swarming:96, validating:61, reviewing:106, swarming-reference:168/187 all verified | PASS |
| 9 | Blast radius: other suites unaffected | M | panel | `test_hook_contracts.mjs:470` only model-guard row sends non-dispatch `apply_patch` (ignored — unaffected); `test_installers_e2e:310` presence-only | PASS |

## Plan-checker panel (opus, adversarial; iteration 1 → resolved)

- **BLOCKER-1** — membership deny would brick `model:"fable"` (CLAUDE.md's own pattern). **Resolved: accepted by design** — session-model dispatches ride `[bee-tier: ceiling]`; the deny FIX teaches both escape routes; deny row added; release note carries it; no hardcoded allowlist (config stays sole authority). See plan.md §2A-iii "Panel findings resolved".
- **WARNING-2** — opus leaves the member set if `claude.review` flips cli. Designed behavior (config authority); model-shaped case pinned by a test row.
- **WARNING-3** — new fixture builders required; named in `ao-2aiii-1` action.
- **WARNING-4** — mirror undercount in `ao-2aiii-2`; files list now carries `.claude/`+`.agents/` mirrors + manifest.
- Clean: AO5/B4(1)/W10 faithfully specified, no 2B smuggling, dep correct, anchors hold.

## Cell review (opus, cold pickup; CRITICALs fixed)

- **CRITICAL (both cells)** — release-manifest trap: edited files are hash-tracked, verify ends `release_manifest.mjs --check`, but manifest was outside `files` and regen was prohibited. **Fixed:** manifest added to `files`+`artifacts`, `--write` final step added to both actions, prohibitions allow regen via the script only, `critical-patterns.md` added to `ao-2aiii-2` read_first.
- Otherwise CLEAN: anchors accurate, 4-arg machinery ships in state.mjs, mirrors covered, deps correct, verify fails meaningfully.

## Verdict

**READY WITH CONSTRAINTS** — constraints applied in-place (cells patched, plan.md updated) before Gate 3. Approval covers `ao-2aiii-1` + `ao-2aiii-2` only; 2A-iv and 2B stay unapproved.

## Approval

Gate 3 auto-approved under `gate_bypass: total` (levels doctrine, decisions 0010/dcf01d7b) — audit decision logged in `.bee/decisions.jsonl`.
