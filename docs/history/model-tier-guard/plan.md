---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: standard
---

# model-tier-guard — enforce model-tier discipline on subagent dispatch

## Scoping synthesis (surface-scope-earlier, in place of CONTEXT.md)

Owner observation (2026-07-11): during real runs many subagents inherit the session
model (the most expensive one) instead of running on the generation tier.
`bee_status` confirms: `tier_mix.ceilingShare = 0.4`, 21 untiered cells.

Root cause, three layers:
1. The Agent tool inherits the parent model when `model` is omitted, and bee's
   ceiling transport (decision 0015 wording in `bee-swarming/SKILL.md:40`) is
   "inherit → omit the model param" — so *deliberate ceiling* and *forgot to set
   model* are the same tool call. Every miss silently lands on the priciest model.
2. Only pipeline-core skills (swarming, reviewing, validating, exploring
   fresh-eyes) carry tier instructions. Aux dispatches — planning research,
   grooming, scribing, xia — say nothing about model, so they inherit.
3. Nothing enforces the rule: the repo PreToolUse matcher is
   `Edit|Write|MultiEdit|Bash|Read|Glob|Grep` — no `Agent`.

### Locked decisions

- **D1 — explicit-tier transport.** Every Agent dispatch carries an explicit tier:
  either the `model` param (resolveTier `{type:'model'}`) or a `[bee-tier: <tier>]`
  marker in the prompt (first 500 chars) or description. Ceiling = omit `model` +
  `[bee-tier: ceiling]`. Budget (external/runtime-can't-select) = omit `model` +
  `[bee-tier: <tier>]` with the budget stated in the prompt, as today. A bare
  dispatch (no param, no marker) is an error and is denied. This supersedes ONLY
  the omit-param *transport* of decision 0015; "ceiling is never configured, it is
  the session model" stands unchanged.
- **D2 — the guard is a hook, fail-open, toggleable.** New PreToolUse hook
  `hooks/bee-model-guard.mjs` (plugin source of truth), matcher `Agent|Task`
  (current + legacy tool name). Deny = exit 2, reason on stderr with a FIX line
  naming the configured generation model (`config.models.<runtime>.generation`).
  Crash/missing-state/parse-miss = exit 0 (fail-open), crash logged to
  `.bee/logs/hooks.jsonl`. Toggle via the existing `hookEnabled(root, "model-guard")`
  config mechanism, on by default like the other hooks.
- **D3 — aux skills default to generation.** One line each in bee-planning,
  bee-grooming, bee-scribing, bee-xia, bee-exploring SKILL.md: ad-hoc/aux
  dispatches default to the generation slot model; ceiling requires the
  `[bee-tier: ceiling]` marker plus a one-line justification. bee-swarming
  SKILL.md step 4 + swarming-reference resolveTier table update their transport
  wording (`inherit` → omit param **and** carry the marker).
- **D4 — codex runtime untouched.** `.codex/hooks.json` gets no Agent matcher:
  Codex has no per-agent model selection (tier is already prompt-enforced budget)
  and no equivalent dispatch tool; adding a dead matcher claims support we can't
  test.

## Mode gate

Flags counted: **existing covered behavior** (onboard_bee.mjs repo-hooks stage is
covered by test_onboard_bee.mjs, which hard-codes the hook list), **cross-platform**
(hooks execute under WSL/Windows Git Bash — see critical pattern 20260708),
**multi-domain** (hook runtime + onboarding sync + skill docs). 3 flags → **standard**.
Smaller modes are insufficient: ~8 files across three domains with covered behavior
changing; `small` (≤3 files) would be dishonest.

## Discovery

L0/L1 — all patterns exist in-repo, cited inline: deny convention from
`bee-write-guard.mjs` (exit 2 + stderr, fail-open exit 0, crash log); payload
reading + repo-root walk from `bee-chain-nudge.mjs`; registration surface mapped
(`hooks/hooks.json`, `onboard_bee.mjs` HOOK_FILENAMES:45 + renderRepoHookEntries:952,
`test_onboard_bee.mjs:399` hard-coded list; sync is sha256-hash-based per file, so
no version bump is required for the hook to propagate). L1 check for validating:
confirm the PreToolUse payload field names for the Agent tool (`tool_name`,
`tool_input.model`, `tool_input.prompt`, `tool_input.description`) against a live
hook log before trusting them.

## Approach

Chosen path: enforce at the hook layer (mechanical, survives model forgetfulness),
teach at the skill layer (defaults), record at the decision layer (supersede the
transport clause). Rejected alternatives:
- *Docs-only patch (skill one-liners, no hook):* rejected — the instructions
  already exist in core skills and the leak still happened; unenforced text is
  the failure mode, not the fix.
- *Require an explicit model name for ceiling (e.g. `model: fable`):* rejected —
  breaks decision 0015 (ceiling = whatever the session runs, never a configured
  name) and would pin a model id into calls.
- *Hook auto-injects a model instead of denying:* rejected — PreToolUse deny +
  retry keeps the orchestrator's judgment in the loop (decision 0016: tier is
  judged at dispatch); silent rewriting hides the decision.

Risk map:
- Hook false-denies legitimate transports (budget/cli dispatches) — MEDIUM →
  proof: the marker rule covers budget; validating writes a payload table
  (bare / model / ceiling-marker / budget-marker / junk stdin) and pipes each
  through the hook.
- Payload field-name mismatch (Agent vs Task, `tool_input` shape) — MEDIUM →
  proof: live-fire one denied dispatch in this session after vendoring
  (Gate 4 UAT item), plus fail-open on unknown shapes.
- Onboarding merge/test drift (hard-coded lists in three places) — LOW →
  test_onboard_bee.mjs updated red-first in the same cell as the registration.
- Skill-sync propagation to ~/.claude/skills — LOW → hash-parity sync verified
  in the skill-sync feature (2026-07-11 UAT); rerun onboarding recheck.

Likely files, in order:
1. `hooks/bee-model-guard.mjs` (new)
2. `hooks/hooks.json` (+PreToolUse Agent|Task entry)
3. `skills/bee-hive/scripts/onboard_bee.mjs` (HOOK_FILENAMES + renderRepoHookEntries)
4. `skills/bee-hive/scripts/test_onboard_bee.mjs` (hook list, red-first)
5. `skills/bee-swarming/SKILL.md` + `skills/bee-swarming/references/swarming-reference.md` (transport wording)
6. `skills/bee-planning/SKILL.md`, `skills/bee-grooming/SKILL.md`, `skills/bee-scribing/SKILL.md`, `skills/bee-xia/SKILL.md`, `skills/bee-exploring/SKILL.md` (one-liner each)
7. Repo apply: `onboard_bee.mjs --apply --repo-hooks` (vendors `.bee/bin/hooks/bee-model-guard.mjs`, merges `.claude/settings.json`, syncs installed skills)

Relevant learnings: critical pattern 20260708 (WSL /tmp invisible to node — hook
tests pipe via stdin, never /tmp file args); decision 0018 (evidence at the
orchestrator); decision aec38e11 (dispatch count discipline).

Open questions for validating:
- Exact PreToolUse `tool_name` for the subagent tool in current Claude Code
  ("Agent", "Task", or both across versions) — matcher covers both, but the
  hook's own tool_name check must not be narrower than the matcher.
- Does `hookEnabled` require a config entry to default-on, or default-on when
  absent? (Read `state.mjs` hookEnabled before wiring.)

## Test matrix sketch (standard depth)

| Dimension | Case |
|---|---|
| happy path | model param set → exit 0 silent |
| boundary | marker at char 490 of prompt → allowed; at char 600 → denied (window is 500) |
| absence | no model, no marker → exit 2, FIX names generation model |
| malformed input | non-JSON stdin, missing tool_input → exit 0 fail-open |
| config off | `hooks: {"model-guard": false}` → exit 0 silent |
| alt transport | `[bee-tier: generation]` marker, no param (budget) → allowed |
| wrong tool | payload tool_name Edit → exit 0 (defense beyond matcher) |
| no repo | cwd outside any .bee repo → exit 0 |
| casing | `[BEE-TIER: Ceiling]` → allowed (case-insensitive) |
| idempotence | onboarding --apply twice → no duplicate settings entries (existing test extends) |
| cross-platform | hook path resolution via findRepoRoot, no /tmp usage |
| regression | all 6 existing hooks still wired (test list) |

## Slices

Single slice (current): the four cells below. No future-slice cells.

1. **guard-hook** — write `hooks/bee-model-guard.mjs` + payload-table verify.
2. **registration** — hooks.json + onboard_bee.mjs + test_onboard_bee.mjs (red-first).
3. **skill-docs** — swarming transport wording + 5 aux one-liners.
4. **apply-and-decide** — run onboarding apply, live-fire deny check, write
   decision doc `docs/decisions/0023-explicit-tier-transport.md` (amends 0015's
   transport clause only), log to decisions.jsonl.

Gate 2 (shape) auto-approved via gate bypass (standard lane, recommended shape
taken as-is); advisor consult at shape satisfied inline — the session model IS
the configured advisor model (fable), verdict: shape approved. Open questions
resolved during prep: `hookEnabled` defaults ON when the config key is absent
(`state.mjs:283`, `!== false`); tool_name coverage `Agent|Task` confirmed by
design + a live-fire UAT item at Gate 4.
