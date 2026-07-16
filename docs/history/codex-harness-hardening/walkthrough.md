# Review Walkthrough — codex-harness-hardening (+1c/+p2/+1d, codex-bypass-per-skill)

**Date:** 2026-07-16
**Review session:** `unreviewed-batch-20260716`
**Scope range:** `0847310..beb75c9`

## What shipped

Hardening across the Codex/Claude harness surface: a drift detector, a source
classifier, a shared hasher, a sha256 manifest check, fail-closed downgrade
blocking, and the machine-checked gate-bypass doctrine (levels
`normal`/`full`/`total`, incl. per-skill bypass via `codex-bypass-per-skill`).
`commands.verify` grew from 6 to 16 suites over the range, each new guard
carrying its own regression test. The operative Codex spawn documentation
(`swarming-reference.md`) and its ORCH-01 conformance census were part of
this range.

## Review findings for this feature

**P1 — FIXED.** Operative Codex spawn doc taught the retired API; the
ORCH-01 census was red and unwired from verify (architecture + test-coverage,
corroborated). `swarming-reference.md:120,123,125` still used
`spawn_agent(agent_type=…, fork_context=…)` and re-spawn prose, forbidden by
SPEC ORCH-01; `census_stale_spawn_syntax.mjs` exited 1 with 4 violations and
was absent from `commands.verify`.
**Fix cell `codex-harness-hardening-6`:** table rewritten to
`spawn_agent({task_name, message, fork_turns:"none"})` /
`followup_task({target, message})`; projections synced; census now green and
wired as verify suite #16.

**P2 — open, backlog.** No template-parity guard exists for the runtime
dispatcher `.bee/bin/bee.mjs` itself — the PROJ-08 hazard `test_lib_mirror`
names is open for the dispatcher (test-coverage; `test_lib_mirror` scopes
`lib/` + `hooks/` only, `release_manifest` omits `.bee/bin/bee.mjs`).
Autofix class: gated_auto.

**P3 — open, backlog (6 items):**
- `onboarding.drift_detail` is a conditional JSON key (api-contract).
- Security posture note: `gate_bypass: "total"` intentionally lifts the
  high-risk floor including secret reads — intended, documented, banner +
  audit trail (security).
- `.codex/config.toml` `approval_policy = "never"` combined with
  `gate_bypass: "total"` are committed repo-wide, inherited by every clone
  (security).
- Two file-hash conventions coexist: `fsutil.hashFile` (utf8) vs
  `release_manifest.sha256File` (buffer) (architecture).
- `status.source` classifies the repo-carried hive while onboarding
  classifies the running launcher — same field name, two subjects
  (architecture).
- New integrity guards are not frozen into `test_verify_manifest`
  `MANDATORY_SUITES` (test-coverage; autofix class: gated_auto).

## What was verified safe

No guard weakened, no test deleted or softened anywhere in the range.
Security-relevant changes are hardening only (downgrade block fail-closed and
unforceable, source classifier fail-closed, sha256 manifest check,
machine-checked bypass doctrine) — no injection surface, no secret reads, no
credential logging introduced. Templates ↔ runtime byte-parity holds for
every touched lib file.

## Fix cells

- `codex-harness-hardening-6` — spawn doc + census fix (P1, closed).

## Full report

- `docs/history/codex-harness-hardening/reports/review-unreviewed-batch-20260716.md`
- Session record: `.bee/reviews/unreviewed-batch-20260716.json` (id
  `unreviewed-batch-20260716`)
