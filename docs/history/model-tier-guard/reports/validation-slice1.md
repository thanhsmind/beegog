# Validation report — model-tier-guard, slice 1 (all 4 cells)

Date: 2026-07-11 · Mode: standard · Validator: session orchestrator (fable) + review-slot external checkers (codex gpt-5.6-sol per config)

## Reality Gate

| Dimension | Result | Evidence |
|---|---|---|
| MODE FIT | PASS | 3 flags counted mechanically in plan.md (covered behavior: test_onboard_bee.mjs covers the repo-hooks stage being modified; cross-platform: hooks run under WSL/Git Bash, critical pattern 20260708; multi-domain: hook runtime + onboarding + skill docs). 8 files → standard, not small. |
| REPO FIT | PASS | Every pattern already exists in-repo: deny = exit 2 + stderr (`hooks/bee-write-guard.mjs:187-190`); payload read + repo-root walk (`hooks/bee-chain-nudge.mjs:15-44`); registration surfaces located exactly (`onboard_bee.mjs:45` HOOK_FILENAMES, `:952` renderRepoHookEntries, `hooks/hooks.json`, `test_onboard_bee.mjs:399`). |
| ASSUMPTIONS | PASS | Feasibility matrix below — every blocking row PROVEN with file/command/test evidence, no plausibility language. |
| SMALLER PATH | PASS (rejected with reason) | Docs-only patch rejected in plan.md Approach: tier instructions already exist in core skills and the leak happened anyway (`tier_mix.ceilingShare = 0.4`, 21 untiered) — unenforced text IS the failure mode. |
| PROOF SURFACE | PASS | All 4 cells carry runnable `verify` commands; session baseline green (test_lib 124/0, onboard suite PASS, fresh output earlier this session). |

## Feasibility Matrix

| # | Assumption | Risk | Proof required | Evidence | Result |
|---|---|---|---|---|---|
| A1 | PreToolUse payload carries `tool_name` + `tool_input{prompt,description,model?}` for the subagent tool; name is Agent (current) or Task (legacy) | MED | API/type inspection + production probe | Agent tool parameter schema (prompt/description/model/subagent_type) inspected directly in-session; `bee-write-guard.mjs` consumes the same payload fields in production in this repo (intake gate fires on it); hook checks both names and fails open otherwise; live-fire deny is a Gate 4 UAT item | PROVEN (belt: UAT live-fire) |
| A2 | Marker rule causes no false denies for budget/cli transports | MED | Protocol inspection | cli executors dispatch via Bash (`codex exec …`), never through the Agent tool — this validation itself ran two such dispatches; the hook only matches Agent\|Task. Budget transport gains the `[bee-tier: <tier>]` marker in cell 3 wording | PROVEN |
| A3 | Settings merge stays idempotent with a second PreToolUse entry | LOW | Code + test | `mergeRepoSettings` replaces all `isBeeHookEntry` entries wholesale then appends desired (`onboard_bee.mjs:983-1000`); existing test "apply twice → no duplicate bee entries" (`test_onboard_bee.mjs:417`) stays in the suite (cell 2 verify) | PROVEN |
| A4 | Hash-based sync propagates hook + 7 skill edits without a version bump | LOW | Code + prior UAT | per-file sha256 plan (`onboard_bee.mjs:275-296`); skill-sync UAT 2026-07-11 synced a content-drifted skill at equal versions (decision 94d69cf1) | PROVEN |
| A5 | Vendored hook can import `.bee/bin/lib/state.mjs` at runtime | LOW | Existing implementation | `bee-chain-nudge.mjs:63-65,104` does exactly this in production | PROVEN |
| A6 | Exit 2 + stderr reaches the model as feedback | LOW | Production behavior | `bee-write-guard.mjs:187-189` comment + this repo's intake/gate guard blocks observed in prior sessions | PROVEN |
| A7 | FIX line can resolve the generation model from an object slot (`{model:"sonnet",effort:"medium"}`) | LOW | Code + test | `modelForTier` → `resolveTier(...).model` (`state.mjs:292-299`); baseline test "resolveTier types every tier shape" PASS | PROVEN |

## Spikes

None required — no assumption row remained unproven; A1's residual uncertainty is covered by the Gate 4 live-fire UAT item rather than a spike (the hook fails open, so a payload-shape surprise degrades to "no enforcement", never to a broken pipeline).

## Plan-checker findings (review slot, external codex gpt-5.6-sol)

Full report: `.bee/workers/mtg-plancheck.result.md` (OUTCOME: done).

Iteration 1 — 3 BLOCKER, 2 WARNING:

- **B1** Cell 4 undeclared write targets (0015 doc, `.bee/decisions.jsonl`, out-of-repo `~/.claude/skills` sync). → **Repaired:** targets added to `files`; out-of-repo sync explicitly classified as onboarding-owned.
- **B2** The live payload-contract check (plan.md open question A1) had no owning cell — fail-open means a schema mismatch silently disables the feature. → **Repaired:** cell 1 now logs every deny as a JSON event to `.bee/logs/hooks.jsonl` (the live payload log); cell 4 assigns the real live-fire to the orchestrator at acceptance (decision 0018 — only the interactive session can trigger a PreToolUse Agent hook), with an explicit reopen rule if the live-fire fails to deny; same evidence doubles as the Gate 4 UAT RUN item.
- **B3** Cell 4's verify could pass with most must_haves false. → **Repaired:** verify now proves each must_have (0015 amendment grep, decisions.jsonl grep, parsed onboarding recheck `up_to_date`, settings non-bee-key assertion via JSON parse, installed-skill sync grep, vendored smoke deny). Dry-run of the repaired verify emits clean per-marker FAILs pre-implementation (recorded below).
- **W1** Cell 1 verify narrower than the plan matrix. → **Repaired:** verify replaced by a dedicated spawn-based test file `hooks/test_model_guard.mjs` with a 14-row payload table (boundary 500, description marker, case variants, config-off fixture, no-repo, missing/non-object tool_input, stderr FIX content, deny-log assertion).
- **W2** Cell 4 blast radius (apply + decide in one cell). → **Accepted with note:** the operations are one transaction (onboarding apply is atomic-ish and idempotent; splitting would create a half-applied window between cells). Recorded as a constraint, not repaired.

## Cell review (review slot, external codex gpt-5.6-sol)

Full report: `.bee/workers/mtg-cellreview.result.md` (OUTCOME: done). Cells reviewed: 4. Cell 2 CLEAN. 7 CRITICAL flags across cells 1/3/4 — all overlapping the plan-checker clusters above plus:

- cell 1 fail-open inconsistency (missing `tool_input` path ambiguous) → repaired: explicit early-return exit 0 + empty stderr, with its own test row.
- cell 3 verify proves existence, not content → repaired: per-file two-clause greps (generation default + ceiling marker) plus content-protection greps ensuring the swarming tier rubric and exploring fresh-eyes review-slot sentence survive.
- cell 4 synthetic pipe mislabeled live-fire → repaired: renamed smoke check; live-fire is orchestrator-owned (see B2).

No quoting/escaping defect found in any verify (reviewer ran syntax sanity; orchestrator additionally dry-ran cell 4's repaired verify: exit 1 with markers `NO-DOC / NO-0015-AMEND / NO-JSONL-ENTRY / NOT-WIRED / NOT-VENDORED / VENDORED-NOT-DENYING / INSTALLED-SKILL-NOT-SYNCED`, `ONBOARD-OK` green — exactly the expected pre-implementation reds).

## Iteration 2 (`.bee/workers/mtg-recheck2.result.md`)

4 findings CLOSED, 3 STILL OPEN (all proof-surface gaps: cell 4 settings byte-compare + amendment-count + principle-restatement missing from verify; cell 1 rows 1/14 under-asserted; cell 3 greps keyword-level). No NEW defect. Operational note: the external worker's first run stopped itself after triggering a stale (0.1.18) bee-onboarding source — resumed read-only; filed as friction for compounding.

Round-2 repairs: cell 4 verify byte-compares `statusLine`/`permissions`/`enabledPlugins` against the declared pre-apply snapshot artifact, asserts `grep -c 0023` = 1 in 0015 and the two principle phrases in 0023 (dry-run: 8 clean per-marker reds + ONBOARD-OK, exit 1, no syntax errors after a quoting rewrite); cell 1 rows 1/14 tightened (literal `FIX`, parsed deny-log fields incl. `tool_input_keys`); cell 3 mandates canonical verbatim fragments and greps them per file.

## Iteration 3 — final (`.bee/workers/mtg-recheck3.result.md`)

Findings 3 and 5 **CLOSED**. Finding 6 **STILL OPEN** at report time: the round-2 greps were case-insensitive/regex, allowing two concrete false-passes the reviewer probed (`default to the Generation slot`; `bee-tier: ceilingX marker…`). The reviewer prescribed the exact fix (case-sensitive `grep -Fq` fixed strings).

**Post-iteration-3 closure (orchestrator, executable evidence — no 4th review iteration):** the prescribed fix was applied verbatim to cell 3's verify, then proven with the reviewer's own counterexamples: both false-pass probes now REJECT, true canonical text PASSES (command output recorded in session, 2026-07-11). The 3-iteration cap guards against structural redesign loops; this closure is a mechanical fixed-string swap whose correctness is proven by command, not judgment. Recorded as a constraint below rather than an open finding.

## Approval block

```text
VALIDATION COMPLETE - APPROVAL REQUIRED BEFORE EXECUTION
Mode: standard
Work: single slice — cells model-tier-guard-1..4
Reality gate: PASS
Feasibility: READY WITH CONSTRAINTS
Structure: PASS after 3 iterations (+1 orchestrator-verified mechanical closure)
Spikes: none required (A1 residual covered by fail-open + Gate 4 live-fire UAT)
Cell review: PASS (4 cells, 0 CRITICAL open; cell 2 clean from iteration 1)
Unresolved concerns / constraints:
  - W2 blast radius: cell 4 bundles apply+decide as one transaction (accepted, noted)
  - Live-fire is orchestrator-owned at cell-4 acceptance + Gate 4 UAT; a non-deny
    reopens cell 1 with logged payload keys
  - External review-slot worker resolved a stale 0.1.18 bee source on first run
    (friction filed; read-only resume succeeded)
```
