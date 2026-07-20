// worktree-holds.mjs — shared cross-worktree holds ledger (xwh-1, additive,
// UNWIRED: nothing in production imports this module yet). Mirrors a
// path-level hold from any checkout (the ordinary checkout, holder 'main',
// or a granted linked worktree, holder = its git-verified worktree id) into
// ONE shared ledger so a different checkout can discover a foreign hold on a
// path it is about to write to, before same-checkout reservation/state
// guards ever see it.
//
// Store: <mainRoot>/.bee/runtime/cross-worktree-holds.json — ALWAYS the
// MAIN checkout's store, never a worktree's own `.bee/` (same asymmetry
// worktree-store.mjs's readGrants/writeGrant rely on for their own security
// property: a worktree cannot self-claim anything by writing to its own
// store, because nothing here ever reads a worktree's own `.bee/runtime/`).
// Atomic tmp+rename writes, same shape as worktree-store.mjs's
// writeGrantsFileAtomic. Every mutation runs inside
// withStoreLock(mainRoot, 'cross-worktree-holds') (lock.mjs) so two
// concurrent mirrorHold/releaseHolds/sweepExpiredHolds calls — from two
// separate OS processes, e.g. two different worktree checkouts — can never
// both read the same pre-mutation snapshot and have the later write silently
// drop the earlier one (same D2 lost-update fix reservations.mjs's
// reserve()/release()/sweepExpired() already apply to .bee/reservations.json).
//
// TTL-only expiry (reservations.mjs's sweepExpired precedent) — there is no
// heartbeat/renewal primitive here. Expired entries are pruned ON READ (never
// returned by findForeignHolds), and separately reconciled to disk (marked
// released) only by the explicit sweepExpiredHolds() call — the exact same
// two-tier shape (`isActive` read-time filter vs. `sweepExpired` disk write)
// reservations.mjs already uses.
//
// pathsOverlap is REUSED, not reimplemented: imported directly from
// reservations.mjs, which is the established sharing style already used by
// schedule.mjs, state.mjs, and cells.mjs (all import { pathsOverlap } from
// './reservations.mjs' rather than duplicating the predicate) — see each
// module's own header comment. reservations.mjs imports only fsutil.mjs +
// lock.mjs + claims.mjs, so importing it here creates no cycle.
//
// This module is NOT wired into any production caller in this cell — no
// bee.mjs, guards.mjs, cells.mjs, or worktree-store.mjs change accompanies
// it. It ships the primitive only, proven by its own unit + race tests.

import fs from 'node:fs';
import path from 'node:path';
import { readJson, writeJsonAtomic } from './fsutil.mjs';
import { withStoreLock } from './lock.mjs';
import { pathsOverlap } from './reservations.mjs';

const DEFAULT_TTL_SECONDS = 3600;

function utcNow() {
  return new Date().toISOString();
}

function holdsLedgerPath(mainRoot) {
  return path.join(mainRoot, '.bee', 'runtime', 'cross-worktree-holds.json');
}

/** Missing file reads as an empty ledger (fail-open read, same posture as
 * worktree-store.mjs's readGrants and reservations.mjs's readStore) — never
 * throws for an absent/malformed store; readJson already warns to stderr and
 * falls back on malformed JSON. */
function readStore(mainRoot) {
  const store = readJson(holdsLedgerPath(mainRoot), null);
  if (!store || typeof store !== 'object' || !Array.isArray(store.holds)) {
    return { holds: [] };
  }
  return store;
}

/** Atomic tmp+rename write, imitating worktree-store.mjs's
 * writeGrantsFileAtomic (the grants-registry writer this module's ledger is
 * modeled on) rather than re-deriving a third atomic-write shape. */
function writeStore(mainRoot, store) {
  writeJsonAtomic(holdsLedgerPath(mainRoot), store);
}

function normalizePath(value) {
  return String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/\/+$/, '');
}

function isExpired(entry, nowMs) {
  const ttl = entry.ttl_seconds;
  if (!Number.isFinite(ttl) || ttl <= 0) return false;
  const mirroredMs = Date.parse(entry.mirrored_at);
  if (!Number.isFinite(mirroredMs)) return false;
  return mirroredMs + ttl * 1000 <= nowMs;
}

function isActive(entry, nowMs = Date.now()) {
  return entry.released_at == null && !isExpired(entry, nowMs);
}

/**
 * Mirrors ONE path-level hold into the shared ledger under
 * withStoreLock(mainRoot, 'cross-worktree-holds'). `holder` is the granted
 * worktree id, or the literal string 'main' for the ordinary checkout —
 * required, like `path`. `feature`/`session`/`cell` are optional context
 * carried through for later callers (e.g. a deny message naming which
 * feature/cell holds a foreign path); `ttl` defaults to
 * DEFAULT_TTL_SECONDS, same default reservations.mjs's reserve() uses.
 *
 * Always appends a new entry (never upserts) — the same posture
 * reservations.mjs's reserve() takes: repeated calls from the same holder on
 * the same path simply accumulate rows, and isActive()/findForeignHolds()
 * read-time-filter which of them still matter. No conflict check runs here;
 * this module only records visibility, it does not itself decide allow/deny.
 */
export async function mirrorHold(mainRoot, { path: holdPath, holder, feature = null, session = null, cell = null, ttl = DEFAULT_TTL_SECONDS } = {}) {
  if (typeof holdPath !== 'string' || !holdPath.trim()) {
    throw new Error('mirrorHold: path is required.');
  }
  if (typeof holder !== 'string' || !holder.trim()) {
    throw new Error('mirrorHold: holder is required.');
  }
  return withStoreLock(mainRoot, 'cross-worktree-holds', () => {
    const store = readStore(mainRoot);
    const hold = {
      path: normalizePath(holdPath),
      holder: holder.trim(),
      feature: typeof feature === 'string' && feature.trim() ? feature.trim() : null,
      session: typeof session === 'string' && session.trim() ? session.trim() : null,
      cell: typeof cell === 'string' && cell.trim() ? cell.trim() : null,
      ttl_seconds: Number.isFinite(ttl) && ttl > 0 ? Math.floor(ttl) : DEFAULT_TTL_SECONDS,
      mirrored_at: utcNow(),
      released_at: null,
    };
    store.holds.push(hold);
    writeStore(mainRoot, store);
    return { ok: true, hold };
  });
}

/**
 * Active (unreleased, unexpired) holds owned by a DIFFERENT holder that
 * overlap any of `paths` (pathsOverlap semantics reused from
 * reservations.mjs — exact match, directory prefix, or trivial `*` glob).
 * Pure read: no lock, mirrors reservations.mjs's findConflicts/
 * findSessionConflicts (also unlocked reads run outside withStoreLock).
 * `paths` accepts a single path string or an array.
 */
export function findForeignHolds(mainRoot, holder, paths) {
  const requested = (Array.isArray(paths) ? paths : [paths]).filter(Boolean);
  if (requested.length === 0) return [];
  const acting = typeof holder === 'string' ? holder.trim() : '';
  const nowMs = Date.now();
  const store = readStore(mainRoot);
  return store.holds.filter(
    (hold) =>
      isActive(hold, nowMs) &&
      hold.holder !== acting &&
      requested.some((requestedPath) => pathsOverlap(hold.path, requestedPath)),
  );
}

/**
 * Releases every unreleased hold owned by `holder`, optionally narrowed by
 * `session` and/or `cell` (both `null` by default — a null filter matches
 * any value, same "absent filter = no filter" posture as
 * reservations.mjs's release({agent, cell=null})). Runs under
 * withStoreLock(mainRoot, 'cross-worktree-holds'). Returns
 * `{ released: <count> }`; the store is only rewritten when at least one row
 * changed.
 */
export async function releaseHolds(mainRoot, { holder, session = null, cell = null } = {}) {
  if (typeof holder !== 'string' || !holder.trim()) {
    throw new Error('releaseHolds: holder is required.');
  }
  const actingHolder = holder.trim();
  return withStoreLock(mainRoot, 'cross-worktree-holds', () => {
    const store = readStore(mainRoot);
    const releasedAt = utcNow();
    let released = 0;
    for (const hold of store.holds) {
      if (hold.released_at != null) continue;
      if (hold.holder !== actingHolder) continue;
      if (session != null && hold.session !== session) continue;
      if (cell != null && hold.cell !== cell) continue;
      hold.released_at = releasedAt;
      released += 1;
    }
    if (released > 0) writeStore(mainRoot, store);
    return { released };
  });
}

/**
 * Releases EVERY unreleased hold for `id`, ignoring session/cell entirely —
 * the unconditional sibling of releaseHolds, for a holder going away
 * outright (e.g. a granted worktree being unregistered/removed) rather than
 * one narrowed release. Implemented as a thin delegate to releaseHolds with
 * no session/cell filter, not a second store-mutation body.
 */
export async function releaseAllForHolder(mainRoot, id) {
  const { released } = await releaseHolds(mainRoot, { holder: id });
  return { released };
}

/**
 * Marks every TTL-expired, still-unreleased hold as released (sets
 * `released_at`) — the disk-persisting sibling of the read-time `isActive`
 * filter every query function above already applies. Mirrors
 * reservations.mjs's sweepExpired exactly: same lock, same "only write when
 * something actually changed" guard. Returns the count of holds released.
 */
export async function sweepExpiredHolds(mainRoot) {
  return withStoreLock(mainRoot, 'cross-worktree-holds', () => {
    const store = readStore(mainRoot);
    const nowMs = Date.now();
    const releasedAt = utcNow();
    let released = 0;
    for (const hold of store.holds) {
      if (hold.released_at != null) continue;
      if (!isExpired(hold, nowMs)) continue;
      hold.released_at = releasedAt;
      released += 1;
    }
    if (released > 0) writeStore(mainRoot, store);
    return released;
  });
}

/**
 * True when the ledger file exists but is unreadable/malformed JSON — false
 * for a missing file (today's open/empty-ledger behavior, never "corrupt")
 * and false once it parses cleanly. Mirrors guards.mjs's private
 * reservationStoreCorrupt (guards.mjs:108-117) byte-for-byte in shape, as a
 * PUBLIC export here for later callers (a hold-aware write guard) that need
 * to fail closed on a torn/corrupt cross-worktree ledger rather than
 * silently treating it as empty. Never locked (mirrors the same read-only,
 * unlocked posture as reservationStoreCorrupt and findForeignHolds above).
 */
export function holdsStoreCorrupt(mainRoot) {
  const file = holdsLedgerPath(mainRoot);
  if (!fs.existsSync(file)) return false; // missing store = today's open behavior
  try {
    JSON.parse(fs.readFileSync(file, 'utf8'));
    return false;
  } catch {
    return true;
  }
}
