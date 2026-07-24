# si-1 done-report — debt wall on every door (orchestrator-authored)

Cell `si-1`, worker `si1-worker`, commit `4ec5e2d` (41 files, 3515 insertions).
Ships: feature-swap debt guard (+ waiver), lane-aware close guard, durable
scribing ledger (.bee/logs/scribing-runs.jsonl, non-active feature stamping
allowed for repairs), global orphan sweep in `status --json` + one loud
preamble line.

## Orchestrator's independent verification

- Fresh chain: test_cli_state 65/0 · test_misc 114/0 · lib mirror byte-identical ·
  ledger parity green.
- Live sweep worked on first contact: 119 orphaned cells / 39 features surfaced —
  including the two named live orphans (full-run-retirement frr-1,
  codex-loop-p0 clp-1), both since content-repaired and ledger-stamped along
  with work-visibility.

## Two defects found by the orchestrator's own probing — spun into fix cell si-3

1. **Sweep stamp condition wrong in both directions**: `state.last_scribing_run`
   honored only when the cell's feature is the ACTIVE feature (hides
   properly-closed features' stamps — live repro: cli-ergonomics), and the
   stamp's own `feature` field never checked (an older run could clear the
   active feature's cells).
2. **Test isolation leak**: si-1's suite left the LIVE `.bee/state.json` with
   fixture name `other-feature`; restored by hand, guard assertion required.

## Pre-ledger amnesty (D6)

Historical features flagged by the day-one sweep receive one backfill stamp
after si-3 lands (they passed the close wall by construction; decision logged).
The alarm must start at zero real debt or it trains everyone to ignore it.
