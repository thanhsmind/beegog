# Review findings — model-tier-guard (standard lane, 4 core reviewers)

Date: 2026-07-11 · Reviewers: code-quality, architecture, security, test-coverage — all external review-slot executors (codex gpt-5.6-sol per config), isolated context (diff fc65f4e..HEAD + plan.md). Raw reports: `.bee/workers/mtg-review-*.result.md`. Synthesis: orchestrator, after all four returned.

Severity mechanics applied: independent scoring; corroboration across reviewers promotes one level; disagreement resolves conservative. Orchestrator code-confirmed the two load-bearing clusters before synthesis (marked CONFIRMED).

## P1 — block merge (5 clusters)

**P1-1 · Unanchored tier marker = control-data injection (CONFIRMED).** security P2 + architecture P2, corroborated → P1. `hooks/bee-model-guard.mjs:21` regex is unanchored and `:94-101` searches the whole description + first 500 prompt chars. Quoted plan text, user content, or retrieved docs containing `[bee-tier: generation]` near the prompt head satisfies the transport with no tier decision made — recreating the silent-inheritance failure the guard exists to prevent. Fix: anchor the marker to a reserved position (first non-whitespace token of `prompt`, or `description` beginning with the marker); negative tests for embedded occurrences. autofix_class: gated_auto.

**P1-2 · Malformed top-level payload escapes fail-open (CONFIRMED live).** code-quality P2 (code defect) + test-coverage P2 (missing crash-path tests), corroborated cluster → P1. `echo null | node hooks/bee-model-guard.mjs` → uncaught TypeError at `:106` (`payload.cwd` on null), exit 1 — the D2 contract requires exit 0 fail-open with a logged crash. Also untested: corrupt/throwing vendored `state.mjs` (the catch at `:120-151` has no exercising fixture). Fix: normalize payload to a plain object + string-only `cwd` before use; add fixtures: `null` payload, array payload, non-string cwd, throwing `state.mjs` (expect exit 0 + crash record in hooks.jsonl). autofix_class: gated_auto.

**P1-3 · `Task` path declared but untested.** code-quality P2 + test-coverage P2, corroborated → P1. `DISPATCH_TOOLS` includes `Task` (`:19`) and the matcher registers `Agent|Task`, but every dispatch row in `hooks/test_model_guard.mjs` uses `Agent`. A refactor dropping `Task` stays green while legacy dispatches inherit silently. Fix: table-drive the tool dimension — bare-deny + explicit-tier allow for both names. autofix_class: gated_auto.

**P1-4 · Onboarding test proves filename presence, not wiring.** test-coverage P2 + code-quality P2 (+ architecture P3 parity variant), corroborated → P1. `test_onboard_bee.mjs:398-410` string-searches serialized settings; wrong event, wrong matcher, or duplication on second apply all stay green; idempotence count covers only `bee-session-init.mjs`. Fix: structural assertions — exactly one PreToolUse entry with matcher `Agent|Task` whose command names the hook, write-guard matcher unchanged, same count after second apply; plus a plugin↔repo parity check normalizing command roots. autofix_class: gated_auto.

**P1-5 · Superseded transport wording still operative in canonical docs.** architecture P2 + code-quality P3 → disagreement resolves conservative (P2), corroboration promotes → P1. `docs/decisions/0015-ceiling-is-the-session-model.md:19` and `skills/bee-swarming/references/swarming-reference.md:39,50` still describe omission-only ceiling transport; an agent following them emits a bare dispatch and is denied by the new hook — one authoritative reference exposing two incompatible contracts. Loud failure (deny + FIX), hence the reviewers' split; promotion rule applied as written. Fix: amend the three sentences inline ("omit `model` **and** carry `[bee-tier: ceiling]`"). autofix_class: gated_auto.

## P2 — backlog, non-blocking

_None standalone — every P2 was absorbed into a corroborated P1 cluster above._

## P3 — backlog, non-blocking

- **P3-1** Test fixtures leak (`mkdtempSync`, no cleanup) — `hooks/test_model_guard.mjs`. (code-quality)
- **P3-2** `DEFAULT_CONFIG.hooks` in `onboard_bee.mjs:65-73` omits `model-guard`, so scaffolded configs don't inventory the toggle. (architecture)

## Gates run by the orchestrator

- Verification-evidence gate (§3): PASS — all 4 behavior_change cells carry red + green evidence in their traces.
- Artifact verification (§4): PASS — hook/test/decision docs EXISTS+SUBSTANTIVE (164/239/45 lines), registration in all three surfaces, vendored hash parity, installed-skill sync grep; WIRED proven by the in-session live-fire deny (hooks.jsonl event 2026-07-11T06:10:32Z with real payload keys `[description,prompt,run_in_background]`).
- Frozen judge: intact on all 4 cells; the one test-file change (cell 2) was declared and red-first.
- Project gates: `test_lib.mjs` 124/0, `test_onboard_bee.mjs` PASS, `hooks/test_model_guard.mjs` 14/14 — fresh outputs quoted in the swarm goal-checks.

## UAT items (SEE/CALL/RUN)

- RUN: bare Agent dispatch in a live session → denied with rule + FIX message; deny event logged with real payload keys. Evidence captured in-session 2026-07-11 (see above). Awaiting human confirmation at Gate 4.
- RUN: explicit dispatch (`model` param) and marker dispatch pass through — demonstrated by the wave-2/3 worker spawns (model: sonnet) succeeding after the hook was wired.

## Fix wave (post-Gate-4 decision, owner approved fixing 2026-07-11)

- **P1-1 fixed** (cell 5, commit c943def): marker anchored to prompt-head / description-start; 500-char window deleted; negative rows added. **Live-fire re-proof:** embedded-marker dispatch DENIED in-session; anchored-marker dispatch PASSED.
- **P1-2 fixed** (cell 5): payload normalized before access; `echo null` now exit 0 empty stderr; throwing state.mjs fixture -> exit 0 + crash record.
- **P1-3 fixed** (cell 5): tool-name dimension table-driven (Agent + Task), 42/42 rows green.
- **P1-4 fixed** (cell 6, commit d98a730): structural PreToolUse assertions (exactly one Agent|Task entry, write-guard matcher byte-identical, idempotence count on second apply) + plugin/repo parity triples; assertions proven to bite (deliberate 3-way break -> 3 named FAILs -> restore).
- **P1-5 fixed** (cell 7, commit 1419a45): 0015/0023/swarming SKILL+reference now state omission+anchored-marker as one inseparable transport; re-vendored via onboarding apply (hash parity, recheck up_to_date, settings snapshot byte-identical).

All 7 cells capped, goal-checked, judge-intact. Live-fire battery 2026-07-11: bare DENY, embedded-marker DENY, anchored-marker PASS, model-param PASS (every fix-wave worker spawn). P1 open count: 0.
