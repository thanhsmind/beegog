#!/usr/bin/env node
// test_recovery.mjs — self-contained, SYNCHRONOUS tests for lib/recovery.mjs
// (transcript-recovery D1-D6, docs/history/transcript-recovery/CONTEXT.md).
// Fixtures are written to os.tmpdir() temp trees; no literal home path
// anywhere, and the real ~/.claude/projects and .bee/ stores are never
// touched (every root is a fresh temp dir per check group).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  detectCrashCandidates,
  readTranscriptTail,
  hasCleanEndTrio,
  lastDurableSettlement,
  computeMiningWindow,
  buildMiningPrompt,
} from '../lib/recovery.mjs';
import { encodeProjectDir } from '../lib/perf.mjs';

let pass = 0;
let fail = 0;
function check(name, fn) {
  try {
    fn();
    pass += 1;
    console.log(`PASS ${name}`);
  } catch (err) {
    fail += 1;
    console.log(`FAIL ${name}: ${err && err.stack ? err.stack : err}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}
function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || 'not equal'}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
}

const iso = (ms) => new Date(ms).toISOString();
const BASE = Date.parse('2026-07-20T00:00:00.000Z');
const PROJECT_PATH = '/work/demo';

// --- fixture helpers ---------------------------------------------------

function freshRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'recovery-test-'));
}

function writeSessionRecord(root, id, { started_at, last_heartbeat, lane } = {}) {
  const dir = path.join(root, '.bee', 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  const rec = { id, started_at, last_heartbeat };
  if (lane) rec.lane = lane;
  fs.writeFileSync(path.join(dir, `${id}.json`), `${JSON.stringify(rec, null, 2)}\n`, 'utf8');
}

function writeLaneRecord(root, feature, { phase = 'idle' } = {}) {
  const dir = path.join(root, '.bee', 'lanes');
  fs.mkdirSync(dir, { recursive: true });
  const rec = {
    schema_version: '1.0',
    feature,
    mode: 'standard',
    phase,
    approved_gates: { context: true, shape: true, execution: true, review: false },
    summary: '',
    next_action: '',
    created_at: iso(BASE),
  };
  fs.writeFileSync(path.join(dir, `${feature}.json`), `${JSON.stringify(rec, null, 2)}\n`, 'utf8');
}

function writeTranscript(projectsRoot, projectPath, sessionId, events) {
  const dir = path.join(projectsRoot, encodeProjectDir(projectPath));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${sessionId}.jsonl`);
  const body = events.length ? `${events.map((e) => JSON.stringify(e)).join('\n')}\n` : '';
  fs.writeFileSync(file, body, 'utf8');
  return file;
}

function writeDecision(root, { id, date, decision = 'x', rationale = 'y' }) {
  const file = path.join(root, '.bee', 'decisions.jsonl');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(
    file,
    `${JSON.stringify({ id, type: 'decide', date, decision, rationale, alternatives: null, scope: 'repo', source: 'user', confidence: null })}\n`,
    'utf8',
  );
}

function writeCaptureStub(root, { id, at, lane = null }) {
  const file = path.join(root, '.bee', 'capture-queue.jsonl');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(
    file,
    `${JSON.stringify({ kind: 'stub', id, at, outcome: 'x', dids: [], area: null, files: [], lane })}\n`,
    'utf8',
  );
}

function writeCappedCell(root, { id, feature, capped_at }) {
  const dir = path.join(root, '.bee', 'cells');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, `${id}.json`),
    `${JSON.stringify({ id, feature, status: 'capped', trace: { capped_at } }, null, 2)}\n`,
    'utf8',
  );
}

function writeClaim(root, { cellId, sessionId, claimed_at, ttl_seconds = 3600 }) {
  const dir = path.join(root, '.bee', 'claims');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, `${cellId}.json`),
    `${JSON.stringify({ cell: cellId, session: sessionId, ttl_seconds, claimed_at, acquired_at: claimed_at }, null, 2)}\n`,
    'utf8',
  );
}

function cleanEndEvents(t0) {
  return [
    { type: 'user', timestamp: iso(t0), message: { role: 'user', content: [{ type: 'text', text: 'go' }] } },
    { type: 'assistant', timestamp: iso(t0 + 1000), message: { role: 'assistant' } },
    { type: 'system', subtype: 'stop_hook_summary', timestamp: iso(t0 + 1100) },
    { type: 'system', subtype: 'turn_duration', durationMs: 5000, timestamp: iso(t0 + 1105) },
    { type: 'last-prompt', lastPrompt: 'hi', leafUuid: 'x' },
    { type: 'ai-title', aiTitle: 'demo' },
    { type: 'mode', mode: 'normal' },
  ];
}

function dirtyEndEvents(t0) {
  // ends mid-turn: no stop_hook_summary/turn_duration/last-prompt trio at all.
  return [
    { type: 'user', timestamp: iso(t0), message: { role: 'user', content: [{ type: 'text', text: 'go' }] } },
    { type: 'assistant', timestamp: iso(t0 + 1000), message: { role: 'assistant' } },
  ];
}

const STALE_HEARTBEAT = iso(BASE - 1000 * 1000); // 1000s old > 900s law
const FRESH_HEARTBEAT = iso(BASE - 100 * 1000); // 100s old < 900s law

// ======================================================================
// hasCleanEndTrio
// ======================================================================

check('hasCleanEndTrio: true for the trio with tolerated trailing bookkeeping', () => {
  assert(hasCleanEndTrio(cleanEndEvents(BASE)) === true, 'clean tail with queue/ai-title/mode trailing must be clean');
});

check('hasCleanEndTrio: false when the trio is entirely absent (mid-turn tail)', () => {
  assert(hasCleanEndTrio(dirtyEndEvents(BASE)) === false, 'dirty tail must not read as clean');
});

check('hasCleanEndTrio: false when last-prompt is missing after turn_duration', () => {
  const events = cleanEndEvents(BASE).filter((e) => e.type !== 'last-prompt' && e.type !== 'ai-title' && e.type !== 'mode');
  assert(hasCleanEndTrio(events) === false, 'stop_hook_summary + turn_duration alone is not the full trio');
});

check('hasCleanEndTrio: false when something conversational follows the trio', () => {
  const events = cleanEndEvents(BASE).concat([{ type: 'user', timestamp: iso(BASE + 5000), message: {} }]);
  assert(hasCleanEndTrio(events) === false, 'a user message after the trio means the tail is not actually clean');
});

check('hasCleanEndTrio: false for an empty tail', () => {
  assert(hasCleanEndTrio([]) === false, 'no events => no trio');
});

// ======================================================================
// readTranscriptTail
// ======================================================================

check('readTranscriptTail: missing file returns []', () => {
  const tmp = freshRoot();
  eq(readTranscriptTail(path.join(tmp, 'nope.jsonl')).length, 0, 'missing file -> no throw, empty');
});

check('readTranscriptTail: empty file returns []', () => {
  const tmp = freshRoot();
  const file = path.join(tmp, 'empty.jsonl');
  fs.writeFileSync(file, '', 'utf8');
  eq(readTranscriptTail(file).length, 0, 'empty file -> empty');
});

check('readTranscriptTail: reads only the last window, drops the truncated first line', () => {
  const tmp = freshRoot();
  const file = path.join(tmp, 'big.jsonl');
  const padLine = JSON.stringify({ type: 'assistant', pad: 'x'.repeat(500) });
  const lines = [];
  for (let i = 0; i < 400; i++) lines.push(padLine); // ~ far more than one 512-byte window
  lines.push(JSON.stringify({ type: 'user', marker: 'TAIL_EVENT_1', timestamp: iso(BASE) }));
  lines.push(JSON.stringify({ type: 'assistant', marker: 'TAIL_EVENT_2', timestamp: iso(BASE + 1000) }));
  fs.writeFileSync(file, `${lines.join('\n')}\n`, 'utf8');

  const tail = readTranscriptTail(file, 600); // window smaller than the padding, forces a mid-line start
  const markers = tail.map((e) => e.marker).filter(Boolean);
  assert(markers.includes('TAIL_EVENT_1') && markers.includes('TAIL_EVENT_2'), 'both real tail events recovered');
  // Every parsed event must be well-formed JSON (a truncated first line would
  // either throw or leave stray fragments — neither happened).
  for (const e of tail) assert(e && typeof e === 'object', 'every returned entry parsed cleanly');
});

check('readTranscriptTail: skips malformed JSON lines in the window', () => {
  const tmp = freshRoot();
  const file = path.join(tmp, 'malformed.jsonl');
  const content = [
    JSON.stringify({ type: 'user', marker: 'ok1' }),
    '{not valid json',
    JSON.stringify({ type: 'assistant', marker: 'ok2' }),
  ].join('\n');
  fs.writeFileSync(file, `${content}\n`, 'utf8');
  const tail = readTranscriptTail(file);
  eq(tail.length, 2, 'malformed line skipped, both valid lines kept');
  assert(tail[0].marker === 'ok1' && tail[1].marker === 'ok2', 'valid entries preserved in order');
});

// ======================================================================
// lastDurableSettlement
// ======================================================================

check('lastDurableSettlement: max across decisions, capture stubs, and cell traces (global)', () => {
  const root = freshRoot();
  writeDecision(root, { id: 'd1', date: iso(BASE) });
  writeCaptureStub(root, { id: 'c1', at: iso(BASE + 2000) });
  writeCappedCell(root, { id: 'feat-1', feature: 'feat', capped_at: iso(BASE + 1000) });
  eq(lastDurableSettlement(root), iso(BASE + 2000), 'max of the three sources (capture stub wins)');
});

check('lastDurableSettlement: lane scoping filters capture stubs and cells, decisions stay global', () => {
  const root = freshRoot();
  writeDecision(root, { id: 'd1', date: iso(BASE + 9000) }); // global decision, newest of all — always counted
  writeCaptureStub(root, { id: 'c-mine', at: iso(BASE + 1000), lane: 'mine' });
  writeCaptureStub(root, { id: 'c-other', at: iso(BASE + 5000), lane: 'other' });
  writeCappedCell(root, { id: 'mine-1', feature: 'mine', capped_at: iso(BASE + 2000) });
  writeCappedCell(root, { id: 'other-1', feature: 'other', capped_at: iso(BASE + 6000) });

  const scoped = lastDurableSettlement(root, 'mine');
  // decisions have no lane field so they are always included; the newest
  // in-scope value here is the global decision at +9000, NOT the +5000/+6000
  // records that belong to lane "other".
  eq(scoped, iso(BASE + 9000), 'lane-scoped read still includes the (unscoped) decision, excludes other lane rows');
});

check('lastDurableSettlement: no settlement anywhere -> null', () => {
  const root = freshRoot();
  eq(lastDurableSettlement(root), null, 'nothing logged -> null, caller falls back to started_at');
  eq(lastDurableSettlement(root, 'some-lane'), null, 'same for a lane-scoped, never-settled lane');
});

// ======================================================================
// computeMiningWindow
// ======================================================================

check('computeMiningWindow: keeps only events after sinceTs', () => {
  const tmp = freshRoot();
  const file = path.join(tmp, 't.jsonl');
  const events = [
    { type: 'assistant', marker: 'before', timestamp: iso(BASE) },
    { type: 'assistant', marker: 'after1', timestamp: iso(BASE + 1000) },
    { type: 'assistant', marker: 'after2', timestamp: iso(BASE + 2000) },
  ];
  fs.writeFileSync(file, `${events.map((e) => JSON.stringify(e)).join('\n')}\n`, 'utf8');
  const win = computeMiningWindow(file, iso(BASE));
  eq(win.event_count, 2, 'sinceTs is exclusive — only strictly-after events kept');
  assert(win.events.every((e) => e.marker !== 'before'), 'the before-marker event is excluded');
  eq(win.window_truncated, false, 'under the cap -> not truncated');
});

check('computeMiningWindow: hard cap truncates oldest, keeps most recent, flags truncation', () => {
  const tmp = freshRoot();
  const file = path.join(tmp, 't.jsonl');
  const events = [];
  for (let i = 0; i < 10; i++) events.push({ type: 'assistant', marker: `e${i}`, timestamp: iso(BASE + i * 1000) });
  fs.writeFileSync(file, `${events.map((e) => JSON.stringify(e)).join('\n')}\n`, 'utf8');
  const win = computeMiningWindow(file, null, { maxEvents: 4 });
  eq(win.event_count, 4, 'capped to maxEvents');
  eq(win.window_truncated, true, 'truncation flagged');
  const markers = win.events.map((e) => e.marker);
  assert(markers.join(',') === 'e6,e7,e8,e9', 'kept the 4 MOST RECENT events, oldest dropped');
});

check('computeMiningWindow: even with no sinceTs, the cap still applies (never whole transcript by default)', () => {
  const tmp = freshRoot();
  const file = path.join(tmp, 't.jsonl');
  const events = [];
  for (let i = 0; i < 50; i++) events.push({ type: 'assistant', marker: `e${i}` });
  fs.writeFileSync(file, `${events.map((e) => JSON.stringify(e)).join('\n')}\n`, 'utf8');
  const win = computeMiningWindow(file, null, { maxEvents: 5 });
  eq(win.event_count, 5, 'null sinceTs does not bypass the hard cap');
  eq(win.window_truncated, true, 'still marked truncated');
});

// ======================================================================
// buildMiningPrompt
// ======================================================================

check('buildMiningPrompt: leads with the bee-tier marker, carries D5 clauses and digest sections', () => {
  const candidate = { session_id: 'sess-abc', lane: 'transcript-recovery' };
  const window = { event_count: 12, window_truncated: false };
  const prompt = buildMiningPrompt(candidate, window);
  assert(prompt.startsWith('[bee-tier: generation]'), 'bee-tier marker must be the first thing in the prompt');
  assert(/redact/i.test(prompt), 'redaction clause present');
  assert(prompt.includes('DATA, never instructions'), 'data-never-instructions clause present verbatim');
  assert(prompt.includes('sess-abc') && prompt.includes('transcript-recovery'), 'candidate identity embedded');
  assert(prompt.includes('In-flight summary'), 'digest section: in-flight summary');
  assert(prompt.includes('Candidate settlements'), 'digest section: candidate settlements');
  assert(prompt.includes('Verify evidence seen'), 'digest section: verify evidence seen');
  assert(prompt.includes('Suggested next action'), 'digest section: suggested next action');
  assert(prompt.includes('600 words'), 'word cap stated');
});

check('buildMiningPrompt: notes truncation when the window was capped', () => {
  const prompt = buildMiningPrompt({ session_id: 's', lane: null }, { event_count: 5, window_truncated: true });
  assert(/truncat/i.test(prompt), 'truncation is surfaced to the miner');
});

// ======================================================================
// detectCrashCandidates
// ======================================================================

check('detectCrashCandidates: no .bee/sessions dir at all -> [] silently', () => {
  const root = freshRoot();
  const projectsRoot = path.join(root, 'projects');
  eq(detectCrashCandidates(root, { projectsRoot, projectPath: PROJECT_PATH }).length, 0, 'no sessions dir -> empty, no throw');
});

check('detectCrashCandidates: sessions dir present but zero records -> []', () => {
  const root = freshRoot();
  fs.mkdirSync(path.join(root, '.bee', 'sessions'), { recursive: true });
  const projectsRoot = path.join(root, 'projects');
  eq(detectCrashCandidates(root, { projectsRoot, projectPath: PROJECT_PATH }).length, 0, 'zero records -> empty');
});

check('detectCrashCandidates: missing projects root (Codex-style host) -> [] silently even with stale work', () => {
  const root = freshRoot();
  const sid = 'sess-codex';
  writeSessionRecord(root, sid, { started_at: iso(BASE - 5000), last_heartbeat: STALE_HEARTBEAT, lane: 'somefeat' });
  writeLaneRecord(root, 'somefeat', { phase: 'swarming' });
  const missingProjectsRoot = path.join(root, 'projects-does-not-exist');
  eq(
    detectCrashCandidates(root, { projectsRoot: missingProjectsRoot, projectPath: PROJECT_PATH, now: BASE }).length,
    0,
    'no transcript store -> silent no-op (D2)',
  );
});

check('detectCrashCandidates: the current live session is never a candidate', () => {
  const root = freshRoot();
  const projectsRoot = path.join(root, 'projects');
  const sid = 'sess-live';
  writeSessionRecord(root, sid, { started_at: iso(BASE - 5000), last_heartbeat: STALE_HEARTBEAT });
  writeTranscript(projectsRoot, PROJECT_PATH, sid, dirtyEndEvents(BASE - 4000));
  const out = detectCrashCandidates(root, { projectsRoot, projectPath: PROJECT_PATH, now: BASE, currentSessionId: sid });
  eq(out.length, 0, 'even stale + dirty, the live session itself is excluded');
});

check('detectCrashCandidates: a fresh heartbeat is excluded (not stale)', () => {
  const root = freshRoot();
  const projectsRoot = path.join(root, 'projects');
  const sid = 'sess-fresh';
  writeSessionRecord(root, sid, { started_at: iso(BASE - 5000), last_heartbeat: FRESH_HEARTBEAT });
  writeTranscript(projectsRoot, PROJECT_PATH, sid, dirtyEndEvents(BASE - 4000));
  const out = detectCrashCandidates(root, { projectsRoot, projectPath: PROJECT_PATH, now: BASE });
  eq(out.length, 0, 'fresh heartbeat -> not a crash');
});

check('detectCrashCandidates: a stale session with a clean-end transcript tail is excluded', () => {
  const root = freshRoot();
  const projectsRoot = path.join(root, 'projects');
  const sid = 'sess-clean';
  writeSessionRecord(root, sid, { started_at: iso(BASE - 5000), last_heartbeat: STALE_HEARTBEAT, lane: 'feat-clean' });
  writeLaneRecord(root, 'feat-clean', { phase: 'swarming' }); // even with a live-looking lane...
  writeTranscript(projectsRoot, PROJECT_PATH, sid, cleanEndEvents(BASE - 4000)); // ...a clean stop wins
  const out = detectCrashCandidates(root, { projectsRoot, projectPath: PROJECT_PATH, now: BASE });
  eq(out.length, 0, 'clean-end trio at tail -> not a crash, regardless of lane state');
});

check('detectCrashCandidates: a stale session with a missing transcript is never a crash candidate', () => {
  const root = freshRoot();
  const projectsRoot = path.join(root, 'projects');
  const sid = 'sess-no-transcript';
  writeSessionRecord(root, sid, { started_at: iso(BASE - 5000), last_heartbeat: STALE_HEARTBEAT, lane: 'feat-x' });
  writeLaneRecord(root, 'feat-x', { phase: 'swarming' });
  fs.mkdirSync(path.join(projectsRoot, encodeProjectDir(PROJECT_PATH)), { recursive: true }); // dir exists, file doesn't
  const out = detectCrashCandidates(root, { projectsRoot, projectPath: PROJECT_PATH, now: BASE });
  eq(out.length, 0, 'no transcript to prove an abrupt stop -> excluded, transcript:null case');
});

check('detectCrashCandidates: dirty tail + bound lane in a non-terminal phase -> candidate (work_signal lane)', () => {
  const root = freshRoot();
  const projectsRoot = path.join(root, 'projects');
  const sid = 'sess-lane';
  writeSessionRecord(root, sid, { started_at: iso(BASE - 5000), last_heartbeat: STALE_HEARTBEAT, lane: 'feat-lane' });
  writeLaneRecord(root, 'feat-lane', { phase: 'swarming' });
  writeTranscript(projectsRoot, PROJECT_PATH, sid, dirtyEndEvents(BASE - 4000));
  const out = detectCrashCandidates(root, { projectsRoot, projectPath: PROJECT_PATH, now: BASE });
  eq(out.length, 1, 'one candidate found');
  eq(out[0].session_id, sid);
  eq(out[0].lane, 'feat-lane');
  eq(out[0].work_signal, 'lane');
  assert(typeof out[0].transcript === 'string' && out[0].transcript.endsWith('.jsonl'), 'transcript path recorded');
});

check('detectCrashCandidates: dirty tail + lane in a TERMINAL phase + no other signal -> excluded', () => {
  const root = freshRoot();
  const projectsRoot = path.join(root, 'projects');
  const sid = 'sess-terminal-lane';
  writeSessionRecord(root, sid, { started_at: iso(BASE - 5000), last_heartbeat: STALE_HEARTBEAT, lane: 'feat-done' });
  writeLaneRecord(root, 'feat-done', { phase: 'compounding-complete' });
  // settlement is NEWER than the transcript's last activity, so the third
  // signal (transcript newer than settlement) does not fire either.
  writeCappedCell(root, { id: 'feat-done-1', feature: 'feat-done', capped_at: iso(BASE) });
  writeTranscript(projectsRoot, PROJECT_PATH, sid, dirtyEndEvents(BASE - 10000));
  const out = detectCrashCandidates(root, { projectsRoot, projectPath: PROJECT_PATH, now: BASE });
  eq(out.length, 0, 'a closed lane with settled work and no fresher activity is not a crash candidate');
});

check('detectCrashCandidates: dirty tail + an active claimed cell -> candidate (work_signal claimed_cells)', () => {
  const root = freshRoot();
  const projectsRoot = path.join(root, 'projects');
  const sid = 'sess-claims';
  writeSessionRecord(root, sid, { started_at: iso(BASE - 5000), last_heartbeat: STALE_HEARTBEAT });
  writeClaim(root, { cellId: 'some-cell-1', sessionId: sid, claimed_at: iso(BASE - 4000) });
  writeTranscript(projectsRoot, PROJECT_PATH, sid, dirtyEndEvents(BASE - 4000));
  const out = detectCrashCandidates(root, { projectsRoot, projectPath: PROJECT_PATH, now: BASE });
  eq(out.length, 1, 'one candidate found');
  eq(out[0].work_signal, 'claimed_cells');
  eq(out[0].lane, null, 'no bound lane on this session');
});

check('detectCrashCandidates: laneless session falls back to the GLOBAL settlement window (D3)', () => {
  const root = freshRoot();
  const projectsRoot = path.join(root, 'projects');
  const sid = 'sess-laneless';
  writeSessionRecord(root, sid, { started_at: iso(BASE - 20000), last_heartbeat: STALE_HEARTBEAT });
  writeDecision(root, { id: 'd1', date: iso(BASE - 15000) }); // global settlement, older than the transcript activity below
  writeTranscript(projectsRoot, PROJECT_PATH, sid, dirtyEndEvents(BASE - 4000)); // activity after settlement
  const out = detectCrashCandidates(root, { projectsRoot, projectPath: PROJECT_PATH, now: BASE });
  eq(out.length, 1, 'transcript activity newer than the global settlement -> candidate');
  eq(out[0].work_signal, 'transcript_activity');
  eq(out[0].since, iso(BASE - 15000), 'candidate carries the global settlement timestamp it was measured against');
});

check('detectCrashCandidates: no settlement anywhere falls back to session started_at', () => {
  const root = freshRoot();
  const projectsRoot = path.join(root, 'projects');
  const sid = 'sess-no-settlement';
  const startedAt = iso(BASE - 20000);
  writeSessionRecord(root, sid, { started_at: startedAt, last_heartbeat: STALE_HEARTBEAT });
  writeTranscript(projectsRoot, PROJECT_PATH, sid, dirtyEndEvents(BASE - 4000)); // activity after started_at
  const out = detectCrashCandidates(root, { projectsRoot, projectPath: PROJECT_PATH, now: BASE });
  eq(out.length, 1, 'activity after started_at, with zero durable settlement anywhere -> still a candidate');
  eq(out[0].since, startedAt, 'since falls back to the session started_at (D3)');
});

console.log(`\ntest_recovery: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
