# Worker report — model-tier-guard-4

**Status:** [DONE]
**Outcome:** decision 0023 written, 0015 amended (single Status line), decision logged, onboarding applied (hook vendored, settings.json wired, 7 skills synced), verify green.

## Files touched

- `docs/decisions/0023-explicit-tier-transport.md` (new)
- `docs/decisions/0015-ceiling-is-the-session-model.md` (single Status amendment line, `grep -c "0023"` = 1)
- `.bee/decisions.jsonl` (decision `d50564fa-cc57-457a-8178-1e06b8a5b319`)
- `.claude/settings.json` (merged by onboarding apply — `PreToolUse` `Agent|Task` -> `.bee/bin/hooks/bee-model-guard.mjs`; `statusLine`/`permissions`/`enabledPlugins` byte-identical to pre-apply snapshot)
- `.bee/bin/hooks/bee-model-guard.mjs` (vendored by onboarding apply)
- `.bee/workers/mtg-settings-pre.json` (pre-apply snapshot, written before apply)

## Verify

Command: the cell's verify script (see `.bee/cells/model-tier-guard-4.json` `verify` field).

- Red run (before any edits): `NO-DOC`, `PRINCIPLE-NOT-RESTATED`, `BAD-0015-AMEND-COUNT`, `NO-JSONL-ENTRY`, `NOT-WIRED`, `SETTINGS-CHECK-FAILED`, `NOT-VENDORED`, `VENDORED-NOT-DENYING`, `RECHECK:changes_needed`, `RECHECK-NOT-CLEAN`, `INSTALLED-SKILL-NOT-SYNCED` (exit 1, no `PASS`).
- Green run (after implementation): `ONBOARD-OK` / `PASS` (exit 0).

Full trace/evidence (including `verification_evidence` and verify output) is on the cell: `.bee/cells/model-tier-guard-4.json`.

## Onboarding

Dry-run (`node skills/bee-hive/scripts/onboard_bee.mjs --repo-root . --json`): `status: changes_needed`, plan = 7 `sync_skill` items (bee-exploring, bee-grooming, bee-hive, bee-planning, bee-scribing, bee-swarming, bee-xia), versions all `0.1.19` (source/host_helpers/installed_skills) — no downgrade, no blocked state.

Apply (`--apply --repo-hooks --json`): `status: applied` — `copy_repo_hook` (`.bee/bin/hooks/bee-model-guard.mjs`), `merge_repo_hook_settings` (`.claude/settings.json`), `write_onboarding`, plus the same 7 `sync_skill` items. `recheck: up_to_date`, `recheck_plan: []`.

## Smoke check (not the live-fire)

Piped a synthetic bare payload (`{"tool_name":"Agent","tool_input":{"prompt":"x"}}`) into the vendored `.bee/bin/hooks/bee-model-guard.mjs`: printed the FIX reason naming `sonnet` and exited 2. This is a synthetic stdin smoke check only — the real in-session denied Agent dispatch and its `.bee/logs/hooks.jsonl` `event:"deny"` line are the **orchestrator's** acceptance duty per the cell spec and decision 0018, and double as the Gate 4 UAT RUN item.

## Deviations

None. One self-caught prose typo in the 0023 draft (`suf1yfient` → `sufficient`) was fixed before the phrase-grep checks ran; not a deviation from the cell's action/spec.

## Prohibitions honored

- No hand-editing of `.claude/settings.json` or `.bee/bin/hooks/*` — both were written exclusively by `onboard_bee.mjs --apply --repo-hooks`.
- `--force-downgrade` was never passed.
- `docs/decisions/0015-ceiling-is-the-session-model.md` received exactly one new line (the Status amendment); `grep -c "0023"` on it is 1.

Full cell trace: `.bee/cells/model-tier-guard-4.json`.
