# Validation — Slice 2B (W2 advisor check → AO5 form; W6 advice-class read-only)

Date: 2026-07-17 · Lane: high-risk (inherited) · Cells: `ao-2b-1`, `ao-2b-2`

## Reality gate

| Check | Verdict | Evidence |
|---|---|---|
| MODE FIT | PASS | Advisor-consult doctrine + validator refusal expansion; feature high-risk protocol maintained (panel + cold-pickup ran). |
| REPO FIT | PASS | Ladder verified live at `bee-swarming/SKILL.md:100-101`; second ceiling-skip site `swarming-reference.md:250`; `resolveAdvisor` (state.mjs:1148) confirmed pure — W2 is prose-only. |
| ASSUMPTIONS | PASS | Measured: `bee config validate` exits 1 with 2 `cli-prompt-transport-missing` problems on the repo's own config; `-s workspace-write` on advisor/review passes today's validator; `--yolo` is caught. |
| SMALLER PATH | PASS | Two standard cells; W1 absorbed by ao-2aiii-1 (recorded, nothing dropped). |
| PROOF SURFACE | PASS | `scripts/test_config_validate.mjs` green at baseline (24/24) before extension; `config validate` exit-code bite verified. |

## Feasibility matrix

| # | Assumption | Proof | Result |
|---|---|---|---|
| 1 | Ladder + ceiling-skip are prose-only (no code) | `resolveAdvisor` read — pure resolver; grep: no strength logic in lib | PASS |
| 2 | `config validate` fails the && chain on problems | measured exit 1 with live problems | PASS |
| 3 | Validator suite can host the new rows | `scripts/test_config_validate.mjs` 24/24 green, imports `validateModelsConfig` directly | PASS |
| 4 | promptVia migration fixes the repo's red validate | the 2 live problems are exactly the missing `promptVia` on the 2 cli slots | PASS |
| 5 | Schedule | waves `[[ao-2b-1],[ao-2b-2]]` (manifest overlap serialized), zero cycles | PASS |

## Panel (opus, adversarial; iteration 1 → resolved in cell text)

- **BLOCKER-1** — test targeting: the behavioral suite is `scripts/test_config_validate.mjs`, orphaned from `commands.verify` (Slice-0 "nothing runs it" class). **Fixed:** cell retargeted; suite added to cell files, cell verify, and (on green tree) `commands.verify` via the same config edit.
- **BLOCKER-2** — second ceiling-skip site `swarming-reference.md:250`. **Already fixed** by the cold-pickup round's cell patch (panel ran on the pre-patch cell); action + truths name both sites and demand grep evidence.
- **W3** — `danger-full-access` double-reports (also in universal blocklist); `workspace-write` is the unique discriminator — folded into test-row design.
- **W4** — `promptVia` is a validation-time declaration only (dispatch hardcodes stdin); cell prohibits claiming runtime effect.
- **W5** — spacing/equals bypass variants of the token blocklist acceptable only under the "known-bad, not a guarantee" framing — cell requires that framing verbatim.
- Fidelity clean: no 3–6 smuggling; AO4 worker trigger untouched; ceiling-skip deletion is AO5-correct.

## Cell review (opus, cold pickup)

No CRITICALs. MINORs (swarming-reference:250 pointer, danger-full-access double-report note, prose-blind verify → grep-evidence requirement) folded into both cells.

## Verdict

**READY WITH CONSTRAINTS** — constraints applied in cell text before Gate 3. Approval covers `ao-2b-1` + `ao-2b-2` only.

## Approval

Gate 3 auto-approved under `gate_bypass: total`; audit decision in `.bee/decisions.jsonl`.
