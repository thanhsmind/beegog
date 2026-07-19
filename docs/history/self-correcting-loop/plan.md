# Plan — self-correcting-loop (high-risk)

CONTEXT D1-D6 authoritative. Five cells, serialized (shared files:
cells.mjs/bee.mjs/test_lib). Every lib-touching cell runs, inside its own
verify: mirror sync check + `render_plugin_skill_trees.mjs` +
`release_manifest.mjs --write` then `--check` (critical-patterns 20260715,
third-recurrence rule). Freeze-first on every cells.mjs/claims.mjs edit
(critical-patterns 20260716).

- **scl-1 (D1 ledger):** `trace.attempts` append-only writer in
  recordVerify/blockCell; `normalizeFailureSignature(output)` (strip
  timestamps/paths/hex → first failing line → sha256-12); `--signature` flag
  on `cells verify`; updateCell freezes the new trace keys. Tests: entries
  appended on fail AND pass, survive cap, refused by updateCell.
- **scl-2 (D2 budgets):** claim-door counting in claimCellCrossSession
  (claims = distinct ledger claim transitions + current claim; failed
  attempts; same-signature pairs); typed `CELL_BUDGET_EXHAUSTED` /
  `REPEATED_FAILURE` naming history summary + the sanctioned door; defaults
  {3,4,2} when `budgets` absent; `cells reset-budget --id --reason` (logs a
  decision, appends a ledger entry, clears counters via an append-only
  `budget_resets` marker — never rewrites history); explicit test: gate_bypass
  total does NOT bypass either refusal. deps: scl-1.
- **scl-3 (D3 matrix):** `change_class` field validation; advisory
  `JUDGE_STANDARD_INSUFFICIENT` warnings at cells add/update (manifest-lint
  pattern, pah-2); cap-teeth for behavior class (red evidence ≥80 chars,
  non-duplicate across cells). deps: scl-2 (cells.mjs serialization).
- **scl-4 (D5 verdict):** `validateJudgeVerdict` (typed errors);
  `trace.semantic_judge` append-only; `model_independence` derivation from
  builder/judge dispatch shapes (pinned-param + differing ⇒ confirmed).
  deps: scl-1.
- **scl-5 (D4 doctrine + close):** bee-swarming goal-check gains the
  judge-tier table (tiny/small mechanical; standard checklist judge;
  high-risk independence-preferred) + verdict handling (NEEDS_REVISION
  automatic ⇒ re-dispatch with issue + ledger entry; authority ⇒ escalate);
  routing-and-contracts reference updated; render + manifest; census/
  conformance green. deps: scl-2, scl-3, scl-4.

## Risks

- Claim-door changes can lock sessions out (false EXHAUSTED) → defaults only
  bite from the 4th claim; reset-budget door; freeze-first + racer suite
  stays green.
- Cap-teeth can strand legitimate behavior cells → 80-char floor only, named
  refusal, and only the behavior class.
- Judge doctrine must not recreate auto-review → explicitly scoped to
  goal-check; Gate 4/candidates untouched (D4 non-goal).
