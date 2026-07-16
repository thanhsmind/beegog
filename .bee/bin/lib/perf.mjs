// perf.mjs — global cross-project performance log for bee.
//
// Each "section" summarizes one piece of work: which models ran, the per-model
// token breakdown (new / cached / total), whether the work went parallel, and
// the section's RUNNING time (active execution, not idle/wall-clock). All metrics
// are recovered post-hoc from the Claude Code session transcript on disk — the
// only trustworthy source (the agent cannot self-report mid-flight token counts).
//
// The pure functions (sliceEvents, aggregateUsage, detectParallel, runningTimeMs,
// buildSection, globalPerfDir, humanizeMs) take already-parsed data so they are
// unit-testable with no filesystem. The I/O helpers (resolveTranscript,
// walkSubagents, computeMetrics, appendSection, readSections) read real paths.
//
// Node 18+, Windows-safe. Only bee.mjs imports this module (never
// command-registry.mjs — that keeps perf.mjs out of the write-guard fixture's
// hand-listed VENDORED_LIB_MODULES, critical-patterns 20260712/20260714).

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ensureDir, appendJsonl, readJsonl, readJson } from './fsutil.mjs';

const SYNTHETIC_MODEL = '<synthetic>';
const DEFAULT_IDLE_THRESHOLD_MS = 300000; // 5 min — a longer gap is "alive but idle"

// --- transcript location -------------------------------------------------

// encodeProjectDir — mirror Claude Code's project-dir encoding: the absolute
// project path with '/', '\' and '.' each replaced by '-' (a leading separator
// becomes the leading '-'). e.g. /a/b/c -> -a-b-c.
export function encodeProjectDir(projectPath) {
  return String(projectPath).replace(/[\\/.]/g, '-');
}

// claudeProjectsRoot — where Claude Code stores per-project transcripts.
// Honors CLAUDE_CONFIG_DIR; defaults to <home>/.claude/projects.
export function claudeProjectsRoot(env = process.env, homedir = os.homedir()) {
  const base = env.CLAUDE_CONFIG_DIR || path.join(homedir, '.claude');
  return path.join(base, 'projects');
}

// resolveTranscript — the session transcript file for a project. With sessionId,
// return <root>/<enc>/<sessionId>.jsonl (or null if absent). Otherwise the
// newest-mtime top-level *.jsonl in that dir (the live session), or null.
export function resolveTranscript(projectsRoot, projectPath, { sessionId } = {}) {
  const dir = path.join(projectsRoot, encodeProjectDir(projectPath));
  if (sessionId) {
    const file = path.join(dir, `${sessionId}.jsonl`);
    return fs.existsSync(file) ? file : null;
  }
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  let best = null;
  let bestMtime = -Infinity;
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith('.jsonl')) continue;
    const full = path.join(dir, e.name);
    let m;
    try {
      m = fs.statSync(full).mtimeMs;
    } catch {
      continue;
    }
    if (m > bestMtime) {
      bestMtime = m;
      best = full;
    }
  }
  return best;
}

// --- pure event helpers --------------------------------------------------

function toMs(v) {
  if (v == null) return NaN;
  return typeof v === 'string' ? Date.parse(v) : Number(v);
}

function eventMs(event) {
  return event && typeof event.timestamp === 'string' ? Date.parse(event.timestamp) : NaN;
}

function num(v) {
  return Number.isFinite(v) ? v : 0;
}

function zeroModel() {
  return { input: 0, output: 0, cache_write: 0, cache_read: 0, new: 0, cached: 0, total: 0 };
}

// new = fresh input + generated output + cache writes (all billed at full/premium);
// cached = cache reads (billed at ~1/10). total = new + cached.
function finalizeModel(m) {
  m.new = m.input + m.output + m.cache_write;
  m.cached = m.cache_read;
  m.total = m.new + m.cached;
  return m;
}

// sliceEvents — keep events whose top-level ISO timestamp is within [start,end]
// inclusive. start/end may be ISO strings or epoch-ms numbers.
export function sliceEvents(events, start, end) {
  const s = toMs(start);
  const e = toMs(end);
  return (events || []).filter((ev) => {
    const t = eventMs(ev);
    if (Number.isNaN(t)) return false;
    return t >= s && t <= e;
  });
}

// aggregateUsage — per-model token totals over assistant events, deduped by
// top-level requestId (streamed chunks repeat one id; keep the record with the
// largest output_tokens). Model '<synthetic>' is excluded (local/interrupt msgs).
export function aggregateUsage(events) {
  const byReq = new Map();
  const noReqId = [];
  for (const ev of events || []) {
    if (!ev || ev.type !== 'assistant') continue;
    const msg = ev.message || {};
    const model = msg.model;
    if (!model || model === SYNTHETIC_MODEL) continue;
    const usage = msg.usage || {};
    const rec = {
      model,
      input: num(usage.input_tokens),
      output: num(usage.output_tokens),
      cache_write: num(usage.cache_creation_input_tokens),
      cache_read: num(usage.cache_read_input_tokens),
    };
    const rid = ev.requestId;
    if (rid) {
      const prev = byReq.get(rid);
      if (!prev || rec.output > prev.output) byReq.set(rid, rec);
    } else {
      noReqId.push(rec);
    }
  }
  const models = {};
  const totals = zeroModel();
  for (const r of [...byReq.values(), ...noReqId]) {
    const m = models[r.model] || (models[r.model] = zeroModel());
    m.input += r.input;
    m.output += r.output;
    m.cache_write += r.cache_write;
    m.cache_read += r.cache_read;
    totals.input += r.input;
    totals.output += r.output;
    totals.cache_write += r.cache_write;
    totals.cache_read += r.cache_read;
  }
  for (const m of Object.values(models)) finalizeModel(m);
  finalizeModel(totals);
  return { models, modelList: Object.keys(models), totals };
}

// runningTimeMs — active execution time in the window. Primary: sum the
// harness-emitted system/turn_duration durationMs (already excludes idle waits).
// Fallback (no turn_duration events): sum consecutive-event gaps below the idle
// threshold, so a long user-away pause is never counted.
export function runningTimeMs(events, { idleThresholdMs = DEFAULT_IDLE_THRESHOLD_MS } = {}) {
  const turns = (events || []).filter(
    (e) => e && e.type === 'system' && e.subtype === 'turn_duration' && Number.isFinite(e.durationMs),
  );
  if (turns.length > 0) {
    return turns.reduce((sum, e) => sum + e.durationMs, 0);
  }
  const stamps = (events || [])
    .map(eventMs)
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b);
  let sum = 0;
  for (let i = 1; i < stamps.length; i++) {
    const gap = stamps[i] - stamps[i - 1];
    if (gap > 0 && gap < idleThresholdMs) sum += gap;
  }
  return sum;
}

// detectParallel — true when >=2 subagent time-spans overlap, OR any single
// assistant turn dispatched >=2 Agent tool_use blocks.
export function detectParallel(agents = [], parentEvents = []) {
  const spans = (agents || [])
    .filter((a) => Number.isFinite(a.startMs) && Number.isFinite(a.endMs))
    .map((a) => [a.startMs, a.endMs])
    .sort((x, y) => x[0] - y[0]);
  for (let i = 1; i < spans.length; i++) {
    if (spans[i][0] <= spans[i - 1][1]) return true;
  }
  for (const ev of parentEvents || []) {
    if (!ev || ev.type !== 'assistant') continue;
    const content = ev.message && Array.isArray(ev.message.content) ? ev.message.content : [];
    const agentCalls = content.filter((b) => b && b.type === 'tool_use' && b.name === 'Agent');
    if (agentCalls.length >= 2) return true;
  }
  return false;
}

// --- subagent sidecar walk ----------------------------------------------

// walkSubagents — attribute worker cost from <sessionDir>/subagents/agent-*.jsonl
// (+ .meta.json). An agent counts if its event span overlaps [start,end].
// Returns { models, totals, agents:[{file, agentType, model, startMs, endMs}] }.
export function walkSubagents(sessionDir, start, end) {
  const startMs = toMs(start);
  const endMs = toMs(end);
  const empty = { models: {}, totals: zeroModel(), agents: [] };
  if (!sessionDir) return empty;
  const subDir = path.join(sessionDir, 'subagents');
  let names;
  try {
    names = fs.readdirSync(subDir);
  } catch {
    return empty;
  }
  const models = {};
  const totals = zeroModel();
  const agents = [];
  for (const name of names) {
    if (!name.endsWith('.jsonl')) continue;
    const events = readJsonl(path.join(subDir, name));
    const stamps = events.map(eventMs).filter((t) => !Number.isNaN(t));
    if (stamps.length === 0) continue;
    const aStart = Math.min(...stamps);
    const aEnd = Math.max(...stamps);
    if (aEnd < startMs || aStart > endMs) continue; // no overlap with the window
    const agg = aggregateUsage(events);
    for (const [model, m] of Object.entries(agg.models)) {
      const acc = models[model] || (models[model] = zeroModel());
      acc.input += m.input;
      acc.output += m.output;
      acc.cache_write += m.cache_write;
      acc.cache_read += m.cache_read;
      totals.input += m.input;
      totals.output += m.output;
      totals.cache_write += m.cache_write;
      totals.cache_read += m.cache_read;
    }
    const meta = readJson(path.join(subDir, name.replace(/\.jsonl$/, '.meta.json')), {}) || {};
    agents.push({
      file: name,
      agentType: meta.agentType || null,
      models: agg.models,
      startMs: aStart,
      endMs: aEnd,
    });
  }
  for (const m of Object.values(models)) finalizeModel(m);
  finalizeModel(totals);
  return { models, totals, agents };
}

// computeMetrics — end-to-end for a transcript file + window. The sidecar dir is
// the transcript path minus its .jsonl suffix (<session-uuid>/ sits beside
// <session-uuid>.jsonl). Tolerates a null/missing transcript with zeroed output.
export function computeMetrics(transcriptFile, start, end, opts = {}) {
  const startMs = toMs(start);
  const endMs = toMs(end);
  const all = transcriptFile ? readJsonl(transcriptFile) : [];
  const windowed = sliceEvents(all, startMs, endMs);
  const usage = aggregateUsage(windowed);
  const sessionDir = transcriptFile ? transcriptFile.replace(/\.jsonl$/, '') : null;
  const sub = walkSubagents(sessionDir, startMs, endMs);
  return {
    models: usage.models,
    modelList: usage.modelList,
    totals: usage.totals,
    subagent_models: sub.models,
    subagent_totals: sub.totals,
    subagent_count: sub.agents.length,
    parallel: detectParallel(sub.agents, windowed),
    running_time_ms: runningTimeMs(windowed, opts),
    event_count: windowed.length,
  };
}

// --- global log location + section record --------------------------------

// globalPerfDir — the cross-project log directory. BEEHIVE_PERF_DIR wins (tests
// use it); else XDG_CONFIG_HOME/beehive; else <home>/.config/beehive. No literal
// home path is ever hard-coded — homedir is always injected/derived.
export function globalPerfDir(env = process.env, homedir = os.homedir()) {
  if (env.BEEHIVE_PERF_DIR) return env.BEEHIVE_PERF_DIR;
  if (env.XDG_CONFIG_HOME) return path.join(env.XDG_CONFIG_HOME, 'beehive');
  return path.join(homedir, '.config', 'beehive');
}

export function globalPerfLogPath(env = process.env, homedir = os.homedir()) {
  return path.join(globalPerfDir(env, homedir), 'performance.jsonl');
}

// humanizeMs — compact "1h2m3s" rendering of a running-time.
export function humanizeMs(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '0s';
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (sec || parts.length === 0) parts.push(`${sec}s`);
  return parts.join('');
}

// buildSection — the JSON record appended to the global log (schema bee-perf/v1).
export function buildSection({
  label,
  note = null,
  projectPath,
  branch = null,
  sessionId = null,
  startTs,
  endTs,
  metrics = {},
}) {
  const startMs = toMs(startTs);
  const endMs = toMs(endTs);
  const runMs = num(metrics.running_time_ms);
  return {
    schema: 'bee-perf/v1',
    label: label || null,
    note,
    project: projectPath || null,
    branch,
    session_id: sessionId,
    started_at: typeof startTs === 'string' ? startTs : Number.isNaN(startMs) ? null : new Date(startMs).toISOString(),
    ended_at: typeof endTs === 'string' ? endTs : Number.isNaN(endMs) ? null : new Date(endMs).toISOString(),
    running_time_ms: runMs,
    running_time_human: humanizeMs(runMs),
    parallel: Boolean(metrics.parallel),
    subagent_count: num(metrics.subagent_count),
    models: metrics.models || {},
    subagent_models: metrics.subagent_models || {},
    event_count: num(metrics.event_count),
    logged_at: new Date().toISOString(),
  };
}

export function appendSection(record, env = process.env, homedir = os.homedir()) {
  const file = globalPerfLogPath(env, homedir);
  ensureDir(path.dirname(file));
  appendJsonl(file, record);
  return file;
}

export function readSections({ limit } = {}, env = process.env, homedir = os.homedir()) {
  const all = readJsonl(globalPerfLogPath(env, homedir));
  if (limit && limit > 0) return all.slice(-limit);
  return all;
}
