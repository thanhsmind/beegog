---
area: performance-log
updated: 2026-07-16
coverage: full
sources:
  - docs/history/perf-log/CONTEXT.md
  - docs/history/perf-log/plan.md
  - cells perf-log-1, perf-log-2, perf-log-3 (capped, verified)
decisions:
  - 0a459671
  - 81456c6e
  - 9f7f4256
  - 6af9f25a
---

# Performance Log

## Purpose

A single, shared record — kept in one place for the whole machine, not per project —
of **how much a stretch of assistant work cost and how long it actively took**. Each entry
(a "section") answers, for one piece of work: which assistant models did the work, how many
tokens each spent (fresh vs. reused-from-cache), whether the work ran several helpers in
parallel, and how much *active* time it consumed. Many projects on the same machine append
to the same log, so their work can be compared and reviewed together over time.

## Entry Points & Triggers

- **Open a section** — the operator names a piece of work and opens a section for it. The
  current coding session's activity record and the moment of opening are remembered so the
  eventual measurement covers exactly this span.
- **Close a section** — the operator closes the open section (optionally with a one-line
  note). The span from open to close is measured, summarized, and appended to the shared log.
- **One-shot section** — instead of open-then-close, the operator can record a section
  covering a trailing window ("everything in the last 30 minutes / 2 hours / 1 day", or since
  a given moment) in a single step.
- **Read the log** — the operator lists recent sections (most recent last), optionally
  limited to the last N.
- **Render the log** — the operator produces a human-readable report of the recorded sections.
- **Build the matrix** — the operator asks for the full cross-project performance matrix. Every
  project's coding sessions are scanned and rolled up into one report; with the HTML option a
  self-contained web page is written to the shared location (a project-by-project matrix). This
  needs no prior tracking — it reads whatever real work already happened.
- **Automatic refresh** — at the end of every coding session the matrix report is regenerated on
  its own, so the operator never has to run anything to keep it current.

Explicit named sections (open/close/one-shot) are the manual path; the matrix and its automatic
refresh are the primary, zero-effort path. Only one section may be open at a time per project
working copy.

## Data Dictionary

A **section** carries:

- **label** — the operator's short name for the piece of work (may be empty).
- **note** — an optional one-line summary recorded at close.
- **project** — which project working copy the work belonged to.
- **branch** — the version-control branch active at the time (may be empty).
- **session** — which coding session's activity record was measured.
- **started / ended** — the wall-clock endpoints of the span.
- **running time** — the **active** execution time inside the span, excluding idle waiting
  (see R3). Stored precisely and also as a compact human form (e.g. `12m52s`).
- **parallel** — whether the work ran helpers concurrently (see R4).
- **subagent count** — how many helper runs were attributed to the span.
- **per-model token breakdown** — for each model that did work in the span:
  - **new** — tokens billed fresh: freshly-read input + generated output + newly-written cache.
  - **cached** — tokens served from cache (reused, cheap).
  - **total** — new + cached.
- **subagent token breakdown** — the same per-model breakdown, for helper runs only.
- **event count** — how many recorded activity events fell inside the span.

Token vocabulary (the four raw quantities the breakdown is built from):

- **fresh input** — new prompt tokens read this call, not from cache.
- **output** — tokens the model generated.
- **cache write** — tokens written into the reuse cache this call.
- **cache read** — tokens served from the reuse cache (the cheap ones).

## Behaviors & Operations

**Opening a section.** Triggered by the operator naming a piece of work. The system resolves
which coding session's activity record to measure — by default the most recently active record
for this project, or an explicitly named session — and remembers that choice together with the
start moment. The operator observes a confirmation naming the section and the session being
measured. If no activity record can be resolved yet, the section still opens and the operator
is told metrics will be empty at close.

**Closing a section.** Triggered by the operator closing the open section. The system measures
the remembered span against the remembered activity record: it counts tokens per model,
attributes helper (parallel) cost, decides whether the work was parallel, and computes the
active running time. It appends the finished section to the shared log, clears the open-section
state, and the operator observes the one-line summary plus where it was written. Closing when
nothing is open yields a clear "nothing to close" message and changes nothing.

**One-shot section.** Triggered by the operator asking to record a trailing window. Same
measurement as close, over the window "now minus the given duration" (or since a given moment)
up to now, appended immediately. An unparseable window yields a clear message and records
nothing.

**Reading / rendering.** Reading returns the recorded sections (most recent last, optionally
the last N), each as a one-line summary. Rendering produces the same content as a human-readable
report. Both tolerate an empty or missing log and report "nothing logged yet".

**Populating the store (sync).** Triggered on demand, or automatically when a coding session ends.
Every project's session activity records are scanned, each session is rolled up (per-model tokens,
running time, parallelism), and one row per session is written into the **persistent log** — the
single stored file that holds all performance data. Rows are keyed by session, so re-writing a
session replaces its row rather than duplicating it (the automatic end-of-session write and any
re-run are safe to repeat). A size+modified-time cache makes repeat scans fast — only records that
changed since the last scan are re-read. The automatic end-of-session write parses only the
just-ended session (never a full re-scan); it is best-effort and never delays or fails a session's
end. Backfilling once brings the whole history into the log.

**Building the matrix (read-only view).** The matrix is **read from the persistent log**, never by
re-scanning activity records at view time. Rows are grouped by **project name — the last folder of
the project's path** — so different checkouts of the same-named folder collapse into one row (their
full paths are kept and shown on hover). Each row shows sessions, active time, per-model token
totals (new/cached), cache ratio, parallel-session count, and last activity. The operator observes
either a self-contained HTML file they open, or a printed per-project summary. If the log is empty
the first time, it is backfilled once. A window filter limits the matrix to sessions active since a
given moment. An empty or missing log yields an empty matrix, never an error.

**Measurement rules.** Within the span:
- Token counts are gathered per model from the session's activity events; repeated records of
  the same underlying request are counted once (R1).
- Helper (subagent) runs whose activity overlaps the span are attributed separately, and their
  models roll into the subagent breakdown (R5).
- Placeholder/local non-model events are excluded from all token counts (R2).

## Actors & Access

- **Operator** — the person (or the assistant acting on their behalf) running the work. Opens,
  closes, records, reads, and renders sections. No other role exists; the log is a personal,
  machine-local record.
- **Consuming reader** — anyone later reading or rendering the shared log to review cost and
  timing across projects.

## Business Rules

- **R1 — Count each request once.** When the session's activity record holds several entries
  for one underlying model request (e.g. streamed in chunks), the token counts are de-duplicated
  so a single request is never counted more than once. (D2 · `81456c6e`)
- **R2 — Exclude non-model events.** Placeholder/local events that carry no real model call are
  excluded from every token total. (D2 · `81456c6e`)
- **R3 — Running time is active time, never "alive" time.** The running time is the sum of the
  session's own measured per-turn active durations within the span, which already exclude idle
  waiting. When those measured durations are unavailable, the fallback sums the gaps between
  consecutive activity events, ignoring any gap longer than the idle threshold (5 minutes) so a
  long wait for the operator is never counted. Plain end-minus-start wall-clock is never used.
  (D3 · `9f7f4256`)
- **R4 — Parallel means genuinely concurrent helpers.** A section is parallel when two or more
  helper runs overlap in time within the span, or when a single turn dispatched two or more
  helpers at once. Otherwise it is sequential. (D2 · `81456c6e`)
- **R5 — Helper cost is attributed, not hidden.** Tokens spent by helper runs are gathered from
  each helper's own activity record and reported in a separate subagent breakdown, so worker
  cost is visible and not silently folded into or dropped from the main totals. (D2 · `81456c6e`)
- **R6 — One shared location, per-machine, project-tagged.** All sections append to one shared
  log for the whole machine; each section is tagged with its project and branch so entries from
  many projects coexist and stay attributable. The location honors the operator's standard
  per-user configuration location and can be redirected for testing. (D1 · `0a459671`)
- **R7 — The store is append-only and machine-readable; reports are rendered on demand.** New
  sections are only ever appended; the human-readable report is produced from the store when
  asked, never kept as the store itself. (D1 · `0a459671`)
- **R8 — A missing measurement never fails the operation.** If the activity record or open
  section is missing, the operation degrades to empty/zeroed metrics or a clear message and
  never errors out. (implementation-confirmed; supports the read-only examples staying safe)
- **R9 — The persistent log is the source of truth; the view only reads it.** All performance data
  is written into one persistent log (rows are derived from the activity records the operator never
  has to track). The matrix view reads that log and never re-scans activity records at view time.
  Session rows are keyed by session, so writing the same session again replaces its row — the
  automatic end-of-session write can fire repeatedly with no double counting. (implementation-confirmed;
  D `62a7c7fd`)
- **R11 — Projects are grouped by their last folder name.** The matrix groups rows by the final
  segment of each project's path (its folder name), so it reads at a glance; two different paths
  that end in the same folder name merge into one row, and every underlying full path is retained
  and shown on hover. (D `62a7c7fd`)
- **R10 — The automatic refresh is best-effort and never blocks a session's end.** The
  end-of-session regeneration runs only when a cache already exists (so the one-time full scan is
  never paid at session end), and any failure in it is swallowed — a session always ends cleanly
  regardless of the matrix. (implementation-confirmed)

## Edge Cases Settled

- **Boundary events** — an event exactly at the start or end moment of the span is included.
- **No open section at close** — reported clearly; nothing is written.
- **Unparseable trailing window** — reported clearly; nothing is recorded.
- **Empty / missing log** — reading and rendering report "nothing logged yet".
- **No resolvable session at open** — the section opens; the operator is warned metrics will be
  empty at close.

## Open Gaps

- **Per-unit-of-work sections.** Emitting an explicit *section* automatically per bee unit of
  work (its own start-to-finish window) is still deferred — the automatic path is the whole-matrix
  refresh, not per-cell sections. Manual sections remain operator-initiated. (backlog: proposed)
- **Cost in currency.** Only raw token counts are recorded; converting to money is left to the
  reader.
- **One logical section spanning multiple sessions** is not merged; a section measures a single
  session's activity record. The matrix aggregates all of a project's sessions, but does not
  reconstruct a single logical task that crossed sessions.

## Pointers (implementation)

- Aggregation core, per-session rollup + cross-project scan (`collectSessionRollups`/`scanProjects`
  + mtime/size cache), persistent store (`sessionRecord`/`upsertSessionRecords`/`readSessionRecords`/
  `syncSessionsToLog`), matrix build-from-log grouped by last folder (`buildMatrixFromLog`,
  `projectName`), HTML (`renderMatrixHtml`/`writeReport`), and section schema (`bee-perf/v1`):
  `skills/bee-hive/templates/lib/perf.mjs` (mirrored to `.bee/bin/lib/perf.mjs` and the
  `.claude`/`.agents` distribution trees).
- CLI surface `bee perf start|stop|section|log|render|report|sync`: handlers + `perfUsageFallback`
  in `skills/bee-hive/templates/bee.mjs`; registry entries in
  `skills/bee-hive/templates/lib/command-registry.mjs`. `perf report` reads the log (backfilling
  once if empty); `perf sync` scans transcripts and writes session rows into the log.
- Automatic write + refresh at session close: `maybePerfRefresh` in `hooks/bee-session-close.mjs`
  (Stop + PreCompact) — upserts the current session row into the log then rebuilds the HTML from
  the log; best-effort/fail-open, parses only the one current transcript.
- Open-section marker: `.bee/perf-open.json` in the project working copy.
- Global store: `~/.config/beehive/performance.jsonl` (manual sections),
  `~/.config/beehive/performance.html` (matrix report), `~/.config/beehive/cache/scan-cache.json`
  (per-transcript rollup cache). `XDG_CONFIG_HOME` honored, `BEEHIVE_PERF_DIR` override for tests.
- Data source: Claude Code session transcripts at `~/.claude/projects/<encoded>/<session>.jsonl`
  plus the `<session>/subagents/agent-*.jsonl` sidecars; running time from the harness
  `system`/`turn_duration` `durationMs` events.
- Tests: `skills/bee-hive/templates/tests/test_perf.mjs`, and the perf blocks in
  `skills/bee-hive/templates/tests/test_bee_cli.mjs`.
