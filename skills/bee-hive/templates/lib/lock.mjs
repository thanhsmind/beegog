// lock.mjs — withStoreLock(root, name, fn): a tiny cross-process mutual-
// exclusion primitive for bee's own store mutators (CONTEXT.md D2).
//
// Guards a single named critical section under .bee/locks/<name>.lock via an
// O_EXCL ('wx') lockfile: reservation/state logical read-check-write verbs
// run their body inside withStoreLock so two concurrent CLI invocations can
// no longer both pass a conflict check against the same snapshot and have
// the later write silently clobber the earlier one. Locked sections MUST
// stay pure JSON read-check-write, milliseconds-scale — never hold this
// lock across a child process spawn (~1000x margin under the 30s stale
// threshold below is there for crashed holders, not slow ones).
//
// This module ships the primitive only — msh-1 wires no caller. msh-3/msh-5
// wrap reservations.mjs and state.mjs's logical-RMW verbs in it.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ensureDir } from './fsutil.mjs';

const RETRY_DELAY_MS = 50;
const MAX_ATTEMPTS = 100; // ~5s worst-case wait before a typed LOCK_BUSY refusal
const STALE_MS = 30_000; // any lock older than this is presumed a crashed holder

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

export function lockFilePath(root, name) {
  return path.join(locksDir(root), `${name}.lock`);
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
function tryStaleTakeover(lockPath, nowMs) {
  let stat;
  try {
    stat = fs.statSync(lockPath);
  } catch {
    return false; // lock vanished between our EEXIST and this stat — normal retry
  }
  if (nowMs - stat.mtimeMs <= STALE_MS) return false;
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
 * Session id is self-derived (CLAUDE_CODE_SESSION_ID), never a parameter —
 * matching D3's "never handed down" posture even though full session-id
 * resolution (explicit flag -> env -> hook payload) is msh-2's helper.
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
export async function withStoreLock(root, name, fn, { maxAttempts = MAX_ATTEMPTS, retryDelayMs = RETRY_DELAY_MS } = {}) {
  ensureDir(locksDir(root));
  const lockPath = lockFilePath(root, name);
  const token = crypto.randomBytes(8).toString('hex');
  const session = process.env.CLAUDE_CODE_SESSION_ID || null;
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
