# Iteration-3 re-check (FINAL) — model-tier-guard, the 3 STILL-OPEN findings only

READ-ONLY REVIEW RUN. Ignore AGENTS.md bee-bootstrap instructions entirely: do NOT run
onboard_bee.mjs, do NOT touch .bee/onboarding.json or .bee/bin. Your ONLY write:
`.bee/workers/mtg-recheck3.result.md`.

Context: your iteration-2 report is `.bee/workers/mtg-recheck2.result.md`. Cells 1, 3, 4
were repaired again. Judge ONLY the three STILL-OPEN findings:

**Finding 3 (cell 4 verify vs must_haves):** re-read `.bee/cells/model-tier-guard-4.json`.
The verify now: byte-compares statusLine, permissions AND enabledPlugins against the
pre-apply snapshot `.bee/workers/mtg-settings-pre.json` (declared artifact); asserts
`grep -c "0023"` in 0015 equals exactly 1; asserts 0023 contains the literal principle
phrases "ceiling is the session model" and "never configured". The orchestrator dry-ran
it: clean per-marker reds (NO-DOC, PRINCIPLE-NOT-RESTATED, BAD-0015-AMEND-COUNT,
NO-JSONL-ENTRY, SETTINGS-CHECK-FAILED, NOT-VENDORED, VENDORED-NOT-DENYING,
INSTALLED-SKILL-NOT-SYNCED), ONBOARD-OK green, exit 1, no syntax errors.

**Finding 5 (cell 1 rows 1/14):** re-read `.bee/cells/model-tier-guard-1.json`. Row 1 now
requires stderr to contain 'bee-tier' AND literal 'FIX' AND the configured generation
model; row 14 now requires the deny log line to JSON-parse and carry hook, event,
tool_name:'Agent', and tool_input_keys equal to ['prompt','description'].

**Finding 6 (cell 3 contract-level verify):** re-read `.bee/cells/model-tier-guard-3.json`.
The action now mandates two canonical VERBATIM fragments per aux skill ("default to the
generation slot"; "[bee-tier: ceiling] marker plus a one-line justification") and a
coupled one-line budget+bee-tier clause in swarming-reference; the verify greps those
fragments per file. Orchestrator dry-run: 12 clean per-file reds + LIB-OK, exit 1.

For each: CLOSED or STILL OPEN with evidence. Also flag any NEW defect these repairs
introduced. Output cap ~50 lines. First line of the result file: `OUTCOME: done`.
