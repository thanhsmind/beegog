OUTCOME: done

# Iteration-3 final re-check: model-tier-guard

## Finding 3 - CLOSED

Cell 4's verify now covers the previously missing must-haves.

- Settings preservation: it loads `.bee/workers/mtg-settings-pre.json` and compares the serialized `statusLine`, `permissions`, and `enabledPlugins` values against current settings (`model-tier-guard-4.json:18,22,43`).
- Decision 0015: `grep -c "0023"` must equal exactly 1 (`:18,24,43`).
- Decision 0023: both required principle phrases, `ceiling is the session model` and `never configured`, are asserted (`:18,24,43`).
- The command remains runnable shell syntax; the reported dry run also demonstrates distinct red markers and a green onboarding test without syntax failure.

These checks close the specific false-pass paths reported in iteration 2.

## Finding 5 - CLOSED

Cell 1's required test table now proves the complete denial-message and deny-log contracts.

- Row 1 requires stderr to contain `bee-tier`, literal `FIX`, and the configured generation model resolved from config with the specified fallback (`model-tier-guard-1.json:16`).
- Row 14 requires the last deny line to JSON-parse and asserts `hook:'model-guard'`, `event:'deny'`, `tool_name:'Agent'`, and exact `tool_input_keys` equality with `['prompt','description']` (`:16`).
- The standalone verify runs the mandated table (`:25,42`).

## Finding 6 - STILL OPEN

Cell 3 now couples the budget and `bee-tier` terms on one line, but its aux-skill checks still do not prove the two canonical fragments VERBATIM as required by the action and must-haves (`model-tier-guard-3.json:19,25-27,42`).

- `grep -qi "default to the generation slot"` is case-insensitive, so non-verbatim text such as `default to the Generation slot` passes.
- `grep -qiE "bee-tier: ceiling..? marker plus a one-line justification"` does not require the literal `[bee-tier: ceiling]` marker. For example, `bee-tier: ceilingX marker plus a one-line justification` passes.
- Direct probes confirmed both false-pass examples against the exact verify expressions.

Replace these with case-sensitive fixed-string checks for the exact fragments in each aux file (for example, `grep -Fq`).

## New defects introduced by the repairs

None separate from Finding 6. The permissive cell-3 grep expressions are the incomplete repair of that existing finding, not an additional independent defect. All three cell JSON files parse and all three verify strings are shell-syntax valid.

## Verdict

Findings 3 and 5 are CLOSED. Finding 6 is STILL OPEN; iteration-3 closure is therefore incomplete.
