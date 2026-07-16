# perf-log — Locked Context

Global cross-project performance log for bee. Each "section" summarizes a piece of work:
what was done, which models ran, per-model token breakdown, whether work went parallel,
and the section's **running time** (active execution, not idle/wall-clock).

Entered via the surface-scope-earlier path (hive): research done up-front by two I/O workers,
gray areas resolved into decisions D1–D4 rather than a separate exploring pass.

## Locked decisions

- **D1 — Global log location** (`0a459671`): `~/.config/beehive/performance.jsonl`,
  append-only JSONL, one section per line. Respect `XDG_CONFIG_HOME`; override with
  `BEEHIVE_PERF_DIR` (tests use this). Each section tagged: project path, git branch,
  session id, start/end timestamps. Markdown is **rendered on demand**, not the store.

- **D2 — Data source & metrics** (`81456c6e`): compute a section by slicing the current
  Claude Code session transcript (`~/.claude/projects/<encoded>/<session>.jsonl`) to the
  section window. Per model: dedupe assistant events by top-level `requestId`, then sum
  `message.usage.{input_tokens, output_tokens, cache_creation_input_tokens,
  cache_read_input_tokens}`. Report `new = input + output + cache_creation`,
  `cached = cache_read`, and `total`. Subagent cost + parallelism from
  `<session>/subagents/agent-*.jsonl` (`isSidechain`) + `.meta.json`. Exclude model
  `<synthetic>`.

- **D3 — Running time** (`9f7f4256`): sum harness `system`/`turn_duration` `durationMs`
  within the window (already excludes idle). Fallback when absent: sum consecutive-event
  timestamp gaps below an idle threshold (default 300s). Never raw `end - start` wall clock.

- **D4 — Section boundaries** (`6af9f25a`): v1 = explicit named spans via a new `perf` CLI
  group (`bee perf start --label` / `bee perf stop --note`). Open-section marker in
  `.bee/perf-open.json` records the resolved session transcript path (newest-mtime,
  `--session` override) so `stop` reads the same file. Cell-cap auto-emit is a deferred
  follow-on, not v1.

## Parallel detection

`parallel: true` when ≥2 subagents have overlapping timestamp spans within the window, or
≥2 `Agent` tool_use blocks share one assistant turn. Otherwise `false`.

## Out of scope (v1)

- Auto-emit on cell cap (deferred follow-on).
- Cost/dollar estimation (only raw token counts; pricing left to the reader).
- Cross-session merging of one logical section.
