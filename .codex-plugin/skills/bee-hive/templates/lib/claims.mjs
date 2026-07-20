// claims.mjs — cross-session session identity + atomic per-cell claims.
// Stores (all repo-relative under .bee/ — never system temp, pattern 20260708):
//   .bee/sessions/<session-id>.json  { id, started_at, last_heartbeat, lane? }
//                                    (lane is OPTIONAL and OMITTED while
//                                     unbound — see bindSessionLane below)
//   .bee/claims/<cell-id>.json       { cell, session?, ttl_seconds, claimed_at,
//                                      adopted_from?, adopted_at? }
//                                    (session is OMITTED, never null, for a
//                                     sessionless single-user claim — D1 Δ2)
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
import { withStoreLock, LockBusyError } from './lock.mjs';
// Deliberately NOT importing reservations.mjs here (state.mjs:7-9 pins
// claims.mjs and reservations.mjs as cycle-free leaf modules — reservations.mjs
// already imports resolveSessionId from THIS file). heartbeatTouch below
// therefore renews only the session heartbeat + this session's claim files;
// its hold-renewal companion (renewHoldsBySession, reservations.mjs) is
// called by the HOOK callers alongside it (hooks/bee-prompt-context.mjs,
// hooks/bee-state-sync.mjs), composed at the call site the same way state.mjs
// composes both leaf modules without either importing the other.

export const DEFAULT_CLAIM_TTL_SECONDS = 3600;
export const DEFAULT_HEARTBEAT_STALE_SECONDS = 900;
// D5 — the hook-driven touch throttle: heartbeatTouch no-ops unless the
// stored heartbeat is older than this, so a burst of hook events (many
// prompts/tool calls in one turn) costs at most one refresh per window.
// Deliberately far below DEFAULT_HEARTBEAT_STALE_SECONDS (900) — the whole
// point is that stale-detection now has a real, frequently-running refresh
// behind it; the 900s threshold itself is unchanged (prohibition, msh-5).
export const HEARTBEAT_TOUCH_THROTTLE_SECONDS = 60;

function utcNow(nowMs) {
  return new Date(nowMs).toISOString();
}

/**
 * D3 — session id is resolved at mutation time, never handed down: explicit
 * flag (highest, for tests/CLI callers) -> CLAUDE_CODE_SESSION_ID env ->
 * absent (null). A blank/whitespace-only flag or env value is treated as
 * absent, same as omitting it. Callers that require a session (claim-next)
 * still enforce non-null themselves; this helper only resolves, it never
 * refuses.
 */
export function resolveSessionId({ flag } = {}) {
  if (typeof flag === 'string' && flag.trim()) return flag.trim();
  const env = process.env.CLAUDE_CODE_SESSION_ID;
  if (typeof env === 'string' && env.trim()) return env.trim();
  return null;
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

/**
 * List every readable session record under .bee/sessions/ (GH#20: the reader
 * cells.mjs's claim-next fallback pool needs to detect a lane's live owner).
 * Fail-open, matching readSession/heartbeatStale's posture: a missing
 * .bee/sessions/ directory is zero records, never an error, and an
 * unreadable/corrupt entry is silently skipped rather than surfaced — a
 * broken session record counts as absent, not as a reason to stop.
 */
export function listSessionRecords(root) {
  let entries;
  try {
    entries = fs.readdirSync(sessionsDir(root));
  } catch {
    return [];
  }
  const sessions = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    const record = readSession(root, entry.slice(0, -'.json'.length));
    if (record) sessions.push(record);
  }
  return sessions;
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

// Exported for cells.mjs's D4 ownership guard (msh-4): reused verbatim so the
// mutator refusal names owner + expiry in the exact same words claimCellFile
// itself uses below — composing an existing reader, never a new one.
export function claimExpiry(claim) {
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
 *
 * D1 (Δ2-amended): sessionId's requirement is deliberately relaxed — null or
 * undefined is a legal SESSIONLESS claim (single-user use with no
 * CLAUDE_CODE_SESSION_ID and no explicit --session-id): the claim file still
 * gets created (the O_EXCL race-serialization still applies), it simply omits
 * the `session` key entirely rather than writing a placeholder value. A
 * non-null sessionId is still validated the same as before (a plain id, no
 * path separators).
 */
export function claimCellFile(root, sessionId, cellId, ttl = DEFAULT_CLAIM_TTL_SECONDS, { now = Date.now() } = {}) {
  const session = sessionId == null ? null : requireId(sessionId, 'session id');
  const cell = requireId(cellId, 'cell id');
  ensureDir(claimsDir(root));
  const claim = {
    cell,
    ...(session ? { session } : {}),
    ttl_seconds: Number.isFinite(ttl) && ttl > 0 ? Math.floor(ttl) : DEFAULT_CLAIM_TTL_SECONDS,
    claimed_at: utcNow(now),
    // GH #27.1 (D-GHF-B): stamped ONCE here, at claim creation — the
    // immutable acquisition identity. claimed_at is the mutable expiry
    // clock (renewClaimTTL legitimately rewrites it on every heartbeat);
    // acquired_at never changes for the life of this claim file, so
    // checkCellBudgets can key off it and stay heartbeat-invariant.
    acquired_at: utcNow(now),
  };
  try {
    fs.writeFileSync(claimPath(root, cell), `${JSON.stringify(claim, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
  } catch (error) {
    if (error && error.code === 'EEXIST') {
      const holder = readClaim(root, cell);
      const owner = holder?.session ?? 'no session (sessionless claim)';
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

/**
 * Same-session-only TTL renewal (D5): refreshes `claimed_at` — the expiry
 * clock — for every claim file currently owned by sessionId, WITHOUT ever
 * calling adoptClaim and without touching adopted_from/adopted_at. Guarded
 * by the same exclusive per-claim gate as adopt/sweep/release (acquireGate/
 * releaseGate above): a claim whose gate is held by another in-flight
 * adopt/sweep is SKIPPED, never waited on — acquireGate is already a single
 * non-retrying 'wx' attempt, so this can never block. The session match is
 * RE-VERIFIED under the gate (never off the pre-gate listing snapshot), so a
 * claim adopted away between listing and gating is left untouched — a
 * renewal racing an adoption can never revert ownership.
 */
export function renewClaimTTL(root, sessionId, { now = Date.now() } = {}) {
  const session = requireId(sessionId, 'session id');
  let entries;
  try {
    entries = fs.readdirSync(claimsDir(root));
  } catch {
    return { ok: true, renewed: [], skipped: [] };
  }
  const renewed = [];
  const skipped = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    const cell = entry.slice(0, -'.json'.length);
    const preview = readClaim(root, cell);
    if (!preview || preview.session !== session) continue; // not ours (or sessionless): never touched
    if (!acquireGate(root, cell, now)) {
      skipped.push(cell);
      continue;
    }
    try {
      const claim = readClaim(root, cell); // re-verify ownership under the gate
      if (claim && claim.session === session) {
        // GH #27.1 (D-GHF-B): the `...claim` spread carries acquired_at
        // forward untouched — only claimed_at (the expiry clock) advances
        // on a heartbeat. Never add an explicit acquired_at key here.
        writeJsonAtomic(claimPath(root, cell), { ...claim, claimed_at: utcNow(now) });
        renewed.push(cell);
      }
    } finally {
      releaseGate(root, cell);
    }
  }
  return { ok: true, renewed, skipped };
}

/**
 * Owner-only removal, under the same exclusive gate as adopt/sweep. D1
 * (Δ2-amended): sessionId is nullable — null/undefined means "release the
 * sessionless claim", and matches only a claim record that itself carries no
 * `session` key (claim.session ?? null === null).
 */
export function releaseClaim(root, sessionId, cellId) {
  const session = sessionId == null ? null : requireId(sessionId, 'session id');
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
    const owner = claim.session ?? null;
    if (owner !== session) {
      return fail(
        'NOT_OWNER',
        `cell "${cell}" is owned by session "${owner ?? 'none (sessionless)'}", not "${session ?? 'none (sessionless)'}".`,
      );
    }
    fs.rmSync(claimPath(root, cell), { force: true });
    return { ok: true, released: claim };
  } finally {
    releaseGate(root, cell);
  }
}

/**
 * Unconditional claim-file removal for cell-mutator claim-clearing
 * transitions (cap/unclaim/block/drop/reopen — D1 Δ2-amendment): these verbs
 * already own the cell's lifecycle transition and, as of msh-2, do not yet
 * check claim ownership (that check is D4/msh-4's job) — so clearing here is
 * by cell id alone, regardless of which session (if any) holds the claim.
 * Without this, a same-session block -> reopen -> claim round-trip would
 * self-refuse CLAIMED for the claim's full TTL, since nothing ever removed
 * the file the first claim created. No-ops (ok:true, released:null) when
 * there is no claim file — most cells claimed before this change, or cells
 * never claimed at all, have none. Gated the same as adopt/sweep/release so
 * it can never race a concurrent adopt/sweep.
 */
export function clearClaim(root, cellId) {
  const cell = requireId(cellId, 'cell id');
  if (!readClaim(root, cell)) {
    return { ok: true, released: null };
  }
  if (!acquireGate(root, cell, Date.now())) {
    return fail('GATE_HELD', `claim "${cell}" is gated by another in-flight adopt/sweep — retry later, never wait on the gate.`);
  }
  try {
    const claim = readClaim(root, cell); // re-read under the gate
    if (!claim) {
      return { ok: true, released: null };
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

// ─── heartbeat + lease renewal touch (D5) ───────────────────────────────────

/**
 * D5 — throttled heartbeat + claim-lease renewal ridden by
 * bee-prompt-context.mjs (UserPromptSubmit) and bee-state-sync.mjs
 * (PostToolUse/Stop): a byte-identical no-op unless the session's STORED
 * heartbeat is older than HEARTBEAT_TOUCH_THROTTLE_SECONDS — at most one
 * refresh per session per throttle window, regardless of how many hook
 * events fire in between. When it does refresh: the session's own heartbeat
 * record, then every live claim file this session owns (renewClaimTTL,
 * same-session-only, gated by the existing per-claim .adopting exclusive
 * gate — never adoptClaim). Hold renewal (reservations.mjs's
 * renewHoldsBySession) is deliberately NOT called from here — claims.mjs
 * stays cycle-free w.r.t. reservations.mjs (see the top-of-file import
 * note); hook callers compose it alongside this call using the `touched`
 * flag this returns, exactly the way state.mjs composes both leaf modules
 * without either importing the other.
 *
 * Δ3-amended: hooks never WAIT on a store lock, so the session-heartbeat
 * write below runs try-once (maxAttempts: 1) — a LOCK_BUSY collision with a
 * concurrent CLI writer is skipped silently (returned in the result, never
 * thrown); claim renewal is already non-waiting via the per-claim gate, so
 * it needs no separate lock mode. A non-lock error still throws (fail-open
 * is the HOOK's job — see bee-prompt-context.mjs / bee-state-sync.mjs — not
 * something this function fakes by swallowing every error itself).
 *
 * Δ6 documented non-goal: this renews blanket for the session regardless of
 * whether it is doing anything bee-relevant right now (a session idling in
 * unrelated chat still renews) — D4's audited force-ownership door and
 * release-on-terminal-transition are the rescue, not a narrower rule here.
 */
export async function heartbeatTouch(root, sessionId, { now = Date.now() } = {}) {
  const session = typeof sessionId === 'string' ? sessionId.trim() : '';
  if (!session) {
    return { ok: true, touched: false, reason: 'no-session' };
  }

  const record = readSession(root, session);
  if (!heartbeatStale(record, now, HEARTBEAT_TOUCH_THROTTLE_SECONDS)) {
    return { ok: true, touched: false, reason: 'throttled' };
  }

  let heartbeat;
  try {
    heartbeat = await withStoreLock(root, 'sessions', () => heartbeatSession(root, session, { now }), {
      maxAttempts: 1,
    });
  } catch (error) {
    if (!(error instanceof LockBusyError)) throw error;
    heartbeat = { ok: false, code: 'LOCK_BUSY', reason: error.message };
  }
  const claims = renewClaimTTL(root, session, { now });

  return { ok: true, touched: true, heartbeat, claims };
}
