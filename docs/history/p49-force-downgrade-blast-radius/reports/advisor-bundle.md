# Advisor consult — orchestrator pre-Gate-3 ask (lane: small, voluntary)

Feature: p49-force-downgrade-blast-radius (bee repo, onboarding CLI `skills/bee-hive/scripts/onboard_bee.mjs`)

## Plan summary

PBI P49 (v1.1.0 review P2): when onboarding refuses `--apply` on a forceable `blocked_downgrade`, the refusal payload the operator reads before deciding to pass `--force-downgrade` does not enumerate the `.bee/bin/**` runtime files (`copy_lib`/`copy_helper` plan items) the forced apply would overwrite. Dry-run mode already includes the full `plan`; the refused-apply object (`applyPlan()` onboard_bee.mjs:2388-2397, emitted main():2839-2856) carries only `{blocked, versions, skills.targets, beeVersion}` — and for the runtime-lib guard (`hostLibDowngradeBlock` :933-965) per-target skill items stay `[]`, so the operator sees nothing about the lib/helper blast radius.

Fix shape: add a `host_items` array — repoRoot-relative `{action: "copy_lib"|"copy_helper", path}` filtered from the already-computed `plan` — to the refused-apply blocked response when the block is forceable, mirroring the existing D2 forced-apply-transparency precedent for skill items (`computeSkillSyncTarget()` :883-894). No change to guard logic, block conditions, or what a forced apply executes. One cell, small lane: edit onboard_bee.mjs + add a three-step test in test_onboard_bee.mjs following the "10v. forced-apply transparency" pattern (:3260-3328): dry-run enumerates → refused apply enumerates → forced apply touches exactly the previewed set. Projected skill-tree copies (.claude/skills, .agents/skills) re-sync via self-onboard --apply, never hand-edited.

## Risk map

- applyPlan refusal payload shape: LOW — additive field; existing tests assert present fields, never absence of others (tolerant-net pattern).
- Test fixture drift: LOW — reuse 10v's own fixture scenario; known trap: hand-kept fixture lists rot (recurred 3x in this repo), so the test derives expectations from the computed plan, not a hand list.
- Semantics risk: `--force-downgrade` applies the WHOLE plan (skills + lib/helpers). The new field must reflect the plan actually pending at refusal time, not a recomputation that could drift.

## Validation findings

- Anchors verified by read-only code scan: plan items built at :2106 (copy_helper) / :2121 (copy_lib), repoRoot-relative, no scope field; refusal object built :2388-2397 with no plan key; force path :2367-2399 falls through to the write loop applying every pre-built plan item.
- Baseline full verify: green (exit 0) this session, pre-change.
- Existing coverage: flatSkillItems helper (test:1618-1620) asserts only skills.targets[].items; no test today asserts lib/helper enumeration in the refusal payload.

## Questions for the adviser

1. Any defect class or edge in this shape (e.g. forceable-vs-non-forceable gating of `host_items`, empty-drift case, unknown-version case) that the three-step test would miss?
2. Is `host_items` the right placement (sibling of `skills` in the refusal payload) versus attaching under `blocked`? Any compatibility concern for consumers parsing the refusal object?
3. Anything about the D2 precedent we would violate by NOT tagging these items with `scope`/`target` fields (skill items carry them; lib/helper items historically do not)?

Answer with: verdict (PROCEED / PROCEED-WITH-CHANGES / STOP), then numbered findings.
