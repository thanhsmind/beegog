---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: standard
feature: harness09
---

# Plan — harness09: adopt learn-harness-engineering items 1–5

Source of truth for scope: [CONTEXT.md](CONTEXT.md) (D1–D8). Evidence:
[docs/09-harness-course-adoption.md](../../09-harness-course-adoption.md).

## Slice 1 — standard paths + baseline gate (D1–D4) · lane: standard-within-feature

**Requirement:** a bee repo can record its host project's `setup/start/test/verify`
commands once, and every session sees them and checks the baseline before work.

Touches: `skills/bee-hive/templates/lib/inject.mjs`, `templates/bee_status.mjs`,
`templates/AGENTS.block.md`, `scripts/onboard_bee.mjs`, `skills/bee-hive/SKILL.md`
(scout paragraph), `skills/bee-exploring` (capture note), `skills/bee-scribing`
(keep-current note), `templates/tests/test_lib.mjs`, managed-version bumps.

Acceptance:
- [ ] `config.json` accepts optional `commands: {setup?, start?, test?, verify?}`; absent key changes nothing.
- [ ] `bee_status` prints the commands; warns (non-blocking) when the object is absent.
- [ ] Session preamble (hook + AGENTS path, one `inject.mjs` source) shows the commands when present.
- [ ] AGENTS block Startup: run `commands.verify` once per session before claiming cells; red baseline → fix-first tiny cell. Session finish: verify green.
- [ ] Onboarding offers command capture, skippable; idempotency tests green.
- [ ] bee's own repo re-onboarded as smoke; CREATION-LOG notes on touched skills.

## Slice 2 — friction layer field (D5) · lane: tiny

**Requirement:** friction entries can carry `layer: spec|context|environment|verification|state`;
grooming's entropy report adds one "friction by layer — bottleneck: X" line.
Touches: `bee-compounding` reference (entry format), `bee-grooming` reference (report line).
Acceptance: format documented in both references + CREATION-LOG notes; taxonomy reusable by future interventions.jsonl (08 item 2) without rework.

## Slice 3 — promotion order: check first, prose second (D6) · lane: tiny

**Requirement:** compounding's promotion step states the order — twice-seen finding →
executable check first (grep/lint in verify, guard, hook denial), `critical-patterns.md`
only for what can't be mechanized; grooming grades promote-to-check proposals tiny/small.
Touches: `bee-compounding` SKILL + reference, `bee-grooming` reference.
Acceptance: promotion decision tree written; CREATION-LOG notes.

## Slice 4 — Fresh Session Test probe (D7) · lane: tiny

**Requirement:** grooming's hunt checklist gains the five-question probe with artifact
mapping; unanswerable question → backlog item naming the missing artifact.
Touches: `bee-grooming` reference.
Acceptance: probe listed with all five mappings; CREATION-LOG note.

## Slice 5 — ERROR/WHY/FIX denial contract (D8) · lane: small

**Requirement:** 07-contracts.md states the refusal contract; every `bin/lib`/hook denial
string audited to name rule + reason + next action; tests assert message shape for the
cap-refusal, gate-block, and reservation-conflict paths.
Touches: `docs/07-contracts.md`, `templates/lib/guards.mjs`/`cells.mjs` strings (only
where non-compliant), `templates/tests/test_lib.mjs`.
Acceptance: contract section present; audit table in the slice report; assertions green.

## Current-slice cells (slice 1, created at prep)

| Cell | Scope | Lane | Deps |
|---|---|---|---|
| harness09-1 | lib surface: `state.mjs` config normalization, `inject.mjs` commands section, `bee_status` print+warn, `test_lib.mjs` assertions | small | — |
| harness09-2 | AGENTS block startup step + session-finish item; onboarding capture path + version handling; onboarding tests | small | — |
| harness09-3 | skill text: hive scout paragraph, exploring capture note, scribing keep-current note, CREATION-LOG notes | tiny | — |
| harness09-4 | re-onboard bee's own repo (sync vendored bin + AGENTS block), set bee's own `commands`, end-to-end smoke | small | 1, 2, 3 |

Reality-gate notes: `readConfig` already passes unknown config keys through (verified in `state.mjs`), so the `commands` key is additive with zero migration; `inject.mjs` is the confirmed single source for hook + AGENTS + status preambles; both test suites exist and run standalone.

## Order & verification

1 → (2,3,4 in any order) → 5. Feature-level verify: `node skills/bee-hive/templates/tests/test_lib.mjs`
and `node skills/bee-hive/scripts/test_onboard_bee.mjs` both green, plus the slice-1 smoke.
Cells are created per slice at prep time (after Gate 2), one commit per cell, cell id in message.
