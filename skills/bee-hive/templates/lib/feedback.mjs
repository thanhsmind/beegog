// feedback.mjs — the dogfood feedback collector (P18, evolving loop, slice A).
//
// Locked design: decision 8cd4c84e (D2, allowlist — supersedes 20784de8). The
// digest is an ALLOWLIST of structured fields; there is NO free-text field.
// Measurement (reports/validation-slice-a.md) showed friction prose routinely
// names functions, files, and config keys (readBacklogCounts, COMMAND_KEYS,
// approved_gates.shape, internal call graphs) that no code-block strip and no
// secret regex removes — so the free-text surface was REMOVED, not filtered.
// Never collect a detail / text / outcome / deviations prose field.
//
// READ-SCOPE INVARIANT (D2): every filesystem access routes through the single
// exported resolveInScope(root, relPath). It path.resolve()s the target,
// realpath()s the target AND the repo root, and throws unless the real target
// sits under realpath(root)/.bee/ or realpath(root)/docs/history/. path.resolve
// normalizes ".." but does NOT resolve symlinks — a symlinked .bee/cells/evil.json
// pointing outside the repo is rejected by realpath containment.
//
// resolveInScope VALIDATES AND RETURNS AN ABSOLUTE PATH — never bytes. Every
// content read goes through an fsutil wrapper (readJson / readJsonl / readText)
// fed a resolved path; those wrappers hold the only content-read primitive and
// live in fsutil.mjs, not here. Directory enumeration goes through the sibling
// guard listInScope. A source-level test greps this file and asserts it contains
// no bare filesystem-read call — like the COMMAND_KEYS cross-file guard, this is
// a no-accidental-drift check, NOT a sandbox: a determined worker can defeat it.
// It exists to catch accident, not malice.

import fs from 'node:fs';
import path from 'node:path';
import { readJson, readText } from './fsutil.mjs';
import { SECRET_CONTENT_PATTERNS, INJECTION_PATTERNS } from './decisions.mjs';

/** Digest schema version. Pinned by a drift test, like BACKLOG_STATUSES. */
export const SCHEMA_VERSION = '1.0';

/**
 * The allowlist (decision 8cd4c84e). Each digest entry is EXACTLY these fields
 * and nothing more — there is no detail/text/outcome/deviations field. Exported
 * so the consumer (evolving-3) imports this one constant rather than hardcoding a
 * second copy that would silently drift. Pinned by a drift test.
 */
export const ENTRY_FIELDS = ['kind', 'layer', 'source', 'title', 'first_seen', 'pain'];

/**
 * Drop reasons. Category only — a dropped record NEVER carries the matched text
 * (a bare integer cannot distinguish a careless worker from a repo probing bee
 * every close). Pinned by a drift test.
 */
export const DROP_REASONS = ['secret', 'injection', 'oversize', 'unknown_type'];

/**
 * Raw entry.type is unconstrained by contract and repos have already diverged
 * (anphabe-gogl carries 11 types and does not use 'finding' at all — the same
 * concept is spelled 'review-finding', its largest single class). This map
 * normalizes a raw type into the closed kind enum. A type absent from this map
 * is NOT silently dropped — it goes to dropped[] with reason 'unknown_type'.
 */
export const KIND_ALIASES = {
  friction: 'friction',
  finding: 'finding',
  'review-finding': 'finding',
  proposal: 'proposal',
  'kill-proposal': 'proposal',
  outcome: 'outcome',
  'kill-outcome': 'outcome',
  'kill-approval': 'approval',
  'backlog-closed': 'closed',
  'entropy-audit': 'audit',
  'harness-issue': 'harness-issue',
  debt: 'debt',
  'migrate-on-touch': 'debt',
  'scope-correction': 'correction',
  // derived kinds (built directly from cells / learnings) normalize to themselves
  blocked: 'blocked',
  deviation: 'deviation',
  learning: 'learning',
};

const MAX_TITLE = 200;
const PAIN_SEVERITY = { P1: 3, P2: 2, P3: 1 };
const PAIN_LMH = { low: 1, medium: 2, high: 3 };

// Source labels — bee-owned meta, stable across runs, used for `source` and for
// the scanned/absent tally. Never a repo's own free-text `source` field.
const SRC_BACKLOG = '.bee/backlog.jsonl';
const SRC_DECISIONS = '.bee/decisions.jsonl';
const SRC_CELLS = '.bee/cells';
const SRC_LEARNINGS = 'docs/history/learnings';

/**
 * Validate a repo-relative path and return its real absolute location, or null
 * if the path does not exist (an ABSENT source is skipped and counted, never a
 * scope violation and never a throw). Throws for any other realpath error and
 * for any target whose real location escapes .bee/ or docs/history/.
 *
 * Only realpath / lstat are used here — never a content-read primitive — so the
 * source-level drift guard stays at zero matches with no per-function exclusion.
 *
 * @param {string} root - repo root
 * @param {string} relPath - path relative to the repo root
 * @returns {string|null} absolute real path inside scope, or null if absent
 */
export function resolveInScope(root, relPath) {
  let realRoot;
  try {
    realRoot = fs.realpathSync(root);
  } catch (err) {
    throw new Error(`resolveInScope: cannot resolve repo root "${root}": ${err && err.code ? err.code : err}`);
  }
  const target = path.resolve(realRoot, relPath);
  let realTarget;
  try {
    realTarget = fs.realpathSync(target);
  } catch (err) {
    if (err && err.code === 'ENOENT') return null; // absent — the caller counts it, never throws
    throw new Error(`resolveInScope: cannot resolve "${relPath}": ${err && err.code ? err.code : err}`);
  }
  const beeRoot = path.join(realRoot, '.bee');
  const historyRoot = path.join(realRoot, 'docs', 'history');
  const contained =
    realTarget === beeRoot ||
    realTarget === historyRoot ||
    realTarget.startsWith(beeRoot + path.sep) ||
    realTarget.startsWith(historyRoot + path.sep);
  if (!contained) {
    throw new Error(
      `resolveInScope: "${relPath}" resolves to "${realTarget}", outside .bee/ and docs/history/ — rejected by realpath containment`,
    );
  }
  return realTarget;
}

/**
 * Resolve a directory in scope and return its sorted entry names, [] if it
 * exists but is not a directory, or null if it is absent. Enumeration is gated
 * behind resolveInScope's realpath containment and uses opendir (not a
 * directory-listing content read) so the source-level drift guard stays clean.
 *
 * @param {string} root - repo root
 * @param {string} relDir - directory path relative to the repo root
 * @returns {string[]|null} sorted entry names, or null if absent
 */
export function listInScope(root, relDir) {
  const dir = resolveInScope(root, relDir);
  if (dir === null) return null;
  let stat;
  try {
    stat = fs.lstatSync(dir);
  } catch {
    return null;
  }
  if (!stat.isDirectory()) return [];
  const names = [];
  const handle = fs.opendirSync(dir);
  try {
    let entry = handle.readSync();
    while (entry !== null) {
      names.push(entry.name);
      entry = handle.readSync();
    }
  } finally {
    handle.closeSync();
  }
  names.sort();
  return names;
}

function normalizeKind(rawType) {
  if (typeof rawType !== 'string') return null;
  return Object.prototype.hasOwnProperty.call(KIND_ALIASES, rawType) ? KIND_ALIASES[rawType] : null;
}

function scanTitle(value) {
  // Runs BEFORE any transformation, so a match is counted as a security event
  // rather than silently rewritten. Secret takes precedence over injection.
  const text = typeof value === 'string' ? value : '';
  for (const pattern of SECRET_CONTENT_PATTERNS) {
    if (pattern.test(text)) return 'secret';
  }
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) return 'injection';
  }
  return null;
}

function capTitle(value) {
  const text = typeof value === 'string' ? value : '';
  if (text.length <= MAX_TITLE) return text;
  return `${text.slice(0, MAX_TITLE - 1)}…`; // trailing ellipsis marks truncation
}

/**
 * A raw candidate is { type, title, layer, first_seen, pain, source }. Turn it
 * into an allowlist entry, or push a { kind, layer, source, first_seen, reason }
 * record onto dropped[]. Order is fixed: unknown-type check, then the title scan
 * (before any transformation), then the cap, then the entry. Returns the entry
 * or null (dropped).
 */
function buildEntry(raw, dropped) {
  const kind = normalizeKind(raw.type);
  const layer = typeof raw.layer === 'string' && raw.layer ? raw.layer : null;
  const source = typeof raw.source === 'string' ? raw.source : null;
  const firstSeen = typeof raw.first_seen === 'string' && raw.first_seen ? raw.first_seen : null;

  if (kind === null) {
    dropped.push({
      kind: typeof raw.type === 'string' ? raw.type : null,
      layer,
      source,
      first_seen: firstSeen,
      reason: 'unknown_type',
    });
    return null;
  }

  const rawTitle = typeof raw.title === 'string' ? raw.title : '';
  const hit = scanTitle(rawTitle);
  if (hit) {
    dropped.push({ kind, layer, source, first_seen: firstSeen, reason: hit });
    return null;
  }

  const pain = Number.isInteger(raw.pain) && raw.pain > 0 ? raw.pain : 1;
  return { kind, layer, source, title: capTitle(rawTitle), first_seen: firstSeen, pain };
}

/**
 * Parse a learnings *.md frontmatter block into { date, severity, title }, or
 * null when there is no leading `---` frontmatter block. Text-only, no code,
 * no body prose — just the three allowlist-relevant frontmatter fields plus the
 * first H1 as the title.
 */
function parseLearningFrontmatter(text) {
  const lines = String(text || '').split(/\r?\n/);
  if (lines[0] !== '---') return null;
  let end = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i] === '---') {
      end = i;
      break;
    }
  }
  if (end === -1) return null;
  let date = null;
  let severity = null;
  for (let i = 1; i < end; i += 1) {
    const m = lines[i].match(/^([A-Za-z_]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === 'date') date = val || null;
    else if (key === 'severity') severity = val.toLowerCase() || null;
  }
  let title = '';
  for (let i = end + 1; i < lines.length; i += 1) {
    const h1 = lines[i].match(/^#\s+(.*)$/);
    if (h1) {
      title = h1[1].trim();
      break;
    }
  }
  return { date, severity, title };
}

/**
 * Gather raw candidates from every in-scope source, plus the scanned/absent
 * tally and a skipped count (malformed JSONL lines and trace-less/invalid cells
 * are skipped and counted, never thrown). Warnings (e.g. a symlink escaping
 * scope) are surfaced on console.warn and never read.
 *
 * @param {string} root - repo root
 */
export function collectFeedback(root) {
  const raw = [];
  const scanned = [];
  const absent = [];
  let skipped = 0;

  // ── .bee/backlog.jsonl ────────────────────────────────────────────────────
  // Read ONLY allowlist-relevant fields (type, title, ts, severity, layer).
  // NEVER `detail` / `predicted_impact` — that is the removed free-text surface.
  {
    const p = resolveInScope(root, SRC_BACKLOG);
    if (p === null) {
      absent.push(SRC_BACKLOG);
    } else {
      scanned.push(SRC_BACKLOG);
      for (const line of readText(p).split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let row;
        try {
          row = JSON.parse(trimmed);
        } catch {
          skipped += 1; // a malformed JSONL line is skipped and counted, never thrown
          continue;
        }
        if (!row || typeof row !== 'object') {
          skipped += 1;
          continue;
        }
        const pain = typeof row.severity === 'string' && PAIN_SEVERITY[row.severity] ? PAIN_SEVERITY[row.severity] : 1;
        raw.push({ type: row.type, title: row.title, layer: row.layer, first_seen: row.ts, pain, source: SRC_BACKLOG });
      }
    }
  }

  // ── .bee/decisions.jsonl ──────────────────────────────────────────────────
  // A scope-guarded, counted source that emits NO entries in slice A. Decision
  // `decision`/`rationale` text is unbounded prose that names functions, files,
  // and config keys (this repo's own 8cd4c84e decision names readBacklogCounts,
  // COMMAND_KEYS, approved_gates.shape) — exactly the identifier leak the D2
  // allowlist removed. There is no allowlist field mapping for a decision event,
  // so it contributes nothing. It is still routed through resolveInScope so its
  // absence is a genuinely exercised skip-and-count path (must-have).
  {
    const p = resolveInScope(root, SRC_DECISIONS);
    if (p === null) absent.push(SRC_DECISIONS);
    else scanned.push(SRC_DECISIONS);
  }

  // ── .bee/cells/*.json ─────────────────────────────────────────────────────
  // From a cell trace we read ONLY blocked_reason PRESENCE and deviations LENGTH
  // — never their text, never trace.worker (free-form; may hold a human name).
  {
    const names = listInScope(root, SRC_CELLS);
    if (names === null) {
      absent.push(SRC_CELLS);
    } else {
      scanned.push(SRC_CELLS);
      for (const name of names) {
        if (!name.endsWith('.json')) continue;
        let resolved;
        try {
          resolved = resolveInScope(root, `${SRC_CELLS}/${name}`);
        } catch (err) {
          // A symlink (or anything) escaping scope is rejected, warned, NOT read.
          console.warn(`feedback: skipping ${SRC_CELLS}/${name} — ${err && err.message ? err.message : err}`);
          continue;
        }
        if (resolved === null) continue;
        const cell = readJson(resolved, null);
        const trace = cell && typeof cell === 'object' ? cell.trace : null;
        if (!trace || typeof trace !== 'object') {
          skipped += 1; // a cell without a trace is skipped and counted, never thrown
          continue;
        }
        const source = typeof cell.id === 'string' && cell.id ? cell.id : `${SRC_CELLS}/${name}`;
        const firstSeen =
          (typeof trace.capped_at === 'string' && trace.capped_at) ||
          (typeof trace.claimed_at === 'string' && trace.claimed_at) ||
          null;
        const title = typeof cell.title === 'string' ? cell.title : '';
        if (trace.blocked_reason) {
          raw.push({ type: 'blocked', title, layer: null, first_seen: firstSeen, pain: 1, source });
        }
        if (Array.isArray(trace.deviations) && trace.deviations.length > 0) {
          raw.push({ type: 'deviation', title, layer: null, first_seen: firstSeen, pain: 1, source });
        }
      }
    }
  }

  // ── docs/history/learnings/*.md frontmatter ───────────────────────────────
  // Read frontmatter only: the `date`, `severity` (low/medium/high scale), and
  // the H1 title. Never the body prose.
  {
    const names = listInScope(root, SRC_LEARNINGS);
    if (names === null) {
      absent.push(SRC_LEARNINGS);
    } else {
      scanned.push(SRC_LEARNINGS);
      for (const name of names) {
        if (!name.endsWith('.md') || name === 'critical-patterns.md') continue;
        let resolved;
        try {
          resolved = resolveInScope(root, `${SRC_LEARNINGS}/${name}`);
        } catch (err) {
          console.warn(`feedback: skipping ${SRC_LEARNINGS}/${name} — ${err && err.message ? err.message : err}`);
          continue;
        }
        if (resolved === null) continue;
        const parsed = parseLearningFrontmatter(readText(resolved));
        if (!parsed) {
          skipped += 1;
          continue;
        }
        const pain = PAIN_LMH[parsed.severity] || 1;
        raw.push({
          type: 'learning',
          title: parsed.title,
          layer: null,
          first_seen: parsed.date,
          pain,
          source: `${SRC_LEARNINGS}/${name}`,
        });
      }
    }
  }

  return { raw, scanned: scanned.sort(), absent: absent.sort(), skipped };
}

// Deterministic sort key so buildDigest is byte-identical across runs regardless
// of filesystem enumeration order. generated_at is the ONLY volatile field.
function sortKey(o) {
  return [o.first_seen ?? '', o.kind ?? '', o.source ?? '', o.title ?? '', o.reason ?? ''].join(' ');
}

/**
 * Build the feedback digest — a SNAPSHOT rebuilt from scratch each call, never
 * appended. The injected clock {now} (a Date or ISO string) pins generated_at so
 * the test can prove byte-identical output. Shape:
 *   { schema_version, generated_at, repo_label, counts, dropped, entries }
 *
 * @param {string} root - repo root
 * @param {{now?: (Date|string)}} [opts]
 */
export function buildDigest(root, { now } = {}) {
  const generatedAt = now instanceof Date ? now.toISOString() : typeof now === 'string' ? now : new Date().toISOString();
  let repoLabel;
  try {
    repoLabel = path.basename(fs.realpathSync(root));
  } catch {
    repoLabel = path.basename(root);
  }

  const { raw, scanned, absent, skipped } = collectFeedback(root);
  const dropped = [];
  const entries = [];
  for (const candidate of raw) {
    const entry = buildEntry(candidate, dropped);
    if (entry) entries.push(entry);
  }

  entries.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  dropped.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

  const byKind = {};
  for (const e of entries) byKind[e.kind] = (byKind[e.kind] || 0) + 1;
  const byKindSorted = {};
  for (const k of Object.keys(byKind).sort()) byKindSorted[k] = byKind[k];

  const counts = {
    entries: entries.length,
    dropped: dropped.length,
    skipped,
    by_kind: byKindSorted,
    sources_scanned: scanned,
    sources_absent: absent,
  };

  return {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    repo_label: repoLabel,
    counts,
    dropped,
    entries,
  };
}
