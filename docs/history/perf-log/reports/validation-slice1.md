# perf-log — Validation (slice 1)

Verdict: **READY** (feasibility). Gate 3 auto-approved under total gate-bypass.

## Reality gate

| Check | Result | Evidence |
|---|---|---|
| MODE FIT | PASS | 3 flags (public contract, cross-platform, weak-proof), no hard-gate → standard. |
| REPO FIT | PASS | Insertion points confirmed at `bee.mjs` 1738/1749/1827; `fsutil` `ensureDir`/`appendJsonl`/`readJsonl` exist; scripts `test_lib_mirror.mjs` + `release_manifest.mjs` present. |
| ASSUMPTIONS | PASS | Transcript fields (`message.usage.*`, `message.model`, `requestId`, `turn_duration.durationMs`, subagent sidecar) verified against REAL transcripts with file:line by I/O worker. |
| SMALLER PATH | PASS | 3 layers (lib → CLI → mirror) each necessary; not collapsible to small. |
| PROOF SURFACE | PASS | Baseline verify (17 suites) green; cell verify strings runnable. |

## Baseline gate

Full recorded verify (`.bee/config.json` `commands.verify`, 17 suites) run once this session → **exit 0, all green** (incl. `census_stale_spawn_syntax: clean`, `test_lib_mirror: 17 files byte-identical`, `release_manifest --check: 136 files match`, installers 16/0). Safe to build on.

## Feasibility matrix

| Assumption | Risk | Proof | Result |
|---|---|---|---|
| requestId dedup avoids double count | MED | worker read real multi-chunk assistant events sharing a requestId | PASS |
| running time excludes idle | MED | `turn_duration.durationMs` present per turn (harness-measured, idle-excluded); 300s gap fallback designed | PASS |
| subagent cost + parallel recoverable | MED | `<session>/subagents/agent-*.jsonl` (isSidechain) + `.meta.json` (toolUseId/spawnDepth) confirmed | PASS |
| cross-platform global dir | MED | resolver = BEEHIVE_PERF_DIR / XDG_CONFIG_HOME / os.homedir(); no literal home path (asserted in test) | PASS (proof deferred to cell test) |
| new lib file doesn't break fixtures | MED | `test_lib_mirror`, `release_manifest`, `test_write_guard` copyLib all `readdirSync` (auto) | PASS |
| schedule serializes 1→2→3 | HIGH | see B1 below — fixed; `cells schedule` now 3 waves, 0 cycles | PASS |

## Adversarial review (opus) — findings resolved

- **B1 (BLOCKER)** deps declared in `depends_on` (engine reads `deps`) → chain inert, single wave. **Fixed**: set `deps` on perf-log-2/3; `cells schedule` now 3 sequential waves, 0 cycles.
- **B2 (BLOCKER)** perf-log-3 verify was a 4-command subset, not the full recorded verify it promises to close. **Fixed**: verify = full `.bee/config.json` verify string (baseline green, so cap must keep it green).
- **W2** start/stop/section examples crash under `assertExampleOk` (transcript-less CI). **Addressed**: handlers must degrade gracefully (never throw on missing transcript/marker); registry examples restricted to read-only log/render; start/stop covered in test_perf.mjs. Added as truth on cells 1 & 2.
- **W3** `templates/tests/test_bee_write_guard_hook.mjs` hand-lists `VENDORED_LIB_MODULES`. **Addressed**: prohibition on cells 1 & 2 — `perf.mjs` must not enter `command-registry.mjs`'s import graph (bee.mjs-only).
- **W1** distribution sync not caught by a guard → cell-3 action explicitly copies `.claude`/`.agents` trees (not reliant on a test). Noted.
- **M1** `json` already in FLAG_ALONE_BOOLEANS (only `markdown` new); **M3** unused `state.mjs` dropped from perf-log-1 read_first. Both fixed.

## Cells (cold-pickup)

3 cells, each with bounded files, D-ID-cited action, must_haves, runnable verify. Ordering 1→2→3 enforced via `deps`.
