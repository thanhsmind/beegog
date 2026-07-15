// backlog.mjs — parser + mechanical passes for docs/backlog.md (the product-backlog
// layer, D6). Status TRANSITIONS stay prose-ruled (per D7) and are never written
// here; the two mechanical passes below (P2 rank = reorder rows by status group,
// P3 badges = render counts into README markers) change no row's content.
// One parser, shared by bee_status and the session preamble.

import fs from 'node:fs';
import path from 'node:path';

// D6: the fixed status enum, priority-ordered. Exported so bee_status, the
// preamble, and the drift guard all read one source of truth.
export const BACKLOG_STATUSES = ['proposed', 'in-flight', 'done'];

function backlogPath(root) {
  return path.join(root, 'docs', 'backlog.md');
}

// 'in-flight' -> 'inFlight'; the count-object key is derived from the token so
// the enum stays the single source of truth (no rival literal list).
function tokenKey(token) {
  return token.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

// Split a markdown table line into trimmed cells, dropping the empty edges that
// bordering pipes produce. Tolerant of rows written without outer pipes.
function splitRow(line) {
  const cells = line.split('|').map((cell) => cell.trim());
  if (cells.length && cells[0] === '') cells.shift();
  if (cells.length && cells[cells.length - 1] === '') cells.pop();
  return cells;
}

// Strip bold/italic/code markup and lowercase, preserving the hyphen in
// 'in-flight'. A separator row cell ('---') or a header cell ('Status') simply
// fails the enum match and is skipped — no special-casing needed.
function normalizeStatus(cell) {
  return cell.replace(/[*`_]/g, '').trim().toLowerCase();
}

/**
 * Parse docs/backlog.md and count rows by their Status column.
 * @returns {{proposed:number, inFlight:number, done:number, total:number}|null}
 *   null only when the file is absent/unreadable; a present-but-tableless file
 *   returns zeroed counts (the file's existence is what gates the preamble line).
 */
export function readBacklogCounts(root) {
  let text;
  try {
    text = fs.readFileSync(backlogPath(root), 'utf8');
  } catch {
    return null;
  }

  const counts = {};
  for (const status of BACKLOG_STATUSES) counts[tokenKey(status)] = 0;

  const lines = text.split(/\r?\n/);
  let statusIndex = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].includes('|')) continue;
    const cells = splitRow(lines[i]);
    if (statusIndex === -1) {
      // The header row is the first table row carrying a 'Status' column.
      const idx = cells.findIndex((cell) => normalizeStatus(cell) === 'status');
      if (idx !== -1) statusIndex = idx;
      continue;
    }
    // A row missing the Status column (malformed / too few cells) is skipped.
    if (cells.length <= statusIndex) continue;
    const token = normalizeStatus(cells[statusIndex]);
    if (BACKLOG_STATUSES.includes(token)) counts[tokenKey(token)] += 1;
  }

  const total = BACKLOG_STATUSES.reduce((sum, status) => sum + counts[tokenKey(status)], 0);
  return { ...counts, total };
}

// ─── P2: mechanical rank pass ───────────────────────────────────────────────
// Reorders the table's data rows by status group — in-flight first (active work
// on top), then proposed, then done (history sinks) — stable within each group
// so hand-ordering inside a group is preserved. Rows whose status is not in the
// enum keep a neutral weight between proposed and done. No cell is edited.

const RANK_WEIGHT = { 'in-flight': 0, proposed: 1, done: 3 };
const RANK_UNKNOWN_WEIGHT = 2;

/**
 * Compute (and with `write: true` apply) the rank pass.
 * @returns {{changed:boolean, order:string[]}|null} null when the file is
 *   absent or has no parseable table; `order` lists the first cell (ID) of each
 *   data row in ranked order.
 */
export function rankBacklog(root, { write = false } = {}) {
  const file = backlogPath(root);
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }

  const lines = text.split(/\r?\n/);
  let statusIndex = -1;
  let separatorLine = -1;
  const rows = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].includes('|')) {
      // A non-table line after the table body ends the block.
      if (separatorLine !== -1 && rows.length > 0) break;
      continue;
    }
    const cells = splitRow(lines[i]);
    if (statusIndex === -1) {
      const idx = cells.findIndex((cell) => normalizeStatus(cell) === 'status');
      if (idx !== -1) {
        statusIndex = idx;
      }
      continue;
    }
    if (separatorLine === -1) {
      separatorLine = i; // the |---| row right after the header
      continue;
    }
    const token = cells.length > statusIndex ? normalizeStatus(cells[statusIndex]) : '';
    rows.push({
      line: lines[i],
      lineIndex: i,
      id: cells[0] ? cells[0].replace(/[*`_]/g, '').trim() : '',
      weight: RANK_WEIGHT[token] !== undefined ? RANK_WEIGHT[token] : RANK_UNKNOWN_WEIGHT,
      position: rows.length,
    });
  }
  if (statusIndex === -1 || separatorLine === -1 || rows.length === 0) return null;

  const ranked = [...rows].sort(
    (a, b) => a.weight - b.weight || a.position - b.position,
  );
  const changed = ranked.some((row, i) => row !== rows[i]);
  const order = ranked.map((row) => row.id);

  if (write && changed) {
    // Write ranked lines back into the rows' original line slots, so any
    // surrounding non-table content is untouched even if rows are not contiguous.
    const slots = rows.map((row) => row.lineIndex);
    for (let i = 0; i < ranked.length; i += 1) {
      lines[slots[i]] = ranked[i].line;
    }
    fs.writeFileSync(file, lines.join('\n'), 'utf8');
  }
  return { changed, order };
}

// ─── featureBacklogRank: Feature-column rank (fresh-session-handoff fsh-11,
// D2 cross-lane ordering) ────────────────────────────────────────────────────
// rankBacklog above reorders rows by Status and returns the ID-column order —
// it never reads the Feature column at all. claim-next's cross-lane pull
// needs the OPPOSITE lookup: "where does lane/feature X rank in the backlog",
// keyed by feature, not by row id. This walks the same table shape (status-
// grouped weight, stable within a group — the exact RANK_WEIGHT ordering
// rankBacklog itself uses) but captures the Feature column per row instead.
//
// A row whose Feature cell is missing, blank, or the placeholder "—"/"-"
// contributes no mapping — it never claims a feature slug. When two rows
// name the SAME feature, the row closest to rank 0 (its best-ranked
// occurrence) wins, so a feature with both an in-flight and a done row ranks
// at the in-flight row's position.
//
// @returns {Map<string, number>} feature slug -> rank position (0 = highest
//   priority). Empty when the file is absent or has no parseable table with a
//   Feature column — callers treat a missing entry as "unranked" (sorts last
//   alongside every other unranked feature, callers' tie-break decides ties).
export function featureBacklogRank(root) {
  const file = backlogPath(root);
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return new Map();
  }

  const lines = text.split(/\r?\n/);
  let statusIndex = -1;
  let featureIndex = -1;
  let separatorLine = -1;
  const rows = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].includes('|')) {
      if (separatorLine !== -1 && rows.length > 0) break;
      continue;
    }
    const cells = splitRow(lines[i]);
    if (statusIndex === -1) {
      const idx = cells.findIndex((cell) => normalizeStatus(cell) === 'status');
      if (idx !== -1) {
        statusIndex = idx;
        featureIndex = cells.findIndex((cell) => normalizeStatus(cell) === 'feature');
      }
      continue;
    }
    if (separatorLine === -1) {
      separatorLine = i; // the |---| row right after the header
      continue;
    }
    const token = cells.length > statusIndex ? normalizeStatus(cells[statusIndex]) : '';
    const rawFeature = featureIndex !== -1 && cells.length > featureIndex ? cells[featureIndex] : '';
    const feature = rawFeature.replace(/[*`_]/g, '').trim();
    rows.push({
      feature: feature && feature !== '—' && feature !== '-' ? feature : null,
      weight: RANK_WEIGHT[token] !== undefined ? RANK_WEIGHT[token] : RANK_UNKNOWN_WEIGHT,
      position: rows.length,
    });
  }
  if (statusIndex === -1 || featureIndex === -1 || separatorLine === -1 || rows.length === 0) {
    return new Map();
  }

  const ranked = [...rows].sort((a, b) => a.weight - b.weight || a.position - b.position);
  const map = new Map();
  ranked.forEach((row, rank) => {
    if (row.feature && !map.has(row.feature)) map.set(row.feature, rank);
  });
  return map;
}

// ─── P3: README badges ──────────────────────────────────────────────────────
// Renders the counts as shields.io static badges between BEE markers in
// README.md. Idempotent; creates the marker block after the first heading when
// absent. Counts-only — no row content leaves the backlog file.

export const BADGE_MARKER_START = '<!-- BEE:BACKLOG-BADGES:START -->';
export const BADGE_MARKER_END = '<!-- BEE:BACKLOG-BADGES:END -->';

const BADGE_COLORS = { done: 'brightgreen', 'in-flight': 'blue', proposed: 'lightgrey' };

function shieldsEscape(text) {
  // shields.io static badges: '-' doubles, '_' doubles, space becomes '%20'.
  return String(text).replace(/-/g, '--').replace(/_/g, '__').replace(/ /g, '%20');
}

export function renderBacklogBadges(root) {
  const counts = readBacklogCounts(root);
  if (!counts) return null;
  const badges = BACKLOG_STATUSES.slice()
    .reverse() // done first — the headline number
    .map((status) => {
      const label = shieldsEscape(`backlog ${status}`);
      const value = counts[tokenKey(status)];
      return `![backlog ${status}](https://img.shields.io/badge/${label}-${value}-${BADGE_COLORS[status]})`;
    });
  return badges.join(' ');
}

/**
 * Insert or refresh the badge block in README.md.
 * @returns {{changed:boolean, badges:string}|null} null when README.md or the
 *   backlog is absent.
 */
export function updateReadmeBadges(root, { write = false } = {}) {
  const badges = renderBacklogBadges(root);
  if (badges == null) return null;
  const file = path.join(root, 'README.md');
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }

  const block = `${BADGE_MARKER_START}\n${badges}\n${BADGE_MARKER_END}`;
  let next;
  if (text.includes(BADGE_MARKER_START) && text.includes(BADGE_MARKER_END)) {
    const pattern = new RegExp(
      `${BADGE_MARKER_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${BADGE_MARKER_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
    );
    next = text.replace(pattern, block);
  } else {
    // No markers yet: place the block right under the first heading line.
    const lines = text.split(/\r?\n/);
    const headingIdx = lines.findIndex((line) => line.startsWith('#'));
    const at = headingIdx === -1 ? 0 : headingIdx + 1;
    lines.splice(at, 0, '', block);
    next = lines.join('\n');
  }

  const changed = next !== text;
  if (write && changed) fs.writeFileSync(file, next, 'utf8');
  return { changed, badges };
}
