---
date: 2026-07-16
feature: perf-report
categories: [architecture, performance, ux]
severity: medium
tags: [derive-dont-track, mtime-cache, fail-open-hook, self-contained-html]
---

# perf-report — automatic cross-project performance matrix (bee 1.3.3)

The manual `perf start/stop` model was the wrong default: the user wanted the feature to run
automatically ("I don't want to care about it") and to view a full per-project matrix as an HTML
file. The redesign shipped in 1.3.3.

## Root Cause + Recommendations

### 1. Derive, don't track — the data already exists on disk
The instinct was to *capture* metrics during work (manual spans, or a hook appending a section
per session). But every session's tokens/time/parallelism already live in the Claude Code
transcript. The right model is to **derive the whole matrix by scanning transcripts on demand**,
so the operator records nothing and the matrix always reflects real work.
**Rule:** when the raw data is already persisted by the platform, prefer a derive-on-read design
over a capture-on-write one — it is simpler, needs no tracking discipline, and is inherently
correct and idempotent. Capture stores only earn their keep when the source is ephemeral.

### 2. An mtime+size cache turns a 347MB scan into a 4ms refresh — which unlocks the hook
A cold cross-project scan of 236 transcripts (~347MB) is ~4s; unacceptable inside a fast,
must-not-block session-close hook. A per-transcript cache keyed on **mtime+size** (reuse the
rollup when both match) made the warm scan **4ms** (only the one changed transcript re-parses).
That is what made "auto-refresh at session close" viable at all.
**Rule:** before rejecting an expensive derive-on-read as "too slow for a hook", check whether a
content-invariance cache (mtime+size, or a hash) collapses the steady-state cost to near-zero —
the incremental case, not the cold case, is what the hook pays. Guard against paying the cold
cost inline (here: the hook refreshes only if a cache already exists; the first full build is an
explicit command).

### 3. A derived+cached report makes the fail-open hook trivially safe
Because the matrix is idempotent (re-scan = same result), the session-close hook can fire on both
Stop and PreCompact with no dedup logic, and its whole perf step is wrapped so any failure is
swallowed (exit code untouched) — matching the fail-open host contract (critical-patterns
20260714). No per-session store, no upsert, no ordering.
**Rule:** idempotent derivation removes an entire class of hook hazards (double-fire, partial
writes, dedup) — prefer it over stateful accumulation whenever the hook's job is "keep a
derived artifact fresh."

### 4. The deliverable was an HTML file, not a terminal report
"Lúc xem thì thông qua 1 file html để thấy 1 matrix đầy đủ theo dự án" — the operator wanted a
self-contained HTML page (opened directly from `~/.config/beehive/performance.html`), theme-aware,
one row per project × model. A markdown/text render would not have satisfied "matrix đầy đủ".
**Rule:** when the user says "an HTML file", ship a self-contained file (inline CSS/JS, no external
requests) to a stable path they open — not an Artifact, not terminal text.

## Reusable Pattern

Cross-project rollup: enumerate `~/.claude/projects/*`, read each session's real project path from
an event's `cwd`, roll sessions up per project with the pure aggregators, cache per-transcript on
mtime+size, and render a self-contained HTML matrix. The same shape fits any per-project telemetry
derived from transcripts.
