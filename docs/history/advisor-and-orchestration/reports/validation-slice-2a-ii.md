# Validation — Slice 2A-ii (advisor-and-orchestration)

Date: 2026-07-17 · Lane: high-risk feature, standard-lane cells · Cells: `ao-2aii-1`, `ao-2aii-2`
Verdict: **READY WITH CONSTRAINTS** → constraints applied in-session (cell repaired, plan note added) → READY.

## Reality gate

| Check | Result | Evidence |
|---|---|---|
| MODE FIT | PASS | 2 bounded cells inside the high-risk feature's approved re-plan (plan.md 2A re-plan, sub-slice ordering); no ceremony beyond the standard-lane checker |
| REPO FIT | PASS | `resolveTier` at `state.mjs:1076-1094` with the `{type:'cli'}` branch at :1087; sole production caller `modelForTier` (:1059) degrades cli→null; guard hot path `bee-model-guard.mjs:133` confirmed byte-unchanged under the refusal (refused→null→"generation") |
| ASSUMPTIONS | PASS | manifest path corrected to `docs/history/codex-harness-hardening/release-manifest.json` (probe: `release_manifest.mjs --check` green, 142 files); rule-13 anchor at `test_lib.mjs:7720` is a presence check — additive sentence safe; census (:7613) checks absence of retired phrasing only |
| SMALLER PATH | PASS | B3a-minimal: one sentence on the standing sheet, elaboration in the reference; no smaller shape closes B1 (prose is not a boundary) |
| PROOF SURFACE | PASS | per-cell verify commands are baseline-chain members, all green this session (22-suite baseline verify, exit 0) |

## Feasibility matrix

| Assumption | Risk | Proof | Evidence | Result |
|---|---|---|---|---|
| refusal never breaks the guard hot path | HIGH | code walk | `modelForTier` returns model-string or null; refused→null identical to cli→null today (`state.mjs:1053-1061`) | PASS |
| only 2 existing test rows assert bare-call cli | MED | reviewer sweep | **FAIL then repaired** — row `test_lib.mjs:2264-2265` (review-cli) found beyond the cell's read window; cell action amended to name both rows + expectations | PASS (post-repair) |
| additive rule-13 edit keeps anchors green | MED | grep | anchor asserts presence of "Fan out the gathering" (`test_lib.mjs:7720-7721`), not byte-length | PASS |
| manifest regen covers touched templates files | MED | file inspect | manifest tracks both `state.mjs` copies + `test_lib.mjs` (`release_manifest.mjs` lines 101/675/731) | PASS |
| schedule has no cycle, waves correct | LOW | `bee cells schedule` | waves: `[ao-2aii-1] → [ao-2aii-2]` (test_lib + manifest overlap serialized by deps) | PASS |

## Plan-checker (review slot, opus; coherence + feasibility + scope-guardian lenses folded into one dispatch — 2-cell slice)

- **CRITICAL (fixed):** ao-2aii-1 claimed "ONE existing test row"; `test_lib.mjs:2264-2265` (cli review slot, 3-arg, asserts `type==='cli'`) would fail the cell's own verify. Repair applied: action now names both rows; bare 3-arg review-cli asserts `refused`, companion `{for:'gather'}` row keeps the external-reviewer path provably reachable; plan.md gained the scope-split note (resolveTier-level refusal is 2A-ii for every slot; routing prose is 2A-iii).
- **WARNING (accepted, transitional):** between 2A-ii and 2A-iii the documented 3-arg external-reviewer instruction (`bee-reviewing/SKILL.md:106`, `bee-validating/SKILL.md:61`, `bee-swarming/SKILL.md:96`) resolves to `refused` on a cli review slot. Named in plan.md + release note; mitigation `{for:'gather'}`; 2A-iii makes it the documented form.
- **MINOR:** 2203 fix must spell the 3rd positional arg (`'claude'`) — folded into the action.
- **MINOR (pre-existing, feature-level):** `.claude`/`.agents` runtime skill copies of `state.mjs` are not manifest-tracked and not re-synced by these cells; boundary lands in `skills/` + `.bee/bin` until the next skill sync (same as 2A-i). Carried, not blocking.
- Coverage / deps / key links / scope: clean (B1+W7/W8/W9/W-a fully covered; `ao-2aii-2 deps:[ao-2aii-1]` correct for the test_lib + manifest overlap; no contradiction with `validateModelsConfig` or the config-validate verb; prohibitions fence 2A-iii/2B/2A-iv correctly).

## Approval

Gate 3 auto-approved under `gate_bypass=total` (level covers every lane incl. high-risk). Audit decision logged in `.bee/decisions.jsonl`. Approval covers cells `ao-2aii-1` + `ao-2aii-2` only; 2A-iii, 2A-iv, 2B, Slices 3–6 return to planning.
