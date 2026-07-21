// decisions.mjs — event-sourced decisions in .bee/decisions.jsonl.
// Write-time secret & injection rejection; datamarked reads.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { appendJsonl, readJsonl, ensureDir } from './fsutil.mjs';
import { acquireStoreLockOnceSync } from './lock.mjs';

/** Content patterns that must never enter the decision log. */
export const SECRET_CONTENT_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bghp_[A-Za-z0-9]{20,}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/,
  /\b(?:api[_-]?key|secret|token|password|passwd)\s*[:=]\s*['"]?[^\s'"]{6,}/i,
];

/** Instruction-injection heuristics rejected at write time. */
export const INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous|prior|above|earlier)\s+(?:instructions|messages|context|prompts?)/i,
  /disregard\s+(?:all\s+)?(?:previous|prior|above|earlier)/i,
  /<\/?\s*(?:system|assistant|user|developer|tool)\b[^>]*>/i,
  /\[\s*(?:system|assistant|user|developer)\s*\]/i,
];

function decisionsPath(root) {
  return path.join(root, '.bee', 'decisions.jsonl');
}

// decision-propagation dp-3 (CONTEXT D4c): the archive sidecar. Same
// directory as the active store, never touched by any reader that doesn't
// explicitly opt into --all.
function decisionsArchivePath(root) {
  return path.join(root, '.bee', 'decisions-archive.jsonl');
}

// dp-3 CONCURRENCY (plan-checker BLOCKER — same class as cells.mjs's
// writeCell retrofit at cells.mjs:414-426): archiveDecisions prunes and
// rewrites the active store, so every writer that APPENDS to it
// (logDecision/supersedeDecision/redactDecision) must serialize against that
// rewrite under the SAME cross-process lock — a bare appendJsonl is only
// safe while nobody else is rewriting the file underneath it, and archive
// breaks that assumption. One unscoped lock name (not per-id, like
// cells.mjs's `cells:<id>` locks) because archive operates on the WHOLE
// store, not a single record.
export const DECISIONS_LOCK_NAME = 'decisions';

// Bounded synchronous retry on top of lock.mjs's single-attempt
// acquireStoreLockOnceSync — mirrors claims.mjs's acquireGateWithRetry
// (GATE_RETRY_ATTEMPTS/GATE_RETRY_DELAY_MS, ~300ms worst case) rather than
// cells.mjs's writeCell (which refuses instantly on contention): every
// caller here (logDecision/supersedeDecision/redactDecision/archiveDecisions)
// must stay fully synchronous (many call sites — cells.mjs's
// resetCellBudget/recordJudgeVerdict — invoke logDecision synchronously
// from inside their OWN already-locked `withStoreLock(cells:<id>, ...)`
// callback, which cannot become async), so this cannot use lock.mjs's async
// withStoreLock. The decisions store's critical sections are small file
// reads/writes (never a child spawn), so a short bounded wait is the right
// shape — an instant refusal would make ordinary concurrent logging flaky
// under the sub-ms-to-tens-of-ms contention this repo's lock doctrine
// expects, not a genuine failure.
const DECISIONS_LOCK_RETRY_ATTEMPTS = 15;
const DECISIONS_LOCK_RETRY_DELAY_MS = 20; // ~300ms worst-case wait, matching acquireGateWithRetry's budget

function sleepSyncMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Typed refusal thrown by withDecisionsLockSync on timeout — never a silent unlocked write. */
export class DecisionsLockBusyError extends Error {
  constructor(holder) {
    const who =
      holder && typeof holder === 'object'
        ? `pid=${holder.pid ?? 'unknown'} session=${holder.session ?? 'unknown'} since ${holder.ts ?? 'unknown'}`
        : 'unknown holder';
    super(`decisions store lock "${DECISIONS_LOCK_NAME}" busy: held by ${who}`);
    this.name = 'DecisionsLockBusyError';
    this.code = 'DECISIONS_LOCK_BUSY';
    this.holder = holder ?? null;
  }
}

// withDecisionsLockSync(root, fn) — run fn() with the decisions store lock
// held, via a bounded synchronous retry loop (see comment above). Always
// releases in `finally`. Throws typed DecisionsLockBusyError after the
// budget is exhausted — never a fall-through unlocked write.
function withDecisionsLockSync(root, fn) {
  let lock = acquireStoreLockOnceSync(root, DECISIONS_LOCK_NAME);
  let attempt = 0;
  while (!lock.acquired && attempt < DECISIONS_LOCK_RETRY_ATTEMPTS) {
    sleepSyncMs(DECISIONS_LOCK_RETRY_DELAY_MS);
    lock = acquireStoreLockOnceSync(root, DECISIONS_LOCK_NAME);
    attempt += 1;
  }
  if (!lock.acquired) {
    throw new DecisionsLockBusyError(lock.holder);
  }
  try {
    return fn();
  } finally {
    lock.release();
  }
}

// writeJsonlAtomic — temp-write+rename the WHOLE active store, for archive's
// prune step. Local to this module (never added to the shared fsutil.mjs,
// which has no jsonl-atomic-rewrite primitive today and is out of this
// cell's file scope) — same atomic-rename shape as fsutil.mjs's own
// writeJsonAtomic, specialized for a jsonl body.
let writeJsonlAtomicCounter = 0;
function writeJsonlAtomic(file, events) {
  ensureDir(path.dirname(file));
  const body = events.map((event) => JSON.stringify(event)).join('\n');
  const unique = `${process.pid}-${(writeJsonlAtomicCounter++).toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
  const tmp = `${file}.${unique}.tmp`;
  fs.writeFileSync(tmp, body.length ? `${body}\n` : '', 'utf8');
  fs.renameSync(tmp, file);
}

// decision-propagation dp-1 (CONTEXT D4a): optional tags[] on a decide
// event, for structured recall alongside the existing free-string `scope`
// (which stays the spec-area dimension — no separate `area` field, fresh-
// eyes P2). Lowercase-slug shape mirrors the repo's existing feature-slug
// convention (worktree-store.mjs's FEATURE_SLUG_RE): one leading alnum,
// then alnum/hyphen.
export const TAG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

// undefined/null tags -> null (event gains NO tags key at all — additive,
// zero-migration parity with the 400+ pre-dp-1 events that never had one).
// Anything else must be a non-empty array of TAG_PATTERN-valid strings.
function normalizeTags(tags) {
  if (tags === undefined || tags === null) return null;
  if (!Array.isArray(tags)) {
    throw new Error('logDecision: tags must be an array of lowercase slugs (e.g. ["billing", "nightly-job"]).');
  }
  const cleaned = tags.map((tag) => String(tag).trim());
  for (const tag of cleaned) {
    if (!TAG_PATTERN.test(tag)) {
      throw new Error(
        `logDecision: tag ${JSON.stringify(tag)} is not a valid lowercase slug (must match ${TAG_PATTERN}).`,
      );
    }
  }
  return cleaned.length ? cleaned : null;
}

function assertSafeContent(field, value) {
  if (typeof value !== 'string' || !value) return;
  for (const pattern of SECRET_CONTENT_PATTERNS) {
    if (pattern.test(value)) {
      throw new Error(
        `Decision rejected: field "${field}" matches a secret pattern (${pattern}). Never log credentials — describe the decision without the secret.`,
      );
    }
  }
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(value)) {
      throw new Error(
        `Decision rejected: field "${field}" contains instruction-like content (${pattern}). Decision text must be data, not instructions.`,
      );
    }
  }
}

function assertSafe(fields) {
  for (const [field, value] of Object.entries(fields)) {
    assertSafeContent(field, value);
  }
}

export function logDecision(
  root,
  { decision, rationale, alternatives = null, scope = 'repo', source = 'user', confidence = null, tags = undefined },
) {
  if (typeof decision !== 'string' || !decision.trim()) {
    throw new Error('logDecision: decision text is required.');
  }
  if (typeof rationale !== 'string' || !rationale.trim()) {
    throw new Error('logDecision: rationale is required.');
  }
  assertSafe({ decision, rationale, alternatives, scope, source });
  const normalizedTags = normalizeTags(tags);

  const event = {
    id: crypto.randomUUID(),
    type: 'decide',
    date: new Date().toISOString(),
    decision: decision.trim(),
    rationale: rationale.trim(),
    alternatives,
    scope,
    source,
    confidence,
  };
  if (normalizedTags) event.tags = normalizedTags;
  // dp-3: the append itself runs under the SAME store lock archiveDecisions
  // holds for its whole read-prune-rewrite transaction — see
  // withDecisionsLockSync's comment above. Either this append lands fully
  // before archive ever reads the file, or fully after archive's rename —
  // never mid-transaction, so no write is ever lost or silently clobbered.
  withDecisionsLockSync(root, () => appendJsonl(decisionsPath(root), event));
  return event;
}

// decision-propagation dp-2 (CONTEXT D2/D3): the propagation sweep. Scans
// docs/** ONLY (D2 pinned root — .bee/spikes/ sits outside docs/ and is
// excluded by construction, no special-case needed) for text files (md,
// json, yaml/yml, txt) citing the superseded decision by its full id or its
// short8 form (the id's first 8 hex chars, e.g. "1178cfce" from a uuid like
// "1178cfce-...") — a \b...\b word-boundary match so a short8 embedded
// inside a longer alnum run (e.g. "abc1178cfcedef") never false-positives.
const SWEEP_TEXT_EXTENSIONS = new Set(['.md', '.json', '.yaml', '.yml', '.txt']);
const SWEEP_EXCERPT_MAX = 160;

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collectSweepFiles(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSweepFiles(full, out);
    } else if (entry.isFile() && SWEEP_TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
}

/**
 * Scan docs/** for citations of a superseded decision id (full id and
 * short8, word-boundary matched). Returns {scanned_at, hit_count, files[]}
 * with one entry per citing LINE: {file (repo-relative), line (1-based),
 * excerpt (trimmed, <=160 chars)}. Never edits the citing files — read-only.
 */
export function sweepDecisionCitations(root, { id, short8 }) {
  const docsRoot = path.join(root, 'docs');
  const candidateFiles = [];
  collectSweepFiles(docsRoot, candidateFiles);

  const idPattern = new RegExp(`\\b${escapeRegExp(id)}\\b`, 'i');
  const shortPattern = new RegExp(`\\b${escapeRegExp(short8)}\\b`, 'i');
  const files = [];
  for (const file of candidateFiles) {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (idPattern.test(line) || shortPattern.test(line)) {
        const trimmed = line.trim();
        const excerpt = trimmed.length > SWEEP_EXCERPT_MAX ? `${trimmed.slice(0, SWEEP_EXCERPT_MAX - 3)}...` : trimmed;
        files.push({ file: path.relative(root, file), line: index + 1, excerpt });
      }
    });
  }
  return { scanned_at: new Date().toISOString(), hit_count: files.length, files };
}

export function supersedeDecision(root, { supersedes, decision, rationale, tags = undefined, scope = undefined }) {
  if (typeof supersedes !== 'string' || !supersedes.trim()) {
    throw new Error('supersedeDecision: supersedes (decision id) is required.');
  }
  if (typeof decision !== 'string' || !decision.trim()) {
    throw new Error('supersedeDecision: replacement decision text is required.');
  }
  if (typeof rationale !== 'string' || !rationale.trim()) {
    throw new Error('supersedeDecision: rationale is required.');
  }
  const targetId = supersedes.trim();
  assertSafe({ decision, rationale });

  // decision-propagation dp-2 (CONTEXT D6): resolve scope/tags — an explicit
  // flag wins; otherwise inherit from the superseded target; a metadata-less
  // target (or a target id not found in the store at all) falls back to
  // scope "repo" and no tags key at all, mirroring logDecision's zero-
  // migration additive shape.
  const events = readJsonl(decisionsPath(root));
  const target = events.find((event) => event && event.id === targetId);

  let resolvedScope;
  if (scope !== undefined && scope !== null && String(scope).trim()) {
    resolvedScope = String(scope).trim();
  } else if (target && typeof target.scope === 'string' && target.scope.trim()) {
    resolvedScope = target.scope.trim();
  } else {
    resolvedScope = 'repo';
  }
  assertSafeContent('scope', resolvedScope);

  let resolvedTags;
  if (tags !== undefined) {
    resolvedTags = normalizeTags(tags);
  } else if (target && Array.isArray(target.tags) && target.tags.length) {
    resolvedTags = normalizeTags(target.tags);
  } else {
    resolvedTags = null;
  }

  // decision-propagation dp-2 (CONTEXT D2, lock doctrine): compute the
  // propagation sweep BEFORE the append below — the event is written to the
  // store exactly once, already carrying the sweep result inline. Never a
  // post-append rewrite of an already-written jsonl line.
  const short8 = targetId.slice(0, 8);
  const sweep = sweepDecisionCitations(root, { id: targetId, short8 });

  const event = {
    id: crypto.randomUUID(),
    type: 'supersede',
    date: new Date().toISOString(),
    supersedes: targetId,
    decision: decision.trim(),
    rationale: rationale.trim(),
    scope: resolvedScope,
    sweep,
  };
  if (resolvedTags) event.tags = resolvedTags;
  // dp-3: the append itself runs under the SAME store lock archiveDecisions
  // holds for its whole read-prune-rewrite transaction — see
  // withDecisionsLockSync's comment above. Either this append lands fully
  // before archive ever reads the file, or fully after archive's rename —
  // never mid-transaction, so no write is ever lost or silently clobbered.
  withDecisionsLockSync(root, () => appendJsonl(decisionsPath(root), event));
  return event;
}

export function redactDecision(root, { redacts, reason }) {
  if (typeof redacts !== 'string' || !redacts.trim()) {
    throw new Error('redactDecision: redacts (decision id) is required.');
  }
  if (typeof reason !== 'string' || !reason.trim()) {
    throw new Error('redactDecision: reason is required.');
  }
  const event = {
    id: crypto.randomUUID(),
    type: 'redact',
    date: new Date().toISOString(),
    redacts: redacts.trim(),
    reason: reason.trim(),
  };
  // dp-3: the append itself runs under the SAME store lock archiveDecisions
  // holds for its whole read-prune-rewrite transaction — see
  // withDecisionsLockSync's comment above. Either this append lands fully
  // before archive ever reads the file, or fully after archive's rename —
  // never mid-transaction, so no write is ever lost or silently clobbered.
  withDecisionsLockSync(root, () => appendJsonl(decisionsPath(root), event));
  return event;
}

/** Typed refusal from archiveDecisions when zero events qualify (never a silent no-op). */
export class DecisionsArchiveNothingQualifiesError extends Error {
  constructor(before) {
    super(
      `archiveDecisions: nothing qualifies for archiving — no superseded/redacted events and no decide events strictly older than ${before} (decision-propagation D4c: --before is explicit or the verb refuses; there is never a default age-based purge).`,
    );
    this.name = 'DecisionsArchiveNothingQualifiesError';
    this.code = 'DECISIONS_ARCHIVE_NOTHING_QUALIFIES';
  }
}

// decision-propagation dp-3 (CONTEXT D4c): moves (1) every superseded/
// redacted event ALWAYS, regardless of age — an event is "superseded" or
// "redacted" the moment some OTHER event's `supersedes`/`redacts` field
// names its id, and such an event is already permanently excluded from
// activeDecisions' result, so relocating it changes nothing observable about
// the active set — and (2) every plain `decide` event strictly older than
// the explicit `before` cutoff, from .bee/decisions.jsonl to
// .bee/decisions-archive.jsonl. `supersede`/`redact` ACTION records
// themselves (the events THAT perform a supersession/redaction) are never
// swept by the age rule — only by rule (1), if some LATER event also
// supersedes/redacts them — so the active file's own audit trail of
// "what superseded what" never ages out silently.
//
// CRASH SAFETY (plan-checker BLOCKER): under the SAME store lock every
// append writer takes (DECISIONS_LOCK_NAME), qualifying events are appended
// to the archive file FIRST, then the pruned active file is written via
// temp-write+rename. A crash between those two steps leaves the same id in
// BOTH files — union reads (activeDecisions({all:true})) de-duplicate by id
// with the ACTIVE copy winning, so recovery is automatic; there is
// deliberately no rename-journal (cells.mjs's journal maps to whole-file
// renames, not jsonl line partitioning — it does not fit this shape).
//
// Refuses (typed DecisionsArchiveNothingQualifiesError) when `before` is
// missing/invalid, or when zero events qualify under either rule — archiving
// is opt-in and explicit, never a default purge, and a no-op call is never
// silently accepted as success (this is also what makes a second run over
// the same cutoff idempotent: nothing new qualifies, so it refuses cleanly
// and leaves both files byte-untouched).
export function archiveDecisions(root, { before } = {}) {
  if (before === undefined || before === null || !String(before).trim()) {
    throw new Error(
      'archiveDecisions: --before <ISO date> is required — decisions archive never runs a default age-based purge (decision-propagation D4c).',
    );
  }
  const beforeStr = String(before).trim();
  const beforeMs = Date.parse(beforeStr);
  if (!Number.isFinite(beforeMs)) {
    throw new Error(`archiveDecisions: --before must be a valid ISO date, got ${JSON.stringify(beforeStr)}.`);
  }

  return withDecisionsLockSync(root, () => {
    const activePath = decisionsPath(root);
    const archivePath = decisionsArchivePath(root);
    const events = readJsonl(activePath);

    const supersededIds = new Set();
    const redactedIds = new Set();
    for (const event of events) {
      if (event && event.type === 'supersede' && event.supersedes) supersededIds.add(event.supersedes);
      if (event && event.type === 'redact' && event.redacts) redactedIds.add(event.redacts);
    }

    const toArchive = [];
    const toKeep = [];
    for (const event of events) {
      if (!event || typeof event !== 'object' || typeof event.id !== 'string') {
        toKeep.push(event); // never drop a malformed-but-parsed line
        continue;
      }
      if (supersededIds.has(event.id) || redactedIds.has(event.id)) {
        toArchive.push(event);
        continue;
      }
      if (event.type === 'decide') {
        const eventMs = Date.parse(event.date);
        if (Number.isFinite(eventMs) && eventMs < beforeMs) {
          toArchive.push(event);
          continue;
        }
      }
      toKeep.push(event);
    }

    if (toArchive.length === 0) {
      throw new DecisionsArchiveNothingQualifiesError(beforeStr);
    }

    // Crash ordering (CONCURRENCY note above): archive-append FIRST.
    ensureDir(path.dirname(archivePath));
    const archiveBody = toArchive.map((event) => JSON.stringify(event)).join('\n');
    fs.appendFileSync(archivePath, `${archiveBody}\n`, 'utf8');

    // Then the pruned active file, as a single atomic temp-write+rename —
    // surviving events are written back VERBATIM (never rewritten/touched).
    writeJsonlAtomic(activePath, toKeep);

    return {
      archived: toArchive.map((event) => event.id),
      kept: toKeep.length,
      before: beforeStr,
    };
  });
}

/**
 * Decide/supersede events not themselves superseded or redacted, newest
 * first. Default (no `all`) is byte-identical to pre-dp-3 behavior — reads
 * ONLY the active store.
 *
 * `all: true` (decision-propagation D4c) additionally unions in
 * .bee/decisions-archive.jsonl (missing/empty archive file is silently
 * treated as "nothing extra"): active events first, then any archived event
 * whose id is not already present in the active file (de-dup by id — the
 * active copy always wins, matching archiveDecisions' crash-ordering note).
 * Superseded/redacted resolution runs over the FULL union, since an archived
 * decide event's supersede/redact record always lives in the active file
 * (dp-3 never archives an action record purely by age). Ordering is sorted
 * explicitly by event date descending (never a positional .reverse() —
 * merging two independently-chronological files cannot rely on file order
 * alone once activity happened before AND after `before` on either side).
 */
export function activeDecisions(root, { recent = null, all = false } = {}) {
  if (!all) {
    const events = readJsonl(decisionsPath(root));
    const superseded = new Set();
    const redacted = new Set();
    for (const event of events) {
      if (event.type === 'supersede' && event.supersedes) superseded.add(event.supersedes);
      if (event.type === 'redact' && event.redacts) redacted.add(event.redacts);
    }
    const active = events
      .filter(
        (event) =>
          (event.type === 'decide' || event.type === 'supersede') &&
          !superseded.has(event.id) &&
          !redacted.has(event.id),
      )
      .reverse();
    return recent != null ? active.slice(0, recent) : active;
  }

  const activeEvents = readJsonl(decisionsPath(root));
  const archivedEvents = readJsonl(decisionsArchivePath(root));
  const byId = new Map();
  for (const event of activeEvents) {
    if (event && typeof event.id === 'string') byId.set(event.id, event);
  }
  for (const event of archivedEvents) {
    if (event && typeof event.id === 'string' && !byId.has(event.id)) byId.set(event.id, event);
  }
  // Indexed BEFORE filtering so same-timestamp ties can break by original
  // position — two events sharing a millisecond-precision date are common
  // (back-to-back logDecision calls). On an unarchived store `events` is
  // exactly `activeEvents` in file (chronological, non-decreasing) order, so
  // "newest date first, ties broken by higher original index first" is
  // mathematically identical to `.reverse()` — this is what makes the `all`
  // path byte-identical to the default path whenever there is nothing in
  // the archive to actually merge in (D4c's byte-identical-for-unarchived
  // requirement), not merely usually-identical.
  const events = [...byId.values()];
  const indexed = events.map((event, idx) => ({ event, idx }));
  const superseded = new Set();
  const redacted = new Set();
  for (const { event } of indexed) {
    if (event.type === 'supersede' && event.supersedes) superseded.add(event.supersedes);
    if (event.type === 'redact' && event.redacts) redacted.add(event.redacts);
  }
  const active = indexed
    .filter(
      ({ event }) =>
        (event.type === 'decide' || event.type === 'supersede') &&
        !superseded.has(event.id) &&
        !redacted.has(event.id),
    )
    .sort((a, b) => {
      const bMs = Date.parse(b.event.date);
      const aMs = Date.parse(a.event.date);
      if (Number.isFinite(aMs) && Number.isFinite(bMs) && aMs !== bMs) return bMs - aMs;
      return b.idx - a.idx; // tie -> later-inserted (higher original index) first, matching .reverse()
    })
    .map(({ event }) => event);
  return recent != null ? active.slice(0, recent) : active;
}

/** Neutralize resurfaced text so it can never act as instructions. */
export function datamark(text) {
  const cleaned = String(text ?? '')
    .replace(/```+/g, '')
    .replace(/<\/?\s*(?:system|assistant|user|developer|tool)\b[^>]*>/gi, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
  return `«${cleaned}»`;
}
