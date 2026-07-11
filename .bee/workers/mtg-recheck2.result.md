OUTCOME: done

# Iteration-2 re-check: model-tier-guard

## PLAN-CHECK BLOCKERS

1. CLOSED - Cell 4 undeclared write targets.
   Evidence: `.bee/cells/model-tier-guard-4.json:6-12` now declares 0023, the 0015 amendment, `.bee/decisions.jsonl`, `.claude/settings.json`, and the vendored hook. The action explicitly classifies the seven `~/.claude/skills` writes as out-of-repo onboarding-owned sync output (`:18`).

2. CLOSED - Live payload-contract check ownership.
   Evidence: cell 1 now logs each deny with `tool_name` and `tool_input_keys` to `.bee/logs/hooks.jsonl` (`model-tier-guard-1.json:16,24`). Cell 4 assigns the real in-session bare-Agent live-fire to the orchestrator at acceptance/Gate 4, requires deny feedback plus the deny log event, and reopens cell 1 on a non-deny (`model-tier-guard-4.json:18,23`).

3. STILL OPEN - Cell 4 verify still does not prove every must-have.
   Evidence: the verify now covers file existence, an 0015 `0023` grep, decisions JSONL grep, Agent|Task wiring, vendored smoke deny, parsed `up_to_date`, installed-skill grep, and onboarding tests (`model-tier-guard-4.json:42`). However:
   - The settings assertion checks only that `statusLine` and `permissions` are truthy; it omits `enabledPlugins` and does not compare any of the three values byte-for-byte with the pre-apply snapshot required by `:18,22`.
   - `grep -q "0023"` does not prove exactly one new Status line in 0015, and `test -f` does not prove 0023 preserves the ceiling-is-session-model principle required by `:24`.
   Thus the repaired command can still pass with material must-haves false.

## CELL-REVIEW CRITICALS

4. CLOSED - Cell 1 missing/non-object `tool_input` fail-open behavior.
   Evidence: the action now requires an early exit 0 with empty stderr before the deny branch and includes rows for absent and string `tool_input` (`model-tier-guard-1.json:16`). The must-haves repeat the executable-test requirement (`:21,23`).

5. STILL OPEN - Cell 1 verify surface does not fully prove the promised denial message/log contract.
   Evidence: the 14-row table now covers description markers, case, the 500-character boundary, after-window denial, absent/non-object input, config-off fixture, no repo, wrong tool, junk input, and deny logging (`model-tier-guard-1.json:16`); the standalone verify runs that table (`:42`). But bare-deny row 1 asserts only `bee-tier` plus the configured generation model, not the literal `FIX` line required by `:22` and plan D2. Row 14 checks only `hook` and `event`, not the required `tool_name` and `tool_input_keys` fields from `:24`. The original verification critical is therefore not fully closed.

6. STILL OPEN - Cell 3 verify remains keyword-level rather than contract-level.
   Evidence: each aux skill is checked independently for `bee-tier: ceiling` and the word `generation`, and the rubric/fresh-eyes protection greps are present (`model-tier-guard-3.json:41`). The reference is checked separately for `bee-tier` and `budget`. But no aux assertion requires `justification`, `default`, or an equivalent coupled clause, so unrelated occurrences can satisfy the two greps; likewise disconnected `bee-tier` and `budget` text can pass the reference check. This does not prove the generation-default plus ceiling-marker-and-justification contract required by `:25`.

7. CLOSED - Cell 4 live-fire vs synthetic smoke separation.
   Evidence: the action explicitly labels the direct vendored-hook pipe as synthetic and not live-fire, while separately assigning the actual Agent PreToolUse dispatch to orchestrator acceptance with captured deny/log evidence (`model-tier-guard-4.json:18`).

## NEW STRUCTURAL DEFECTS

None found. The dependency graph remains acyclic (`1 -> 2`, `1/2/3 -> 4`), all repaired cell JSON parses, and verifies for cells 1, 3, and 4 are shell-syntax valid. The remaining items above are unresolved proof gaps from iteration 1, not newly introduced dependency, scope, or runnable-command defects.

## VERDICT

Iteration-1 closure is incomplete: 4 findings are CLOSED and 3 are STILL OPEN. No NEW blocker or warning was introduced.
