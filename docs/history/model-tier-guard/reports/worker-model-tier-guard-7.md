# Worker report — model-tier-guard-7

[DONE] Fixed P1-5 (superseded transport wording) and propagated the P1-1 anchored-marker contract from the already-landed hook (commit c943def) into the durable docs, then re-vendored via onboarding apply.

Files touched:
- docs/decisions/0015-ceiling-is-the-session-model.md — omission sentence now pairs the model-param omission with the `[bee-tier: ceiling]` marker (decision 0023); no new Status lines added.
- docs/decisions/0023-explicit-tier-transport.md — transport clause replaced the first-500-characters scan window with the anchored position rule (first non-whitespace token of prompt, or description-start); added a hardening note to the Status line, dated 2026-07-11.
- skills/bee-swarming/SKILL.md — step 4's `inherit`/`budget` tier resolution now states the anchored marker position.
- skills/bee-swarming/references/swarming-reference.md — the ceiling bullet, the `resolveTier` code note, and the explicit-tier-marker paragraph all now describe the anchored inherit/budget transport.
- .bee/bin/hooks/bee-model-guard.mjs — re-vendored (hash-identical to `hooks/bee-model-guard.mjs`, owned by cell 5, untouched by hand).
- .bee/onboarding.json — updated managed hash record for the re-vendored hook.

Re-vendor: `node skills/bee-hive/scripts/onboard_bee.mjs --repo-root . --apply --repo-hooks --json` → `status: applied`, `recheck: up_to_date`, no `--force-downgrade`, no `blocked_*` status. Installed skills (`~/.claude/skills/bee-swarming/{SKILL.md,references/swarming-reference.md}`) diffed clean against source post-apply. `.claude/settings.json` non-bee keys (`statusLine`, `permissions`, `enabledPlugins`) confirmed byte-identical to the cell-4 snapshot `.bee/workers/mtg-settings-pre.json` before and after apply (file itself untouched by this cell — no PreToolUse change was needed).

Verification: cell verify command run red-first (`0023-NO-ANCHOR-RULE`, `REF-NO-ANCHOR-RULE`, `VENDOR-DRIFT`, `RECHECK-NOT-CLEAN`, exit 1) before edits, then green (`LIB-OK`, `PASS`, exit 0) after edits + re-vendor. Frozen judge intact (no undeclared test/CI/lockfile changes). Full trace/evidence: `.bee/cells/model-tier-guard-7.json`.

Capped at 2026-07-11T06:34:37.266Z.
