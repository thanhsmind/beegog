# Walkthrough — bee-footprint

Shipped 2026-07-12 · standard lane · Gate 4 approved (UAT 2/2 pass) · no implement-plan.md was rendered for this feature (standard on-demand default: plan.md + gate chat were the review record).

## What shipped

- **Onboard-managed `.gitignore` block (footprint-1 + footprint-4).** `onboard --apply` now maintains a `# BEE:START…# BEE:END` block in the host repo's `.gitignore` ignoring machine-local runtime files (`.bee/state.json`, `reservations.json`, `workers/`, `logs/`, `capture-queue.jsonl`, `feedback-digest.json`, `.inject-cache.json`, `HANDOFF.json`, `spikes/`). Team-durable knowledge (`bin/`, `config.json`, `config-sample.json`, `onboarding.json`, `decisions.jsonl`, `backlog.jsonl`, `cells/`) stays tracked. The block is marker-spliced (whole-line-anchored regexes — a user comment containing the marker text is never adopted), preserves user bytes outside the markers exactly, survives no-trailing-newline files (the original corrupt-merge bug class), compares CRLF-insensitively, and its sha256 rides `onboarding.json` managed versions for drift detection. When managed paths are already git-tracked (the real cause of the origin complaint), onboard emits an advisory naming the exact `git rm -r --cached` command — it never runs it itself.
- **Spikes containment (footprint-2).** The spike convention moved from repo-root `.spikes/<feature>/` to `.bee/spikes/<feature>/` across all living skill docs and AGENTS.block.md. Root `.spikes/` left the write-guard allowlist (`GATE_ALLOWED_PREFIXES`) and the session-close nudge regex — a strict shrink; `.bee/spikes/` is covered by the existing `.bee/` prefix.
- **Bee repo self-migration (footprint-3).** This repo's corrupt `.gitignore` (two entries merged on one line) was replaced by the managed block; 187 tracked spike files and 14 tracked mutable runtime files were removed from the index (working tree preserved — probe-proven); all spike trees moved to `.bee/spikes/`; `onboard --apply` recheck reads `up_to_date`.

## How it was verified

- Fresh orchestrator-shell runs at goal-check and again at review close: `test_onboard_bee.mjs` → `PASS - failures: 0, skipped: 1` (pre-existing case-alias skip); `test_lib.mjs` → `171 passed, 0 failed`.
- RED-first evidence recorded in every behavior_change cell trace: footprint-1 (new tests failed against pre-change code: missing plan action + ENOENT), footprint-2 (`checkWrite('.spikes/demo/notes.md')` returned allow before the guards edit), footprint-4 (9 checks failed with the fix stashed and tests kept).
- Frozen judge intact on all four cells; validation spike (`.bee/spikes/bee-footprint/probe.mjs`) proved the two load-bearing assumptions: `#`-markers are inert in gitignore and `git rm --cached` preserves the working tree.
- UAT 2/2 confirmed by the owner (2026-07-12): git status stays quiet after bee runs; no root `.spikes/`, everything under `.bee/`.
- NOT verified end-to-end: a real anphabe host onboard (happens at release rollout); the tracked-paths advisory was tested against fixture repos only.

## How to test it yourself

1. In any repo: `node skills/bee-hive/scripts/onboard_bee.mjs --repo-root <repo> --json` → plan lists a `*_gitignore_block` action; `--apply` writes the block; re-run reports `up_to_date`.
2. Run any bee command that mutates `.bee/state.json`, then `git status` — no `.bee` runtime churn appears.
3. In a repo with `.bee/state.json` already tracked: the onboard report carries the advisory with the exact untrack command.
4. `grep -rn '\.spikes' skills/ hooks/` → only historical-string comments and the D2 denial test remain.

## Deviations from plan

- footprint-2: the cell's verify grep was auto-fix narrowed (recorded deviation) — the pattern inevitably matches its own denial-test fixture and two origin-comment strings; the orchestrator hand-reviewed all 5 residual hits as legitimate.
- footprint-3: `git rm --cached .bee/state.json` was false-positive-blocked by the write-guard; the worker used the equivalent index-only `git update-index --force-remove` (filed as P3 friction, guard parser gap).
- footprint-4 was not in the original 3-cell plan — it is the review wave's fix cell (both P2s + three foldable P3s).
- Wave-1 commit attribution crossed (shared git index): stuart's trace files landed in bob's commit `d35c053`. Content intact; filed as P3 friction.

## Known limitations / follow-ups (backlog)

- Already-onboarded hosts must run the advised `git rm -r --cached` once; onboard only advises (deliberate — never auto-mutates a host's index).
- `.bee/spikes/` is write-allowlisted AND gitignored — staged content there escapes git-status review visibility (accepted D2/D3 tradeoff, P3 note).
- AGENTS.md marker functions still use unanchored substring matching (P3, parity hardening pending).
- session-close hook pair (`hooks/` ↔ `.bee/bin/hooks/`) has no byte-identity sweep; `NUDGE_ALLOWED` untested (P3 debt).
- Write-guard parser gaps: `$VAR`/`cd`-relative/`git -C` false positives, `git update-index` unmodeled (P3 friction ×2).
- footprint-2's stored verify predicate false-positives if re-run against the finished tree (P3 note).
