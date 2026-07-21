// lock.mjs — withStoreLock(root, name, fn): a tiny cross-process mutual-
// exclusion primitive for bee's own store mutators (CONTEXT.md D2).
//
// Guards a single named critical section under .bee/locks/<name>.lock via an
// O_EXCL ('wx') lockfile: reservation/state logical read-check-write verbs
// run their body inside withStoreLock so two concurrent CLI invocations can
// no longer both pass a conflict check against the same snapshot and have
// the later write silently clobber the earlier one.
//
// hardening-1-7-10 (D2, amended by advisor consult): a live holder may
// LEGITIMATELY hold this lock across a long child spawn — e.g.
// worktree-store.mjs's mergeFeatureWorktree runs the host project's verify
// via a synchronous spawnSync WHILE holding 'worktree-admin', and that verify
// can genuinely run for minutes. Because spawnSync blocks the event loop for
// its own duration, a timer-based heartbeat cannot fire during exactly the
// long holds this needs to protect (locked: no heartbeat — see
// tryStaleTakeover below). So takeover is no longer age-alone: the 30s
// STALE_MS window only ever applies to a CRASHED holder (mtime stale AND the
// recorded owner pid is provably dead per `isPidAlive`). A pid that is
// provably alive is never stolen below the HARD_STALE_MS absolute ceiling —
// past that ceiling (or when liveness is unknowable), takeover proceeds
// regardless, as a pid-reuse guard of last resort.
//
// This module ships the primitive only — msh-1 wires no caller. msh-3/msh-5
// wrap reservations.mjs and state.mjs's logical-RMW verbs in it.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ensureDir } from './fsutil.mjs';

const RETRY_DELAY_MS = 50;
const MAX_ATTEMPTS = 100; // ~5s worst-case wait before a typed LOCK_BUSY refusal
const STALE_MS = 30_000; // crashed-holder window: only a candidate once BOTH stale-aged AND pid-dead
// Absolute ceiling: past this age, takeover proceeds regardless of the pid probe result — a
// pid-reuse/unknowable-liveness guard of last resort, set far above any real verify duration.
const HARD_STALE_MS = 3_600_000; // 1h

/** Typed refusal thrown by withStoreLock on timeout — never a silent fall-through. */
export class LockBusyError extends Error {
  constructor(name, holder) {
    const who =
      holder && typeof holder === 'object'
        ? `pid=${holder.pid ?? 'unknown'} session=${holder.session ?? 'unknown'} since ${holder.ts ?? 'unknown'}`
        : 'unknown holder';
    super(`lock "${name}" busy: held by ${who}`);
    this.name = 'LockBusyError';
    this.type = 'refused';
    this.reason = 'LOCK_BUSY';
    this.lockName = name;
    this.holder = holder ?? null;
  }
}

export function locksDir(root) {
  return path.join(root, '.bee', 'locks');
}

// hardening-4a: mirrors claims.mjs's resolveSessionId env-only chain
// (BEE_SESSION_ID wins over the legacy CLAUDE_CODE_SESSION_ID) WITHOUT
// importing claims.mjs — lock.mjs stays a dependency-light leaf module
// (claims.mjs itself imports withStoreLock from here, so importing back
// would cycle). claims.mjs's resolveSessionId is the CANONICAL
// implementation; this is a deliberate small duplicate for the lock-holder
// label only (never used to authorize anything) — keep the two in sync by
// hand if the chain ever changes.
function envSessionId(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

// Windows-invalid filename characters (< > : " / \ | ? *) plus control chars.
// eslint-disable-next-line no-control-regex
const UNSAFE_LOCK_NAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;

/**
 * Maps a logical lock name (e.g. "cells:some-id") to a filesystem-safe
 * basename. Runtime lock names contain ':' (cells.mjs's `cells:${id}`),
 * which Windows rejects in filenames — plain substitution alone risks two
 * DISTINCT logical names colliding after sanitization (e.g. "cells:a" and
 * "cells/a" both -> "cells_a"), so a short deterministic hash of the
 * ORIGINAL name is always appended: same logical name -> same file (pure
 * function, safe across processes), distinct logical names -> distinct
 * files, guaranteed rather than merely likely.
 */
function sanitizeLockName(name) {
  const raw = String(name);
  const sanitized = raw.replace(UNSAFE_LOCK_NAME_CHARS, '_');
  const hash = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 8);
  return `${sanitized}-${hash}`;
}

export function lockFilePath(root, name) {
  return path.join(locksDir(root), `${sanitizeLockName(name)}.lock`);
}

function readHolder(lockPath) {
  try {
    return JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  } catch {
    return null; // gone, unreadable, or mid-write elsewhere — treat as "no info", never throw
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * isPidAlive(pid) — synchronous liveness probe via the null-signal trick
 * (`process.kill(pid, 0)` never actually signals anything; it only reports
 * whether the kernel would let this process signal that pid). Same-host by
 * construction (locks live under the per-checkout `.bee/locks/`), so a pid
 * probe is meaningful here.
 *
 *   - missing/unparsable pid (not a positive integer)         -> dead
 *   - process.kill(pid, 0) succeeds (pid exists, ours or not)  -> alive
 *   - ESRCH (no such process)                                  -> dead
 *   - EPERM (pid exists, we just can't signal it)              -> alive
 *   - any other errno                                          -> alive
 *     (liveness genuinely unknowable; treated conservatively as alive so a
 *     live holder is never falsely stolen below HARD_STALE_MS — the ceiling
 *     is exactly the guard for this "unknowable" case)
 */
export function isPidAlive(pid) {
  const n = Number(pid);
  if (!Number.isInteger(n) || n <= 0) return false;
  try {
    process.kill(n, 0);
    return true;
  } catch (error) {
    if (error && error.code === 'ESRCH') return false;
    return true;
  }
}

function tryAcquire(lockPath, body) {
  try {
    fs.writeFileSync(lockPath, `${JSON.stringify(body)}\n`, { encoding: 'utf8', flag: 'wx' });
    return true;
  } catch (error) {
    if (error && error.code === 'EEXIST') return false;
    throw error;
  }
}

// Attempt exactly one stale takeover of lockPath by ATOMIC RENAME. Returns
// true only when THIS call performed the rename (sole winner; the corpse is
// now at a pid-unique stale path and gets unlinked here) — never an
// unconditional unlink, which lets a waiter delete a fresh holder's lock out
// from under it (spike negative control: naive unlink reproduced 7-8
// simultaneous "winners"). Two racers renaming the same source path is still
// safe even though each targets a different pid-unique destination: rename()
// consumes its source, so the loser's rename sees the source already gone
// and fails ENOENT — that is a normal loss, not an error, so it just backs
// off into the retry loop.
//
// hardening-1-7-10 (D2): mtime age alone is no longer sufficient. A lock
// past STALE_MS is only a takeover CANDIDATE — it becomes eligible only when
// the recorded owner pid is NOT alive (crashed-holder case), UNLESS the age
// has also passed the HARD_STALE_MS absolute ceiling, in which case takeover
// proceeds regardless of liveness (pid-reuse / unknowable-liveness guard of
// last resort). A pid that is provably alive is therefore never stolen
// below HARD_STALE_MS, no matter how long a legitimate holder blocks the
// event loop inside a child spawn.
function tryStaleTakeover(lockPath, nowMs) {
  let stat;
  try {
    stat = fs.statSync(lockPath);
  } catch {
    return false; // lock vanished between our EEXIST and this stat — normal retry
  }
  const ageMs = nowMs - stat.mtimeMs;
  if (ageMs <= STALE_MS) return false;
  if (ageMs <= HARD_STALE_MS) {
    const holder = readHolder(lockPath);
    const pid = holder && typeof holder === 'object' ? holder.pid : undefined;
    if (isPidAlive(pid)) return false; // live holder — legitimately long-running, never stolen
  }
  const stalePath = `${lockPath}.stale-${process.pid}-${nowMs}`;
  try {
    fs.renameSync(lockPath, stalePath);
  } catch (error) {
    if (error && error.code === 'ENOENT') return false; // another racer already renamed it away
    throw error;
  }
  fs.rmSync(stalePath, { force: true });
  return true;
}

/**
 * withStoreLock(root, name, fn, options) — run fn() with .bee/locks/<name>.lock
 * held exclusively across processes. fn's return value/throw propagates
 * unchanged. Always releases in `finally`, and release only ever removes a
 * lock THIS acquisition created (matched by pid + a per-call token) — never
 * someone else's, including one that took over after this call's own lock
 * somehow went stale (should never happen for a millisecond-scale section,
 * but the token match makes it structurally impossible to unlink the wrong
 * lock either way).
 *
 * Session id is self-derived (BEE_SESSION_ID, falling back to the legacy
 * CLAUDE_CODE_SESSION_ID), never a parameter — matching D3's "never handed
 * down" posture even though full session-id resolution (explicit flag ->
 * env -> hook payload) is msh-2's helper (claims.mjs resolveSessionId).
 *
 * options.maxAttempts (default MAX_ATTEMPTS, ~100) lets a caller opt into a
 * SINGLE attempt (msh-5, D5 Δ3-amended: "hooks never WAIT on the lock" —
 * every store write on the hook-driven heartbeat/lease-renewal touch path
 * passes {maxAttempts: 1} here instead of the CLI's normal ~5s retry
 * budget). The retry/backoff SHAPE is otherwise byte-identical to before —
 * a caller that omits options gets exactly the original ~100-try, ~5s-worst-
 * case wait. The one deliberate behavior tweak (bug fix, not a race risk):
 * the inter-attempt sleep only runs when another attempt will follow, so the
 * final failing attempt no longer wastes one extra RETRY_DELAY_MS before
 * throwing — shaving ~50ms off the existing timeout path, never adding any.
 *
 * Timeout after ~maxAttempts * retryDelayMs throws LockBusyError naming the
 * current holder parsed from the lock body — never a fall-through unlocked
 * write.
 */
/**
 * acquireStoreLockOnceSync(root, name) — the SYNCHRONOUS, single-attempt
 * sibling of withStoreLock, for callers that must stay sync end-to-end
 * (hardening-1-7-10 D4: writeCell — the single cell-write funnel called
 * synchronously from addCells' `.map()` at cells.mjs — cannot become async
 * without cascading `await` through every caller up to that call site).
 *
 * Applies the SAME stale-takeover rule as withStoreLock's retry loop
 * (tryStaleTakeover: mtime > STALE_MS AND owner pid dead, or past the
 * HARD_STALE_MS absolute ceiling regardless of liveness) but with NO retry
 * loop and NO sleep: exactly one acquire attempt, and — only if that first
 * attempt found the lock stale-eligible and won the takeover race — exactly
 * one follow-up acquire attempt. Anything else (a live holder, or losing the
 * takeover race to another racer) is reported back as `{ acquired: false }`
 * rather than waited out; the caller decides how to surface that (cells.mjs
 * throws a typed CELLS_ARCHIVE_BUSY).
 *
 * Returns `{ acquired: true, release }` on success. `release()` is
 * idempotent and safe to call from a `finally`; it removes the lock file
 * only if it still matches THIS acquisition's pid + token (same anti-
 * clobber discipline as withStoreLock's own finally block below — a caller
 * can never unlink a lock some other holder has since taken over).
 * Returns `{ acquired: false, holder }` on contention, `holder` being
 * whatever readHolder could parse from the lock file (possibly null).
 */
export function acquireStoreLockOnceSync(root, name) {
  ensureDir(locksDir(root));
  const lockPath = lockFilePath(root, name);
  const token = crypto.randomBytes(8).toString('hex');
  const session = envSessionId(process.env.BEE_SESSION_ID, process.env.CLAUDE_CODE_SESSION_ID);
  const nowMs = Date.now();
  const body = { pid: process.pid, session, ts: new Date(nowMs).toISOString(), token };

  let acquired = tryAcquire(lockPath, body);
  if (!acquired && tryStaleTakeover(lockPath, nowMs)) {
    acquired = tryAcquire(lockPath, { ...body, ts: new Date(Date.now()).toISOString() });
  }
  if (!acquired) {
    return { acquired: false, holder: readHolder(lockPath) };
  }
  let released = false;
  return {
    acquired: true,
    release: () => {
      if (released) return;
      released = true;
      const holder = readHolder(lockPath);
      if (holder && holder.token === token && holder.pid === process.pid) {
        fs.rmSync(lockPath, { force: true });
      }
    },
  };
}

export async function withStoreLock(root, name, fn, { maxAttempts = MAX_ATTEMPTS, retryDelayMs = RETRY_DELAY_MS } = {}) {
  ensureDir(locksDir(root));
  const lockPath = lockFilePath(root, name);
  const token = crypto.randomBytes(8).toString('hex');
  const session = envSessionId(process.env.BEE_SESSION_ID, process.env.CLAUDE_CODE_SESSION_ID);
  let acquired = false;

  for (let attempt = 0; attempt < maxAttempts && !acquired; attempt++) {
    const nowMs = Date.now();
    const body = { pid: process.pid, session, ts: new Date(nowMs).toISOString(), token };
    if (tryAcquire(lockPath, body)) {
      acquired = true;
      break;
    }
    // Staleness is re-verified at THIS retry, on the real filesystem mtime —
    // never cached from an earlier check.
    if (tryStaleTakeover(lockPath, nowMs)) {
      // We just freed the slot ourselves; race for it immediately rather
      // than waiting a full retry interval behind everyone else.
      if (tryAcquire(lockPath, { ...body, ts: new Date(Date.now()).toISOString() })) {
        acquired = true;
        break;
      }
    }
    if (attempt + 1 < maxAttempts) {
      await sleep(retryDelayMs);
    }
  }

  if (!acquired) {
    throw new LockBusyError(name, readHolder(lockPath));
  }

  try {
    return await fn();
  } finally {
    const holder = readHolder(lockPath);
    if (holder && holder.token === token && holder.pid === process.pid) {
      fs.rmSync(lockPath, { force: true });
    }
  }
}
