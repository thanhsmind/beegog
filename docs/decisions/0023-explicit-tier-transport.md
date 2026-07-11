# 0023 — Explicit-tier transport for Agent/Task dispatch

- **Status:** active — owner-approved 2026-07-11 (gate bypass, standard lane); built in the model-tier-guard feature. Amends the transport clause of decision 0015 only. **Hardened 2026-07-11** (review-findings.md P1-1): the marker transport is anchored to a reserved position, not a scan window — see the Decision section below.
- **Date:** 2026-07-11
- **Source:** owner observation 2026-07-11, made while dogfooding a live session: `bee_status` showed `tier_mix.ceilingShare = 0.4` with 21 untiered cells — the session was running on Fable (the expensive ceiling model) and many subagent dispatches were silently inheriting it instead of running on the configured generation tier. Root-cause review found the Agent tool inherits the parent model whenever `model` is omitted, and until now bee's ceiling transport (0015, `bee-swarming/SKILL.md:40`) was simply "inherit → omit the `model` param" — so *deliberate ceiling* and *forgot to set a tier* were indistinguishable at the call site, and every miss silently landed on the priciest model. Only the pipeline-core skills carried tier instructions; aux dispatches (planning research, grooming, scribing, xia) said nothing about model and inherited by default.
- **Confidence:** 0.75 (the hook logic and skill wording are proven in-repo; the payload field names for the Agent/Task PreToolUse tool were confirmed by design plus a fail-open default, with a live-fire deny recorded as the Gate 4 UAT acceptance item).

## Decision

**Every Agent/Task dispatch must carry an explicit tier.** A dispatch expresses its tier one of two ways:

1. the `model` param (`resolveTier {type:'model'}`), or
2. a `[bee-tier: <tier>]` marker, case-insensitive, **anchored to a reserved position**: the first non-whitespace token of the prompt, or the description beginning with it (leading whitespace allowed either way). A marker occurring anywhere else — embedded after other prompt text, or mid-description — never satisfies the transport; it would let quoted plan text, user content, or retrieved docs forge the tier with no real decision made. (Hardened 2026-07-11 per review-findings.md P1-1; the original first-500-characters scan window is removed.)

Ceiling is expressed by **omitting** `model` **and** adding `[bee-tier: ceiling]` — that combination, not omission alone, is what now means "run this on the session model." Budget dispatches (external/runtime-can't-select-a-model calls) omit `model` and carry `[bee-tier: <tier>]` with the budget stated in the prompt, exactly as before. A **bare** dispatch — no `model` param and no marker — is an error: it is denied by the new `bee-model-guard.mjs` PreToolUse hook (matcher `Agent|Task`), which exits 2 with a FIX line naming the configured generation model, and fails open (exit 0) on any crash, missing state, or unrecognized payload shape.

This decision **amends only the transport clause of decision 0015**: under 0015, omitting the `model` param was, by itself, sufficient to mean "inherit the session model." Under 0023, omission alone is no longer enough to express ceiling — it must be paired with the `[bee-tier: ceiling]` marker so a forgotten tier is mechanically distinguishable from a deliberate one. The principle 0015 established stands unweakened: **the ceiling is the session model, never configured** — there is still no `ceiling` key anywhere in `models` config, and the ceiling tier still cannot be pinned to a named model. 0023 only changes how a caller *signals* that it intends the ceiling, not what the ceiling *is*.

## Rationale

- **Mechanical enforcement beats prose.** The instruction to tier dispatches already existed in the pipeline-core skills before this decision, and the leak happened anyway — unenforced text is the failure mode, not the fix. A PreToolUse deny keeps the orchestrator's judgment in the loop (decision 0016: tier is judged at dispatch) without silently rewriting anyone's call.
- **Ambiguity was the actual bug.** "Omit param" meant two different things (deliberate ceiling vs. forgotten tier) and the tool call itself could not tell them apart. Requiring a marker alongside the omission removes the ambiguity at the source, not after the fact.
- **The 0015 principle is orthogonal to transport.** Nothing about *how a call announces its tier* changes *what the ceiling tier is*. The ceiling is still, and only ever, the model the session itself is running on — 0023 is a signalling fix, not a re-litigation of 0015.

## Alternatives considered

- **Docs-only patch (skill one-liners, no hook).** Rejected — the instructions already existed in core skills and the leak still happened; unenforced text is not a fix.
- **Require an explicit model name for ceiling (e.g. `model: fable`).** Rejected — this would break 0015 outright (ceiling = whatever the session runs, never a configured name) and would pin a model id into calls.
- **Hook auto-injects a model instead of denying.** Rejected — silent rewriting hides the decision from the orchestrator; a PreToolUse deny + retry keeps a human/orchestrator judgment call at the dispatch site.

## Scope (built)

- `hooks/bee-model-guard.mjs` (new, plugin source of truth) — PreToolUse, matcher `Agent|Task`, deny = exit 2 + stderr reason/FIX, fail-open (exit 0) on crash/missing-state/parse-miss, crash logged to `.bee/logs/hooks.jsonl`; toggle via `hookEnabled(root, "model-guard")` (on by default).
- `hooks/hooks.json` — `PreToolUse` entry added for the `Agent|Task` matcher pointing at `bee-model-guard.mjs`.
- `skills/bee-hive/scripts/onboard_bee.mjs` — `HOOK_FILENAMES` + `renderRepoHookEntries` updated so onboarding vendors and wires the hook.
- `skills/bee-hive/scripts/test_onboard_bee.mjs` — hook list extended, red-first.
- `skills/bee-swarming/SKILL.md` + `skills/bee-swarming/references/swarming-reference.md` — transport wording updated (`inherit` → omit `model` **and** carry the `[bee-tier: ceiling]` marker).
- `skills/bee-planning/SKILL.md`, `skills/bee-grooming/SKILL.md`, `skills/bee-scribing/SKILL.md`, `skills/bee-xia/SKILL.md`, `skills/bee-exploring/SKILL.md` — one line each: ad-hoc/aux dispatches default to the generation slot model; ceiling requires the `[bee-tier: ceiling]` marker plus a one-line justification.
- Repo apply: `onboard_bee.mjs --apply --repo-hooks` vendors `.bee/bin/hooks/bee-model-guard.mjs`, merges the `.claude/settings.json` `PreToolUse` entry, and hash-syncs the updated skill docs to the installed skills tree.
- `.codex/hooks.json` is deliberately untouched (decision D4 in the feature plan): Codex has no per-agent model selection tool and no equivalent dispatch surface, so adding a matcher there would claim support that cannot be tested.

## Consequences

- Any Agent/Task dispatch written before this decision that relied on bare omission to mean ceiling will now be denied until it adds the `[bee-tier: ceiling]` marker (or a `model` param). This is intentional — it is exactly the silent-inheritance failure mode this decision closes.
- The hook is fail-open by design: a crash, an unrecognized payload shape, or a disabled `.bee` state never blocks a dispatch — it only fails to catch a bare one. Payload-shape drift across Claude Code versions is the main residual risk, tracked via the Gate 4 live-fire UAT item.
