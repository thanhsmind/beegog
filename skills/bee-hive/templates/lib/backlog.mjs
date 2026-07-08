// backlog.mjs — read-only parser for docs/backlog.md (the product-backlog layer, D6).
// Reads ONLY the Status column; never writes (transitions are prose-ruled per D7).
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
