# Walkthrough — model-tier-guard

Shipped 2026-07-11 · standard lane · 7 cells, commits `11e43a0` `4c9960b` `b115d68` `5fa9706` `c943def` `d98a730` `1419a45` · no implement-plan brief was rendered (plan.md was the Gate 2 record)

## What shipped

Every subagent dispatch (Agent/Task tool call) now requires an **explicit model tier**: either a `model` parameter, or a `[bee-tier: <tier>]` marker that must be the **first non-whitespace token of the prompt** or the **start of the description**. A bare dispatch — the pattern that silently inherited the most expensive session model — is denied by a new PreToolUse hook (`hooks/bee-model-guard.mjs`, vendored to `.bee/bin/hooks/`) with a two-line reason naming the configured generation model as the fix. Every deny is logged as a JSON event to `.bee/logs/hooks.jsonl` with the real payload keys.

Around the hook: registration in all three surfaces (plugin `hooks/hooks.json`, `onboard_bee.mjs` vendor list + settings merge, structural tests); decision **0023** amends decision 0015's transport clause (the principle "ceiling = session model, never configured" is unchanged — only the way you *say* ceiling changed); 7 skill docs now carry two canonical fragments: aux dispatches "default to the generation slot", ceiling requires the "[bee-tier: ceiling] marker plus a one-line justification".

## How it was verified

All evidence is recorded in cell traces and was re-run by the orchestrator (decision 0018):

- `hooks/test_model_guard.mjs` — spawn-based payload table, **42/42 rows** green: bare deny (stderr carries `bee-tier` + `FIX` + configured model), anchored-marker allow at prompt-head and description-start, **embedded-marker deny** (mid-prompt, mid-description), Agent + Task symmetry, `null`/array/non-string-cwd payloads exit 0 fail-open, throwing vendored `state.mjs` → exit 0 + crash record, config toggle off, no-repo, deny-log field assertions.
- `test_onboard_bee.mjs` — PASS, now with structural assertions: exactly one `Agent|Task` PreToolUse entry, write-guard matcher byte-identical, idempotence on second apply, plugin↔repo parity triples. The assertions were proven to bite (deliberate 3-way break → 3 named FAILs → restore).
- `test_lib.mjs` — 124/0 throughout.
- **Live-fire battery (in the real session, not synthetic stdin):** bare dispatch → DENIED (twice: pre- and post-fix-wave); dispatch with `[bee-tier: generation]` embedded mid-prompt → DENIED; `[bee-tier: extraction]` at prompt head → PASSED; every fix-wave worker spawn (`model: sonnet`) → PASSED. Six deny events in `.bee/logs/hooks.jsonl`, real payload keys `[description,prompt,run_in_background]`.
- Onboarding recheck `up_to_date` after both applies; vendored hook hash-identical to source; `.claude/settings.json` non-bee keys byte-identical to the pre-apply snapshot.

Not verified: nothing outstanding — the one plan assumption that stayed unproven at Gate 3 (live payload field names) was closed by the live-fire evidence above.

## How to test it yourself

1. Ask the agent to spawn any subagent **without** specifying a model — the call should be denied with a message that names the rule and the fix.
2. Look at `.bee/logs/hooks.jsonl` — the last line should be an `"event":"deny"` record for that attempt.
3. Ask again with "dùng sonnet" (or any explicit model) — it should go through.
4. To turn the guard off: set `"hooks": {"model-guard": false}` in `.bee/config.json`.

## Deviations from plan

- **The marker contract tightened mid-review.** Plan D1 said the marker could sit anywhere in the description or the first 500 prompt characters; review found that was injectable by quoted content (P1-1, corroborated security + architecture) and the fix wave anchored it to prompt-head/description-start. Decision 0023 and all docs now state the anchored rule; the 500-char window is gone.
- **Cell 4's "exactly one 0023 mention in 0015" check was superseded** by cell 7, which also amended 0015's transport sentence inline (so 0015 now mentions 0023 twice — Status line + amended sentence). Named in cell 7's action; the old count check does not re-run.
- **A git-history hiccup during wave 1:** hookbee's `--amend` briefly swept docbee's staged files into its commit; hookbee self-caught, reset, and re-committed cell-scoped. Final history is clean (verified per-commit stats).
- **anchorbee removed two stray log lines** its own red-reproduction runs wrote to the real `.bee/logs/hooks.jsonl`; the six genuine deny events are intact.

## Known limitations / follow-ups

- **P3-1** (backlog): `hooks/test_model_guard.mjs` leaks its mkdtemp fixture dirs; add cleanup in a `finally`.
- **P3-2** (backlog): `DEFAULT_CONFIG.hooks` in `onboard_bee.mjs` doesn't inventory the `model-guard` toggle for newly scaffolded configs (absent key still defaults on).
- The guard covers the **Claude Code runtime only** (D4): Codex has no per-agent model selection and no equivalent dispatch tool; its budget-in-prompt transport is unchanged.
- An allowed `[bee-tier: …]` marker with no `model` param still *inherits* the session model by mechanism — the marker asserts the orchestrator made a deliberate call; it cannot technically force a cheaper model.
- Friction noted for compounding: an external review-slot worker resolved a **stale bee source (0.1.18)** and tried to run onboarding mid-review; it stopped politely, but `--yolo` external runs could have downgraded `.bee/bin`. Worth a guard or a READ-ONLY convention in the external-reviewer protocol.
