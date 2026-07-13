# fsh-4 — Lane + session CLI surface through the unified registry

Status: [DONE]

Outcome: state.set/gate/scribing-run gain an optional `--lane <feature>` routing the mutation to that lane record via `readLaneStrict` (missing/corrupt lane refuses loudly, zero writes); `state.start-feature` gains `--as-lane` (+ `--session-id`/`--paths` for the declared-paths holds check); `state.lanes` lists lane records with phase/gates/bound sessions; `state.session.list`/`bind`/`unbind` expose fsh-3's session→lane binding as a nested verb family under `state` (mirroring `state.worker.*` — see deviations). Zero-lane byte-parity held: all 102 pre-existing test_bee_cli rows and all 250 test_lib rows pass unmodified; 11 new RED-first runExample rows cover every new/changed entry (113/0 + onboard PASS).

Files touched:

- skills/bee-hive/templates/lib/command-registry.mjs
- skills/bee-hive/templates/bee.mjs
- skills/bee-hive/templates/tests/test_bee_cli.mjs
- .bee/bin/lib/command-registry.mjs (vendored byte-identical)
- .bee/bin/bee.mjs (vendored byte-identical)

Deviations (2, both recorded in the trace):

1. `state.set` refuses `--feature` combined with `--lane` — a safety guard added beyond the literal cell text, since `writeLane` derives the lane file's path from `record.feature`; letting that field flow through unchanged on a lane-routed set would silently rename a lane's identity into a second file.
2. The "session verb group" ships as nested `state.session.list/bind/unbind` rather than a new top-level `session` registry group, because two pre-existing pinned rows in test_bee_cli.mjs hard-code the registry's allowed top-level group set at the original 9 (status/cells/reservations/decisions/state/backlog/capture/reviews/feedback).

Full trace and verification evidence: `.bee/cells/fsh-4.json`.
