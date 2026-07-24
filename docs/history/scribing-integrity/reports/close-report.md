# scribing-integrity — close report (orchestrator-authored)

Origin: user observation "tasks look done but scribing never ran; sessions stop
at scribing." Confirmed as three structural holes (CONTEXT.md); all closed.

## Landed

- `si-1` (4ec5e2d): feature-swap debt guard + audited waiver; lane-aware close
  guard; durable ledger `.bee/logs/scribing-runs.jsonl`; global orphan sweep in
  status + one loud preamble line. Verified independently (65+114+281 tests,
  mirror/manifest/ledger green); day-one sweep surfaced 119 orphaned cells /
  39 features.
- `si-3` (64f8cdc): fix for si-1's sweep fallback — the default-record stamp is
  attributed by ITS OWN feature field, both directions red-first proven; live
  repro was cli-ergonomics counted orphaned despite a newer stamp. Plus a
  permanent live-state isolation guard in test_cli_state.mjs (si-1's suite had
  left fixture name `other-feature` in the live state; restored by hand).
- `si-2` (9de2c26): herding names the tail-stuck worktree distinctly (cells
  capped, tree clean, phase pre-terminal = scribing/close owed) with the paved
  repair, report-only contract unchanged; scout offers orphaned debt with the
  capture-queue offer discipline.
- D5 repairs: full-run-retirement → lane-and-working-discipline.md;
  codex-loop-p0 → coordination-refresh-and-session-init.md; both + work-visibility
  ledger-stamped with real areas.
- D6 amnesty: 35 pre-ledger features backfill-stamped (decision logged) — the
  alarm starts at zero real debt.

## Seam bug found at first live use → tiny follow-up `scribing-run-terminal-stamp`

The repair verb refused from terminal phases (`refused from phase
"compounding-complete"`) even for a NON-active feature stamp — unusable exactly
where the scout offers repairs. Cell tst-1 scopes the phase gate to the
active-feature run only.

## Verification of the wall itself

This feature's own close went THROUGH the new wall: scribing-run stamped
si-1/si-3, compounding-complete accepted, orphan count for this feature zero.
