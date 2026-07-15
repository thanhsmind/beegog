// claims.mjs — cross-session session identity + atomic per-cell claims.
// Stores (all repo-relative under .bee/ — never system temp, pattern 20260708):
//   .bee/sessions/<session-id>.json  { id, started_at, last_heartbeat, lane? }
//                                    (lane is OPTIONAL and OMITTED while
//                                     unbound — see bindSessionLane below)
//   .bee/claims/<cell-id>.json       { cell, session, ttl_seconds, claimed_at,
//                                      adopted_from?, adopted_at? }
//   .bee/claims/<cell-id>.adopting   exclusive per-claim gate (adopt/sweep/release)
//
// Claim creation is exclusive-create ('wx' → O_EXCL): the probe-proven
// one-winner primitive (.bee/spikes/fresh-session-handoff/probe_atomic_claim.mjs,
// PASS 20x8 on linux AND win32). O_EXCL is not reliable on network filesystems,
// so project directories on network mounts (NFS and similar) are unsupported.
//
// Typed-failure contract (pinned, fresh-session-handoff validating repair):
// every mutating API returns { ok: true, ... } | { ok: false, code, reason }
// and never throws for contention. Codes: SESSION_EXISTS, SESSION_MISSING,
// CLAIMED, GATE_HELD, NOT_OWNER, NOT_FOUND. Bad arguments (empty/path-shaped
// ids) still throw, matching reservations.mjs.
//
// Ownership changes never delete-then-recreate the claim file: adoption and
// release run under the exclusive gate, and adoption rewrites the owner IN
// PLACE via atomic rename, so concurrent 'wx' claimers keep getting EEXIST
// throughout. Reclaim (sweepExpiredClaims) requires TTL expired AND heartbeat
// stale, re-verified under the gate — an expired TTL with a fresh heartbeat is
// never stolen (pattern 20260710).

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { readJson, writeJsonAtomic, ensureDir } from './fsutil.mjs';

export const DEFAULT_CLAIM_TTL_SECONDS = 3600;
export const DEFAULT_HEARTBEAT_STALE_SECONDS = 900;

function utcNow(nowMs) {
  return new Date(nowMs).toISOString();
}

function requireId(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} is required.`);
  }
  const id = value.trim();
  if (/[\\/]/.test(id) || id.includes('..')) {
    throw new Error(`${label} must be a plain id (no path separators).`);
  }
  return id;
}

function fail(code, reason, extra = {}) {
  return { ok: false, code, reason, ...extra };
}

export function sessionsDir(root) {
  return path.join(root, '.bee', 'sessions');
}

export function claimsDir(root) {
  return path.join(root, '.bee', 'claims');
}

export function sessionPath(root, sessionId) {
  return path.join(sessionsDir(root), `${requireId(sessionId, 'session id')}.json`);
}

export function claimPath(root, cellId) {
  return path.join(claimsDir(root), `${requireId(cellId, 'cell id')}.json`);
}

/** Exclusive per-claim gate file: <cellId>.adopting (adopt/sweep/release). */
export function claimGatePath(root, cellId) {
  return path.join(claimsDir(root), `${requireId(cellId, 'cell id')}.adopting`);
}

// ─── sessions ────────────────────────────────────────────────────────────────

export function createSession(root, { id = randomUUID(), now = Date.now() } = {}) {
  const sessionId = requireId(id, 'session id');
  ensureDir(sessionsDir(root));
  const session = {
    id: sessionId,
    started_at: utcNow(now),
    last_heartbeat: utcNow(now),
  };
  try {
    fs.writeFileSync(sessionPath(root, sessionId), `${JSON.stringify(session, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
  } catch (error) {
    if (error && error.code === 'EEXIST') {
      return fail('SESSION_EXISTS', `session "${sessionId}" already exists.`);
    }
    throw error;
  }
  return { ok: true, session };
}

export function readSession(root, sessionId) {
  let file;
  try {
    file = sessionPath(root, sessionId); // fail-open: a malformed id reads as "no session"
  } catch {
    return null;
  }
  const session = readJson(file, null);
  if (!session || typeof session !== 'object' || session.id !== String(sessionId).trim()) return null;
  return session;
}

export function heartbeatSession(root, sessionId, { now = Date.now() } = {}) {
  const session = readSession(root, sessionId);
  if (!session) {
    return fail('SESSION_MISSING', `session "${sessionId}" has no record to heartbeat.`);
  }
  session.last_heartbeat = utcNow(now);
  writeJsonAtomic(sessionPath(root, sessionId), session);
  return { ok: true, session };
}

/** A session is stale when its heartbeat is older than staleSeconds — or unreadable/missing. */
export function heartbeatStale(session, nowMs = Date.now(), staleSeconds = DEFAULT_HEARTBEAT_STALE_SECONDS) {
  if (!session || typeof session !== 'object') return true;
  const beatMs = Date.parse(session.last_heartbeat);
  if (!Number.isFinite(beatMs)) return true;
  return beatMs + staleSeconds * 1000 <= nowMs;
}

// ─── session→lane binding (fresh-session-handoff fsh-3) ─────────────────────
// The lane field is OPTIONAL and OMITTED while unbound: createSession never
// writes it, so pre-existing session-record consumers see exactly the shape
// they always did. Binding does NOT verify the lane record exists — claims.mjs
// stays lane-agnostic (the same decoupling as sessionId-as-parameter), and
// state.mjs resolvePipeline owns the typed LANE_MISSING/LANE_CORRUPT refusal.

export function bindSessionLane(root, sessionId, feature) {
  const session = requireId(sessionId, 'session id');
  const lane = requireId(feature, 'lane feature');
  const record = readSession(root, session);
  if (!record) {
    return fail('SESSION_MISSING', `session "${session}" has no record to bind to lane "${lane}".`);
  }
  const bound = { ...record, lane };
  writeJsonAtomic(sessionPath(root, session), bound);
  return { ok: true, session: bound };
}

/** Remove the binding by OMITTING the key (never lane:null), restoring the unbound shape. */
export function unbindSessionLane(root, sessionId) {
  const session = requireId(sessionId, 'session id');
  const record = readSession(root, session);
  if (!record) {
    return fail('SESSION_MISSING', `session "${session}" has no record to unbind.`);
  }
  const { lane: _lane, ...unbound } = record;
  writeJsonAtomic(sessionPath(root, session), unbound);
  return { ok: true, session: unbound };
}

// ─── claims ──────────────────────────────────────────────────────────────────

export function readClaim(root, cellId) {
  const claim = readJson(claimPath(root, cellId), null);
  if (!claim || typeof claim !== 'object') return null;
  return claim;
}

/** TTL semantics mirror reservations.mjs: non-positive/invalid TTL never expires. */
function isClaimExpired(claim, nowMs) {
  const ttl = claim.ttl_seconds;
  if (!Number.isFinite(ttl) || ttl <= 0) return false;
  const claimedMs = Date.parse(claim.claimed_at);
  if (!Number.isFinite(claimedMs)) return false;
  return claimedMs + ttl * 1000 <= nowMs;
}

export function isClaimActive(claim, nowMs = Date.now()) {
  if (!claim || typeof claim !== 'object') return false;
  return !isClaimExpired(claim, nowMs);
}

function claimExpiry(claim) {
  const claimedMs = Date.parse(claim?.claimed_at);
  const ttl = claim?.ttl_seconds;
  if (!Number.isFinite(claimedMs) || !Number.isFinite(ttl) || ttl <= 0) return 'no expiry';
  return `expires ${utcNow(claimedMs + ttl * 1000)}`;
}

function acquireGate(root, cellId, nowMs) {
  try {
    fs.writeFileSync(
      claimGatePath(root, cellId),
      `${JSON.stringify({ pid: process.pid, at: utcNow(nowMs) })}\n`,
      { encoding: 'utf8', flag: 'wx' },
    );
    return true;
  } catch (error) {
    if (error && error.code === 'EEXIST') return false;
    throw error;
  }
}

function releaseGate(root, cellId) {
  fs.rmSync(claimGatePath(root, cellId), { force: true });
}

/**
 * One winner per cell via exclusive create. Losing the race — including to a
 * TTL-expired claim, which only sweepExpiredClaims may reclaim — returns the
 * typed CLAIMED failure naming the holder and expiry.
 */
export function claimCellFile(root, sessionId, cellId, ttl = DEFAULT_CLAIM_TTL_SECONDS, { now = Date.now() } = {}) {
  const session = requireId(sessionId, 'session id');
  const cell = requireId(cellId, 'cell id');
  ensureDir(claimsDir(root));
  const claim = {
    cell,
    session,
    ttl_seconds: Number.isFinite(ttl) && ttl > 0 ? Math.floor(ttl) : DEFAULT_CLAIM_TTL_SECONDS,
    claimed_at: utcNow(now),
  };
  try {
    fs.writeFileSync(claimPath(root, cell), `${JSON.stringify(claim, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
  } catch (error) {
    if (error && error.code === 'EEXIST') {
      const holder = readClaim(root, cell);
      const owner = holder?.session ?? 'unknown session';
      return fail(
        'CLAIMED',
        `cell "${cell}" is already claimed by session "${owner}" (${claimExpiry(holder)}).`,
        { holder },
      );
    }
    throw error;
  }
  return { ok: true, claim };
}

/**
 * Transfer ownership IN PLACE under the exclusive gate: the claim file is
 * atomically rewritten, never deleted, so concurrent 'wx' claimers keep
 * getting EEXIST throughout the adoption. Never release-then-reclaim.
 */
export function adoptClaim(root, cellId, newSessionId, { now = Date.now() } = {}) {
  const cell = requireId(cellId, 'cell id');
  const session = requireId(newSessionId, 'session id');
  ensureDir(claimsDir(root));
  if (!acquireGate(root, cell, now)) {
    return fail('GATE_HELD', `claim "${cell}" is gated by another in-flight adopt/sweep — retry later, never wait on the gate.`);
  }
  try {
    const claim = readClaim(root, cell);
    if (!claim) {
      return fail('NOT_FOUND', `cell "${cell}" has no claim to adopt.`);
    }
    const previous = claim.session;
    const adopted = {
      ...claim,
      session,
      claimed_at: utcNow(now), // fresh ownership renews the TTL clock
      adopted_from: previous,
      adopted_at: utcNow(now),
    };
    writeJsonAtomic(claimPath(root, cell), adopted);
    return { ok: true, claim: adopted, previous_owner: previous };
  } finally {
    releaseGate(root, cell);
  }
}

/** Owner-only removal, under the same exclusive gate as adopt/sweep. */
export function releaseClaim(root, sessionId, cellId) {
  const session = requireId(sessionId, 'session id');
  const cell = requireId(cellId, 'cell id');
  if (!readClaim(root, cell)) {
    return fail('NOT_FOUND', `cell "${cell}" has no claim to release.`);
  }
  if (!acquireGate(root, cell, Date.now())) {
    return fail('GATE_HELD', `claim "${cell}" is gated by another in-flight adopt/sweep — retry later, never wait on the gate.`);
  }
  try {
    const claim = readClaim(root, cell); // re-read under the gate
    if (!claim) {
      return fail('NOT_FOUND', `cell "${cell}" has no claim to release.`);
    }
    if (claim.session !== session) {
      return fail('NOT_OWNER', `cell "${cell}" is owned by session "${claim.session}", not "${session}".`);
    }
    fs.rmSync(claimPath(root, cell), { force: true });
    return { ok: true, released: claim };
  } finally {
    releaseGate(root, cell);
  }
}

/**
 * Reclaim only what is provably abandoned: TTL expired AND owner heartbeat
 * stale (missing/corrupt session record counts as stale), both RE-VERIFIED
 * under the claim's exclusive gate (pattern 20260710 — never steal on a stall
 * signal alone). A held gate means another process is mid-adopt/sweep: skip,
 * never wait.
 */
export function sweepExpiredClaims(root, { now = Date.now(), staleSeconds = DEFAULT_HEARTBEAT_STALE_SECONDS } = {}) {
  const dir = claimsDir(root);
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return { ok: true, swept: [], skipped: [] };
  }
  const swept = [];
  const skipped = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    const cell = entry.slice(0, -'.json'.length);
    const preview = readClaim(root, cell);
    if (!preview) continue; // unreadable/corrupt: refuse to touch, never clobber
    if (!isClaimExpired(preview, now)) continue;
    if (!heartbeatStale(readSession(root, preview.session), now, staleSeconds)) continue;
    if (!acquireGate(root, cell, now)) {
      skipped.push(cell);
      continue;
    }
    try {
      const claim = readClaim(root, cell); // re-verify everything under the gate
      if (
        claim &&
        isClaimExpired(claim, now) &&
        heartbeatStale(readSession(root, claim.session), now, staleSeconds)
      ) {
        fs.rmSync(claimPath(root, cell), { force: true });
        swept.push(cell);
      }
    } finally {
      releaseGate(root, cell);
    }
  }
  return { ok: true, swept, skipped };
}
