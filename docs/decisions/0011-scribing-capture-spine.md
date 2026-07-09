# 0011 — Capture-mode needs a mechanical spine (scribing debt)

- **Status:** active — owner-approved 2026-07-09; **built in 0.1.8** (2026-07-09). Implemented in the shared lib + hook + prose below; lib suite green (60/60), onboarding suite green. Not yet redeployed to dogfood repos and not yet dogfooded — that is the remaining debt.
- **Date:** 2026-07-09
- **Source:** real-case review of the dogfood repo `~/projects/anphabe/anphabe-gogl` (WSL). Feature `actor-tracking` was `phase: swarming` with `behavior_change` cells capped across 2026-07-07→09, yet `docs/specs/` did not update until the owner **ran `bee-scribing` by hand**. Owner asked why capture did not engage on its own and to recalibrate the harness.
- **Confidence:** 0.75 (the gap is confirmed from the installed mechanism; the specific spine below is designed but not yet dogfooded).

## The finding — capture-mode has zero enforcement

Decisions 0001/0002 gave scribing a **capture mode**: "trigger is SETTLEMENT not subject matter — any discuss→build→test→adjust loop that lands an outcome is merged immediately, **any phase**." Vision principle 11 ("the meaning outlives the stack") is the whole reason it exists: settled knowledge must not evaporate when the session closes.

But in the shipped harness that contract is **prose only**. A full inventory of what could trigger scribing when a `behavior_change` cell caps mid-swarming:

| Mechanism | Fires scribing on a `behavior_change` cap during swarming? |
|---|---|
| `capCell` (`lib/cells.mjs`) | No — validates evidence + "before" (D0009), returns `Capped X`, no signal |
| `bee_cells.mjs cap` | No — prints `Capped X at …` |
| `bee-chain-nudge` (SubagentStop) | No — nudges STATUS collection / reviewer synthesis only; "next chain step" is vague prose |
| `bee-state-sync` | No — no scribing/capture output |
| `bee-session-close` capture-nudge | Weak — Stop-only, keyed on a *decision* newer than every spec (not on capped cells), deduped |
| `bee-compounding` guard | Yes — but only at **feature close** (after Gate 4). For a multi-day feature this is far too late, which is exactly what capture-mode exists to avoid |

Net: **no mechanical trigger bells scribing at the moment a `behavior_change` cell caps.** Between cap and feature-close, specs go stale until a human remembers. This is the same class of defect as decision 0004 / the v0.1.1 idle-gate lesson — *"default-closed beats prompt-level routing; enforcement must lead the workflow"* — a lesson already applied to the write-guard but never applied to capture-mode.

Note the correct half: **chain-position scribing** (reviewing → scribing → compounding, after Gate 4) works — it ran fine when invoked. The hole is specifically capture-mode's "immediately, any phase" promise.

## Decision

Give capture-mode a **mechanical spine** derived from data the harness already has — no new files, works on both runtimes (one brain, shared `lib/`):

1. **`scribingDebt(root)`** (shared lib, `lib/cells.mjs` or `lib/state.mjs`): the set of cells with `behavior_change === true` and `capped_at > last_scribing_run.date` (scoped to the active feature). Pure, runtime-agnostic.
2. **`bee-chain-nudge` (Claude Code belt):** in the swarming/worker branch, when `scribingDebt > 0`, append a loud line — *"⚠ N behavior_change cell(s) capped since last capture — run bee-scribing capture now; do not wait for review."*
3. **Visibility (both belts):** `buildSessionPreamble` (`lib/inject.mjs`) and `bee_status` print `Scribing debt: N cells (capture pending)` so it shows at session start and on every status check.
4. **(Optional escalation, decide at build):** past a threshold (e.g. ≥3), `bee-session-close` warns regardless of the decision-recency check; or `write-guard` warns (never blocks) on further source writes.

Keep the prose capture-on-settlement contract for settlements that land **in discussion only** (no cell) — those cannot be detected mechanically. Principle: **mechanize what is mechanizable (behavior_change caps); prose covers the rest.**

## Rationale

- **Restores the "immediately" contract with a spine.** Compounding's end-of-feature guard stays as the backstop; the debt signal makes capture engage in-flight, which is the point of capture-mode.
- **Reuses existing data.** No new artifact, no new classification — `behavior_change` and `capped_at` and `last_scribing_run.date` already exist. Derivation only.
- **One brain, two belts.** The debt function lives in shared `lib/`; the CLI (`bee_status`) surfaces it for Codex and plugin-less agents, the hooks surface it for Claude Code. No second enforcement path to drift.
- **Always visible beats occasionally nudged.** A standing preamble/status line does not depend on a hook firing at the right instant.

## Alternatives considered

- **Do nothing (rely on prose + compounding guard).** Rejected — that is the status quo that failed in anphabe-gogl.
- **Hard-block source writes when debt > 0 (write-guard exit 2).** Rejected as the default — too aggressive mid-swarming; a warn is proportionate. Left as an opt-in escalation.
- **Signal at cap time only (print a nudge from `bee_cells.mjs cap`).** Insufficient alone — a one-shot line scrolls away; the standing debt view is what persists. Can be added as a cheap extra.
- **Auto-run scribing on cap.** Rejected — scribing is a skill (judgment: sources, rebuild bar, Open Gaps), not a mechanical merge; auto-running it produces exactly the shallow spec decision 0002 exists to prevent.

## Scope (when built)

- Shared lib: `scribingDebt` in `.bee/bin/lib/` + mirror `skills/bee-hive/templates/lib/`.
- Hooks: `hooks/bee-chain-nudge.mjs` (swarming branch), optionally `bee-session-close.mjs`.
- Visibility: `lib/inject.mjs` (preamble line), `bee_status.mjs`.
- Prose: `bee-scribing/SKILL.md` + `references/scribing-reference.md` (capture-mode now cites the debt signal), `bee-compounding` guard note.
- Tests: `skills/bee-hive/templates/tests/test_lib.mjs` (debt computation fixtures).
- Redeploy to dogfood repos via `onboard_bee.mjs --repo-hooks`; never hand-patch vendored copies.
- Version 0.1.7 → 0.1.8.

## Consequences

- The "meaning outlives the stack" invariant gains an enforcement spine for the cell-backed majority of settlements; discussion-only settlements remain prose-covered (documented limitation).
- Recorded debt honoring D0002's gate: the workflow gap named here is "capture-mode fires in-flight" — no new skill, an existing-skill trigger fix.
- Not yet dogfooded — build + pressure test (does the nudge actually get acted on, does debt clear correctly after a partial sync) is the debt to close before 1.0.
