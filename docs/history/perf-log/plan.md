---
artifact_contract: bee-plan/v1
artifact_readiness: requirements-only
mode: standard
---

# perf-log — Plan

## Mode gate

Risk flags counted: **public contracts** (new `perf` CLI group is a public surface),
**cross-platform** (home-dir / `~/.config` resolution must hold on Linux/macOS/Windows),
**weak proof around the area** (CC transcript shape is undocumented and could drift).
= 3 flags, no hard-gate flag (no auth / data-loss / security / external provider). → **standard**.

Why not smaller: touches the core CLI dispatcher + a new lib module + tests + a 4-tree mirror
and introduces a brand-new global-write convention with no repo precedent — beyond `small`'s
"≤3 files, no gray areas". Why not high-risk: purely additive, read-only over transcripts,
append-only to a new file; no existing behavior or protected surface changes.

## Discovery

L1 — the two capture facts were verified against real transcripts and the CLI source by two
I/O workers (see CONTEXT D2/D4). No separate discovery.md: no multi-candidate comparison, the
approach is a direct build on confirmed field paths.

## Approach

Three layers, bottom-up:

1. **`lib/perf.mjs` — pure aggregation core.** Functions over a transcript file + `[start,end]`
   window: resolve the project's transcript dir from a project path (mirror CC's `/`→`-`
   encoding), pick the current session file by newest mtime (or explicit id), slice events by
   `timestamp`, dedupe assistant usage by `requestId`, aggregate per model
   (new/cached/total), walk the `subagents/` sidecar for worker cost, detect parallel, and
   sum `turn_duration.durationMs` for running time (with the idle-gap fallback). No filesystem
   convention beyond reading — everything is a pure function taking the resolved paths, so it
   is unit-testable with fixture transcripts. Also owns the global-dir resolver
   (`XDG_CONFIG_HOME` → `~/.config/beehive`, `BEEHIVE_PERF_DIR` override) and the section
   record schema + append/read via `fsutil` (`appendJsonl`/`readJsonl`).

2. **CLI `perf` group in `bee.mjs`.** Verbs: `start` (write `.bee/perf-open.json` marker),
   `stop` (compute from the recorded transcript window, append the section to the global log,
   print a summary), `section` (one-shot: compute over `--since <ISO|duration>` without a prior
   `start`), `log` (read recent sections, `--json` or one-line summaries), `render` (markdown).
   Registered at all three surfaces (registry entries, `HANDLERS`, `GROUP_USAGE_FALLBACKS` +
   `perfUsageFallback`); handlers return `{result, text}`; boolean-alone flags added to
   `FLAG_ALONE_BOOLEANS`. Update the three hardcoded group lists in `test_bee_cli.mjs`
   (~167/198/270) and add `assertExampleOk('perf.<verb>')` blocks.

3. **Mirror + distribution + manifest.** Copy `templates/lib/perf.mjs` → `.bee/bin/lib/`
   byte-identical (satisfy `test_lib_mirror.mjs`); keep `bee.mjs` identical across
   `templates/`, `.bee/bin/`, `.claude/skills/…`, `.agents/skills/…`; run
   `release_manifest.mjs --write` (a new `lib/` file makes `--check` red until regenerated —
   critical-patterns 20260715). Then the full recorded verify green.

### Risk map

| Component | Risk | Proof needed at validating |
|---|---|---|
| transcript slicing / requestId dedup | MEDIUM | fixture transcript → asserted token totals (no double-count) |
| running-time (turn_duration + fallback) | MEDIUM | fixture with turn_duration events AND one without → correct active time, idle excluded |
| subagent walk + parallel detect | MEDIUM | fixture with 2 overlapping sidecars → parallel true + worker tokens attributed |
| global-dir cross-platform resolution | MEDIUM | `BEEHIVE_PERF_DIR`/`XDG_CONFIG_HOME`/home fallback each resolve; no hard-coded `/home` |
| CLI registry/test group-list wiring | LOW | `test_bee_cli.mjs` + registry bijection green with `perf` |
| mirror + manifest | LOW | `test_lib_mirror.mjs` + `release_manifest.mjs --check` green |

### Open questions for validating

- Confirm no OTHER test fixture hand-lists lib modules (critical-patterns 20260712/20260714):
  grep for vendored-module lists that would break on a new `lib/perf.mjs`.
- Confirm the exact `requestId` dedup rule against a real multi-chunk assistant request
  (take the final/max-output record per id).
- Dry-run every cell `verify` string before locking (critical-patterns 20260708).

## Slice 1 (current) — cells

1. `perf-log-1` — `lib/perf.mjs` aggregation core + global-dir resolver + section schema, with
   a standalone unit test over fixture transcripts (tokens/models/new-cached, running time,
   subagent/parallel, dir resolution).
2. `perf-log-2` — wire the `perf` CLI group into `bee.mjs` (all three surfaces + handlers +
   flags) and update `test_bee_cli.mjs` group lists + example blocks.
3. `perf-log-3` — mirror `lib/perf.mjs` + `bee.mjs` into `.bee/bin/` and the two distribution
   trees, regenerate `release_manifest.mjs --write`, and run the full recorded verify green.

Ordering: 1 → 2 → 3 (2 imports 1; 3 mirrors both and closes on the standing guards).

## Test matrix (against edge dimensions, standard depth)

- **Empty/малformed input:** transcript missing, empty window, no assistant events, `null`
  usage fields → section with zeroed metrics, never a crash.
- **Boundaries:** event exactly at start/end ts; single-event window.
- **Duplication:** same `requestId` across chunks counted once.
- **Concurrency:** overlapping vs sequential sidecars → parallel true/false.
- **Cross-platform:** dir resolution via env overrides, no literal home path.
- **Idempotence:** `stop` with no open marker → clear error, no partial write.
- **Registry integrity:** unique dotted names, bijection with usage fallbacks.
