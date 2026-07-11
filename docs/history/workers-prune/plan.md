---
artifact_contract: bee-plan/v1
artifact_readiness: implementation-ready
mode: small
---

# workers-prune — auto-prune `.bee/workers` dispatch transients

Backlog source: `[P3] .bee/workers transients never pruned — 66 stale files / 2.8MB of 3.9MB total (harness)`.
User confirmed the intent is the standing mechanism ("tính năng tự dọn"), not a one-off cleanup.

## Discovery (L0 — precedent cited)

- Thin-CLI verb + door validation is the locked pattern for any `.bee` mutation surface (decision bb4bb18e, cli-mutations). `.bee/workers/` file deletion is a `.bee` mutation → it gets a CLI verb, not ad-hoc `rm`.
- Worker lifecycle verbs already live in `bee_state.mjs` (`worker add|update|remove|clear`, bee_state.mjs:157) — `worker prune` joins them; no fourth CLI (avoids worsening filed P3 "arg-parsing duplicated across three CLIs").
- Writers of the transients: bee-swarming external-executor dispatch (swarming-reference.md:71–86) — `<cell-id>.prompt.md`, `<cell-id>.out*.log`, `<cell-id>.result.md|json`, plus reviewer/plan-check logs with the same suffix family.
- Live census (this repo): 66 files / 2.8MB; suffix histogram: 20 `.prompt.md`, 20 `.result.md`, 12 `.out.log`, 2 `.out2.log`, 1 `.out3.log`, 9 `.log`, 2 bare `.json` (`mtg-settings-pre.json` evidence snapshot, `release-0120-cell.json` cell payload — both must survive pruning). All 65 cells capped, `state.workers` empty.

## Approach

**Verb:** `node .bee/bin/bee_state.mjs worker prune [--dry-run] [--json]`

Prunable = a file directly in `.bee/workers/` that:
1. matches the transient suffix set `\.(prompt\.md|result\.md|result\.json|out\d*\.log|log)$` — anything else (evidence snapshots, cell payloads, subdirs) is never touched; and
2. its stem (name minus that suffix) is not the `cell` of any entry in `state.workers` (active dispatch); and
3. its stem, when `.bee/cells/<stem>.json` exists, has `status: "capped"` — an open/claimed/blocked cell keeps its transients. Stems with no cell file (reviewer/plan-check/validate logs) are prunable once rules 1–2 pass.

Safety properties: state is read with `readStateStrict` — corrupt `state.json` fails loud and deletes nothing; `state.json` is never written by prune (read-only verb on state); missing `.bee/workers/` dir is success with 0 pruned; `--dry-run` lists without deleting; unknown flags keep failing per parseArgs.

**Auto wiring:** bee-swarming reference wrap-up gains one line — after the feature's final slice caps and review completes, the orchestrator runs `worker prune`. Every swarm cleans up after itself at close; that is the accumulation source.

Rejected alternatives:
- One-off `rm` — leaves the mechanism unbuilt (the backlog item's actual complaint).
- SessionStart-hook auto-delete — hooks stay fail-open and lean (bee harness philosophy); a deleting hook is neither.
- New `bee_workers.mjs` CLI — duplicates arg parsing a third… fourth time; verb belongs with the existing worker domain.
- `bee_status` prunable-count warning — deferred; swarming wrap-up already covers the source of accumulation. Revisit only if junk reappears.

Risk map: deletion logic (MEDIUM — proof: process-level tests incl. keep-rules + live run on the real 66 files, which are git-tracked so recoverable); everything else LOW.

## Files (bounded)

1. `skills/bee-hive/templates/bee_state.mjs` — `worker prune` verb + usage comment.
2. `skills/bee-hive/templates/tests/test_lib.mjs` — process-level checks.
3. `skills/bee-swarming/references/swarming-reference.md` — one wrap-up line.
4. `.bee/bin/bee_state.mjs` — mechanical vendor copy (byte-equality enforced by the standing sweep).

## Mode gate

Risk flags: 0 (no auth/data model/external/public contract; deletion is of harness transients, git-tracked, guarded by keep-rules). 3 source files, no gray areas → **small**. Tiny rejected: >2 files and a deletion surface deserving a real test matrix.

## Test matrix (edge dimensions that bite here)

- capped-cell transient → deleted; open/claimed-cell transient → kept; active-worker cell transient → kept even if cell file missing.
- no-cell stem (`review-x.log`) → deleted; non-matching name (`foo-pre.json`, bare `.json`) → kept.
- `.out2.log` / `.out3.log` stem maps to the same cell id as `.out.log`.
- `--dry-run` deletes nothing and lists the same set.
- corrupt `state.json` → exit non-zero, zero deletions.
- missing `.bee/workers/` → exit 0, `pruned: 0`.
- unknown worker action still lists `prune` in the Use: line.

## Reality check (inline, small fast path)

- MODE FIT: 0 flags, 3 source files, one direct task — evidence above. PASS
- REPO FIT: joins existing `worker` switch in bee_state.mjs:157; tests mirror `runBeeState` harness at test_lib.mjs:2585. PASS
- ASSUMPTIONS: all 64 deletable files match the suffix set; the 2 bare `.json` survive — verified by live census. PASS
- SMALLER PATH: one-off rm rejected by the user's own framing (auto-clean). PASS
- PROOF SURFACE: `node skills/bee-hive/templates/tests/test_lib.mjs` + live prune of the real 66-file dir. PASS

Advisor (shape): session model already IS the advisor tier (fable) — consult collapses in-session; verdict: small-lane shape approved as recommended.
