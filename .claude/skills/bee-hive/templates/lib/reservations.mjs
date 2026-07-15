// reservations.mjs — same-session file reservations for swarms.
// Store: .bee/reservations.json { reservations: [ {agent, cell, path, ttl_seconds, reserved_at, released_at|null} ] }

import path from 'node:path';
import { readJson, writeJsonAtomic } from './fsutil.mjs';

const DEFAULT_TTL_SECONDS = 3600;

function utcNow() {
  return new Date().toISOString();
}

export function reservationsPath(root) {
  return path.join(root, '.bee', 'reservations.json');
}

function readStore(root) {
  const store = readJson(reservationsPath(root), null);
  if (!store || typeof store !== 'object' || !Array.isArray(store.reservations)) {
    return { reservations: [] };
  }
  return store;
}

function writeStore(root, store) {
  writeJsonAtomic(reservationsPath(root), store);
}

function isExpired(reservation, nowMs) {
  const ttl = reservation.ttl_seconds;
  if (!Number.isFinite(ttl) || ttl <= 0) return false;
  const reservedMs = Date.parse(reservation.reserved_at);
  if (!Number.isFinite(reservedMs)) return false;
  return reservedMs + ttl * 1000 <= nowMs;
}

function isActive(reservation, nowMs = Date.now()) {
  return reservation.released_at == null && !isExpired(reservation, nowMs);
}

function normalizePath(value) {
  return String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/\/+$/, '');
}

/**
 * Two reservation paths overlap when: exact match, one is a directory prefix
 * of the other, or one is a trivial `*` glob suffix (e.g. `src/api/*`)
 * whose prefix contains/covers the other.
 */
export function pathsOverlap(a, b) {
  const left = normalizePath(a);
  const right = normalizePath(b);
  if (!left || !right) return false;
  if (left === right) return true;

  const leftGlob = left.endsWith('*');
  const rightGlob = right.endsWith('*');
  const leftBase = leftGlob ? left.replace(/\*+$/, '').replace(/\/+$/, '') : left;
  const rightBase = rightGlob ? right.replace(/\*+$/, '').replace(/\/+$/, '') : right;

  if (leftBase === rightBase) return true;
  if (leftBase === '' || rightBase === '') return true; // bare "*" covers everything
  return (
    leftBase.startsWith(`${rightBase}/`) || rightBase.startsWith(`${leftBase}/`)
  );
}

export function listReservations(root, { activeOnly = false } = {}) {
  const store = readStore(root);
  const nowMs = Date.now();
  if (!activeOnly) return store.reservations;
  return store.reservations.filter((reservation) => isActive(reservation, nowMs));
}

/** Active reservations held by *other* agents covering any of the given paths. */
export function findConflicts(root, agent, paths) {
  const requested = (Array.isArray(paths) ? paths : [paths]).filter(Boolean);
  if (requested.length === 0) return [];
  return listReservations(root, { activeOnly: true }).filter(
    (reservation) =>
      reservation.agent !== agent &&
      requested.some((requestedPath) => pathsOverlap(reservation.path, requestedPath)),
  );
}

/**
 * Active reservations owned by a DIFFERENT session covering any of the given
 * paths (fresh-session-handoff D3 — cross-session hold conflict finder, the
 * session-keyed sibling of findConflicts' agent-keyed check). A reservation
 * with no `session` field is a legacy/intra-swarm-only row and never
 * conflicts here — only rows explicitly bound to a session can deny another
 * session's write; the acting session's own rows never conflict either.
 */
export function findSessionConflicts(root, sessionId, paths) {
  const requested = (Array.isArray(paths) ? paths : [paths]).filter(Boolean);
  if (requested.length === 0) return [];
  const acting = typeof sessionId === 'string' ? sessionId.trim() : '';
  return listReservations(root, { activeOnly: true }).filter(
    (reservation) =>
      typeof reservation.session === 'string' &&
      reservation.session.trim() &&
      reservation.session !== acting &&
      requested.some((requestedPath) => pathsOverlap(reservation.path, requestedPath)),
  );
}

export function reserve(root, { agent, cell, path: reservedPath, ttl = DEFAULT_TTL_SECONDS, session = null }) {
  if (typeof agent !== 'string' || !agent.trim()) {
    throw new Error('reserve: agent is required.');
  }
  if (typeof cell !== 'string' || !cell.trim()) {
    throw new Error('reserve: cell id is required.');
  }
  if (typeof reservedPath !== 'string' || !reservedPath.trim()) {
    throw new Error('reserve: path is required.');
  }
  const conflicts = findConflicts(root, agent.trim(), [reservedPath]);
  if (conflicts.length > 0) {
    return { ok: false, conflicts };
  }
  const store = readStore(root);
  const reservation = {
    agent: agent.trim(),
    cell: cell.trim(),
    path: normalizePath(reservedPath),
    ttl_seconds: Number.isFinite(ttl) && ttl > 0 ? Math.floor(ttl) : DEFAULT_TTL_SECONDS,
    reserved_at: utcNow(),
    released_at: null,
    // session is OPTIONAL and OMITTED entirely when absent (mirrors claims.mjs's
    // lane-omission pattern): every pre-existing row and every call that never
    // passes `session` keeps today's exact shape, byte for byte.
    ...(typeof session === 'string' && session.trim() ? { session: session.trim() } : {}),
  };
  store.reservations.push(reservation);
  writeStore(root, store);
  return { ok: true, reservation };
}

export function release(root, { agent, cell = null }) {
  if (typeof agent !== 'string' || !agent.trim()) {
    throw new Error('release: agent is required.');
  }
  const store = readStore(root);
  const releasedAt = utcNow();
  let released = 0;
  for (const reservation of store.reservations) {
    if (reservation.released_at != null) continue;
    if (reservation.agent !== agent.trim()) continue;
    if (cell && reservation.cell !== cell) continue;
    reservation.released_at = releasedAt;
    released += 1;
  }
  if (released > 0) writeStore(root, store);
  return { released };
}

export function sweepExpired(root) {
  const store = readStore(root);
  const nowMs = Date.now();
  const releasedAt = utcNow();
  let released = 0;
  for (const reservation of store.reservations) {
    if (reservation.released_at != null) continue;
    if (!isExpired(reservation, nowMs)) continue;
    reservation.released_at = releasedAt;
    released += 1;
  }
  if (released > 0) writeStore(root, store);
  return released;
}
